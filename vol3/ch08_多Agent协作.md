# 第8章：多Agent协作

> "一个人走得快，一群人走得远。"
> ——非洲谚语（同样适用于 AI Agent）

---

## 8.1 为什么需要多Agent？

单个 Agent 的能力受限于其底层模型的上下文窗口、推理能力和工具集。当面对以下场景时，多 Agent 协作成为更好的选择：

1. **复杂任务分解**：需要不同专业领域知识的任务
2. **并行处理**：可拆分为独立子任务以提升效率
3. **冗余验证**：关键决策需要多方确认
4. **专家协作**：模拟真实团队中不同角色的协同

### 8.1.1 单Agent vs 多Agent

```
┌─────────────────────────────────────────────────────────┐
│                    单 Agent 架构                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ 感知层   │ →  │ 推理层   │ →  │ 行动层   │             │
│  └─────────┘    └─────────┘    └─────────┘             │
│       ↓              ↓              ↓                   │
│  输入/工具      LLM 推理       输出/调用                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   多 Agent 架构                           │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │协调者 │←→│专家A │←→│专家B │←→│专家C │              │
│  └──┬───┘  └──────┘  └──────┘  └──────┘              │
│     │                                                  │
│  ┌──┴──────────────────────────────────┐              │
│  │         共享消息总线 / 黑板           │              │
│  └─────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 8.1.2 何时选择多Agent

**适合多Agent的场景：**
- 需要不同领域专业知识（如代码审查 + 安全审计 + 性能优化）
- 任务可自然分解为独立子任务
- 需要冗余验证或交叉检查
- 模拟多方对话或辩论

**不适合多Agent的场景：**
- 简单的单步任务（杀鸡用牛刀）
- 严格顺序依赖、无法并行的流程
- 实时性要求极高的场景（Agent间通信开销）
- 成本敏感场景（每次Agent调用都有LLM成本）

---

## 8.2 多Agent架构模式

### 8.2.1 层级式架构（Hierarchical）

层级式架构中，存在明确的上下级关系，顶层 Agent 负责任务分配和结果汇总，底层 Agent 执行具体任务。

```
        ┌──────────────┐
        │   协调者 Agent  │
        │  (Orchestrator) │
        └──┬───┬───┬────┘
           │   │   │
     ┌─────┘   │   └─────┐
     ↓         ↓         ↓
┌─────────┐┌─────────┐┌─────────┐
│ 专家A   ││ 专家B   ││ 专家C   │
│ (代码)   ││ (安全)   ││ (测试)   │
└─────────┘└─────────┘└─────────┘
```

**优势：**
- 控制流清晰，易于调试
- 适合需要全局视角的任务编排
- 容易实现优先级和依赖管理

**劣势：**
- 协调者成为性能瓶颈
- 顶层Agent需要理解全局，上下文压力大
- 缺乏底层间的直接协作

**代码实现：**

```python
from typing import Protocol, Any
from dataclasses import dataclass, field
from enum import Enum
import asyncio


class AgentRole(Enum):
    ORCHESTRATOR = "orchestrator"
    CODER = "coder"
    REVIEWER = "reviewer"
    TESTER = "tester"
    SECURITY = "security"


@dataclass
class Task:
    """任务定义"""
    id: str
    description: str
    assigned_to: AgentRole | None = None
    result: Any = None
    dependencies: list[str] = field(default_factory=list)
    status: str = "pending"  # pending, in_progress, completed, failed


@dataclass
class Message:
    """Agent间消息"""
    from_agent: AgentRole
    to_agent: AgentRole
    content: str
    task_id: str | None = None
    metadata: dict = field(default_factory=dict)


class Agent(Protocol):
    """Agent协议"""
    async def receive(self, message: Message) -> None: ...
    async def execute(self, task: Task) -> Any: ...
    @property
    def role(self) -> AgentRole: ...


class HierarchicalOrchestrator:
    """层级式协调者"""
    
    def __init__(self, agents: dict[AgentRole, Agent]):
        self.agents = agents
        self.task_queue: list[Task] = []
        self.completed_tasks: dict[str, Any] = {}
    
    async def submit_task(self, task: Task) -> Any:
        """提交任务并等待完成"""
        # 1. 分析任务，确定需要哪些Agent
        plan = await self._plan_task(task)
        
        # 2. 按计划分配子任务
        for sub_task in plan:
            self.task_queue.append(sub_task)
        
        # 3. 执行任务链
        results = {}
        for sub_task in self.task_queue:
            # 检查依赖
            for dep_id in sub_task.dependencies:
                if dep_id not in self.completed_tasks:
                    raise RuntimeError(f"依赖任务 {dep_id} 未完成")
            
            # 分配给对应Agent
            agent = self.agents[sub_task.assigned_to]
            message = Message(
                from_agent=AgentRole.ORCHESTRATOR,
                to_agent=sub_task.assigned_to,
                content=sub_task.description,
                task_id=sub_task.id
            )
            await agent.receive(message)
            
            # 执行并收集结果
            result = await agent.execute(sub_task)
            self.completed_tasks[sub_task.id] = result
            results[sub_task.id] = result
        
        # 4. 汇总结果
        return await self._aggregate_results(task, results)
    
    async def _plan_task(self, task: Task) -> list[Task]:
        """将大任务分解为子任务链"""
        # 在实际系统中，这里会调用LLM进行任务规划
        return [
            Task(id=f"{task.id}_code", description=f"实现: {task.description}",
                 assigned_to=AgentRole.CODER),
            Task(id=f"{task.id}_review", description=f"审查上述代码",
                 assigned_to=AgentRole.REVIEWER,
                 dependencies=[f"{task.id}_code"]),
            Task(id=f"{task.id}_test", description=f"编写测试用例",
                 assigned_to=AgentRole.TESTER,
                 dependencies=[f"{task.id}_code"]),
            Task(id=f"{task.id}_security", description=f"安全审计",
                 assigned_to=AgentRole.SECURITY,
                 dependencies=[f"{task.id}_code"]),
        ]
    
    async def _aggregate_results(self, task: Task, results: dict) -> Any:
        """汇总各Agent的结果"""
        return {
            "original_task": task.description,
            "code": results.get(f"{task.id}_code"),
            "review": results.get(f"{task.id}_review"),
            "tests": results.get(f"{task.id}_test"),
            "security_audit": results.get(f"{task.id}_security"),
        }
```

### 8.2.2 对等式架构（Peer-to-Peer）

对等式架构中没有中央协调者，所有 Agent 地位平等，通过直接通信进行协作。

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  AgentA │ ←→ │  AgentB │ ←→ │  AgentC │
│ (前端)   │     │ (后端)   │     │ (数据)   │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
            ┌────────┴────────┐
            │   消息总线       │
            │  (Message Bus)  │
            └─────────────────┘
```

**优势：**
- 去中心化，无单点故障
- Agent间可灵活协作
- 适合开放式探索任务

**劣势：**
- 缺乏全局协调，可能出现混乱
- 消息传递可能形成循环
- 一致性保证困难

**代码实现：**

```python
import asyncio
from collections import defaultdict
from typing import Callable


class MessageBus:
    """Agent间消息总线"""
    
    def __init__(self):
        self.subscribers: dict[AgentRole, list[Callable]] = defaultdict(list)
        self.message_log: list[Message] = []
    
    def subscribe(self, role: AgentRole, handler: Callable):
        """订阅特定角色的消息"""
        self.subscribers[role].append(handler)
    
    async def publish(self, message: Message):
        """发布消息"""
        self.message_log.append(message)
        handlers = self.subscribers.get(message.to_agent, [])
        for handler in handlers:
            await handler(message)
    
    async def broadcast(self, from_agent: AgentRole, content: str):
        """广播消息给所有Agent"""
        for role in self.subscribers:
            message = Message(
                from_agent=from_agent,
                to_agent=role,
                content=content
            )
            await self.publish(message)


class PeerAgent:
    """对等Agent实现"""
    
    def __init__(self, role: AgentRole, expertise: str, message_bus: MessageBus):
        self.role = role
        self.expertise = expertise
        self.bus = message_bus
        self.knowledge_base: list[str] = []
        self.bus.subscribe(role, self._on_message)
    
    async def _on_message(self, message: Message):
        """收到消息的处理"""
        print(f"[{self.role.value}] 收到来自 {message.from_agent.value} 的消息: {message.content[:50]}...")
        
        # 如果不是我能处理的，转发给其他合适的Agent
        if not self._can_handle(message.content):
            await self._forward_message(message)
    
    def _can_handle(self, content: str) -> bool:
        """判断是否能处理该消息"""
        # 实际中这里会调用LLM判断
        keywords = {
            "前端": ["HTML", "CSS", "React", "UI", "组件"],
            "后端": ["API", "数据库", "服务", "接口", "认证"],
            "数据": ["数据", "分析", "模型", "特征", "统计"],
        }
        expertise_keywords = keywords.get(self.expertise, [])
        return any(kw in content for kw in expertise_keywords)
    
    async def _forward_message(self, message: Message):
        """转发消息"""
        for role in [AgentRole.CODER, AgentRole.TESTER, AgentRole.SECURITY]:
            if role != self.role:
                forward = Message(
                    from_agent=self.role,
                    to_agent=role,
                    content=f"[转发] {message.content}",
                    task_id=message.task_id
                )
                await self.bus.publish(forward)
    
    async def execute(self, task: Task) -> Any:
        """执行任务"""
        # 广播自己的工作状态
        await self.bus.broadcast(
            self.role,
            f"开始处理任务: {task.description}"
        )
        
        # 实际执行（此处模拟）
        result = f"[{self.expertise}] 处理完成: {task.description}"
        self.knowledge_base.append(result)
        
        return result


async def demo_peer_to_peer():
    """演示对等式多Agent"""
    bus = MessageBus()
    
    agents = {
        AgentRole.CODER: PeerAgent(AgentRole.CODER, "前端", bus),
        AgentRole.TESTER: PeerAgent(AgentRole.TESTER, "后端", bus),
        AgentRole.SECURITY: PeerAgent(AgentRole.SECURITY, "数据", bus),
    }
    
    task = Task(id="demo_1", description="实现一个用户登录页面，包含前端UI和后端API")
    
    # 所有Agent并行尝试处理
    results = await asyncio.gather(*[
        agent.execute(task) for agent in agents.values()
    ])
    
    return results
```

### 8.2.3 黑板式架构（Blackboard）

黑板式架构中，Agent 通过共享的"黑板"（Blackboard）进行间接通信。黑板是一个结构化的共享存储空间。

```
┌────────────────────────────────────────────────────┐
│                    黑板 (Blackboard)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 需求区域  │ │ 代码区域  │ │ 测试区域  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐                        │
│  │ 审查区域  │ │ 安全区域  │                        │
│  └──────────┘ └──────────┘                        │
└──────────┬──────────┬──────────┬───────────────────┘
           │          │          │
      ┌────┴────┐┌───┴────┐┌───┴────┐
      │ 读取/写入 ││ 读取/写入││ 读取/写入│
      └─────────┘└────────┘└────────┘
      ┌─────────┐┌────────┐┌────────┐
      │ AgentA  ││ AgentB ││ AgentC │
      └─────────┘└────────┘└────────┘
```

**优势：**
- 解耦——Agent不需要知道彼此的存在
- 灵活——Agent可以随时加入/退出
- 可追溯——黑板上的所有变更都有记录

**劣势：**
- 黑板可能成为性能瓶颈
- 信息过载——Agent需要筛选相关信息
- 冲突解决复杂——多个Agent同时写入同一区域

**代码实现：**

```python
from datetime import datetime
import threading
from typing import Any


class BlackboardSection:
    """黑板分区"""
    
    def __init__(self, name: str):
        self.name = name
        self.entries: list[dict] = []
        self.lock = threading.Lock()
        self._change_callbacks: list[Callable] = []
    
    def write(self, author: str, content: Any, tags: list[str] = None):
        """写入黑板"""
        with self.lock:
            entry = {
                "author": author,
                "content": content,
                "tags": tags or [],
                "timestamp": datetime.now().isoformat(),
            }
            self.entries.append(entry)
        
        # 通知观察者
        for callback in self._change_callbacks:
            callback(entry)
        
        return entry
    
    def read(self, tags: list[str] = None, author: str = None) -> list[dict]:
        """读取黑板"""
        with self.lock:
            entries = self.entries.copy()
        
        if tags:
            entries = [
                e for e in entries
                if any(t in e.get("tags", []) for t in tags)
            ]
        
        if author:
            entries = [e for e in entries if e["author"] == author]
        
        return entries
    
    def on_change(self, callback: Callable):
        """注册变更回调"""
        self._change_callbacks.append(callback)


class Blackboard:
    """共享黑板"""
    
    def __init__(self):
        self.sections: dict[str, BlackboardSection] = {}
    
    def create_section(self, name: str) -> BlackboardSection:
        """创建分区"""
        section = BlackboardSection(name)
        self.sections[name] = section
        return section
    
    def get_section(self, name: str) -> BlackboardSection:
        """获取分区"""
        return self.sections.get(name, self.create_section(name))


class BlackboardAgent:
    """黑板式Agent"""
    
    def __init__(self, name: str, blackboard: Blackboard, 
                 watch_sections: list[str]):
        self.name = name
        self.blackboard = blackboard
        self.watch_sections = watch_sections
        
        # 注册对感兴趣分区的监听
        for section_name in watch_sections:
            section = self.blackboard.get_section(section_name)
            section.on_change(self._on_blackboard_update)
    
    def _on_blackboard_update(self, entry: dict):
        """黑板更新时的回调"""
        if entry["author"] == self.name:
            return  # 忽略自己写入的内容
        
        # 检查是否需要响应
        if self._should_respond(entry):
            self._respond(entry)
    
    def _should_respond(self, entry: dict) -> bool:
        """判断是否需要响应"""
        # 实际中这里会调用LLM判断
        return True
    
    def _respond(self, entry: dict):
        """对黑板更新做出响应"""
        # 实际中这里会执行具体工作
        print(f"[{self.name}] 响应黑板更新: {str(entry['content'])[:50]}...")
    
    def write_to(self, section_name: str, content: Any, 
                 tags: list[str] = None):
        """写入黑板"""
        section = self.blackboard.get_section(section_name)
        return section.write(self.name, content, tags)


# 使用示例
def demo_blackboard():
    bb = Blackboard()
    bb.create_section("requirements")
    bb.create_section("code")
    bb.create_section("reviews")
    
    pm_agent = BlackboardAgent("PM", bb, ["code", "reviews"])
    coder_agent = BlackboardAgent("Coder", bb, ["requirements"])
    reviewer_agent = BlackboardAgent("Reviewer", bb, ["code"])
    
    # PM写入需求
    pm_agent.write_to("requirements", "用户需要登录功能", ["feature", "auth"])
    
    # Coder看到需求，写入代码
    coder_agent.write_to("code", "def login(user, pwd): ...", ["auth", "backend"])
    
    # Reviewer看到代码，写入审查意见
    reviewer_agent.write_to("reviews", "建议添加输入验证", ["security"])
```

---

## 8.3 Agent间通信协议

### 8.3.1 消息格式标准化

在多 Agent 系统中，统一的通信协议至关重要。以下是推荐的标准化消息格式：

```python
from pydantic import BaseModel, Field
from typing import Literal, Any
from datetime import datetime


class AgentMessage(BaseModel):
    """标准化Agent消息"""
    
    # 消息标识
    message_id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str  # 关联的对话/任务ID
    parent_message_id: str | None = None  # 回复的消息ID
    
    # 发送者与接收者
    sender: str  # Agent标识
    receiver: str  # 目标Agent标识或"broadcast"
    
    # 消息类型与内容
    msg_type: Literal[
        "task_request",    # 任务请求
        "task_result",     # 任务结果
        "query",           # 查询
        "response",        # 响应
        "notification",    # 通知
        "error",           # 错误
        "status_update",   # 状态更新
    ]
    content: str
    structured_data: dict[str, Any] = Field(default_factory=dict)
    
    # 元信息
    priority: Literal["low", "normal", "high", "critical"] = "normal"
    requires_response: bool = False
    timeout_seconds: int | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class MessageProtocol:
    """消息协议处理"""
    
    @staticmethod
    def create_task_request(
        sender: str, receiver: str,
        task_description: str, task_id: str,
        priority: str = "normal"
    ) -> AgentMessage:
        return AgentMessage(
            conversation_id=task_id,
            sender=sender,
            receiver=receiver,
            msg_type="task_request",
            content=task_description,
            structured_data={"task_id": task_id},
            priority=priority,
            requires_response=True,
            timeout_seconds=300,
        )
    
    @staticmethod
    def create_task_result(
        sender: str, receiver: str,
        result: Any, original_request: AgentMessage,
        status: str = "success"
    ) -> AgentMessage:
        return AgentMessage(
            conversation_id=original_request.conversation_id,
            parent_message_id=original_request.message_id,
            sender=sender,
            receiver=original_request.sender,
            msg_type="task_result",
            content=f"任务完成: {status}",
            structured_data={
                "result": result,
                "status": status,
                "original_task_id": original_request.structured_data.get("task_id"),
            },
        )
```

### 8.3.2 通信模式

```python
class CommunicationPattern:
    """通信模式"""
    
    # 1. 请求-响应（Request-Response）
    # 最基本的模式，同步等待结果
    async def request_response(self, sender, receiver, message, timeout=30):
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[message.message_id] = future
        await self._send(message)
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            return {"error": "timeout", "message_id": message.message_id}
    
    # 2. 发布-订阅（Pub-Sub）
    # Agent订阅感兴趣的主题
    async def publish(self, topic: str, message: AgentMessage):
        subscribers = self._subscriptions.get(topic, [])
        for subscriber in subscribers:
            await self._deliver(subscriber, message)
    
    def subscribe(self, topic: str, agent_id: str, handler: Callable):
        if topic not in self._subscriptions:
            self._subscriptions[topic] = []
        self._subscriptions[topic].append((agent_id, handler))
    
    # 3. 流水线（Pipeline）
    # Agent A → Agent B → Agent C 顺序处理
    async def pipeline(self, agents: list, initial_message: AgentMessage):
        current_message = initial_message
        results = []
        
        for agent in agents:
            result = await agent.process(current_message)
            results.append(result)
            current_message = self._create_pipeline_message(
                agent.role, result
            )
        
        return results
```

---

## 8.4 任务分配与负载均衡

### 8.4.1 静态分配 vs 动态分配

| 维度 | 静态分配 | 动态分配 |
|------|---------|---------|
| 分配时机 | 任务开始前确定 | 运行时根据状态调整 |
| 灵活性 | 低 | 高 |
| 开销 | 小 | 较大（需要状态监控） |
| 适用场景 | 任务类型固定 | 任务类型多变 |

### 8.4.2 能力匹配分配器

```python
from dataclasses import dataclass


@dataclass
class AgentCapability:
    """Agent能力描述"""
    agent_id: str
    expertise_areas: list[str]  # 专业领域
    max_concurrent: int = 3     # 最大并发数
    current_load: int = 0       # 当前负载
    avg_response_time: float = 0.0  # 平均响应时间
    success_rate: float = 1.0   # 成功率


class CapabilityBasedDispatcher:
    """基于能力匹配的任务分配器"""
    
    def __init__(self):
        self.agents: dict[str, AgentCapability] = {}
    
    def register_agent(self, capability: AgentCapability):
        self.agents[capability.agent_id] = capability
    
    def dispatch(self, task_description: str) -> str | None:
        """为任务选择最合适的Agent"""
        # 1. 提取任务关键词
        task_keywords = self._extract_keywords(task_description)
        
        # 2. 计算每个Agent的匹配分数
        scores = {}
        for agent_id, cap in self.agents.items():
            # 跳过已满载的Agent
            if cap.current_load >= cap.max_concurrent:
                continue
            
            # 计算匹配度 (0-1)
            expertise_match = self._calculate_expertise_match(
                task_keywords, cap.expertise_areas
            )
            
            # 负载惩罚 (负载越高分数越低)
            load_factor = 1.0 - (cap.current_load / cap.max_concurrent * 0.5)
            
            # 速度奖励
            speed_factor = 1.0 / (1.0 + cap.avg_response_time / 10.0)
            
            # 质量奖励
            quality_factor = cap.success_rate
            
            # 综合分数
            scores[agent_id] = (
                expertise_match * 0.5 +
                load_factor * 0.2 +
                speed_factor * 0.15 +
                quality_factor * 0.15
            )
        
        if not scores:
            return None
        
        # 3. 返回最高分的Agent
        return max(scores, key=scores.get)
    
    def _extract_keywords(self, text: str) -> list[str]:
        """提取关键词（简化版）"""
        # 实际中可以使用 NLP 工具或 LLM
        stop_words = {"的", "了", "是", "在", "和", "请", "帮我", "我", "要"}
        words = [w for w in text.split() if w not in stop_words and len(w) > 1]
        return words
    
    def _calculate_expertise_match(
        self, task_keywords: list[str], 
        expertise: list[str]
    ) -> float:
        """计算任务与Agent专业领域的匹配度"""
        if not task_keywords:
            return 0.1  # 无关键词时给一个基础分
        
        matches = sum(
            1 for kw in task_keywords 
            for area in expertise 
            if kw in area or area in kw
        )
        return min(matches / len(task_keywords), 1.0)
```

---

## 8.5 多Agent框架实战

### 8.5.1 AutoGen

Microsoft 的 AutoGen 是目前最流行的多 Agent 框架之一，以对话为核心进行 Agent 协作。

```python
import autogen

# 配置LLM
llm_config = {
    "model": "gpt-4",
    "temperature": 0,
    "api_key": "your-api-key",
}

# 定义Agent
user_proxy = autogen.UserProxyAgent(
    name="User",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=5,
    code_execution_config={
        "work_dir": "coding",
        "use_docker": False,
    },
)

coder = autogen.AssistantAgent(
    name="Coder",
    llm_config=llm_config,
    system_message="""你是一个高级Python开发工程师。
    负责根据需求编写高质量的代码。
    遵循PEP8规范，编写类型注解和文档字符串。
    完成后请 reviewer 审查。""",
)

reviewer = autogen.AssistantAgent(
    name="Reviewer",
    llm_config=llm_config,
    system_message="""你是一个严格的代码审查员。
    检查代码的：安全性、性能、可读性、错误处理。
    如果发现问题，请明确提出并给出修改建议。
    如果代码没有问题，回复 APPROVED。""",
)

tester = autogen.AssistantAgent(
    name="Tester",
    llm_config=llm_config,
    system_message="""你是一个测试工程师。
    根据代码编写单元测试和集成测试。
    使用 pytest 框架。
    确保覆盖边界情况和异常路径。""",
)

# 创建群聊
groupchat = autogen.GroupChat(
    agents=[user_proxy, coder, reviewer, tester],
    messages=[],
    max_round=15,
)

manager = autogen.GroupChatManager(
    groupchat=groupchat,
    llm_config=llm_config,
)

# 启动协作
user_proxy.initiate_chat(
    manager,
    message="请实现一个线程安全的LRU缓存类，支持TTL过期和统计功能。",
)
```

**AutoGen 核心概念：**

| 概念 | 说明 |
|------|------|
| `UserProxyAgent` | 用户代理，可执行代码 |
| `AssistantAgent` | LLM驱动的Agent |
| `GroupChat` | 多Agent群聊 |
| `GroupChatManager` | 群聊管理器，决定谁发言 |
| `max_round` | 最大对话轮次限制 |

### 8.5.2 CrewAI

CrewAI 采用了"角色扮演"的方式组织多 Agent 协作，每个 Agent 都有明确的角色、目标和工具。

```python
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool


# 定义自定义工具
@tool("Search Codebase")
def search_codebase(query: str) -> str:
    """在代码库中搜索相关代码"""
    # 实际实现...
    return f"搜索结果: {query}"


@tool("Run Tests")
def run_tests(test_file: str) -> str:
    """运行测试文件"""
    import subprocess
    result = subprocess.run(
        ["pytest", test_file, "-v"],
        capture_output=True, text=True
    )
    return result.stdout


# 定义Agent角色
architect = Agent(
    role="系统架构师",
    goal="设计最优的技术方案",
    backstory="""你是一位经验丰富的系统架构师，拥有15年分布式系统设计经验。
    你擅长将复杂需求拆解为清晰的架构方案，总是考虑可扩展性和可维护性。
    你使用C4模型进行架构设计，输出Mermaid图表。""",
    tools=[search_codebase],
    verbose=True,
    allow_delegation=False,
)

developer = Agent(
    role="高级开发工程师",
    goal="编写高质量、可维护的代码",
    backstory="""你是一位追求代码卓越的开发工程师。
    你遵循SOLID原则，注重代码的可读性和性能。
    你总是先写测试再写实现（TDD）。""",
    tools=[search_codebase, run_tests],
    verbose=True,
    allow_delegation=True,
)

reviewer = Agent(
    role="代码审查专家",
    goal="确保代码质量和安全性",
    backstory="""你是一位严格的代码审查员，曾在多个大型项目担任技术负责人。
    你对代码质量有极高的标准，尤其关注安全漏洞和性能问题。
    你使用Checklist进行系统性审查。""",
    tools=[search_codebase],
    verbose=True,
    allow_delegation=False,
)

# 定义任务
design_task = Task(
    description="分析需求文档，设计一个RESTful API的微服务架构。"
                "包括服务划分、API设计、数据模型和部署方案。",
    agent=architect,
    expected_output="Mermaid架构图 + API设计文档",
)

develop_task = Task(
    description="根据架构设计文档，实现核心API端点。"
                "包括用户认证、CRUD操作和错误处理。",
    agent=developer,
    expected_output="完整的Python代码实现",
)

review_task = Task(
    description="审查代码实现，检查：1)安全性 2)性能 3)可维护性 4)测试覆盖率",
    agent=reviewer,
    expected_output="审查报告，包含发现的问题和修改建议",
)

# 组建团队
crew = Crew(
    agents=[architect, developer, reviewer],
    tasks=[design_task, develop_task, review_task],
    process=Process.sequential,  # 顺序执行
    verbose=True,
)

# 执行
result = crew.kickoff()
print(f"最终结果:\n{result}")
```

**CrewAI vs AutoGen 对比：**

| 维度 | AutoGen | CrewAI |
|------|---------|--------|
| **协作模式** | 自由对话 | 角色扮演 |
| **流程控制** | GroupChatManager 管理 | Task 链式编排 |
| **任务定义** | 对话驱动 | 显式 Task 定义 |
| **工具集成** | 内置代码执行 | 自定义 @tool |
| **适用场景** | 开放式探索 | 结构化流水线 |
| **学习曲线** | 低 | 中 |

### 8.5.3 LangGraph

LangGraph 用图（Graph）的方式建模 Agent 的工作流，特别适合需要条件分支和循环的复杂场景。

```python
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated, Literal
from langchain_core.messages import HumanMessage, AIMessage


class AgentState(TypedDict):
    """共享状态"""
    messages: Annotated[list, add_messages]
    current_agent: str
    task_description: str
    code: str
    review_result: str
    iteration: int
    max_iterations: int


def router_agent(state: AgentState) -> dict:
    """路由Agent：决定下一步谁来处理"""
    iteration = state.get("iteration", 0)
    max_iter = state.get("max_iterations", 3)
    
    if iteration == 0:
        return {"current_agent": "coder", "iteration": iteration + 1}
    elif state.get("review_result", "") == "APPROVED":
        return {"current_agent": END}
    elif iteration >= max_iter:
        return {"current_agent": END}
    else:
        return {"current_agent": "coder", "iteration": iteration + 1}


def coder_node(state: AgentState) -> dict:
    """编码Agent节点"""
    # 调用LLM生成/修改代码
    code = f"# 第{state['iteration']}次迭代\n# {state['task_description']}\ndef solve():\n    pass"
    return {"code": code}


def reviewer_node(state: AgentState) -> dict:
    """审查Agent节点"""
    # 调用LLM审查代码
    review = "APPROVED" if state["iteration"] >= 2 else "需要改进"
    return {"review_result": review}


def should_review(state: AgentState) -> Literal["reviewer", "router"]:
    """条件边：判断是否需要审查"""
    if state.get("code"):
        return "reviewer"
    return "router"


# 构建图
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("router", router_agent)
workflow.add_node("coder", coder_node)
workflow.add_node("reviewer", reviewer_node)

# 设置入口
workflow.set_entry_point("router")

# 添加边
workflow.add_conditional_edges("router", lambda s: s["current_agent"], {
    "coder": "coder",
    END: END,
})
workflow.add_conditional_edges("coder", should_review, {
    "reviewer": "reviewer",
    "router": "router",
})
workflow.add_edge("reviewer", "router")

# 编译
app = workflow.compile()

# 执行
result = app.invoke({
    "messages": [],
    "task_description": "实现快速排序算法",
    "max_iterations": 3,
})

print(f"最终代码:\n{result['code']}")
print(f"审查结果: {result['review_result']}")
```

---

## 8.6 冲突解决与共识机制

### 8.6.1 常见冲突类型

| 冲突类型 | 描述 | 示例 |
|---------|------|------|
| **结果冲突** | 多个Agent产生矛盾的结果 | AgentA说用方案A，AgentB说用方案B |
| **资源冲突** | 多个Agent争抢同一资源 | 两个Agent同时修改同一文件 |
| **顺序冲突** | Agent执行顺序不当 | 测试Agent在编码Agent完成前运行 |
| **权限冲突** | Agent执行了越权操作 | 开发Agent尝试部署到生产环境 |

### 8.6.2 冲突解决策略

```python
from enum import Enum


class ConflictResolution(Enum):
    MAJORITY_VOTE = "majority_vote"      # 多数投票
    WEIGHTED_VOTE = "weighted_vote"      # 加权投票
    PRIORITY_BASED = "priority_based"    # 优先级决定
    NEGOTIATION = "negotiation"          # 协商解决
    ESCALATION = "escalation"            # 上报人工
    MERGE = "merge"                      # 合并方案


class ConflictResolver:
    """冲突解决器"""
    
    def __init__(self, strategy: ConflictResolution):
        self.strategy = strategy
        self.agent_weights: dict[str, float] = {}
        self.agent_priorities: dict[str, int] = {}
    
    def resolve(self, conflict: dict) -> Any:
        """解决冲突"""
        match self.strategy:
            case ConflictResolution.MAJORITY_VOTE:
                return self._majority_vote(conflict)
            case ConflictResolution.WEIGHTED_VOTE:
                return self._weighted_vote(conflict)
            case ConflictResolution.PRIORITY_BASED:
                return self._priority_based(conflict)
            case ConflictResolution.NEGOTIATION:
                return self._negotiation(conflict)
            case ConflictResolution.ESCALATION:
                return self._escalation(conflict)
            case ConflictResolution.MERGE:
                return self._merge(conflict)
    
    def _majority_vote(self, conflict: dict) -> Any:
        """多数投票"""
        from collections import Counter
        votes = conflict["proposals"]
        counter = Counter(votes)
        return counter.most_common(1)[0][0]
    
    def _weighted_vote(self, conflict: dict) -> Any:
        """加权投票"""
        proposals = conflict["proposals"]
        weights = conflict.get("agent_weights", {})
        
        scores: dict[Any, float] = {}
        for agent, proposal in proposals.items():
            weight = weights.get(agent, 1.0)
            scores[proposal] = scores.get(proposal, 0) + weight
        
        return max(scores, key=scores.get)
    
    def _priority_based(self, conflict: dict) -> Any:
        """优先级决定"""
        proposals = conflict["proposals"]
        priorities = conflict.get("agent_priorities", {})
        
        # 选择优先级最高的Agent的方案
        sorted_agents = sorted(
            proposals.keys(),
            key=lambda a: priorities.get(a, 0),
            reverse=True
        )
        return proposals[sorted_agents[0]]
    
    def _negotiation(self, conflict: dict) -> Any:
        """协商解决 - 通过LLM调解"""
        proposals = conflict["proposals"]
        
        # 构建协商Prompt
        prompt = f"""
        多个Agent提出了不同的方案，请作为调解者选出最佳方案：
        
        {self._format_proposals(proposals)}
        
        请分析每个方案的优劣，然后给出最终建议。
        """
        # 调用LLM进行调解
        # return llm.invoke(prompt)
        return "negotiated_result"
    
    def _escalation(self, conflict: dict) -> Any:
        """上报人工"""
        return {
            "status": "escalated",
            "conflict": conflict,
            "message": "需要人工介入解决冲突",
        }
    
    def _merge(self, conflict: dict) -> Any:
        """合并方案 - 取各方案之长"""
        proposals = conflict["proposals"]
        
        prompt = f"""
        请将以下不同Agent的方案合并为一个综合方案，
        保留每个方案的优势：
        
        {self._format_proposals(proposals)}
        """
        # return llm.invoke(prompt)
        return "merged_result"
    
    def _format_proposals(self, proposals: dict) -> str:
        return "\n".join(
            f"- {agent}: {proposal}" 
            for agent, proposal in proposals.items()
        )
```

### 8.6.3 共识协议：Raft-inspired Agent Consensus

```python
class AgentConsensus:
    """灵感来自Raft的Agent共识协议"""
    
    PHASES = ["propose", "vote", "commit"]
    
    def __init__(self, agents: list[str], quorum: int):
        self.agents = agents
        self.quorum = quorum  # 法定人数
        self.current_proposal = None
        self.votes: dict[str, bool] = {}
        self.phase = "idle"
    
    async def propose(self, proposer: str, proposal: Any) -> dict:
        """提出提案"""
        self.current_proposal = proposal
        self.phase = "propose"
        self.votes = {proposer: True}  # 提案者自动同意
        
        # 广播提案给所有Agent
        votes_received = {proposer: True}
        
        for agent in self.agents:
            if agent == proposer:
                continue
            # 实际中这里会发送消息给Agent，Agent进行评估
            # vote = await self._request_vote(agent, proposal)
            vote = True  # 模拟
            votes_received[agent] = vote
        
        self.phase = "vote"
        self.votes = votes_received
        
        # 检查是否达到法定人数
        if sum(votes_received.values()) >= self.quorum:
            self.phase = "commit"
            return {
                "status": "consensus_reached",
                "proposal": proposal,
                "votes": votes_received,
            }
        else:
            self.phase = "idle"
            return {
                "status": "consensus_failed",
                "proposal": proposal,
                "votes": votes_received,
                "reason": "未达到法定人数",
            }
```

---

## 8.7 最佳实践与常见陷阱

### 8.7.1 最佳实践

1. **从简单开始**：先用单Agent验证核心逻辑，确认需要多Agent后再扩展
2. **定义清晰的接口**：每个Agent的输入/输出格式要标准化
3. **设置合理的超时**：Agent间调用必须有超时机制，防止无限等待
4. **实现优雅降级**：当某个Agent失败时，系统不应完全崩溃
5. **记录一切**：完整的消息日志是调试多Agent系统的关键
6. **控制成本**：多Agent意味着多次LLM调用，要监控Token消耗

### 8.7.2 常见陷阱

```python
# ❌ 陷阱1：无限对话循环
# 没有设置max_round限制，Agent可能无限对话
groupchat = autogen.GroupChat(
    agents=[agent_a, agent_b],
    messages=[],
    # max_round=10,  # 必须设置！
)

# ✅ 正确：设置最大轮次
groupchat = autogen.GroupChat(
    agents=[agent_a, agent_b],
    messages=[],
    max_round=10,  # 限制对话轮次
)


# ❌ 陷阱2：忘记设置超时
result = await agent.execute(task)  # 可能永远挂起

# ✅ 正确：使用asyncio.wait_for
try:
    result = await asyncio.wait_for(
        agent.execute(task), timeout=60
    )
except asyncio.TimeoutError:
    logger.error(f"Agent {agent.role} 执行超时")


# ❌ 陷阱3：共享可变状态
shared_state = {"data": []}  # 多个Agent同时修改

# ✅ 正确：使用线程安全的数据结构
from threading import Lock
shared_state = {"data": [], "lock": Lock()}


# ❌ 陷阱4：Agent职责不清
# 所有Agent都能做所有事 → 角色混乱
developer = Agent(
    role="开发者",
    goal="做任何事",  # 太模糊！
)

# ✅ 正确：明确职责边界
developer = Agent(
    role="后端开发工程师",
    goal="根据API设计文档，使用Python/FastAPI实现后端接口",
    allow_delegation=False,  # 不允许将任务委托给其他Agent
)
```

### 8.7.3 生产环境检查清单

```
多Agent系统上线前检查清单：
├── [ ] 每个Agent有明确的职责描述和边界
├── [ ] 消息格式已标准化（使用Schema/Protocol）
├── [ ] 所有Agent间调用设置了超时
├── [ ] 实现了失败重试机制（指数退避）
├── [ ] 有熔断机制防止级联故障
├── [ ] 消息日志完整可追溯
├── [ ] Token消耗有预算限制和告警
├── [ ] 冲突解决策略已定义
├── [ ] 有降级方案（单Agent回退）
├── [ ] 性能基准测试已通过
├── [ ] 安全权限已配置（最小权限原则）
└── [ ] 监控指标已配置（延迟、成功率、成本）
```

---

## 8.8 小结

本章系统介绍了多 Agent 协作的核心模式和实践方法：

- **三种架构模式**：层级式适合需要全局协调的场景，对等式适合开放式探索，黑板式适合解耦协作
- **通信协议**：标准化的消息格式和通信模式是多Agent系统稳定运行的基石
- **任务分配**：基于能力匹配的智能分配器能显著提升系统效率
- **主流框架**：AutoGen 适合对话驱动、CrewAI 适合角色扮演、LangGraph 适合复杂流程
- **冲突解决**：多种策略各有适用场景，关键是提前定义好解决机制

**下一章预告：** 第9章将深入探讨 Agent 的推理与规划能力，从 ReAct 到 Graph-of-Thought，揭示 Agent 如何"思考"。

---

*第8章 · 多Agent协作* | *Agent 编程：从原理到生产级实践 · 卷三 · 进阶篇*
