# 第19章：自动化工作流 Agent

> "工作流是 Agent 系统的骨架——它定义了任务如何分解、步骤如何编排、决策如何做出、人工如何介入。"

## 19.1 概述：从脚本到智能编排

自动化工作流 Agent 是将多个 Agent 和工具按照特定逻辑串联起来的编排系统。如果说单个 Agent 是一个"工人"，工作流就是"工厂"——它协调多个工人、管理物料流转、处理异常中断、确保产出质量。

### 19.1.1 工作流 vs. 脚本 vs. Agent

```
                    自主性
                      ▲
                      │
              ┌───────┼───────┐
              │       │       │
           脚本    工作流    Agent
           (确定性) (半自主)  (全自主)
              │       │       │
              │   ┌───┼───┐   │
              │   │       │   │
           固定  条件分支  人工  事件
           顺序  并行     审批   触发
```

| 维度 | 脚本 | 工作流 | Agent |
|------|------|--------|-------|
| 执行路径 | 固定 | 条件分支 | 动态决策 |
| 人工介入 | 无 | 审批节点 | 可协商 |
| 错误处理 | try/catch | 重试/回滚 | 自我修复 |
| 并行能力 | 多线程 | DAG 并行 | 多 Agent 协作 |
| 状态管理 | 无/简单 | 持久化状态 | 记忆系统 |
| 适应性 | 零 | 低 | 高 |

### 19.1.2 工作流 Agent 的核心能力

- **工作流引擎设计**：DAG 有向无环图、状态机、并行执行
- **条件分支**：基于规则或 LLM 判断的动态路由
- **并行执行**：无依赖任务的并发处理
- **人工审批节点**：暂停流程等待人工确认
- **定时任务调度**：Cron 表达式、时间窗口、超时处理
- **事件触发机制**：Webhook、消息队列、状态变更监听

## 19.2 工作流引擎设计

### 19.2.1 核心数据结构

```python
"""
自动化工作流 Agent - 工作流引擎
基于 DAG（有向无环图）的工作流编排系统
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Callable, Any
import json
import time
import uuid
import asyncio
import logging
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


class NodeType(Enum):
    """节点类型"""
    TASK = "task"              # 普通任务节点
    CONDITION = "condition"    # 条件分支节点
    PARALLEL = "parallel"      # 并行网关
    APPROVAL = "approval"      # 人工审批节点
    TIMER = "timer"            # 定时器节点
    EVENT = "event"            # 事件触发节点
    SUB_WORKFLOW = "sub_workflow"  # 子工作流


class ExecutionStatus(Enum):
    """执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    WAITING = "waiting"         # 等待审批/事件
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class BranchStrategy(Enum):
    """并行分支策略"""
    ALL = "all"           # 全部执行（AND）
    ANY = "any"           # 任一成功即可（OR）
    MAJORITY = "majority" # 多数成功


@dataclass
class WorkflowNode:
    """工作流节点"""
    node_id: str
    node_type: NodeType
    name: str
    handler: Optional[Callable] = None          # 执行函数
    handler_name: Optional[str] = None         # handler 的可读名称
    condition: Optional[Callable] = None        # 条件判断函数
    timeout: int = 0                            # 超时秒数，0=无限
    retry_count: int = 0                        # 重试次数
    retry_delay: int = 1                        # 重试间隔（秒）
    inputs: dict = field(default_factory=dict)  # 输入映射
    outputs: dict = field(default_factory=dict) # 输出映射
    metadata: dict = field(default_factory=dict)


@dataclass
class WorkflowEdge:
    """工作流边（连接）"""
    source_id: str
    target_id: str
    condition_name: Optional[str] = None   # 条件分支标识
    condition_expr: Optional[str] = None    # 条件表达式


@dataclass
class NodeResult:
    """节点执行结果"""
    node_id: str
    status: ExecutionStatus
    output: Any = None
    error: Optional[str] = None
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: int = 0
    retry_count: int = 0


class WorkflowContext:
    """工作流执行上下文 - 节点间共享数据"""

    def __init__(self, workflow_id: str):
        self.workflow_id = workflow_id
        self.variables: dict = {}
        self.node_results: dict[str, NodeResult] = {}
        self.start_time: float = time.time()

    def set(self, key: str, value: Any):
        """设置变量"""
        self.variables[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """获取变量"""
        return self.variables.get(key, default)

    def set_node_result(self, node_id: str, result: NodeResult):
        """记录节点结果"""
        self.node_results[node_id] = result
        if result.status == ExecutionStatus.SUCCESS:
            # 自动将输出存入上下文
            if isinstance(result.output, dict):
                for k, v in result.output.items():
                    self.variables[f"{node_id}.{k}"] = v
            else:
                self.variables[node_id] = result.output

    def get_node_result(self, node_id: str) -> Optional[NodeResult]:
        """获取节点结果"""
        return self.node_results.get(node_id)

    def to_dict(self) -> dict:
        """序列化为字典"""
        return {
            "workflow_id": self.workflow_id,
            "variables": {
                k: str(v)[:200] if not isinstance(v, (int, float, bool, type(None)))
                else v
                for k, v in self.variables.items()
            },
            "node_status": {
                nid: result.status.value
                for nid, result in self.node_results.items()
            }
        }
```

### 19.2.2 DAG 工作流引擎

```python
class WorkflowEngine:
    """
    DAG 工作流引擎

    特性:
    - 基于有向无环图的任务编排
    - 条件分支与并行执行
    - 人工审批节点
    - 超时与重试机制
    - 执行上下文共享
    """

    def __init__(self):
        self.nodes: dict[str, WorkflowNode] = {}
        self.edges: list[WorkflowEdge] = []
        self._adjacency: dict[str, list[str]] = defaultdict(list)
        self._reverse_adj: dict[str, list[str]] = defaultdict(list)
        self._listeners: list[Callable] = []

    def add_node(self, node: WorkflowNode) -> 'WorkflowEngine':
        """添加节点（支持链式调用）"""
        self.nodes[node.node_id] = node
        return self

    def add_edge(self, source_id: str, target_id: str,
                 condition_name: Optional[str] = None,
                 condition_expr: Optional[str] = None) -> 'WorkflowEngine':
        """添加边（连接）"""
        edge = WorkflowEdge(source_id, target_id, condition_name, condition_expr)
        self.edges.append(edge)
        self._adjacency[source_id].append(target_id)
        self._reverse_adj[target_id].append(source_id)
        return self

    def on_event(self, listener: Callable):
        """注册事件监听器"""
        self._listeners.append(listener)
        return self

    def _emit(self, event_type: str, data: dict = None):
        """触发事件"""
        for listener in self._listeners:
            try:
                listener(event_type, data or {})
            except Exception as e:
                logger.error(f"事件监听器异常: {e}")

    def _get_start_nodes(self) -> list[str]:
        """获取起始节点（没有入边的节点）"""
        all_targets = set()
        for edge in self.edges:
            all_targets.add(edge.target_id)
        return [nid for nid in self.nodes if nid not in all_targets]

    def _get_next_nodes(self, node_id: str) -> list[tuple[str, Optional[str]]]:
        """获取后续节点及其条件标识"""
        result = []
        for edge in self.edges:
            if edge.source_id == node_id:
                result.append((edge.target_id, edge.condition_name))
        return result

    def _get_ready_nodes(self, context: WorkflowContext) -> list[str]:
        """获取可以执行的节点（所有前置节点已完成）"""
        ready = []
        completed_ids = {
            nid for nid, r in context.node_results.items()
            if r.status in (ExecutionStatus.SUCCESS, ExecutionStatus.SKIPPED)
        }

        for node_id in self.nodes:
            if node_id in context.node_results:
                continue  # 已执行过

            # 检查所有前置节点是否完成
            predecessors = self._reverse_adj.get(node_id, [])
            if all(pid in completed_ids for pid in predecessors):
                # 检查前置节点是否有失败
                all_success = all(
                    context.node_results[pid].status == ExecutionStatus.SUCCESS
                    for pid in predecessors
                )
                if all_success or not predecessors:
                    ready.append(node_id)

        return ready

    def _validate_dag(self) -> bool:
        """验证是否为有效的 DAG（无环）"""
        visited = set()
        path = set()

        def dfs(node_id: str) -> bool:
            if node_id in path:
                return False  # 发现环
            if node_id in visited:
                return True
            visited.add(node_id)
            path.add(node_id)
            for neighbor in self._adjacency.get(node_id, []):
                if not dfs(neighbor):
                    return False
            path.remove(node_id)
            return True

        for node_id in self.nodes:
            if node_id not in visited:
                if not dfs(node_id):
                    return False
        return True

    async def execute(self, workflow_id: Optional[str] = None,
                      initial_data: Optional[dict] = None,
                      max_parallel: int = 5) -> WorkflowContext:
        """
        执行工作流

        Args:
            workflow_id: 工作流实例 ID
            initial_data: 初始数据
            max_parallel: 最大并行数

        Returns:
            WorkflowContext 包含完整执行结果
        """
        wid = workflow_id or str(uuid.uuid4())[:8]
        ctx = WorkflowContext(wid)

        if initial_data:
            for k, v in initial_data.items():
                ctx.set(k, v)

        if not self._validate_dag():
            ctx.set("error", "工作流包含循环，无法执行")
            self._emit("workflow_failed", {"workflow_id": wid, "error": "循环检测失败"})
            return ctx

        self._emit("workflow_started", {"workflow_id": wid})

        # 使用信号量控制并行度
        semaphore = asyncio.Semaphore(max_parallel)

        while True:
            ready = self._get_ready_nodes(ctx)
            if not ready:
                break

            async def run_node(node_id: str):
                async with semaphore:
                    return await self._execute_node(ctx, node_id)

            # 并行执行就绪节点
            results = await asyncio.gather(
                *[run_node(nid) for nid in ready], return_exceptions=True
            )

            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"节点执行异常: {result}")

        # 检查是否所有节点都完成
        total = len(self.nodes)
        done = len(ctx.node_results)
        success = sum(1 for r in ctx.node_results.values()
                     if r.status == ExecutionStatus.SUCCESS)

        self._emit("workflow_completed", {
            "workflow_id": wid,
            "total_nodes": total,
            "completed": done,
            "success": success
        })

        return ctx

    async def _execute_node(self, ctx: WorkflowContext, node_id: str) -> NodeResult:
        """执行单个节点"""
        node = self.nodes.get(node_id)
        if not node:
            return NodeResult(node_id, ExecutionStatus.FAILED, error="节点不存在")

        self._emit("node_started", {"workflow_id": ctx.workflow_id, "node_id": node_id})

        start = time.time()
        result = NodeResult(node_id, ExecutionStatus.RUNNING, start_time=start)

        # 根据节点类型执行
        try:
            if node.node_type == NodeType.CONDITION:
                output = await self._execute_condition(ctx, node)
            elif node.node_type == NodeType.APPROVAL:
                output = await self._execute_approval(ctx, node)
            elif node.node_type == NodeType.TIMER:
                output = await self._execute_timer(ctx, node)
            else:
                output = await self._execute_task(ctx, node)

            result.status = ExecutionStatus.SUCCESS
            result.output = output

        except asyncio.TimeoutError:
            result.status = ExecutionStatus.TIMEOUT
            result.error = f"节点执行超时 ({node.timeout}s)"
        except Exception as e:
            result.status = ExecutionStatus.FAILED
            result.error = str(e)

        result.end_time = time.time()
        result.duration_ms = int((result.end_time - result.start_time) * 1000)
        ctx.set_node_result(node_id, result)

        self._emit("node_completed", {
            "workflow_id": ctx.workflow_id,
            "node_id": node_id,
            "status": result.status.value,
            "duration_ms": result.duration_ms
        })

        return result

    async def _execute_task(self, ctx: WorkflowContext,
                             node: WorkflowNode) -> Any:
        """执行普通任务节点（含重试）"""
        if not node.handler:
            return None

        last_error = None
        for attempt in range(node.retry_count + 1):
            try:
                if asyncio.iscoroutinefunction(node.handler):
                    return await asyncio.wait_for(
                        node.handler(ctx), timeout=node.timeout or None)
                else:
                    loop = asyncio.get_event_loop()
                    return await asyncio.wait_for(
                        loop.run_in_executor(None, node.handler, ctx),
                        timeout=node.timeout or None)
            except asyncio.TimeoutError:
                raise
            except Exception as e:
                last_error = e
                if attempt < node.retry_count:
                    logger.warning(f"节点 {node.node_id} 第 {attempt+1} 次重试: {e}")
                    await asyncio.sleep(node.retry_delay)

        raise last_error

    async def _execute_condition(self, ctx: WorkflowContext,
                                  node: WorkflowNode) -> str:
        """执行条件分支 - 返回匹配的分支名称"""
        if node.condition:
            result = node.condition(ctx)
            if asyncio.iscoroutine(result):
                result = await result
            return str(result)

        # 根据后续边的条件表达式判断
        for edge in self.edges:
            if edge.source_id != node.node_id:
                continue
            if edge.condition_expr:
                try:
                    # 简单的条件表达式求值
                    if eval(edge.condition_expr, {"ctx": ctx, **ctx.variables}):
                        return edge.condition_name or edge.target_id
                except Exception:
                    continue
        return "default"

    async def _execute_approval(self, ctx: WorkflowContext,
                                 node: WorkflowNode) -> Any:
        """执行人工审批节点 - 阻塞等待审批结果"""
        # 实际实现中，这里会将工作流状态持久化并等待外部回调
        approval_key = f"approval.{node.node_id}"
        approved = ctx.get(approval_key)

        if approved is None:
            # 模拟等待审批
            self._emit("approval_requested", {
                "workflow_id": ctx.workflow_id,
                "node_id": node.node_id,
                "node_name": node.name
            })

            # 在真实系统中，这里会暂停并等待外部 API 回调
            # 演示中设置为等待状态
            raise RuntimeError(
                f"审批节点 '{node.name}' 等待人工审批。"
                f"请调用 ctx.set('{approval_key}', True/False) 后恢复。"
            )

        if not approved:
            raise RuntimeError(f"审批被拒绝: {node.name}")
        return {"approved": True}

    async def _execute_timer(self, ctx: WorkflowContext,
                              node: WorkflowNode) -> Any:
        """执行定时器节点"""
        delay = node.metadata.get("delay_seconds", 0)
        cron = node.metadata.get("cron_expression")

        if delay > 0:
            await asyncio.sleep(delay)
        elif cron:
            # 简单的 Cron 解析（生产环境建议使用 APScheduler）
            import re as _re
            m = _re.match(r'(\d+)\s*(s|m|h)', cron)
            if m:
                value, unit = int(m.group(1)), m.group(2)
                seconds = value * {"s": 1, "m": 60, "h": 3600}[unit]
                await asyncio.sleep(seconds)

        return {"fired_at": time.time()}
```

## 19.3 条件分支与并行执行

### 19.3.1 工作流 DSL（领域特定语言）

为了让工作流定义更直观，我们设计一个简洁的 DSL：

```python
"""
工作流 DSL - 流畅的链式 API 定义工作流
"""

class WorkflowBuilder:
    """工作流构建器 - 提供流畅的链式 API"""

    def __init__(self, name: str = ""):
        self.engine = WorkflowEngine()
        self.name = name
        self._current_node: Optional[str] = None

    def task(self, node_id: str, name: str, handler: Callable,
             timeout: int = 0, retry: int = 0, retry_delay: int = 1,
             **metadata) -> 'WorkflowBuilder':
        """添加任务节点"""
        node = WorkflowNode(
            node_id=node_id, node_type=NodeType.TASK,
            name=name, handler=handler,
            timeout=timeout, retry_count=retry,
            retry_delay=retry_delay, metadata=metadata
        )
        self.engine.add_node(node)
        self._current_node = node_id
        return self

    def condition(self, node_id: str, name: str,
                  condition_fn: Callable) -> 'WorkflowBuilder':
        """添加条件分支节点"""
        node = WorkflowNode(
            node_id=node_id, node_type=NodeType.CONDITION,
            name=name, condition=condition_fn
        )
        self.engine.add_node(node)
        self._current_node = node_id
        return self

    def parallel(self, node_id: str, name: str,
                 strategy: BranchStrategy = BranchStrategy.ALL) -> 'WorkflowBuilder':
        """添加并行网关节点"""
        node = WorkflowNode(
            node_id=node_id, node_type=NodeType.PARALLEL,
            name=name, metadata={"strategy": strategy.value}
        )
        self.engine.add_node(node)
        self._current_node = node_id
        return self

    def approval(self, node_id: str, name: str,
                 approver: Optional[str] = None) -> 'WorkflowBuilder':
        """添加人工审批节点"""
        node = WorkflowNode(
            node_id=node_id, node_type=NodeType.APPROVAL,
            name=name, metadata={"approver": approver}
        )
        self.engine.add_node(node)
        self._current_node = node_id
        return self

    def timer(self, node_id: str, name: str, delay: int = 0,
              cron: Optional[str] = None) -> 'WorkflowBuilder':
        """添加定时器节点"""
        node = WorkflowNode(
            node_id=node_id, node_type=NodeType.TIMER,
            name=name, metadata={"delay_seconds": delay, "cron_expression": cron}
        )
        self.engine.add_node(node)
        self._current_node = node_id
        return self

    def edge(self, from_id: str, to_id: str,
             condition: Optional[str] = None) -> 'WorkflowBuilder':
        """添加连接"""
        self.engine.add_edge(from_id, to_id, condition_name=condition)
        return self

    def then(self, to_id: str, condition: Optional[str] = None) -> 'WorkflowBuilder':
        """从当前节点连接到目标节点"""
        if self._current_node:
            self.edge(self._current_node, to_id, condition)
        self._current_node = to_id
        return self

    def build(self) -> WorkflowEngine:
        """构建并返回引擎"""
        if not self.engine._validate_dag():
            raise ValueError("工作流包含循环依赖")
        return self.engine


# ==================== 示例：订单处理工作流 ====================

def build_order_workflow() -> WorkflowEngine:
    """构建一个完整的订单处理工作流"""

    async def validate_order(ctx: WorkflowContext):
        """验证订单"""
        order = ctx.get("order", {})
        if not order.get("items"):
            raise ValueError("订单为空")
        if not order.get("customer_id"):
            raise ValueError("缺少客户信息")
        ctx.set("order_valid", True)
        return {"valid": True, "item_count": len(order["items"])}

    async def check_inventory(ctx: WorkflowContext):
        """检查库存"""
        order = ctx.get("order", {})
        in_stock = True
        for item in order.get("items", []):
            # 模拟库存检查
            if item.get("quantity", 0) > 1000:
                in_stock = False
                break
        ctx.set("in_stock", in_stock)
        return {"in_stock": in_stock}

    async def process_payment(ctx: WorkflowContext):
        """处理支付"""
        order = ctx.get("order", {})
        amount = sum(i.get("price", 0) * i.get("quantity", 1)
                     for i in order.get("items", []))
        # 模拟支付
        ctx.set("payment_id", f"pay_{uuid.uuid4().hex[:8]}")
        return {"payment_id": ctx.get("payment_id"), "amount": amount}

    async def reserve_inventory(ctx: WorkflowContext):
        """预留库存"""
        await asyncio.sleep(0.1)  # 模拟处理时间
        return {"reserved": True}

    async def create_shipment(ctx: WorkflowContext):
        """创建发货单"""
        await asyncio.sleep(0.1)
        return {"shipment_id": f"ship_{uuid.uuid4().hex[:8]}"}

    async def send_confirmation(ctx: WorkflowContext):
        """发送确认通知"""
        return {"notification_sent": True}

    def route_by_stock(ctx: WorkflowContext) -> str:
        """根据库存状况路由"""
        return "in_stock" if ctx.get("in_stock") else "out_of_stock"

    async def handle_out_of_stock(ctx: WorkflowContext):
        """处理缺货"""
        return {"status": "backordered", "message": "商品缺货，已加入等待列表"}

    builder = WorkflowBuilder(name="订单处理流程")
    builder.task("start", "开始", lambda ctx: {"started": True}) \
           .then("validate", condition=None)
    builder.task("validate", "验证订单", validate_order, timeout=30, retry=2) \
           .then("check_stock", condition=None)
    builder.task("check_stock", "检查库存", check_inventory) \
           .then("route", condition=None)
    builder.condition("route", "库存路由", route_by_stock)
    builder.task("process_payment", "处理支付", process_payment, timeout=60, retry=3)
    builder.task("reserve", "预留库存", reserve_inventory)
    builder.task("ship", "创建发货", create_shipment)
    builder.task("notify", "发送通知", send_confirmation)
    builder.task("out_of_stock", "缺货处理", handle_out_of_stock)

    # 构建边
    builder.edge("route", "process_payment", "in_stock")
    builder.edge("route", "out_of_stock", "out_of_stock")
    builder.edge("process_payment", "reserve")
    builder.edge("process_payment", "ship")       # 与 reserve 并行
    builder.edge("reserve", "notify")
    builder.edge("ship", "notify")
    builder.edge("out_of_stock", "notify")

    return builder.build()
```

### 19.3.2 并行执行与合并

```python
"""
并行执行模式 - Fan-out / Fan-in
"""

class ParallelExecutor:
    """并行执行器"""

    @staticmethod
    async def fan_out(tasks: list[Callable], context: WorkflowContext,
                      strategy: BranchStrategy = BranchStrategy.ALL,
                      max_parallel: int = 5) -> dict:
        """
        Fan-out: 并行执行多个任务

        Args:
            tasks: 任务列表 [(task_id, callable), ...]
            context: 共享上下文
            strategy: 分支策略
            max_parallel: 最大并行数
        """
        semaphore = asyncio.Semaphore(max_parallel)
        results = {}

        async def run_task(task_id: str, task_fn: Callable):
            async with semaphore:
                try:
                    if asyncio.iscoroutinefunction(task_fn):
                        result = await task_fn(context)
                    else:
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(
                            None, task_fn, context)
                    results[task_id] = {"status": "success", "output": result}
                except Exception as e:
                    results[task_id] = {"status": "failed", "error": str(e)}

        await asyncio.gather(*[
            run_task(tid, fn) for tid, fn in tasks
        ])

        # 根据策略判断整体结果
        success_count = sum(1 for r in results.values() if r["status"] == "success")
        total = len(results)

        if strategy == BranchStrategy.ALL:
            overall = success_count == total
        elif strategy == BranchStrategy.ANY:
            overall = success_count > 0
        else:  # MAJORITY
            overall = success_count > total // 2

        return {
            "results": results,
            "success_count": success_count,
            "total": total,
            "overall_success": overall
        }

    @staticmethod
    async def fan_in(context: WorkflowContext, task_ids: list[str],
                     merge_fn: Optional[Callable] = None) -> Any:
        """
        Fan-in: 收集并行任务结果并合并

        Args:
            context: 工作流上下文
            task_ids: 要收集结果的节点 ID 列表
            merge_fn: 自定义合并函数
        """
        collected = {}
        for tid in task_ids:
            result = context.get_node_result(tid)
            if result:
                collected[tid] = result.output

        if merge_fn:
            return merge_fn(collected)

        # 默认合并策略
        if all(isinstance(v, dict) for v in collected.values()):
            merged = {}
            for v in collected.values():
                merged.update(v)
            return merged
        return collected
```

## 19.4 人工审批节点

### 19.4.1 审批系统

```python
"""
人工审批系统 - 工作流中的暂停与恢复
"""

from datetime import datetime


@dataclass
class ApprovalRequest:
    """审批请求"""
    request_id: str
    workflow_id: str
    node_id: str
    node_name: str
    requester: str
    approver: str
    request_data: dict = field(default_factory=dict)
    status: str = "pending"        # pending / approved / rejected
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved_at: Optional[str] = None
    comment: str = ""


class ApprovalManager:
    """审批管理器"""

    def __init__(self):
        self.pending: dict[str, ApprovalRequest] = {}    # request_id -> request
        self.resolved: list[ApprovalRequest] = []
        self._callbacks: dict[str, Callable] = {}         # request_id -> callback

    def request_approval(self, workflow_id: str, node_id: str,
                          node_name: str, requester: str,
                          approver: str, data: dict = None,
                          callback: Optional[Callable] = None) -> str:
        """
        发起审批请求

        Args:
            callback: 审批完成后的回调函数（用于恢复工作流）
        """
        request_id = f"apr_{uuid.uuid4().hex[:8]}"
        request = ApprovalRequest(
            request_id=request_id,
            workflow_id=workflow_id,
            node_id=node_id,
            node_name=node_name,
            requester=requester,
            approver=approver,
            request_data=data or {}
        )

        self.pending[request_id] = request
        if callback:
            self._callbacks[request_id] = callback

        logger.info(f"审批请求已创建: {request_id} ({node_name}) → {approver}")
        return request_id

    def approve(self, request_id: str, approver: str,
                comment: str = "") -> bool:
        """批准审批"""
        request = self.pending.get(request_id)
        if not request:
            return False

        request.status = "approved"
        request.approver = approver
        request.comment = comment
        request.resolved_at = datetime.now().isoformat()

        self.resolved.append(request)
        del self.pending[request_id]

        # 触发回调恢复工作流
        callback = self._callbacks.pop(request_id, None)
        if callback:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(True, comment))
                else:
                    callback(True, comment)
            except Exception as e:
                logger.error(f"审批回调执行失败: {e}")

        return True

    def reject(self, request_id: str, approver: str,
               comment: str = "") -> bool:
        """拒绝审批"""
        request = self.pending.get(request_id)
        if not request:
            return False

        request.status = "rejected"
        request.approver = approver
        request.comment = comment
        request.resolved_at = datetime.now().isoformat()

        self.resolved.append(request)
        del self.pending[request_id]

        callback = self._callbacks.pop(request_id, None)
        if callback:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(False, comment))
                else:
                    callback(False, comment)
            except Exception as e:
                logger.error(f"审批回调执行失败: {e}")

        return True

    def get_pending_list(self, approver: Optional[str] = None) -> list[dict]:
        """获取待审批列表"""
        requests = list(self.pending.values())
        if approver:
            requests = [r for r in requests if r.approver == approver]
        return [
            {
                "request_id": r.request_id,
                "workflow_id": r.workflow_id,
                "node_name": r.node_name,
                "requester": r.requester,
                "created_at": r.created_at,
                "data_summary": str(r.request_data)[:100]
            }
            for r in requests
        ]

    def get_stats(self) -> dict:
        """获取审批统计"""
        total_approved = sum(1 for r in self.resolved if r.status == "approved")
        total_rejected = sum(1 for r in self.resolved if r.status == "rejected")
        return {
            "pending": len(self.pending),
            "approved": total_approved,
            "rejected": total_rejected,
            "approval_rate": (
                total_approved / max(total_approved + total_rejected, 1) * 100
            )
        }
```

## 19.5 定时任务调度

### 19.5.1 调度引擎

```python
"""
定时任务调度引擎
支持 Cron 表达式、固定间隔和一次性延迟
"""

import re
from datetime import datetime, timedelta


@dataclass
class ScheduledJob:
    """调度任务"""
    job_id: str
    name: str
    handler: Callable
    cron_expression: Optional[str] = None   # Cron 表达式
    interval_seconds: int = 0               # 固定间隔（秒）
    run_at: Optional[str] = None             # 一次性执行时间
    max_retries: int = 3
    timeout: int = 300
    enabled: bool = True
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    run_count: int = 0
    fail_count: int = 0


class CronParser:
    """Cron 表达式解析器（简化版）

    支持格式: 分 时 日 月 星期
    示例: "0 9 * * 1-5" (工作日每天9点)
    """

    FIELD_NAMES = ["minute", "hour", "day_of_month", "month", "day_of_week"]

    @classmethod
    def parse(cls, expression: str) -> dict:
        """解析 Cron 表达式为字段配置"""
        parts = expression.strip().split()
        if len(parts) != 5:
            raise ValueError(f"Cron 表达式需要5个字段，得到 {len(parts)} 个")

        config = {}
        for name, part in zip(cls.FIELD_NAMES, parts):
            config[name] = cls._parse_field(part)
        return config

    @classmethod
    def _parse_field(cls, field: str) -> list[int]:
        """解析单个 Cron 字段"""
        values = set()
        for part in field.split(","):
            if part == "*":
                values.update(range(0, 60 if "minute" in field else 24))
            elif "/" in part:
                range_part, step = part.split("/")
                step = int(step)
                if range_part == "*":
                    values.update(range(0, 60, step))
                elif "-" in range_part:
                    start, end = map(int, range_part.split("-"))
                    values.update(range(start, end + 1, step))
            elif "-" in part:
                start, end = map(int, part.split("-"))
                values.update(range(start, end + 1))
            else:
                values.add(int(part))
        return sorted(values)

    @classmethod
    def should_run(cls, expression: str) -> bool:
        """判断当前是否应该执行"""
        try:
            config = cls.parse(expression)
        except ValueError:
            return False

        now = datetime.now()
        checks = [
            (now.minute, config["minute"]),
            (now.hour, config["hour"]),
            (now.day, config["day_of_month"]),
            (now.month, config["month"]),
            (now.weekday(), config["day_of_week"]),
        ]
        return all(val in allowed for val, allowed in checks)

    @classmethod
    def next_run_time(cls, expression: str) -> str:
        """计算下次执行时间（简化实现）"""
        now = datetime.now()
        # 每分钟检查一次，找到最近的匹配时间
        check = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        for _ in range(525600):  # 最多查找一年
            if cls._matches_time(check, expression):
                return check.isoformat()
            check += timedelta(minutes=1)
        return now.isoformat()

    @classmethod
    def _matches_time(cls, dt: datetime, expression: str) -> bool:
        """检查时间是否匹配 Cron 表达式"""
        try:
            config = cls.parse(expression)
        except ValueError:
            return False
        return (dt.minute in config["minute"]
                and dt.hour in config["hour"]
                and dt.day in config["day_of_month"]
                and dt.month in config["month"]
                and dt.weekday() in config["day_of_week"])


class SchedulerEngine:
    """调度引擎"""

    def __init__(self):
        self.jobs: dict[str, ScheduledJob] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def add_job(self, job: ScheduledJob) -> 'SchedulerEngine':
        """添加调度任务"""
        self.jobs[job.job_id] = job
        # 计算下次执行时间
        if job.cron_expression:
            job.next_run = CronParser.next_run_time(job.cron_expression)
        return self

    def remove_job(self, job_id: str) -> bool:
        """移除调度任务"""
        if job_id in self.jobs:
            del self.jobs[job_id]
            return True
        return False

    def enable_job(self, job_id: str, enabled: bool = True):
        """启用/禁用任务"""
        if job_id in self.jobs:
            self.jobs[job_id].enabled = enabled

    async def start(self, check_interval: int = 60):
        """
        启动调度器

        Args:
            check_interval: 检查间隔（秒）
        """
        self._running = True
        logger.info(f"调度器已启动，检查间隔: {check_interval}s")

        while self._running:
            now = datetime.now().isoformat()

            for job in self.jobs.values():
                if not job.enabled:
                    continue
                if job.next_run and now >= job.next_run:
                    await self._execute_job(job)

            await asyncio.sleep(check_interval)

    async def stop(self):
        """停止调度器"""
        self._running = False
        if self._task:
            self._task.cancel()

    async def _execute_job(self, job: ScheduledJob):
        """执行调度任务"""
        logger.info(f"执行调度任务: {job.name} ({job.job_id})")
        job.last_run = datetime.now().isoformat()
        job.run_count += 1

        try:
            if asyncio.iscoroutinefunction(job.handler):
                await asyncio.wait_for(
                    job.handler(), timeout=job.timeout or None)
            else:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, job.handler)

            # 更新下次执行时间
            if job.cron_expression:
                job.next_run = CronParser.next_run_time(job.cron_expression)

        except asyncio.TimeoutError:
            job.fail_count += 1
            logger.error(f"任务 {job.name} 超时")
        except Exception as e:
            job.fail_count += 1
            logger.error(f"任务 {job.name} 执行失败: {e}")

    def get_status(self) -> dict:
        """获取调度器状态"""
        return {
            "running": self._running,
            "total_jobs": len(self.jobs),
            "enabled_jobs": sum(1 for j in self.jobs.values() if j.enabled),
            "jobs": [
                {
                    "id": j.job_id, "name": j.name,
                    "enabled": j.enabled,
                    "cron": j.cron_expression,
                    "last_run": j.last_run,
                    "next_run": j.next_run,
                    "run_count": j.run_count,
                    "fail_count": j.fail_count
                }
                for j in self.jobs.values()
            ]
        }
```

## 19.6 事件触发机制

### 19.6.1 事件总线

```python
"""
事件总线 - 工作流的事件触发与响应机制
"""

from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class Event:
    """事件"""
    event_id: str
    event_type: str
    source: str
    payload: dict = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: dict = field(default_factory=dict)


class EventBus:
    """事件总线 - 发布/订阅模式"""

    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)
        self._event_history: list[Event] = []
        self._max_history: int = 1000

    def subscribe(self, event_type: str, handler: Callable) -> 'EventBus':
        """订阅事件（支持通配符 *）"""
        self._subscribers[event_type].append(handler)
        return self

    def unsubscribe(self, event_type: str, handler: Callable):
        """取消订阅"""
        if event_type in self._subscribers:
            self._subscribers[event_type] = [
                h for h in self._subscribers[event_type] if h != handler
            ]

    async def publish(self, event_type: str, source: str,
                      payload: dict = None, metadata: dict = None) -> list:
        """
        发布事件

        Returns:
            所有处理器的返回值列表
        """
        event = Event(
            event_id=f"evt_{uuid.uuid4().hex[:8]}",
            event_type=event_type,
            source=source,
            payload=payload or {},
            metadata=metadata or {}
        )

        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]

        results = []
        handlers = (self._subscribers.get(event_type, []) +
                    self._subscribers.get("*", []))

        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    result = await handler(event)
                else:
                    result = handler(event)
                results.append(result)
            except Exception as e:
                logger.error(f"事件处理器异常 [{event_type}]: {e}")
                results.append({"error": str(e)})

        return results

    def get_history(self, event_type: Optional[str] = None,
                    limit: int = 50) -> list[dict]:
        """获取事件历史"""
        events = self._event_history
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [
            {
                "event_id": e.event_id,
                "event_type": e.event_type,
                "source": e.source,
                "timestamp": e.timestamp,
                "payload_keys": list(e.payload.keys())
            }
            for e in events[-limit:]
        ]
```

### 19.6.2 事件驱动的 Webhook 触发器

```python
"""
Webhook 触发器 - 接收外部 HTTP 回调触发工作流
"""

@dataclass
class WebhookEndpoint:
    """Webhook 端点"""
    endpoint_id: str
    path: str
    secret: Optional[str] = None
    workflow_name: Optional[str] = None
    event_type: str = "webhook.triggered"
    enabled: bool = True
    call_count: int = 0
    last_called: Optional[str] = None


class WebhookManager:
    """Webhook 管理器"""

    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.endpoints: dict[str, WebhookEndpoint] = {}

    def register(self, path: str, secret: Optional[str] = None,
                 workflow_name: Optional[str] = None) -> str:
        """注册 Webhook 端点"""
        endpoint_id = f"wh_{uuid.uuid4().hex[:8]}"
        self.endpoints[endpoint_id] = WebhookEndpoint(
            endpoint_id=endpoint_id,
            path=path,
            secret=secret,
            workflow_name=workflow_name
        )
        return endpoint_id

    async def handle_request(self, path: str, payload: dict,
                              signature: Optional[str] = None) -> dict:
        """
        处理 Webhook 请求

        在实际应用中，这通常由 HTTP 框架（FastAPI/Flask）的路由处理函数调用。
        """
        # 查找匹配的端点
        endpoint = None
        for ep in self.endpoints.values():
            if ep.path == path and ep.enabled:
                endpoint = ep
                break

        if not endpoint:
            return {"success": False, "error": "未找到匹配的端点"}

        # 验证签名
        if endpoint.secret and signature:
            import hmac
            import hashlib
            expected = hmac.new(
                endpoint.secret.encode(),
                json.dumps(payload, sort_keys=True).encode(),
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return {"success": False, "error": "签名验证失败"}

        # 更新统计
        endpoint.call_count += 1
        endpoint.last_called = datetime.now().isoformat()

        # 发布事件
        await self.event_bus.publish(
            event_type=endpoint.event_type,
            source=f"webhook:{endpoint.endpoint_id}",
            payload=payload,
            metadata={"workflow_name": endpoint.workflow_name, "path": path}
        )

        return {"success": True, "endpoint_id": endpoint.endpoint_id}

    def list_endpoints(self) -> list[dict]:
        """列出所有端点"""
        return [
            {
                "id": ep.endpoint_id,
                "path": ep.path,
                "workflow": ep.workflow_name,
                "enabled": ep.enabled,
                "calls": ep.call_count,
                "last_called": ep.last_called
            }
            for ep in self.endpoints.values()
        ]
```

## 19.7 完整集成：自动化工作流 Agent

### 19.7.1 统一工作流编排器

```python
"""
自动化工作流 Agent - 完整集成
"""

class WorkflowAgent:
    """
    自动化工作流 Agent - 统一入口

    使用示例:
        agent = WorkflowAgent()
        agent.define_workflow("daily_report", builder)
        await agent.start()
    """

    def __init__(self):
        self.engines: dict[str, WorkflowEngine] = {}
        self.approval_mgr = ApprovalManager()
        self.scheduler = SchedulerEngine()
        self.event_bus = EventBus()
        self.webhook_mgr = WebhookManager(self.event_bus)

    def define_workflow(self, name: str, engine: WorkflowEngine):
        """注册工作流"""
        self.engines[name] = engine

    def define_workflow_from_builder(self, name: str,
                                      builder: WorkflowBuilder):
        """通过 Builder 注册工作流"""
        self.engines[name] = builder.build()

    async def run_workflow(self, name: str,
                            initial_data: Optional[dict] = None) -> WorkflowContext:
        """运行指定工作流"""
        engine = self.engines.get(name)
        if not engine:
            raise ValueError(f"工作流 '{name}' 不存在")
        return await engine.execute(initial_data=initial_data)

    async def start(self):
        """启动调度器和事件监听"""
        # 注册事件处理：Webhook 触发工作流
        self.event_bus.subscribe("webhook.triggered", self._on_webhook_trigger)

        # 启动调度器
        asyncio.create_task(self.scheduler.start(check_interval=30))

    async def stop(self):
        """停止所有服务"""
        await self.scheduler.stop()

    async def _on_webhook_trigger(self, event: Event):
        """Webhook 事件处理"""
        workflow_name = event.metadata.get("workflow_name")
        if workflow_name and workflow_name in self.engines:
            await self.run_workflow(workflow_name, initial_data=event.payload)
            logger.info(f"Webhook 触发工作流: {workflow_name}")

    def get_dashboard(self) -> dict:
        """获取工作流仪表板数据"""
        return {
            "workflows": list(self.engines.keys()),
            "scheduler": self.scheduler.get_status(),
            "approvals": self.approval_mgr.get_stats(),
            "webhooks": self.webhook_mgr.list_endpoints(),
            "recent_events": self.event_bus.get_history(limit=10)
        }
```

### 19.7.2 端到端示例

```python
"""
端到端使用示例 - 内容发布工作流
"""

import asyncio


async def demo_workflow():
    """演示完整的工作流编排"""

    # 定义任务函数
    async def generate_content(ctx: WorkflowContext):
        ctx.set("content", "AI生成的文章内容...")
        return {"content_length": 100}

    async def review_content(ctx: WorkflowContext):
        # 模拟 LLM 审核内容质量
        content = ctx.get("content", "")
        score = min(100, 50 + len(content) // 2)
        ctx.set("quality_score", score)
        return {"score": score}

    async def optimize_seo(ctx: WorkflowContext):
        return {"keywords": ["AI", "自动化"], "optimized": True}

    async def check_compliance(ctx: WorkflowContext):
        return {"compliant": True, "issues": []}

    def needs_revision(ctx: WorkflowContext) -> str:
        return "revise" if ctx.get("quality_score", 0) < 70 else "publish"

    async def revise_content(ctx: WorkflowContext):
        ctx.set("content", ctx.get("content", "") + "（已修订）")
        return {"revised": True}

    async def publish_article(ctx: WorkflowContext):
        return {"published": True, "url": "/articles/123"}

    async def notify_author(ctx: WorkflowContext):
        return {"notification_sent": True}

    # 构建工作流
    builder = WorkflowBuilder(name="内容发布流程")
    builder.task("generate", "生成内容", generate_content) \
           .then("review", condition=None)
    builder.task("review", "质量审核", review_content) \
           .then("quality_gate", condition=None)
    builder.condition("quality_gate", "质量门槛", needs_revision)
    builder.task("revise", "修订内容", revise_content) \
           .then("review")  # 修订后重新审核
    builder.task("seo", "SEO优化", optimize_seo)
    builder.task("compliance", "合规检查", check_compliance)
    builder.task("publish", "发布文章", publish_article)
    builder.task("notify", "通知作者", notify_author)

    # 路由
    builder.edge("quality_gate", "seo", "publish")
    builder.edge("quality_gate", "revise", "revise")
    builder.edge("seo", "compliance")
    builder.edge("compliance", "publish")
    builder.edge("publish", "notify")

    engine = builder.build()

    # 创建 Agent
    agent = WorkflowAgent()
    agent.define_workflow("content_publish", engine)

    # 添加事件监听
    agent.event_bus.subscribe("*", lambda e: print(
        f"  [事件] {e.event_type} from {e.source}"))

    # 运行工作流
    print("=== 运行内容发布工作流 ===")
    ctx = await agent.run_workflow("content_publish", {
        "topic": "AI工作流",
        "author": "张三"
    })

    print(f"\n执行结果:")
    for nid, result in ctx.node_results.items():
        status_icon = {"SUCCESS": "✅", "FAILED": "❌", "SKIPPED": "⏭️"}.get(
            result.status.value, "❓")
        print(f"  {status_icon} {nid}: {result.status.value} "
              f"({result.duration_ms}ms)")

    # 添加调度任务
    print("\n=== 添加调度任务 ===")
    async def daily_report():
        print("  [调度] 执行每日报告生成...")
        return {"report": "generated"}

    agent.scheduler.add_job(ScheduledJob(
        job_id="daily_report",
        name="每日报告生成",
        handler=daily_report,
        cron_expression="0 9 * * 1-5",  # 工作日每天9点
        timeout=300
    ))

    # 添加审批
    print("\n=== 审批系统 ===")
    approval_id = agent.approval_mgr.request_approval(
        workflow_id="wf_001", node_id="publish",
        node_name="发布文章", requester="system",
        approver="editor_zhang", data={"article_id": "123"}
    )
    print(f"  待审批: {approval_id}")
    print(f"  审批统计: {agent.approval_mgr.get_stats()}")

    # 注册 Webhook
    print("\n=== Webhook 管理 ===")
    wh_id = agent.webhook_mgr.register(
        path="/api/webhook/cms",
        secret="my_secret_key",
        workflow_name="content_publish"
    )
    print(f"  注册 Webhook: {wh_id}")
    print(f"  端点列表: {agent.webhook_mgr.list_endpoints()}")

    # 仪表板
    print("\n=== 工作流仪表板 ===")
    dashboard = agent.get_dashboard()
    print(f"  注册工作流: {dashboard['workflows']}")
    print(f"  调度任务: {dashboard['scheduler']['total_jobs']}")
    print(f"  待审批: {dashboard['approvals']['pending']}")


if __name__ == "__main__":
    asyncio.run(demo_workflow())
```

## 19.8 生产级考量

### 19.8.1 持久化与恢复

| 状态存储 | 方案 | 适用场景 |
|----------|------|---------|
| 内存 | Python dict | 开发/测试 |
| 文件 | JSON/SQLite | 单机部署 |
| Redis | Hash + TTL | 中等规模 |
| 数据库 | PostgreSQL + JSONB | 生产环境 |

```python
"""
工作流状态持久化（SQLite 示例）
"""

import sqlite3


class WorkflowPersistence:
    """工作流持久化层"""

    def __init__(self, db_path: str = "workflows.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS workflow_instances (
                    workflow_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    status TEXT DEFAULT 'running',
                    context_json TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS node_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT,
                    node_id TEXT,
                    status TEXT,
                    output_json TEXT,
                    error TEXT,
                    duration_ms INTEGER,
                    started_at TEXT,
                    FOREIGN KEY (workflow_id) REFERENCES workflow_instances(workflow_id)
                )
            """)

    def save_workflow(self, workflow_id: str, name: str,
                      context: WorkflowContext):
        """保存工作流状态"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO workflow_instances
                (workflow_id, name, status, context_json, created_at, updated_at)
                VALUES (?, ?, 'running', ?, ?, ?)
            """, (
                workflow_id, name,
                json.dumps(context.to_dict(), ensure_ascii=False),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            for nid, result in context.node_results.items():
                conn.execute("""
                    INSERT INTO node_executions
                    (workflow_id, node_id, status, output_json, error, duration_ms, started_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    workflow_id, nid, result.status.value,
                    json.dumps(str(result.output)[:500]) if result.output else None,
                    result.error,
                    result.duration_ms,
                    datetime.fromtimestamp(result.start_time).isoformat()
                ))

    def load_workflow(self, workflow_id: str) -> Optional[dict]:
        """加载工作流状态"""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM workflow_instances WHERE workflow_id = ?",
                (workflow_id,)
            ).fetchone()
            if not row:
                return None
            return {"workflow_id": row[0], "name": row[1],
                    "status": row[2], "context": json.loads(row[3])}
```

### 19.8.2 可观测性

```python
"""
工作流可观测性 - 指标收集与追踪
"""

class WorkflowMetrics:
    """工作流指标收集器"""

    def __init__(self):
        self._counters: dict[str, int] = defaultdict(int)
        self._histograms: dict[str, list[float]] = defaultdict(list)
        self._timers: dict[str, float] = {}

    def increment(self, metric: str, value: int = 1):
        self._counters[metric] += value

    def record_duration(self, metric: str, duration_ms: float):
        self._histograms[metric].append(duration_ms)

    def start_timer(self, name: str):
        self._timers[name] = time.time()

    def stop_timer(self, name: str) -> float:
        if name in self._timers:
            duration = (time.time() - self._timers[name]) * 1000
            self.record_duration(name, duration)
            del self._timers[name]
            return duration
        return 0.0

    def get_summary(self) -> dict:
        """获取指标摘要"""
        summary = {"counters": dict(self._counters)}
        for metric, values in self._histograms.items():
            if values:
                sorted_vals = sorted(values)
                summary[metric] = {
                    "count": len(values),
                    "avg": sum(values) / len(values),
                    "p50": sorted_vals[len(sorted_vals) // 2],
                    "p95": sorted_vals[int(len(sorted_vals) * 0.95)],
                    "p99": sorted_vals[int(len(sorted_vals) * 0.99)],
                    "max": max(values),
                    "min": min(values)
                }
        return summary
```

## 本章小结

本章从 DAG 工作流引擎出发，构建了完整的自动化工作流 Agent 体系：

1. **工作流引擎设计**：基于 DAG 的节点编排、状态管理、上下文共享
2. **条件分支与并行**：动态路由、Fan-out/Fan-in 并行模式、分支合并策略
3. **人工审批节点**：审批请求、批准/拒绝、回调恢复、审批统计
4. **定时任务调度**：Cron 表达式解析、固定间隔、超时处理、任务管理
5. **事件触发机制**：发布/订阅事件总线、Webhook 管理器、事件驱动工作流
6. **持久化与可观测性**：状态持久化、指标收集、性能追踪

核心思想：**工作流 Agent 的本质是"协调"——协调人、机器、数据和时间，让复杂的业务流程变得可预测、可观测、可恢复。** 一个好的工作流系统，不仅要知道"做什么"，更要知道"出错时怎么办"。
