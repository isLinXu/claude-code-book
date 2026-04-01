# 第9章：Agent推理与规划

> "人类智能的本质不在于计算能力，而在于推理和规划的能力。"
> ——Herbert Simon

---

## 9.1 推理：Agent 的"思考"核心

推理（Reasoning）是 Agent 区别于传统程序的关键能力。传统程序执行预定义的逻辑，而 Agent 能够根据上下文进行动态推理，选择最优的行动方案。

### 9.1.1 推理的层次模型

```
┌─────────────────────────────────────────┐
│     Layer 4: 元推理 (Meta-Reasoning)        │
│     "我的推理过程是否正确？"               │
├─────────────────────────────────────────┤
│     Layer 3: 规划推理 (Planning)           │
│     "为了达到目标，我应该按什么顺序做？"     │
├─────────────────────────────────────────┤
│     Layer 2: 因果推理 (Causal)             │
│     "如果我做X，会导致Y吗？"              │
├─────────────────────────────────────────┤
│     Layer 1: 模式匹配 (Pattern)            │
│     "这个问题类似于我见过的..."            │
└─────────────────────────────────────────┘
```

推理层次的差异决定了 Agent 的能力边界。一个只具备 Layer 1 能力的 Agent 只能做简单的模式匹配；而具备 Layer 4 能力的 Agent 能自我审视推理过程，发现并纠正自己的逻辑错误。现实中的生产级 Agent，通常需要 Layer 2-3 的推理能力。

---

## 9.2 ReAct：推理与行动交织

ReAct（Reasoning and Acting）由 Yao et al. 在 2023 年提出，是 Agent 推理的基础范式。其核心思想是让模型在推理（Thought）和行动（Action）之间交替进行，每一步行动的结果作为下一步推理的输入。

### 9.2.1 ReAct 核心循环

```
┌─────────────────────────────────────────┐
│              ReAct 循环                    │
│                                         │
│   ┌──────────┐                           │
│   │  Question │                          │
│   └────┬─────┘                           │
│        ↓                                 │
│   ┌──────────┐                           │
│   │ Thought  │ ← "我需要..."              │
│   └────┬─────┘                           │
│        ↓                                 │
│   ┌──────────┐                           │
│   │ Action   │ ← 调用工具/搜索/计算       │
│   └────┬─────┘                           │
│        ↓                                 │
│   ┌──────────┐                           │
│   │Observation│ ← 工具返回结果            │
│   └────┬─────┘                           │
│        ↓                                 │
│   ┌──────────┐                           │
│   │ Thought  │ ← "根据结果..."            │
│   └────┬─────┘                           │
│        ↓                                 │
│   ┌──────────┐                           │
│   │ Answer   │ ← 最终答案                 │
│   └──────────┘                           │
└─────────────────────────────────────────┘
```

与单纯的 Chain-of-Thought（CoT）相比，ReAct 的关键改进在于引入了**外部工具交互**。CoT 只能基于模型内部知识进行推理，而 ReAct 可以在推理过程中主动获取信息——搜索网页、查询数据库、执行代码。

### 9.2.2 ReAct 完整实现

```python
from typing import Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import json, re


class StepType(Enum):
    THOUGHT = "thought"
    ACTION = "action"
    OBSERVATION = "observation"
    ANSWER = "answer"


@dataclass
class ReActStep:
    """ReAct 单步记录"""
    step_type: StepType
    content: str
    tool_name: str | None = None
    tool_input: dict | None = None
    observation: str | None = None


class ToolRegistry:
    """工具注册中心"""

    def __init__(self):
        self._tools: dict[str, dict] = {}

    def register(self, name: str, description: str,
                 function: Callable, parameters: dict = None):
        self._tools[name] = {
            "name": name,
            "description": description,
            "function": function,
            "parameters": parameters or {},
        }

    async def execute(self, name: str, **kwargs) -> str:
        tool = self._tools.get(name)
        if not tool:
            return f"错误: 工具 '{name}' 不存在"
        try:
            result = await tool["function"](**kwargs)
            return str(result)
        except Exception as e:
            return f"工具执行错误: {str(e)}"

    def get_tools_description(self) -> str:
        lines = []
        for name, tool in self._tools.items():
            lines.append(f"- {name}: {tool['description']}")
        return "\n".join(lines)


class ReActAgent:
    """ReAct Agent 实现"""

    SYSTEM_PROMPT = """你是一个有帮助的 AI 助手。请使用以下格式回答问题：

思考: 分析当前情况和下一步行动
行动: 工具名[参数]
观察: (系统会提供)
... (思考/行动/观察 重复)
最终答案: 问题的最终答案

可用工具:
{tools}

规则:
1. 每次只能使用一个工具
2. 思考必须明确说明选择理由
3. 工具失败时思考替代方案
4. 确定答案后输出"最终答案: ..."
"""

    def __init__(self, llm_client, tools: ToolRegistry,
                 max_iterations: int = 10):
        self.llm = llm_client
        self.tools = tools
        self.max_iterations = max_iterations
        self.history: list[ReActStep] = []

    async def run(self, question: str) -> str:
        system = self.SYSTEM_PROMPT.format(
            tools=self.tools.get_tools_description()
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": question},
        ]

        for _ in range(self.max_iterations):
            response = await self.llm.chat(messages)
            steps = self._parse_response(response)

            for step in steps:
                self.history.append(step)

                if step.step_type == StepType.ANSWER:
                    return step.content

                if step.step_type == StepType.ACTION:
                    obs = await self.tools.execute(
                        step.tool_name, **(step.tool_input or {})
                    )
                    self.history.append(ReActStep(
                        step_type=StepType.OBSERVATION,
                        content=obs,
                    ))
                    messages.append({
                        "role": "assistant",
                        "content": f"行动: {step.content}"
                    })
                    messages.append({
                        "role": "user",
                        "content": f"观察: {obs}"
                    })

        return "抱歉，在最大迭代次数内未能找到答案。"

    def _parse_response(self, response: str) -> list[ReActStep]:
        steps = []
        for line in response.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("思考:"):
                steps.append(ReActStep(
                    step_type=StepType.THOUGHT,
                    content=line[3:].strip()))
            elif line.startswith("行动:"):
                name, inp = self._parse_action(line[3:].strip())
                steps.append(ReActStep(
                    step_type=StepType.ACTION,
                    content=line[3:].strip(),
                    tool_name=name, tool_input=inp))
            elif line.startswith("最终答案:"):
                steps.append(ReActStep(
                    step_type=StepType.ANSWER,
                    content=line[5:].strip()))
        return steps

    def _parse_action(self, text: str) -> tuple:
        match = re.match(r'(\w+)\[(.+)\]', text)
        if match:
            name = match.group(1)
            try:
                inp = json.loads(match.group(2))
            except json.JSONDecodeError:
                inp = {"query": match.group(2)}
            return name, inp
        return text, {}


# ---- 使用示例 ----
async def demo_react():
    tools = ToolRegistry()

    async def calculator(expression: str) -> str:
        try:
            return str(eval(expression))
        except Exception as e:
            return f"计算错误: {e}"

    async def search(query: str) -> str:
        return f"搜索 '{query}' 的结果: Python 3.12 于 2023年10月发布。"

    tools.register("calculator", "计算数学表达式", calculator)
    tools.register("search", "搜索信息", search)

    # agent = ReActAgent(llm_client, tools)
    # result = await agent.run("Python 3.12 发布距今多少天？")
```

### 9.2.3 ReAct 的局限

ReAct 虽然强大，但有几个固有局限：

1. **线性依赖**：推理链是线性的，一旦某步出错，后续全部受影响
2. **无法回溯**：走入死胡同后只能从头开始
3. **视角单一**：每次只探索一条推理路径

这些局限催生了更高级的推理策略——Tree-of-Thought 和 Graph-of-Thought。

---

## 9.3 Tree-of-Thought：树状思维推理

### 9.3.1 从线性到树状

Tree-of-Thought（ToT）由 Yao et al. 在 2023 年提出，将推理过程从单链扩展为树结构，允许模型同时探索多条推理路径，并通过评估选择最优者。

```
ReAct (线性):              Tree-of-Thought (树状):

Q → T1 → A1 → Answer      Q ─┬─ T1a ─ T2a ─ T3a → Answer ✓
                              ├─ T1b ─ T2b → (放弃)
                              └─ T1c ─ T2c ─ T3c → Answer ✓
```

ToT 的关键创新在于**分叉探索 + 评估剪枝**。每个推理步骤可以生成多个候选思维，评估后只保留最有前景的分支继续深入。

### 9.3.2 ToT 实现框架

```python
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ThoughtNode:
    """思维节点"""
    id: str
    content: str
    parent_id: str | None = None
    children_ids: list[str] = field(default_factory=list)
    score: float = 0.0
    depth: int = 0
    is_terminal: bool = False


class TreeOfThought:
    """树状思维推理引擎"""

    def __init__(self, llm_client: Any,
                 num_branches: int = 3,
                 max_depth: int = 5,
                 top_k: int = 2):
        self.llm = llm_client
        self.num_branches = num_branches
        self.max_depth = max_depth
        self.top_k = top_k
        self.nodes: dict[str, ThoughtNode] = {}
        self._counter = 0

    def _gen_id(self) -> str:
        self._counter += 1
        return f"n_{self._counter}"

    async def solve(self, problem: str) -> str:
        """使用树状思维解决问题"""

        # 1. 生成初始思维分支
        thoughts = await self._generate_thoughts(problem)
        for t in thoughts:
            nid = self._gen_id()
            self.nodes[nid] = ThoughtNode(id=nid, content=t, depth=0)

        frontier = list(self.nodes.keys())

        # 2. BFS 逐层扩展
        for depth in range(1, self.max_depth + 1):
            next_frontier = []

            for nid in frontier:
                node = self.nodes[nid]
                if node.is_terminal:
                    continue

                # 生成分支
                children = await self._generate_thoughts(
                    f"问题: {problem}\n之前: {node.content}"
                )
                for c in children:
                    cid = self._gen_id()
                    child = ThoughtNode(
                        id=cid, content=c,
                        parent_id=nid, depth=depth,
                    )
                    self.nodes[cid] = child
                    node.children_ids.append(cid)
                    next_frontier.append(cid)

            # 3. 评估 + 剪枝
            for cid in next_frontier:
                node = self.nodes[cid]
                node.score = await self._evaluate(node.content, problem)
                node.is_terminal = self._check_terminal(node.content)

            # 保留 top_k
            scored = sorted(
                next_frontier,
                key=lambda x: self.nodes[x].score,
                reverse=True
            )
            frontier = scored[:self.top_k]

        # 4. 返回最佳路径
        return self._best_path_summary()

    async def _generate_thoughts(self, context: str) -> list[str]:
        """生成多个候选思维"""
        prompt = f"""基于以下上下文，生成 {self.num_branches} 个不同的推理步骤。
用换行分隔：
{context}"""
        # response = await self.llm.chat(prompt)
        # return [l.strip() for l in response.split("\n") if l.strip()]
        return [f"思维步骤 {i+1}" for i in range(self.num_branches)]

    async def _evaluate(self, thought: str, problem: str) -> float:
        """评估思维质量 (0-10)"""
        prompt = f"""评估以下推理步骤的质量(0-10):
问题: {problem}
步骤: {thought}
只输出一个数字。"""
        # return float(await self.llm.chat(prompt))
        return 7.0

    def _check_terminal(self, thought: str) -> bool:
        markers = ["答案是", "因此", "最终", "结论"]
        return any(m in thought for m in markers)

    def _best_path_summary(self) -> str:
        terminals = [n for n in self.nodes.values() if n.is_terminal]
        if not terminals:
            terminals = [max(self.nodes.values(), key=lambda n: n.score)]
        best = max(terminals, key=lambda n: n.score)
        path = []
        cur = best
        while cur:
            path.append(cur.content)
            cur = self.nodes.get(cur.parent_id)
        path.reverse()
        return "\n→ ".join(path)
```

### 9.3.3 搜索策略对比

| 策略 | 描述 | 适用场景 | 优势 | 劣势 |
|------|------|---------|------|------|
| **BFS** | 逐层展开，每层保留 top_k | 方案比较、创意生成 | 全局最优 | 消耗大 |
| **DFS** | 深度优先探索单条路径 | 数学推理、逻辑证明 | 节省资源 | 可能错过好分支 |
| **Beam Search** | 固定宽度束搜索 | 翻译、摘要生成 | 平衡效率和质量 | 宽度是超参数 |
| **MCTS** | 蒙特卡洛树搜索 | 博弈、复杂决策 | 渐进精确 | 实现复杂 |

---

## 9.4 Graph-of-Thought：图状思维推理

### 9.4.1 从树到图

Graph-of-Thought（GoT）由 Besta et al. 在 2023 年提出，将推理空间从树扩展为有向无环图（DAG）。相比 ToT，GoT 增加了一个关键操作：**合并（Aggregate）**——可以将不同分支的思维合并为更全面的结论。

```
Tree-of-Thought:          Graph-of-Thought:

    A                          A ──┐
    ├─ B                       │   │
    │  └─ C                B       D
    └─ D                       │  ╲ │ ╱
       └─ E                C ── E ── F (合并)
```

GoT 支持四种图操作：

| 操作 | 描述 |
|------|------|
| **Branch（分叉）** | 从现有节点生成新分支 |
| **Merge（合并）** | 合并多个节点的思维 |
| **Refine（精炼）** | 改进现有节点的思维 |
| **Loop（循环）** | 回到之前节点重新推理 |

### 9.4.2 GoT 实现框架

```python
from collections import defaultdict


class GraphOfThought:
    """图状思维推理引擎"""

    def __init__(self, llm_client: Any):
        self.llm = llm_client
        self.nodes: dict[str, dict] = {}
        self.edges: dict[str, list[str]] = defaultdict(list)
        self._counter = 0

    def _gen_id(self) -> str:
        self._counter += 1
        return f"g_{self._counter}"

    def add_node(self, content: str, score: float = 0.0) -> str:
        nid = self._gen_id()
        self.nodes[nid] = {"content": content, "score": score}
        return nid

    def add_edge(self, from_id: str, to_id: str, etype: str):
        self.edges[from_id].append(to_id)
        # 存储边类型（用于可视化/调试）
        self.edges[f"{from_id}->{to_id}"] = etype

    async def branch(self, parent_id: str, num: int = 2) -> list[str]:
        """从父节点分叉出新思维"""
        parent = self.nodes[parent_id]
        prompt = f"""基于: {parent['content']}
生成 {num} 个不同的后续推理步骤。"""
        # response = await self.llm.chat(prompt)
        child_ids = []
        for i in range(num):
            cid = self.add_node(f"分支 {i+1}")
            self.add_edge(parent_id, cid, "branch")
            child_ids.append(cid)
        return child_ids

    async def merge(self, node_ids: list[str]) -> str:
        """合并多个节点的思维"""
        contents = "\n".join(
            f"- {self.nodes[nid]['content']}" for nid in node_ids
        )
        prompt = f"""合并以下思维为一个综合结论:
{contents}"""
        # response = await self.llm.chat(prompt)
        merged_id = self.add_node("合并结果")
        for nid in node_ids:
            self.add_edge(nid, merged_id, "merge")
        return merged_id

    async def refine(self, node_id: str) -> str:
        """精炼改进某个节点"""
        node = self.nodes[node_id]
        prompt = f"""改进以下推理（保持核心思路）:
{node['content']}"""
        # response = await self.llm.chat(prompt)
        refined_id = self.add_node("改进结果")
        self.add_edge(node_id, refined_id, "refine")
        return refined_id

    async def solve(self, problem: str, budget: int = 15) -> str:
        """使用图操作解决问题"""
        # 初始节点
        init_ids = [self.add_node(f"初始思维 {i}") for i in range(3)]

        ops = 0
        frontier = init_ids[:]

        while ops < budget:
            import random
            op = random.choice(["branch", "branch", "merge", "refine"])

            match op:
                case "branch":
                    parent = random.choice(frontier)
                    new_ids = await self.branch(parent)
                    frontier.extend(new_ids)

                case "merge":
                    if len(frontier) >= 2:
                        pair = random.sample(frontier, 2)
                        mid = await self.merge(pair)
                        frontier.append(mid)

                case "refine":
                    if frontier:
                        target = random.choice(frontier)
                        rid = await self.refine(target)
                        frontier.append(rid)

            ops += 1

        # 返回得分最高的节点
        best = max(self.nodes.values(), key=lambda n: n.get("score", 0))
        return best["content"]
```

---

## 9.5 任务分解与子目标规划

### 9.5.1 任务分解器

复杂任务需要分解为可管理的子任务。关键原则：

- **原子性**：每个子任务应该独立可执行
- **显式依赖**：明确标注子任务间的依赖关系
- **可并行化**：无依赖的子任务应标记为可并行

```python
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SubTask:
    id: str
    description: str
    dependencies: list[str] = field(default_factory=list)
    estimated_effort: float = 1.0
    status: str = "pending"
    result: Any = None


class TaskDecomposer:
    """智能任务分解器"""

    PROMPT = """将以下任务分解为子任务。
规则:
1. 每个子任务原子化（不可再分）
2. 标注依赖关系
3. 估算复杂度 (1-5)
4. 最多8个子任务

任务: {task}

输出JSON:
{{"subtasks": [{{"id":"s1","description":"...","dependencies":[],"complexity":1}}]}}"""

    async def decompose(self, task: str, llm_client=None) -> list[SubTask]:
        # response = await llm_client.chat(self.PROMPT.format(task=task))
        # parsed = json.loads(response)
        # return [SubTask(**s) for s in parsed["subtasks"]]

        # 模拟
        return [
            SubTask(id="s1", description="分析需求文档"),
            SubTask(id="s2", description="设计技术方案",
                    dependencies=["s1"]),
            SubTask(id="s3", description="实现核心功能",
                    dependencies=["s2"]),
            SubTask(id="s4", description="编写测试",
                    dependencies=["s3"]),
            SubTask(id="s5", description="安全审查",
                    dependencies=["s3"]),
            SubTask(id="s6", description="部署上线",
                    dependencies=["s4", "s5"]),
        ]


class TaskPlanner:
    """任务规划器：生成分层执行计划"""

    def plan(self, subtasks: list[SubTask]) -> list[list[str]]:
        """生成分层并行执行计划"""
        task_map = {st.id: st for st in subtasks}
        layers = []
        completed = set()
        remaining = set(st.id for st in subtasks)

        while remaining:
            ready = [
                tid for tid in remaining
                if all(dep in completed
                       for dep in task_map[tid].dependencies)
            ]
            if not ready:
                raise ValueError("循环依赖检测")
            layers.append(sorted(ready))
            completed.update(ready)
            remaining -= set(ready)

        return layers


# 演示
def demo_planning():
    decomposer = TaskDecomposer()
    planner = TaskPlanner()

    subtasks = [
        SubTask(id="s1", description="分析需求"),
        SubTask(id="s2", description="设计", dependencies=["s1"]),
        SubTask(id="s3", description="编码", dependencies=["s2"]),
        SubTask(id="s4", description="测试", dependencies=["s3"]),
        SubTask(id="s5", description="审查", dependencies=["s3"]),
    ]

    plan = planner.plan(subtasks)
    for i, layer in enumerate(plan):
        label = "并行" if len(layer) > 1 else ""
        print(f"第{i+1}层{label}: {', '.join(layer)}")

    # 输出:
    # 第1层: s1
    # 第2层: s2
    # 第3层: s3
    # 第4层并行: s4, s5
```

---

## 9.6 自我反思与迭代优化

### 9.6.1 Reflexion 模式

Reflexion（Shinn et al., 2023）让 Agent 在失败后生成"反思"文本，作为后续尝试的额外上下文。这模拟了人类"从错误中学习"的能力。

```python
@dataclass
class ReflectionEntry:
    attempt: int
    action: str
    result: str
    success: bool
    reflection: str
    lesson: str


class ReflexionAgent:
    """具备反思能力的 Agent"""

    MAX_REFLECTIONS = 3

    def __init__(self, llm_client, max_attempts: int = 5):
        self.llm = llm_client
        self.max_attempts = max_attempts
        self.reflections: list[ReflectionEntry] = []

    async def run(self, task: str, evaluator) -> dict:
        for attempt in range(1, self.max_attempts + 1):
            context = self._build_context(task, attempt)
            action = await self._get_action(context)
            result = await self._execute(action)
            evaluation = await evaluator(result)

            if evaluation["success"]:
                return {"success": True, "result": result,
                        "attempts": attempt}

            # 反思失败原因
            reflection = await self._reflect(action, result)
            self.reflections.append(ReflectionEntry(
                attempt=attempt, action=action, result=result,
                success=False,
                reflection=reflection["text"],
                lesson=reflection["lesson"],
            ))

        return {"success": False, "reflections": self.reflections}

    def _build_context(self, task: str, attempt: int) -> str:
        parts = [f"任务: {task}", f"当前: 第{attempt}次尝试"]
        if self.reflections:
            parts.append("历史教训:")
            for r in self.reflections[-self.MAX_REFLECTIONS:]:
                parts.append(f"  - {r.lesson}")
        return "\n".join(parts)

    async def _reflect(self, action: str, result: str) -> dict:
        """生成反思"""
        prompt = f"""上次操作失败。
操作: {action}
结果: {result}
请反思: 1) 为什么失败? 2) 下次应该怎么做?
输出JSON: {{"text":"...","lesson":"..."}}"""
        # response = await self.llm.chat(prompt)
        return {"text": "分析中...", "lesson": "下次注意..."}
```

### 9.6.2 迭代优化器

```python
class IterativeOptimizer:
    """对解决方案进行多轮迭代优化"""

    async def optimize(self, initial: str, task: str,
                       evaluator, max_iter: int = 5,
                       threshold: float = 0.1) -> dict:
        current = initial
        current_score = await evaluator(current)
        history = [{"iter": 0, "score": current_score}]

        for i in range(1, max_iter + 1):
            analysis = await self._analyze(current, task, current_score)
            improved = await self._improve(current, analysis, task)
            new_score = await evaluator(improved)
            delta = new_score - current_score
            history.append({"iter": i, "score": new_score,
                            "delta": delta})

            if delta > threshold:
                current = improved
                current_score = new_score
            else:
                break  # 改进幅度不足，停止

        return {
            "solution": current,
            "score": current_score,
            "iterations": len(history) - 1,
            "history": history,
        }
```

---

## 9.7 规划失败的处理策略

### 9.7.1 失败模式分类

| 失败模式 | 描述 | 处理策略 |
|---------|------|---------|
| **工具失败** | 工具调用返回错误 | 重试 → 降级 → 替代工具 |
| **推理死锁** | 循环推理无法前进 | 回溯到上一个分支 |
| **信息不足** | 缺少关键信息 | 主动搜索/询问用户 |
| **超时** | 推理时间过长 | 返回最佳已知答案 |
| **目标矛盾** | 子目标互相冲突 | 重新规划 |

### 9.7.2 弹性规划器

```python
from enum import Enum
from typing import Callable


class FailureType(Enum):
    TOOL_ERROR = "tool_error"
    DEADLOCK = "deadlock"
    INFO_GAP = "info_gap"
    TIMEOUT = "timeout"
    CONFLICT = "conflict"


class ResilientPlanner:
    """弹性规划器：处理各种失败"""

    def __init__(self, llm_client):
        self.llm = llm_client
        self.failure_log: list[dict] = []
        self.handlers: dict[FailureType, Callable] = {
            FailureType.TOOL_ERROR: self._tool_fallback,
            FailureType.DEADLOCK: self._backtrack,
            FailureType.INFO_GAP: self._ask_user,
            FailureType.TIMEOUT: self._return_best,
            FailureType.CONFLICT: self._replan,
        }

    async def plan_with_recovery(self, task: str,
                                  max_retries: int = 3) -> dict:
        for attempt in range(max_retries + 1):
            try:
                plan = await self._create_plan(task)
                result = await self._execute_plan(plan)

                if result["success"]:
                    return result

                failure = self._classify_failure(result)
                handler = self.handlers.get(failure)
                if handler:
                    recovery = await handler(task, result)
                    if recovery.get("recovered"):
                        return recovery["result"]

            except Exception as e:
                self.failure_log.append({"error": str(e)})

        return {"success": False,
                "message": "超过最大恢复次数"}

    async def _tool_fallback(self, task, result):
        """工具失败 → 尝试替代方案"""
        # 降级策略
        simplified = await self._create_simple_plan(task)
        return {"recovered": True,
                "result": await self._execute_plan(simplified)}

    async def _backtrack(self, task, result):
        """死锁 → 回溯"""
        return {"recovered": False, "action": "backtrack"}

    async def _ask_user(self, task, result):
        """信息不足 → 询问用户"""
        return {"recovered": False,
                "action": "need_user_input",
                "questions": ["请补充以下信息..."]}

    async def _return_best(self, task, result):
        """超时 → 返回当前最佳"""
        return {"recovered": True,
                "result": {"answer": result.get("best_known", ""),
                           "note": "超时，返回已知最佳答案"}}

    async def _replan(self, task, result):
        """目标冲突 → 重新规划"""
        return {"recovered": False, "action": "replan"}
```

---

## 9.8 动态规划与在线学习

### 9.8.1 自适应推理策略选择

不同类型的任务适合不同的推理策略。一个成熟的 Agent 应该能自动判断任务类型并选择最优策略：

```python
class AdaptiveReasoner:
    """根据任务特征自动选择推理策略"""

    PROFILES = {
        "mathematical": {
            "strategy": "cot",      # Chain-of-Thought
            "fallback": "tot",
            "temperature": 0.0,
            "max_steps": 5,
        },
        "creative": {
            "strategy": "tot",
            "fallback": "got",
            "temperature": 0.7,
            "max_steps": 8,
        },
        "analytical": {
            "strategy": "react",
            "fallback": "cot",
            "temperature": 0.1,
            "max_steps": 10,
        },
        "factual": {
            "strategy": "react",
            "fallback": "react",
            "temperature": 0.0,
            "max_steps": 6,
        },
    }

    async def classify_and_reason(self, task: str) -> dict:
        # 1. 分类
        task_type = await self._classify(task)
        profile = self.PROFILES[task_type]

        # 2. 用主策略推理
        result = await self._reason(task, profile["strategy"], profile)

        # 3. 主策略失败则用备选
        if not result["success"]:
            result = await self._reason(
                task, profile["fallback"], profile)

        return {"task_type": task_type, **result}

    async def _classify(self, task: str) -> str:
        prompt = f"""分类为: mathematical, creative, analytical, factual
任务: {task}
只输出分类名。"""
        # return (await self.llm.chat(prompt)).strip().lower()
        return "analytical"
```

### 9.8.2 从执行中学习

```python
from collections import defaultdict


class OnlineLearner:
    """Agent 在线学习器"""

    def __init__(self):
        self.history: list[dict] = []
        self.strategy_perf: dict[str, list[float]] = defaultdict(list)

    async def learn(self, task: str, strategy: str, outcome: dict):
        """记录一次执行的经验"""
        self.history.append({
            "task": task,
            "strategy": strategy,
            "success": outcome["success"],
            "score": outcome.get("score", 0),
        })
        self.strategy_perf[strategy].append(outcome.get("score", 0))

    def best_strategy(self) -> str:
        """基于历史数据选择最佳策略"""
        if not self.strategy_perf:
            return "react"
        return max(
            self.strategy_perf,
            key=lambda s: sum(self.strategy_perf[s]) /
                          len(self.strategy_perf[s])
        )

    def performance_summary(self) -> dict:
        summary = {}
        for s, scores in self.strategy_perf.items():
            if scores:
                summary[s] = {
                    "avg": sum(scores) / len(scores),
                    "runs": len(scores),
                    "best": max(scores),
                }
        return summary
```

---

## 9.9 最佳实践与常见陷阱

### 9.9.1 推理策略选择决策树

```
任务需要什么？
├── 数学推理 / 逻辑链
│   └── CoT + 自我验证
├── 创意探索 / 方案比较
│   └── ToT (BFS)
├── 复杂决策 / 多因素权衡
│   └── GoT
├── 需要外部信息
│   └── ReAct
└── 简单问答
    └── 直接生成（无需特殊策略）
```

### 9.9.2 常见陷阱

```python
# ❌ 陷阱1：过度推理
# 简单问题使用复杂策略 → 浪费成本和时间
if complexity(task) <= 2:
    result = await simple_generate(task)
else:
    result = await tot.solve(task)  # 只在需要时才用

# ❌ 陷阱2：忽视推理成本
# ToT 每步都调用 LLM，5 层 × 3 分支 = 15 次调用
budget = ReasoningBudget(max_calls=20, max_tokens=10000)

# ❌ 陷阱3：盲目信任推理结果
# LLM 的推理可能包含逻辑错误
async def verified_reasoning(task):
    chain = await self.reason(task)
    for step in chain.critical_steps:
        if not await self.verify(step):
            step = await self.rereason(step)
    return chain

# ❌ 陷阱4：反思循环
# 不断反思但从不行动
MAX_REFLECTIONS = 3
for attempt in range(max_attempts):
    action = await self.plan(task)
    result = await self.execute(action)
    if self.evaluate(result):
        return result
    if attempt < MAX_REFLECTIONS:
        context += f"\n反思: {await self.reflect(result)}"
    # 超过限制后强制行动
```

### 9.9.3 生产环境推理检查清单

```
推理系统上线检查清单：
├── [ ] 任务分类器已验证（准确率 > 90%）
├── [ ] 每种推理策略有超时和预算限制
├── [ ] 失败降级策略已定义
├── [ ] 反思次数有上限（防止循环）
├── [ ] 推理链可追溯（日志完整）
├── [ ] 关键步骤有验证机制
├── [ ] Token 消耗有预算告警
├── [ ] 性能基准测试已通过
└── [ ] 成本/质量权衡已评估
```

---

## 9.10 小结

本章深入探讨了 Agent 推理与规划的核心技术：

- **ReAct** 是推理的基础范式，将思考与行动交织，让 Agent 能动态获取信息
- **Tree-of-Thought** 将线性推理扩展为树状探索，支持多路径比较和剪枝
- **Graph-of-Thought** 进一步引入合并和精炼操作，实现更灵活的思维协同
- **任务分解** 是处理复杂问题的前提，原子化子任务 + 显式依赖是关键
- **自我反思** 让 Agent 能从失败中学习，Reflexion 模式显著提升多轮任务表现
- **弹性规划** 确保规划失败时系统仍能优雅降级
- **自适应推理** 根据任务特征动态选择策略，平衡质量与成本

**核心洞见**：推理能力不是越复杂越好，而是要与问题复杂度匹配。简单的 CoT 对多数场景已经足够；ToT/GoT 适用于真正需要探索的复杂决策；而 ReAct 是需要外部信息时的首选。

**下一章预告：** 第10章将建立完整的 Agent 评估体系，从指标定义到基准测试，从自动化评估到人类评估，帮助你系统地衡量和提升 Agent 的表现。

---

*第9章 · Agent推理与规划* | *Agent 编程：从原理到生产级实践 · 卷三 · 进阶篇*
