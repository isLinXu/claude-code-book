# 第32章 多Agent编排模式

> "没有任何一个Agent能够独自解决所有问题。真正的智能来自于协作。" —— Marvin Minsky《心智社会》

## 32.1 概述

当单个Agent的能力不足以处理复杂任务时，我们需要多个Agent协同工作。多Agent编排模式关注的是**如何组织和管理多个Agent之间的协作关系**，使它们作为一个整体发挥出超越个体的能力。

本章探讨六种核心的多Agent编排模式：Orchestrator、Blackboard、Pipeline、Swarm、Hierarchical 和 Peer-to-Peer。这些模式从"中心化→去中心化"、"静态→动态"、"顺序→并行"等多个维度提供了不同的编排策略。

选择合适的编排模式取决于以下关键因素：
- **任务性质**：任务是否可分解、是否有依赖关系
- **Agent同质性**：Agent是相同的还是各有所长
- **实时性要求**：是否需要低延迟响应
- **容错需求**：单个Agent失败时系统是否必须继续运行
- **可扩展性**：是否需要动态增减Agent数量

**模式选择决策树：**

```
任务能否预先分解？
├── 是 → 有固定执行顺序？
│   ├── 是 → Pipeline模式
│   └── 否 → Orchestrator模式
└── 否 → Agent之间地位是否平等？
    ├── 是 → 通信机制？
    │   ├── 直接通信 → Swarm / Peer-to-Peer
    │   └── 间接通信 → Blackboard
    └── 否 → 有明确层级关系？ → Hierarchical模式
```

---

## 32.2 Orchestrator 模式（中心编排）

### 意图

通过一个**中央编排器（Orchestrator）**来协调多个专业Agent的执行，由编排器负责任务分解、Agent选择、结果整合和流程控制。

### 动机

在面对复杂任务时，一个自然的方式是引入一个"管理者"角色——它不一定亲自执行具体工作，但知道"谁最适合做什么"以及"应该按什么顺序做"。这就是Orchestrator模式的核心思想。

Orchestrator模式类似于软件架构中的"Facade（外观）模式"或"Mediator（中介者）模式"：它为外部调用者提供了一个简单的入口，但内部协调着多个专业组件的复杂交互。这种模式在企业级AI系统中最为常见——用户只需要和一个入口对话，背后由多个专业Agent协同完成。

LangChain的 AgentExecutor、AutoGen的 GroupChatManager、CrewAI的 Manager 都在不同程度上实现了这种模式。

### 结构

```
┌──────────────────────────────────────────────┐
│            Orchestrator System                │
│                                              │
│  User ──▶ ┌──────────────┐                  │
│           │ Orchestrator │                  │
│           │  (编排器)      │                  │
│           └──────┬───────┘                  │
│                  │                           │
│    ┌─────┬───────┼───────┬─────┐           │
│    ▼     ▼       ▼       ▼     ▼           │
│ ┌────┐┌────┐ ┌────┐ ┌────┐ ┌────┐          │
│ │Agent││Agent│ │Agent│ │Agent│ │Agent│      │
│ │ A  ││ B  │ │ C  │ │ D  │ │ E  │          │
│ │(搜索)││(分析)│ │(写作)│ │(审核)│ │(翻译)│     │
│ └────┘└────┘ └────┘ └────┘ └────┘          │
│                                              │
│  编排策略: 串行/并行/条件分支/循环            │
└──────────────────────────────────────────────┘
```

### 参与者

- **Orchestrator**：中央编排器，负责任务分解和Agent调度
- **Agent Pool**：可用的专业Agent集合
- **Task Queue**：任务队列，存储待执行和已完成的任务
- **Context Store**：共享上下文存储，Agent之间通过它传递中间结果

### 协作

1. Orchestrator接收用户请求，将其分解为子任务
2. 根据每个子任务的性质选择最合适的Agent
3. 按照依赖关系编排执行顺序（串行、并行或混合）
4. 收集各Agent的执行结果，整合为最终答案
5. 返回结果给用户

### 效果

**优点：**
- 流程可控——编排器完全掌控执行流程
- 结果质量高——可以选择最佳Agent执行每个子任务
- 易于调试——编排器记录完整的执行日志
- 支持复杂的工作流（条件分支、循环、并行）

**缺点：**
- 编排器是单点故障
- 编排器的能力瓶颈——编排器的"规划能力"限制了系统的上限
- 灵活性受限——新Agent需要注册到编排器才能使用
- 上下文传递开销大

### 实现

```python
"""
Orchestrator 模式 - 中心编排实现
"""
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
import json


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SubTask:
    task_id: str
    description: str
    assigned_agent: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None


@dataclass
class AgentNode:
    name: str
    description: str
    capabilities: List[str]
    handler: Callable


class Orchestrator:
    """Orchestrator - 中心编排器，支持串行、并行和条件编排。"""
    
    def __init__(self, llm_client, max_parallel: int = 3, verbose: bool = False):
        self.llm = llm_client
        self.agents: Dict[str, AgentNode] = {}
        self.max_parallel = max_parallel
        self.verbose = verbose
    
    def register_agent(self, agent: AgentNode) -> None:
        self.agents[agent.name] = agent
    
    def decompose_task(self, user_request: str) -> List[SubTask]:
        agent_list = "\n".join(
            f"- {n}: {a.description}" for n, a in self.agents.items()
        )
        prompt = f"""将请求分解为子任务并分配Agent。
请求: {user_request}
可用Agent: {agent_list}
返回JSON: {{"tasks": [{{"task_id":"t1","description":"...",
"assigned_agent":"name","depends_on":[]}}]}}"""
        
        response = self.llm.chat([{"role": "user", "content": prompt}])
        try:
            import re
            m = re.search(r'\{.*\}', response, re.DOTALL)
            if m:
                data = json.loads(m.group(0))
                return [SubTask(t["task_id"], t["description"],
                    t.get("assigned_agent"), t.get("depends_on", []))
                    for t in data["tasks"]]
        except (json.JSONDecodeError, KeyError):
            pass
        return [SubTask("t1", user_request)]
    
    def execute(self, user_request: str) -> Dict[str, Any]:
        tasks = self.decompose_task(user_request)
        context: Dict[str, Any] = {}
        remaining = list(tasks)
        
        for _ in range(len(tasks) * 2):
            ready = [t for t in remaining
                     if all(context.get(d) is not None for d in t.depends_on)]
            if not ready:
                break
            
            with ThreadPoolExecutor(max_workers=min(self.max_parallel, len(ready))) as ex:
                futures = {}
                for t in ready:
                    agent = self.agents.get(t.assigned_agent) or list(self.agents.values())[0]
                    deps = {d: context[d] for d in t.depends_on if d in context}
                    futures[ex.submit(agent.handler, t.description, deps)] = t
                
                for f in as_completed(futures):
                    task = futures[f]
                    try:
                        context[task.task_id] = f.result()
                        task.status = TaskStatus.COMPLETED
                    except Exception:
                        task.status = TaskStatus.FAILED
                    if task in remaining:
                        remaining.remove(task)
        
        return {
            "results": context,
            "completed": len([t for t in tasks if t.status == TaskStatus.COMPLETED])
        }
```

### 适用场景

- 需要多个专业Agent协同完成的复杂任务
- 任务有明确的分解和依赖关系
- 需要细粒度控制和审计的工作流

### 相关模式

- **Hierarchical**：Orchestrator是扁平编排，Hierarchical是层级编排
- **Pipeline**：Orchestrator的并行能力可替代简单的Pipeline
- **Blackboard**：Orchestrator主动调度，Blackboard被动通信

---

## 32.3 Blackboard 模式

### 意图

提供一个**共享的黑板（Blackboard）**作为Agent之间的通信媒介，各Agent独立监听黑板上的信息变化，自主决定是否参与处理。

### 动机

Blackboard模式起源于人工智能的早期研究（H.P. Nii, 1986），最初用于语音识别系统 Hearsay-II。其核心思想是：**不告诉Agent做什么，而是让Agent自己判断是否该做什么**。黑板上的内容变化就像是一个"公告栏"，所有Agent都可以看到，但只有认为自己能够做出贡献的Agent才会行动。

这种模式特别适合问题求解路径不确定、需要"机会主义"求解的场景。

### 结构

```
┌──────────────────────────────────────────┐
│           Blackboard System              │
│        ┌─────────────────┐              │
│        │   Blackboard     │              │
│        │  hypothesis/数据  │              │
│        │  partial_solution │              │
│        └────────┬────────┘              │
│    ┌────────────┼────────────┐         │
│    ▼            ▼            ▼         │
│ ┌──────┐   ┌──────┐    ┌──────┐       │
│ │Agent │   │Agent │    │Agent │       │
│ │(监听) │   │(监听) │    │(监听) │       │
│ └──────┘   └──────┘    └──────┘       │
└──────────────────────────────────────────┘
```

### 参与者

- **Blackboard**：共享数据结构，存储问题状态和中间结果
- **Knowledge Sources（Agent）**：独立的Agent，各自擅长不同领域
- **Controller**：监控黑板状态，判断终止条件

### 协作

1. Controller将初始问题写入黑板
2. 所有Agent监听黑板变化，满足条件的Agent被激活
3. 被激活的Agent处理信息，将结果写回黑板
4. 新信息可能触发其他Agent
5. 重复直到达到终止条件

### 效果

**优点：** 高度解耦、支持增量求解、新Agent可随时加入、天然支持并行
**缺点：** 终止条件难确定、黑板可能成为性能瓶颈、行为不可预测

### 实现

```python
"""
Blackboard 模式实现
"""
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from threading import Lock
import time


class EntryType(Enum):
    PROBLEM = "problem"
    HYPOTHESIS = "hypothesis"
    SOLUTION = "solution"


@dataclass
class BlackboardEntry:
    entry_id: str
    entry_type: EntryType
    content: Any
    confidence: float = 0.0
    source: str = ""
    timestamp: float = field(default_factory=time.time)


class KnowledgeSource:
    def __init__(self, name: str, can_contribute: Callable, process: Callable):
        self.name = name
        self.can_contribute = can_contribute
        self.process = process


class Blackboard:
    def __init__(self):
        self._entries: Dict[str, BlackboardEntry] = {}
        self._lock = Lock()
    
    def write(self, entry: BlackboardEntry) -> None:
        with self._lock:
            self._entries[entry.entry_id] = entry
    
    def read_all(self, entry_type: EntryType = None) -> List[BlackboardEntry]:
        with self._lock:
            entries = list(self._entries.values())
        return [e for e in entries if entry_type is None or e.entry_type == entry_type]
    
    def has_solution(self, min_conf: float = 0.8) -> bool:
        return any(e.entry_type == EntryType.SOLUTION and e.confidence >= min_conf
                   for e in self._entries.values())


class BlackboardController:
    def __init__(self, bb: Blackboard, max_rounds: int = 20):
        self.bb = bb
        self.sources: List[KnowledgeSource] = []
        self.max_rounds = max_rounds
    
    def solve(self, problem: str) -> Dict:
        self.bb.write(BlackboardEntry("p0", EntryType.PROBLEM, problem, 1.0))
        
        for _ in range(self.max_rounds):
            if self.bb.has_solution():
                break
            for src in self.sources:
                entries = self.bb.read_all()
                if src.can_contribute(entries):
                    for e in (src.process(entries) or []):
                        self.bb.write(e)
        
        sols = self.bb.read_all(EntryType.SOLUTION)
        return {"solutions": [{"content": s.content, "confidence": s.confidence} for s in sols]}
```

### 适用场景

- 问题求解路径不确定（诊断系统、创意生成）
- 需要增量式构建解决方案
- 研究型AI系统（假设生成与验证）

### 相关模式

- **Orchestrator**：主动调度 vs 被动监听
- **Swarm**：黑板间接通信 vs 直接通信

---

## 32.4 Pipeline 模式

### 意图

将多个Agent组织为**流水线**，数据按固定顺序流经每个处理阶段，每个Agent专注于处理数据的某个方面。

### 动机

许多数据处理任务具有天然的阶段性——先清洗、再转换、后分析。Pipeline模式借鉴了Unix管道的设计哲学：每个Agent做一件简单的事，通过串联组合完成复杂任务。核心优势在于**简单性和可预测性**。

### 结构

```
Input ──▶ [Stage 1: 清洗] ──▶ [Stage 2: 转换] ──▶ [Stage 3: 输出] ──▶ Output
```

### 参与者

- **Pipeline**：流水线管理器
- **Stage**：处理阶段
- **PipelineContext**：在Stage之间传递的上下文

### 效果

**优点：** 简单直观、Stage可独立测试、便于添加/移除Stage
**缺点：** 缺乏灵活性、整体延迟为各Stage之和、单Stage失败可能中断Pipeline

### 实现

```python
"""Pipeline 模式实现"""
from typing import List, Optional, Callable, Any
from dataclasses import dataclass, field
import time


@dataclass
class PipelineContext:
    data: Any
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    stage_results: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineStage:
    name: str
    process: Callable[[PipelineContext], PipelineContext]
    condition: Optional[Callable[[PipelineContext], bool]] = None
    on_error: str = "stop"


class Pipeline:
    """Pipeline - 流水线管理器"""
    def __init__(self, name: str = "default", verbose: bool = False):
        self.name = name
        self.stages: List[PipelineStage] = []
        self.verbose = verbose
    
    def add_stage(self, stage: PipelineStage) -> 'Pipeline':
        self.stages.append(stage)
        return self
    
    def execute(self, input_data: Any) -> PipelineContext:
        ctx = PipelineContext(data=input_data)
        for i, stage in enumerate(self.stages):
            if stage.condition and not stage.condition(ctx):
                continue
            start = time.time()
            try:
                ctx = stage.process(ctx)
                ctx.stage_results[stage.name] = {"status": "ok",
                    "ms": (time.time() - start) * 1000}
            except Exception as e:
                ctx.errors.append(f"{stage.name}: {e}")
                if stage.on_error == "stop":
                    break
        return ctx
```

### 适用场景

- 数据处理流水线（ETL）
- 文档处理（翻译→摘要→格式化）
- 内容审核（过滤→分类→标注）

### 相关模式

- **Orchestrator**：Pipeline固定流程 vs Orchestrator动态调度

---

## 32.5 Swarm 模式

### 意图

让多个**同质或半同质的Agent**以**群体智能（Swarm Intelligence）**的方式协作，通过简单的局部交互涌现出复杂的全局行为。

### 动机

Swarm模式借鉴自然界蜂群的集体智慧：没有中央控制，每个个体遵循简单规则，但整体能完成复杂任务。OpenAI的 Swarm 框架（2024）是这种模式的代表实现。

核心机制是**Handoff（交接）**——Agent可以将任务移交给另一个更合适的Agent，形成灵活的协作链。

### 结构

```
┌──────────────────────────────────────┐
│          Swarm System                 │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │Agent │◀▶│Agent │◀▶│Agent │      │
│  │ A    │  │ B    │  │ C    │      │
│  └──────┘  └──────┘  └──────┘      │
│       通过 Handoff 协议交接任务        │
└──────────────────────────────────────┘
```

### 参与者

- **Swarm Agents**：轻量级、可互换的Agent节点
- **Handoff Protocol**：任务交接协议

### 效果

**优点：** 高度可扩展、鲁棒性强、无单点故障、负载自然均衡
**缺点：** 行为难预测、调试困难、可能循环交接、全局一致性难保证

### 实现

```python
"""Swarm 模式实现"""
from typing import Dict, Optional, Callable
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    name: str
    handler: Callable
    can_handoff_to: list = field(default_factory=list)


@dataclass
class Handoff:
    target: str
    reason: str = ""


class SwarmAgent:
    def __init__(self, config: AgentConfig):
        self.name = config.name
        self.handler = config.handler
        self.can_handoff_to = config.can_handoff_to


class Swarm:
    """Swarm - 群体智能管理器"""
    def __init__(self, max_handoffs: int = 10, verbose: bool = False):
        self.agents: Dict[str, SwarmAgent] = {}
        self.max_handoffs = max_handoffs
        self.verbose = verbose
    
    def add_agent(self, config: AgentConfig) -> 'Swarm':
        self.agents[config.name] = SwarmAgent(config)
        return self
    
    def run(self, message: str, entry: str = None) -> dict:
        current = self.agents[entry or list(self.agents.keys())[0]]
        handoffs = 0
        visited = [current.name]
        
        while handoffs <= self.max_handoffs:
            response, handoff = current.handler(current, message, self.agents)
            if not handoff:
                break
            if handoff.target in visited or handoff.target not in self.agents:
                break
            visited.append(handoff.target)
            current = self.agents[handoff.target]
            message = response
            handoffs += 1
        
        return {"response": response, "chain": visited, "handoffs": handoffs}
```

### 适用场景

- 客服系统（多技能坐席协作）
- 需要高可扩展性和容错的系统

### 相关模式

- **Peer-to-Peer**：Swarm通过Handoff协作，P2P通过直接消息协作
- **Orchestrator**：Swarm去中心化，Orchestrator中心化

---

## 32.6 Hierarchical 模式

### 意图

将Agent组织为**层级结构**，上层Agent负责管理和协调下层Agent，形成类似组织架构的"管理者-执行者"关系。

### 动机

面对极其复杂的任务，单一的Orchestrator可能力不从心，需要多级管理来处理不同粒度的子任务。MetaGPT（2023）是典型实现：模拟软件公司组织架构（产品经理→架构师→工程师→QA），通过层级协作完成开发任务。

### 结构

```
         ┌──────────┐
         │ Manager  │
         └────┬─────┘
      ┌───────┼───────┐
      ▼       ▼       ▼
   [Lead A] [Lead B] [Lead C]
    ┌─┴─┐    ┌─┴─┐
   [W] [W]  [W] [W]
```

### 参与者

- **Manager Agent**：上层，任务分解和分配
- **Team Lead**：中层，管理Worker
- **Worker Agent**：底层，执行具体任务

### 效果

**优点：** 支持复杂任务分解、职责明确、可扩展
**缺点：** 层级过深增加延迟、信息传递可能丢失上下文、错误级联

### 实现

```python
"""Hierarchical 模式实现"""
from typing import Dict, Any, Callable, List
from dataclasses import dataclass, field
from enum import Enum
import json


class Level(Enum):
    MANAGER = "manager"
    LEAD = "lead"
    WORKER = "worker"


@dataclass
class HierarchyNode:
    name: str
    level: Level
    handler: Callable = None
    children: List['HierarchyNode'] = field(default_factory=list)
    
    def add_child(self, child: 'HierarchyNode'):
        self.children.append(child)
        return child


class HierarchicalSystem:
    def __init__(self, root: HierarchyNode, verbose: bool = False):
        self.root = root
        self.verbose = verbose
    
    def _exec(self, node: HierarchyNode, task: str, ctx=None) -> Any:
        ctx = ctx or {}
        if not node.children:
            return node.handler(task, ctx) if node.handler else task
        if node.handler:
            return node.handler(node, task, ctx)
        return {c.name: self._exec(c, task, ctx) for c in node.children}
    
    def execute(self, task: str) -> Any:
        return self._exec(self.root, task)


# 示例：模拟软件公司
root = HierarchyNode("CEO", Level.MANAGER,
    lambda n, t, c: {ch.name: ch.handler(ch, t, c) if ch.handler else None
                      for ch in n.children})
tech = root.add_child(HierarchyNode("CTO", Level.LEAD,
    lambda n, t, c: {ch.name: ch.handler(t, c) for ch in n.children}))
tech.add_child(HierarchyNode("前端", Level.WORKER, lambda t, c: f"[前端] {t}"))
tech.add_child(HierarchyNode("后端", Level.WORKER, lambda t, c: f"[后端] {t}"))
```

### 适用场景

- 大型复杂项目
- 企业多部门协作
- 需要多级审批的工作流

### 相关模式

- **Orchestrator**：Hierarchical是多层级版本
- **Plan-and-Execute**：天然支持计划-执行范式

---

## 32.7 Peer-to-Peer 模式

### 意图

让Agent以**对等（Peer-to-Peer）**的方式直接通信和协作，没有中心控制器，所有Agent地位平等。

### 动机

Orchestrator和Hierarchical模式都依赖中心节点，这引入了单点故障和性能瓶颈。P2P模式借鉴分布式计算的P2P网络思想：每个Agent既是客户端也是服务端，可以主动发起请求也可以响应请求。

这种模式特别适合分布式部署、边缘计算和需要强鲁棒性的场景。IPFS、BitTorrent等系统已经证明了P2P架构的可行性。

### 结构

```
┌──────────────────────────────────────┐
│       Peer-to-Peer Network            │
│  ┌──────┐   ┌──────┐   ┌──────┐    │
│  │Peer A│◀─▶│Peer B│◀─▶│Peer C│    │
│  └──┬───┘   └──┬───┘   └──┬───┘    │
│     │           │          │         │
│     └───────────┼──────────┘         │
│                 ▼                     │
│         [Message Bus / Gossip]        │
│                                       │
│  ┌──────┐   ┌──────┐                 │
│  │Peer D│◀─▶│Peer E│                 │
│  └──────┘   └──────┘                 │
└──────────────────────────────────────┘
```

### 参与者

- **Peer Agent**：对等节点，既是请求发起者也是响应者
- **Message Bus**：消息传递基础设施
- **Discovery Service**：Agent发现服务（可选）

### 协作

1. Peer A有任务需要协助
2. Peer A通过消息总线广播请求或直接联系已知Peer
3. 有能力的Peer响应并提供结果
4. 结果通过消息总线返回给Peer A

### 效果

**优点：**
- 无单点故障——去中心化架构
- 高可扩展性——Peer可以随时加入或离开
- 强鲁棒性——部分节点故障不影响整体
- 低延迟——直接通信无需经过中心节点

**缺点：**
- 全局协调困难——缺乏中心控制
- 一致性保证复杂——分布式一致性问题
- 安全性挑战——需要信任机制
- 调试困难——分布式调试的天然复杂性

### 实现

```python
"""Peer-to-Peer 模式实现"""
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import uuid
import time


@dataclass
class PeerMessage:
    msg_id: str
    sender: str
    content: Any
    msg_type: str = "request"  # request, response, broadcast
    target: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


class PeerAgent:
    """P2P Agent节点"""
    def __init__(self, name: str, capabilities: List[str],
                 handler: Callable, verbose: bool = False):
        self.name = name
        self.capabilities = capabilities
        self.handler = handler
        self.verbose = verbose
        self.peers: Dict[str, 'PeerAgent'] = {}
        self.message_log: List[Dict] = []
    
    def connect(self, peer: 'PeerAgent') -> None:
        """连接到其他Peer"""
        self.peers[peer.name] = peer
        peer.peers[self.name] = self
    
    def send(self, target_name: str, content: Any) -> Optional[Any]:
        """直接发送消息给指定Peer"""
        if target_name not in self.peers:
            return None
        
        msg = PeerMessage(str(uuid.uuid4()), self.name, content, "request", target_name)
        self.message_log.append({"role": "sender", "msg_id": msg.msg_id, "target": target_name})
        
        peer = self.peers[target_name]
        response = peer.handler(msg)
        
        peer.message_log.append({"role": "receiver", "msg_id": msg.msg_id, "from": self.name})
        return response
    
    def broadcast(self, content: Any) -> Dict[str, Any]:
        """广播消息给所有连接的Peer"""
        msg = PeerMessage(str(uuid.uuid4()), self.name, content, "broadcast")
        results = {}
        for name, peer in self.peers.items():
            response = peer.handler(msg)
            results[name] = response
        return results
    
    def handle_request(self, msg: PeerMessage) -> Any:
        """处理收到的请求"""
        return self.handler(msg)


class PeerNetwork:
    """P2P 网络管理器"""
    def __init__(self, verbose: bool = False):
        self.peers: Dict[str, PeerAgent] = {}
        self.verbose = verbose
    
    def add_peer(self, peer: PeerAgent) -> None:
        self.peers[peer.name] = peer
    
    def connect_all(self) -> None:
        """全连接拓扑"""
        names = list(self.peers.keys())
        for i, n1 in enumerate(names):
            for n2 in names[i+1:]:
                self.peers[n1].connect(self.peers[n2])
    
    def find_peer(self, capability: str) -> Optional[PeerAgent]:
        """按能力查找Peer"""
        for peer in self.peers.values():
            if capability in peer.capabilities:
                return peer
        return None


def demo_p2p():
    def search_handler(msg):
        return f"[搜索结果] {msg.content}"
    
    def analyze_handler(msg):
        return f"[分析报告] {msg.content}"
    
    network = PeerNetwork()
    peer_a = PeerAgent
    peer_a = PeerAgent("A", ["search"], search_handler)
    peer_b = PeerAgent("B", ["analyze"], analyze_handler)
    network.add_peer(peer_a)
    network.add_peer(peer_b)
    network.connect_all()
    result = peer_a.send("B", "分析这段数据")
    print(f"P2P结果: {result}")
```

### 适用场景

- 分布式AI系统（跨区域部署）
- 边缘计算场景
- 需要强鲁棒性和自愈能力的系统
- 联邦学习、隐私计算

### 相关模式

- **Swarm**：P2P通过消息总线通信，Swarm通过Handoff交接
- **Orchestrator**：P2P完全去中心化，Orchestrator完全中心化
- **Blackboard**：P2P直接通信，Blackboard通过共享空间间接通信

---

## 32.8 模式对比与选择

本章介绍的六种多Agent编排模式各有优劣，适用于不同的场景。下表从多个维度进行了对比：

| 维度 | Orchestrator | Blackboard | Pipeline | Swarm | Hierarchical | P2P |
|------|:-----------:|:----------:|:--------:|:-----:|:------------:|:---:|
| 中心化程度 | 高 | 低 | 中 | 低 | 高 | 无 |
| 灵活性 | 中 | 高 | 低 | 高 | 中 | 高 |
| 可预测性 | 高 | 低 | 高 | 低 | 中 | 低 |
| 容错性 | 低 | 中 | 低 | 高 | 低 | 高 |
| 可扩展性 | 中 | 高 | 中 | 高 | 中 | 高 |
| 调试难度 | 低 | 高 | 低 | 高 | 中 | 高 |
| 适用规模 | 小-中 | 中-大 | 小-中 | 大 | 大 | 大 |

**实践建议：**

1. **从小开始**：先用Orchestrator或Pipeline验证方案，再考虑更复杂的模式
2. **混合使用**：不同层级可以使用不同的编排模式（如上层Orchestrator，下层Pipeline）
3. **关注可观测性**：无论哪种模式，都需要完善的日志和监控
4. **渐进式演进**：随着系统复杂度增长，逐步引入更复杂的编排模式

---

*"如果我们把每个Agent看作一个神经元，那么多Agent系统就是一个神经网络。智能不在于单个神经元，而在于它们之间的连接方式。"*
