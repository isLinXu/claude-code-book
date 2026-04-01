# 第4章：Agent 核心概念

> **理解 Agent 的本质——一个能感知环境、进行推理、并采取行动的自主系统**

---

## 4.1 什么是 Agent

### 4.1.1 从 Chatbot 到 Agent

如果你使用过 ChatGPT，你已经在和一种最简单的"Agent"交互了——只不过它的能力被严格限定在对话范围内。当你问它一个问题，它基于自己的训练数据和你的输入生成回答。但当你让它"帮我查一下今天的天气"或者"帮我在 GitHub 上创建一个 Issue"时，普通 Chatbot 就无能为力了。

**Agent（智能体）** 是对这种局限性的突破。它不仅仅能"说"，更能"做"。

一个正式的定义：

> **Agent 是一个以 LLM 为核心推理引擎，能够自主感知环境、制定计划、调用工具并执行行动，从而完成复杂目标的自治系统。**

关键区别在于：

| 特性 | Chatbot | Agent |
|------|---------|-------|
| 交互方式 | 单轮/多轮对话 | 持续的感知-推理-行动循环 |
| 能力边界 | 限于文本生成 | 可以调用外部工具、操作 API |
| 自主性 | 被动响应 | 主动规划和执行 |
| 状态管理 | 无状态或简单对话历史 | 维护长期记忆和世界模型 |
| 目标导向 | 回答问题 | 完成任务 |

### 4.1.2 Agent 的直觉类比

理解 Agent 最好的方式是类比人类自身：

- **你（LLM）** 是大脑，负责思考和决策
- **你的手（工具）** 可以操作键盘、手机、各种工具
- **你的眼睛和耳朵（感知）** 观察环境，获取信息
- **你的记忆（记忆系统）** 帮你记住过去的经验和知识
- **你的计划能力（规划器）** 帮你把大目标分解为小步骤

Agent 就是把这个过程系统化、自动化的产物。

```python
# 一个最简化的 Agent 概念模型
class SimpleAgent:
    def __init__(self):
        self.brain = LLM()           # 推理引擎
        self.tools = ToolBox()       # 工具集
        self.memory = Memory()       # 记忆系统
        self.planner = Planner()     # 规划器
    
    def run(self, task: str):
        """Agent 的核心循环"""
        while not self.is_done(task):
            # 1. 感知：收集当前状态
            context = self.perceive(task)
            
            # 2. 推理：思考下一步该做什么
            action = self.think(context)
            
            # 3. 行动：执行决策
            result = self.act(action)
            
            # 4. 记忆：记录结果
            self.remember(result)
```

### 4.1.3 Agent 的能力层次

并非所有 Agent 都是平等的。根据其能力的复杂度，我们可以分为几个层次：

```
┌──────────────────────────────────────┐
│  Level 5: 自主 Agent                 │  ← 完全自主，多 Agent 协作
│  (Autonomous Multi-Agent)           │
├──────────────────────────────────────┤
│  Level 4: 规划 Agent                 │  ← 能分解复杂任务，自我反思
│  (Planning & Reflection Agent)      │
├──────────────────────────────────────┤
│  Level 3: 工具使用 Agent             │  ← 能调用 API、搜索、执行代码
│  (Tool-Using Agent)                 │
├──────────────────────────────────────┤
│  Level 2: 增强型 Chatbot             │  ← 有上下文记忆，RAG 增强
│  (Augmented Chatbot)                │
├──────────────────────────────────────┤
│  Level 1: 基础 Chatbot               │  ← 单轮/多轮文本对话
│  (Basic Chatbot)                    │
└──────────────────────────────────────┘
```

本卷主要聚焦于 Level 2-4 的内容，Level 5 的多 Agent 协作将在卷三中详细讨论。

---

## 4.2 Agent 架构模型

Agent 的架构决定了它如何组织"思考"和"行动"。目前主流的架构模型有三种，各有适用场景。

### 4.2.1 ReAct：推理与行动交织

**ReAct**（Reasoning + Acting）是目前最广泛使用的 Agent 架构，由 Yao 等人在 2022 年提出。其核心思想是：**推理和行动交替进行，形成 "Thought → Action → Observation" 的循环**。

```
用户提问
  │
  ▼
┌─────────────────────────────────────────┐
│  Thought: 我需要先搜索相关信息           │
│  Action: search("Python asyncio 教程")   │
│  Observation: 找到了3篇相关文章...       │
│                                         │
│  Thought: 我需要查看第一篇文章的内容      │
│  Action: read_page("article_1_url")     │
│  Observation: 文章介绍了 event loop...   │
│                                         │
│  Thought: 我已经有足够信息来回答了       │
│  Action: answer("根据搜索结果...")       │
└─────────────────────────────────────────┘
```

**ReAct 的优势：**
- 过程透明——每一步推理都可以被追踪
- 灵活性高——可以根据中间结果调整策略
- 实现相对简单

```python
import json
from typing import Callable

class ReActAgent:
    """ReAct 架构的 Agent 实现"""
    
    def __init__(self, llm, tools: dict[str, Callable]):
        self.llm = llm
        self.tools = tools
        self.max_iterations = 10
    
    def run(self, task: str) -> str:
        history = [{"role": "user", "content": task}]
        
        for i in range(self.max_iterations):
            # LLM 进行推理
            response = self.llm.chat(
                messages=history,
                tools=self._get_tool_definitions()
            )
            
            # 如果 LLM 直接给出最终回答
            if not response.tool_calls:
                return response.content
            
            # 执行工具调用
            for tool_call in response.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                
                # 执行工具
                result = self.tools[tool_name](**tool_args)
                
                # 记录到历史
                history.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [tool_call]
                })
                history.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(result)
                })
        
        return "达到最大迭代次数，任务未完成。"
```

### 4.2.2 Plan-and-Execute：先规划再执行

与 ReAct 的"边想边做"不同，**Plan-and-Execute** 架构采用分阶段策略：先制定完整计划，再逐步执行。

```
用户提问
  │
  ▼
┌─────────────┐
│  Planner    │  制定完整计划
│  (规划器)    │  → Step 1: 搜索数据
└──────┬──────┘  → Step 2: 分析数据
       │         → Step 3: 生成报告
       ▼         → Step 4: 格式化输出
┌─────────────┐
│  Executor   │  按计划逐步执行
│  (执行器)    │  执行 Step 1 → 得到结果 1
└──────┬──────┘  执行 Step 2 → 得到结果 2
       │         ...
       ▼
   最终结果
```

```python
from pydantic import BaseModel
from typing import List

class PlanStep(BaseModel):
    """计划中的单个步骤"""
    step_id: int
    description: str
    tool: str | None = None        # 需要的工具
    depends_on: List[int] = []     # 依赖的前置步骤
    expected_output: str           # 预期产出

class Plan(BaseModel):
    """完整的执行计划"""
    goal: str
    steps: List[PlanStep]
    
    def get_ready_steps(self, completed: set[int]) -> List[PlanStep]:
        """获取可执行的步骤（依赖已满足）"""
        return [
            step for step in self.steps
            if step.step_id not in completed
            and all(dep in completed for dep in step.depends_on)
        ]

class PlanAndExecuteAgent:
    """Plan-and-Execute 架构实现"""
    
    def __init__(self, llm, executor):
        self.llm = llm
        self.executor = executor
    
    def plan(self, task: str) -> Plan:
        """让 LLM 制定计划"""
        prompt = f"""请为以下任务制定一个详细的执行计划。
        每个步骤应该清晰、可执行，并注明需要的工具和依赖关系。

        任务：{task}
        
        请用 JSON 格式返回计划。"""
        
        response = self.llm.chat(prompt)
        return Plan.model_validate_json(response.content)
    
    def execute(self, plan: Plan) -> dict:
        """按计划执行"""
        results = {}
        completed = set()
        
        while len(completed) < len(plan.steps):
            ready = plan.get_ready_steps(completed)
            
            for step in ready:
                result = self.executor.execute(step)
                results[step.step_id] = result
                completed.add(step.step_id)
                
                # 根据执行结果决定是否需要重新规划
                if not result.success:
                    revised_plan = self.replan(plan, step, result.error)
                    if revised_plan:
                        plan = revised_plan
                        break
        
        return results
    
    def rep plan(self, plan, failed_step, error):
        """重新规划失败的步骤"""
        prompt = f"""步骤 {failed_step.description} 执行失败。
        错误信息：{error}
        请修改计划中剩余的步骤。"""
        # ... 重新规划的实现
```

**Plan-and-Execute 的优势：**
- 适合复杂、多步骤任务
- 计划可复用、可审查
- 步骤可并行（无依赖关系的步骤）

**劣势：**
- 前期规划成本高
- 面对意外情况需要重新规划
- 不适合需要实时交互的场景

### 4.2.3 Reflexion：带自我反思的 Agent

**Reflexion** 架构由 Shinn 等人在 2023 年提出，在 ReAct 的基础上增加了**自我反思（Self-Reflection）**机制。Agent 执行完行动后，会评估结果是否满意，如果不满意就反思失败原因并调整策略。

```
Thought → Action → Observation
                        │
                        ▼
                  结果是否满意？
                   ╱          ╲
                 是             否
                 │               │
                 ▼               ▼
              输出结果      Reflection（反思）
                              │
                              ▼
                     为什么失败了？
                     如何改进？
                              │
                              ▼
                    调整策略，重新执行
```

```python
class ReflexionAgent(ReActAgent):
    """带自我反思能力的 Agent"""
    
    def __init__(self, llm, tools, evaluator):
        super().__init__(llm, tools)
        self.evaluator = evaluator  # 结果评估器
        self.reflection_history = []
    
    def run(self, task: str, max_attempts: int = 3) -> str:
        """带反思重试的执行循环"""
        for attempt in range(max_attempts):
            # 使用 ReAct 执行任务
            result = super().run(task)
            
            # 评估结果
            evaluation = self.evaluator.evaluate(task, result)
            
            if evaluation.is_satisfactory:
                return result
            
            # 反思失败原因
            reflection = self._reflect(task, result, evaluation)
            self.reflection_history.append({
                "attempt": attempt + 1,
                "result": result,
                "evaluation": evaluation,
                "reflection": reflection
            })
            
            # 将反思注入下一次执行的上下文
            task = f"""原始任务：{task}
            
            上一次尝试的结果：{result}
            评估反馈：{evaluation.feedback}
            反思总结：{reflection}
            
            请根据以上反馈重新完成任务。"""
        
        return result  # 返回最后一次尝试的结果
    
    def _reflect(self, task, result, evaluation):
        """让 LLM 反思失败原因"""
        prompt = f"""任务：{task}
        我的回答：{result}
        评估反馈：{evaluation.feedback}
        
        请分析为什么我的回答不够好，并给出具体的改进建议。"""
        
        return self.llm.chat(prompt)
```

### 4.2.4 三种架构的对比

| 维度 | ReAct | Plan-and-Execute | Reflexion |
|------|-------|------------------|-----------|
| **决策方式** | 边想边做 | 先想后做 | 做完再想 |
| **适合任务** | 中等复杂度 | 高复杂度、多步骤 | 需要高质量输出的任务 |
| **推理透明度** | 高（每步可见） | 高（计划可见） | 极高（含反思） |
| **执行效率** | 中等 | 高（可并行） | 低（多轮尝试） |
| **Token 消耗** | 中等 | 较高（规划阶段） | 高（反思消耗） |
| **实现复杂度** | 低 | 中 | 中高 |

**选型建议：**
- 快速原型 / 简单工具使用场景 → **ReAct**
- 复杂工作流 / 数据分析管线 → **Plan-and-Execute**
- 代码生成 / 写作 / 需要质量保证 → **Reflexion**

---

## 4.3 Agent 核心组件

无论采用哪种架构，一个完整的 Agent 都由以下核心组件构成。

### 4.3.1 LLM：推理引擎

LLM 是 Agent 的"大脑"，负责理解输入、进行推理、生成决策。但 Agent 对 LLM 的要求不同于普通对话：

```python
class AgentLLM:
    """为 Agent 场景优化的 LLM 封装"""
    
    def __init__(self, model: str, api_key: str):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self._call_count = 0
        self._total_tokens = 0
    
    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.1,     # Agent 场景下温度宜低
        response_format: dict | None = None
    ) -> dict:
        """Agent 专用的聊天接口"""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        
        if response_format:
            kwargs["response_format"] = response_format
        
        response = self.client.chat.completions.create(**kwargs)
        
        # 统计 Token 使用
        self._call_count += 1
        self._total_tokens += response.usage.total_tokens
        
        return response.choices[0].message
    
    @property
    def stats(self) -> dict:
        return {
            "call_count": self._call_count,
            "total_tokens": self._total_tokens,
            "avg_tokens_per_call": (
                self._total_tokens / self._call_count
                if self._call_count > 0 else 0
            )
        }
```

**Agent 场景下的 LLM 配置要点：**

| 参数 | 推荐值 | 原因 |
|------|--------|------|
| `temperature` | 0.0 - 0.3 | 低随机性确保稳定决策 |
| `top_p` | 0.9 - 1.0 | 与低 temperature 配合 |
| `max_tokens` | 4096+ | 确保有足够空间生成完整响应 |
| `response_format` | 按需 | 结构化输出时可指定 JSON |

### 4.3.2 工具集：Agent 的"手"

工具赋予 Agent 与外部世界交互的能力。第6章将深入讨论，这里先了解基本概念。

```python
from pydantic import BaseModel, Field
from typing import Any

class ToolDefinition(BaseModel):
    """工具定义的统一格式"""
    name: str = Field(description="工具名称，需唯一")
    description: str = Field(description="工具功能的自然语言描述")
    parameters: dict = Field(description="JSON Schema 格式的参数定义")
    handler: Any = Field(exclude=True, description="实际的处理函数")
    
    class Config:
        arbitrary_types_allowed = True

# 示例：定义一个计算器工具
calculator_tool = ToolDefinition(
    name="calculator",
    description="执行数学计算。支持加减乘除、幂运算等。",
    parameters={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "数学表达式，如 '2 + 3 * 4'"
            }
        },
        "required": ["expression"]
    },
    handler=lambda expression: str(eval(expression))  # 仅演示，生产环境需安全处理
)

# 示例：定义一个文件读取工具
import os

def read_file_safe(filepath: str) -> str:
    """安全地读取文件内容"""
    filepath = os.path.normpath(filepath)
    # 防止路径遍历攻击
    if not filepath.startswith("/allowed/path/"):
        return "错误：不允许访问该路径"
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()[:10000]  # 限制长度
    except FileNotFoundError:
        return "错误：文件不存在"

file_reader_tool = ToolDefinition(
    name="read_file",
    description="读取指定路径的文本文件内容",
    parameters={
        "type": "object",
        "properties": {
            "filepath": {
                "type": "string",
                "description": "文件的绝对路径"
            }
        },
        "required": ["filepath"]
    },
    handler=read_file_safe
)
```

### 4.3.3 记忆系统：Agent 的"经验"

记忆系统让 Agent 能够在交互中积累经验，避免重复犯错，提供连贯的用户体验。第7章将深入讨论。

核心类型：

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass
class MemoryEntry:
    """记忆条目"""
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict)
    importance: float = 0.5  # 0-1, 用于记忆排序
    embedding: list[float] | None = None  # 用于语义检索

class MemorySystem:
    """Agent 记忆系统"""
    
    def __init__(self):
        self.short_term: list[MemoryEntry] = []  # 短期记忆（对话上下文）
        self.long_term: list[MemoryEntry] = []   # 长期记忆（持久化）
        self.max_short_term = 20
    
    def add(self, entry: MemoryEntry, memory_type: str = "short"):
        """添加记忆"""
        if memory_type == "short":
            self.short_term.append(entry)
            # 短期记忆满时，重要的转移到长期记忆
            if len(self.short_term) > self.max_short_term:
                self._evict()
        else:
            self.long_term.append(entry)
    
    def _evict(self):
        """短期记忆淘汰策略"""
        # 按重要性排序，保留最重要的
        self.short_term.sort(key=lambda x: x.importance, reverse=True)
        evicted = self.short_term[self.max_short_term:]
        self.short_term = self.short_term[:self.max_short_term]
        # 高重要性的淘汰记忆转移到长期记忆
        for entry in evicted:
            if entry.importance > 0.7:
                self.long_term.append(entry)
    
    def recall(self, query: str, top_k: int = 5) -> list[MemoryEntry]:
        """检索相关记忆"""
        # 简单实现：先从短期记忆中查找
        # 生产环境应使用向量检索（详见第7章）
        all_memories = self.short_term + self.long_term
        # TODO: 实现 embedding 相似度检索
        return all_memories[:top_k]
```

### 4.3.4 规划器：Agent 的"策略家"

规划器负责将复杂任务分解为可执行的子任务序列：

```python
class TaskDecomposer:
    """任务分解器"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def decompose(self, task: str) -> list[dict]:
        """将复杂任务分解为子任务"""
        prompt = f"""请将以下任务分解为具体的、可执行的子任务。
        
        要求：
        1. 每个子任务应该独立、可验证
        2. 标注子任务之间的依赖关系
        3. 标注每个子任务需要的工具或能力
        
        任务：{task}
        
        请用 JSON 格式返回：
        {{
            "subtasks": [
                {{
                    "id": 1,
                    "description": "...",
                    "depends_on": [],
                    "tool": "...",
                    "success_criteria": "..."
                }}
            ]
        }}"""
        
        response = self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        
        result = json.loads(response.content)
        return result["subtasks"]
```

---

## 4.4 Agent 生命周期

一个 Agent 从创建到完成任务，会经历以下生命周期阶段：

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  初始化   │───▶│  接收任务  │───▶│  执行循环  │───▶│  输出结果  │───▶│  清理资源  │
│ (Init)   │    │ (Receive)│    │ (Execute)│    │ (Output) │    │ (Cleanup)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                               │
     │                               │
     ▼                               ▼
 配置LLM、工具                     Thought → Action → 
 记忆系统、规划器                   Observation 循环
```

### 4.4.1 完整的 Agent 实现

```python
import asyncio
from typing import AsyncIterator
from dataclasses import dataclass, field

@dataclass
class AgentConfig:
    """Agent 配置"""
    name: str = "Agent"
    model: str = "gpt-4o"
    temperature: float = 0.1
    max_iterations: int = 15
    max_tokens_per_step: int = 4096
    verbose: bool = True


class Agent:
    """完整的 Agent 实现"""
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.llm = AgentLLM(model=config.model)
        self.tools: dict[str, ToolDefinition] = {}
        self.memory = MemorySystem()
        self._running = False
    
    def register_tool(self, tool: ToolDefinition):
        """注册工具"""
        self.tools[tool.name] = tool
    
    def register_tools(self, tools: list[ToolDefinition]):
        """批量注册工具"""
        for tool in tools:
            self.register_tool(tool)
    
    async def run(self, task: str) -> str:
        """执行任务（异步版本）"""
        self._running = True
        
        # 阶段1：初始化上下文
        system_prompt = self._build_system_prompt()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task}
        ]
        
        # 阶段2：执行循环
        for i in range(self.config.max_iterations):
            if not self._running:
                break
            
            # 调用 LLM
            tool_defs = [
                {
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters
                    }
                }
                for t in self.tools.values()
            ]
            
            response = self.llm.chat(
                messages=messages,
                tools=tool_defs if tool_defs else None,
                temperature=self.config.temperature
            )
            
            # 如果没有工具调用，说明 Agent 认为任务完成了
            if not response.tool_calls:
                self._log(f"[完成] {response.content}")
                return response.content
            
            # 阶段3：处理工具调用
            messages.append(response.model_dump())
            
            for tool_call in response.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                
                self._log(f"[工具调用] {func_name}({func_args})")
                
                # 执行工具
                try:
                    tool = self.tools[func_name]
                    result = await self._execute_tool(tool, func_args)
                    tool_result = str(result)
                except Exception as e:
                    tool_result = f"工具执行错误：{str(e)}"
                
                self._log(f"[工具结果] {tool_result[:200]}")
                
                # 记录工具结果
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                })
                
                # 存入记忆
                self.memory.add(MemoryEntry(
                    content=f"调用 {func_name} 得到：{tool_result[:500]}",
                    importance=0.5
                ))
        
        self._running = False
        return "达到最大迭代次数。"
    
    async def _execute_tool(self, tool: ToolDefinition, args: dict):
        """执行工具（带超时保护）"""
        try:
            return await asyncio.wait_for(
                asyncio.to_tool(tool.handler, **args),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            return "工具执行超时（30秒）"
    
    def _build_system_prompt(self) -> str:
        """构建系统提示词"""
        tool_descriptions = "\n".join(
            f"- {t.name}: {t.description}" for t in self.tools.values()
        )
        
        return f"""你是 {self.config.name}，一个 AI Agent。

## 你的能力
你可以使用以下工具：
{tool_descriptions}

## 工作方式
1. 分析用户的请求
2. 决定需要使用哪些工具
3. 按逻辑顺序调用工具
4. 综合工具的返回结果，给出最终回答

## 注意事项
- 每次只调用必要的工具
- 如果工具返回错误，尝试其他方法
- 在给出最终回答前，确保信息充分
"""
    
    def _log(self, message: str):
        """日志输出"""
        if self.config.verbose:
            print(message)
    
    def stop(self):
        """停止 Agent 执行"""
        self._running = False
```

### 4.4.2 Agent 的状态管理

在长期运行中，Agent 需要管理自己的状态：

```python
from enum import Enum

class AgentState(Enum):
    """Agent 状态枚举"""
    IDLE = "idle"               # 空闲
    PLANNING = "planning"       # 规划中
    EXECUTING = "executing"     # 执行中
    WAITING = "waiting"         # 等待外部输入
    REFLECTING = "reflecting"   # 反思中
    FINISHED = "finished"       # 已完成
    ERROR = "error"             # 出错

@dataclass
class AgentContext:
    """Agent 运行上下文"""
    task: str
    state: AgentState = AgentState.IDLE
    current_step: int = 0
    total_steps: int = 0
    tool_call_history: list[dict] = field(default_factory=list)
    error_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    
    @property
    def duration(self) -> float | None:
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return None
```

---

## 4.5 感知-推理-行动循环

### 4.5.1 循环的本质

Agent 的核心是一个持续运转的循环，每个循环周期包含三个阶段：

```
         ┌─────────────────────────────────┐
         │                                 │
         ▼                                 │
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  感知   │───▶│  推理   │───▶│  行动   │
    │Perceive │    │ Reason  │    │  Act    │
    └─────────┘    └─────────┘    └─────────┘
         │                               │
         │      ┌───────────┐           │
         └──────│  环境     │◀──────────┘
                │Environment│
                └───────────┘
```

### 4.5.2 感知（Perception）

感知是 Agent 获取环境信息的过程：

```python
class AgentPerception:
    """Agent 感知模块"""
    
    def __init__(self):
        self._sensors: list[Callable] = []
    
    def add_sensor(self, sensor: Callable):
        """添加感知器"""
        self._sensors.append(sensor)
    
    async def perceive(self) -> dict:
        """收集所有感知信息"""
        observations = {}
        for sensor in self._sensors:
            try:
                result = await sensor()
                observations[sensor.__name__] = result
            except Exception as e:
                observations[sensor.__name__] = f"感知错误：{e}"
        return observations

# 示例感知器
async def get_current_time() -> str:
    from datetime import datetime
    return datetime.now().isoformat()

async def check_file_exists(filepath: str) -> str:
    import os
    return f"exists: {os.path.exists(filepath)}"

async def get_system_info() -> str:
    import platform
    return f"{platform.system()} {platform.release()}"
```

### 4.5.3 推理（Reasoning）

推理是 Agent 分析感知信息、做出决策的过程：

```python
class AgentReasoner:
    """Agent 推理模块"""
    
    def __init__(self, llm, memory):
        self.llm = llm
        self.memory = memory
    
    def reason(self, task: str, observations: dict) -> dict:
        """
        基于任务和观察进行推理
        返回：{
            "thought": "推理过程",
            "action": "要执行的行动",
            "action_args": {...}
        }
        """
        # 检索相关记忆
        relevant_memories = self.memory.recall(task)
        memory_context = "\n".join(
            f"- {m.content}" for m in relevant_memories
        )
        
        prompt = f"""## 当前任务
{task}

## 环境观察
{json.dumps(observations, ensure_ascii=False, indent=2)}

## 相关经验
{memory_context if memory_context else "无相关经验"}

请分析当前情况，决定下一步行动。用 JSON 格式返回：
{{
    "thought": "你的思考过程",
    "action": "要调用的工具名称（如果没有合适的工具，填 'finish'）",
    "action_args": {{}},
    "confidence": 0.0-1.0
}}"""
        
        response = self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        
        return json.loads(response.content)
```

### 4.5.4 行动（Action）

行动是 Agent 改变环境的过程：

```python
class AgentActor:
    """Agent 行动模块"""
    
    def __init__(self, tools: dict[str, ToolDefinition]):
        self.tools = tools
    
    async def act(self, action: str, args: dict) -> dict:
        """执行行动"""
        if action == "finish":
            return {"status": "done", "result": args.get("result", "")}
        
        if action not in self.tools:
            return {
                "status": "error",
                "error": f"未知工具：{action}，可用工具：{list(self.tools.keys())}"
            }
        
        tool = self.tools[action]
        
        try:
            # 参数验证
            validated_args = self._validate_args(tool, args)
            
            # 执行
            result = await asyncio.to_tool(tool.handler, **validated_args)
            
            return {
                "status": "success",
                "result": result,
                "tool_used": action
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "tool_used": action
            }
    
    def _validate_args(self, tool: ToolDefinition, args: dict) -> dict:
        """验证工具参数"""
        from pydantic import validate_json
        schema = tool.parameters
        return validate_json(json.dumps(args), schema)
```

---

## 4.6 Agent 评估指标

如何评估一个 Agent 的好坏？以下是常用的评估维度。

### 4.6.1 任务完成度

```python
class AgentEvaluator:
    """Agent 评估器"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def evaluate_completion(
        self,
        task: str,
        result: str,
        criteria: list[str] | None = None
    ) -> dict:
        """评估任务完成度"""
        criteria_str = "\n".join(
            f"- {c}" for c in (criteria or ["正确性", "完整性"])
        )
        
        prompt = f"""请评估以下 Agent 的任务完成情况。

## 任务
{task}

## Agent 的输出
{result}

## 评估标准
{criteria_str}

请用 JSON 格式返回评分：
{{
    "score": 0-10,
    "correctness": 0-10,
    "completeness": 0-10,
    "efficiency": 0-10,
    "feedback": "具体的改进建议"
}}"""
        
        response = self.llm.chat(prompt, temperature=0.1)
        return json.loads(response.content)
```

### 4.6.2 效率指标

```python
@dataclass
class AgentMetrics:
    """Agent 运行指标"""
    # 任务指标
    task_success: bool = False
    task_score: float = 0.0
    
    # 效率指标
    total_steps: int = 0
    tool_calls: int = 0
    successful_tool_calls: int = 0
    failed_tool_calls: int = 0
    
    # 资源消耗
    total_tokens: int = 0
    total_duration_seconds: float = 0.0
    llm_api_calls: int = 0
    
    # 质量指标
    hallucination_count: int = 0
    self_corrections: int = 0
    unnecessary_steps: int = 0
    
    @property
    def tool_success_rate(self) -> float:
        if self.tool_calls == 0:
            return 0.0
        return self.successful_tool_calls / self.tool_calls
    
    @property
    def tokens_per_step(self) -> float:
        if self.total_steps == 0:
            return 0.0
        return self.total_tokens / self.total_steps
    
    def summary(self) -> str:
        return f"""
=== Agent 运行报告 ===
任务状态: {'✅ 成功' if self.task_success else '❌ 失败'}
任务评分: {self.task_score}/10

执行步骤: {self.total_steps}
工具调用: {self.tool_calls} (成功率: {self.tool_success_rate:.1%})
Token消耗: {self.total_tokens:,} (平均: {self.tokens_per_step:.0f}/步)
运行时间: {self.total_duration_seconds:.1f}s

幻觉次数: {self.hallucination_count}
自我修正: {self.self_corrections}
冗余步骤: {self.unnecessary_steps}
"""
```

### 4.6.3 基准测试

```python
class AgentBenchmark:
    """Agent 基准测试"""
    
    def __init__(self, agent, evaluator):
        self.agent = agent
        self.evaluator = evaluator
    
    def run_benchmark(
        self,
        test_cases: list[dict]
    ) -> dict:
        """
        运行基准测试
        test_cases: [
            {
                "task": "任务描述",
                "expected": "预期结果（可选）",
                "criteria": ["评估标准1", "评估标准2"]
            }
        ]
        """
        results = []
        
        for i, case in enumerate(test_cases):
            print(f"\n{'='*50}")
            print(f"测试用例 {i+1}/{len(test_cases)}")
            print(f"任务：{case['task']}")
            print(f"{'='*50}")
            
            # 运行 Agent
            start = time.time()
            result = self.agent.run(case["task"])
            duration = time.time() - start
            
            # 评估
            evaluation = self.evaluator.evaluate_completion(
                task=case["task"],
                result=result,
                criteria=case.get("criteria")
            )
            
            results.append({
                "task": case["task"],
                "result": result,
                "evaluation": evaluation,
                "duration": duration
            })
        
        # 汇总统计
        avg_score = sum(r["evaluation"]["score"] for r in results) / len(results)
        success_rate = sum(
            1 for r in results if r["evaluation"]["score"] >= 7
        ) / len(results)
        
        return {
            "total_cases": len(test_cases),
            "average_score": avg_score,
            "success_rate": success_rate,
            "results": results
        }
```

---

## 4.7 常见陷阱与最佳实践

### 4.7.1 常见陷阱

#### 陷阱1：过度依赖 LLM 的规划能力

LLM 的规划能力有上限。面对超过 10 步的复杂任务，LLM 往往会遗漏细节或产生矛盾。

**解决方案：**
- 将大任务分解为多个小 Agent 协作
- 使用外部规划算法（如状态空间搜索）辅助
- 设置检查点，在关键步骤验证中间结果

#### 陷阱2：工具描述模糊导致误用

```python
# ❌ 错误：描述太模糊
ToolDefinition(
    name="search",
    description="搜索东西"  # 太模糊！
)

# ✅ 正确：描述清晰具体
ToolDefinition(
    name="search_web",
    description="在互联网上搜索最新信息。"
                "返回搜索结果的标题、URL和摘要。"
                "适合查找实时信息、新闻、技术文档。"
                "不适合数学计算或代码执行。"
)
```

#### 陷阱3：无限循环

Agent 可能陷入 "调用工具→失败→重试→再失败" 的循环。

**解决方案：**
```python
# 在 Agent 循环中加入防护
class LoopDetector:
    """循环检测器"""
    
    def __init__(self, max_retries: int = 3, lookback: int = 5):
        self.max_retries = max_retries
        self.lookback = lookback
        self._action_history: list[str] = []
    
    def check(self, action: str, args: dict) -> bool:
        """检查是否陷入循环，返回 True 表示检测到循环"""
        action_sig = f"{action}:{json.dumps(args, sort_keys=True)}"
        self._action_history.append(action_sig)
        
        # 检查最近 N 步是否有重复
        recent = self._action_history[-self.lookback:]
        if len(recent) >= self.max_retries:
            # 如果同一动作重复超过阈值
            if len(set(recent)) == 1:
                return True
            
            # 如果出现循环模式（如 A→B→A→B）
            for pattern_len in range(1, len(recent)//2 + 1):
                pattern = recent[:pattern_len]
                repetitions = len(recent) // pattern_len
                if recent[:pattern_len * repetitions] == pattern * repetitions:
                    return True
        
        return False
```

#### 陷阱4：忽略成本控制

Agent 的 Token 消耗可能很快失控。一个复杂任务可能消耗数十万 Token。

**解决方案：**
```python
class TokenBudget:
    """Token 预算管理器"""
    
    def __init__(self, max_tokens: int, warning_threshold: float = 0.8):
        self.max_tokens = max_tokens
        self.warning_threshold = warning_threshold
        self.used_tokens = 0
    
    def consume(self, tokens: int) -> bool:
        """消耗 Token，返回是否还有预算"""
        self.used_tokens += tokens
        
        if self.used_tokens >= self.max_tokens:
            return False  # 预算耗尽
        
        if self.used_tokens >= self.max_tokens * self.warning_threshold:
            print(f"⚠️ Token 预算警告：已使用 {self.used_tokens}/{self.max_tokens}")
        
        return True
    
    @property
    def remaining(self) -> int:
        return self.max_tokens - self.used_tokens
```

### 4.7.2 最佳实践

#### 实践1：渐进式复杂度

不要一开始就构建最复杂的 Agent。从简单开始，逐步增加能力。

```
Level 1: 纯对话 → 验证 Prompt 效果
Level 2: 单工具  → 验证 Function Calling
Level 3: 多工具  → 验证工具选择逻辑
Level 4: 记忆系统 → 验证上下文管理
Level 5: 规划能力 → 验证复杂任务处理
```

#### 实践2：可观测性

Agent 的决策过程应该是可观测的：

```python
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("agent")

@asynccontextmanager
async def trace_step(step_name: str, **metadata):
    """追踪 Agent 步骤"""
    logger.info(f"[开始] {step_name}", extra=metadata)
    start = time.time()
    
    try:
        yield
        duration = time.time() - start
        logger.info(
            f"[完成] {step_name} ({duration:.2f}s)",
            extra={**metadata, "duration": duration, "status": "success"}
        )
    except Exception as e:
        duration = time.time() - start
        logger.error(
            f"[失败] {step_name} ({duration:.2f}s): {e}",
            extra={**metadata, "duration": duration, "status": "error", "error": str(e)}
        )
        raise
```

#### 实践3：优雅降级

当工具不可用时，Agent 应该有备选方案：

```python
class ResilientAgent(Agent):
    """具备降级能力的 Agent"""
    
    async def _execute_tool(self, tool: ToolDefinition, args: dict):
        """带降级的工具执行"""
        try:
            return await super()._execute_tool(tool, args)
        except asyncio.TimeoutError:
            # 降级策略：使用 LLM 的内置知识
            self._log(f"⚠️ 工具 {tool.name} 超时，使用降级策略")
            return await self._fallback(tool.name, args)
        except ConnectionError:
            self._log(f"⚠️ 工具 {tool.name} 连接失败，使用降级策略")
            return await self._fallback(tool.name, args)
    
    async def _fallback(self, tool_name: str, args: dict) -> str:
        """降级处理"""
        fallback_prompt = f"""工具 {tool_name} 不可用。
        原始参数：{json.dumps(args)}
        请基于你的知识给出最佳估计。"""
        
        response = self.llm.chat(
            messages=[{"role": "user", "content": fallback_prompt}],
            temperature=0.3
        )
        return f"[降级结果] {response.content}"
```

---

## 4.8 本章小结

本章我们建立了 Agent 的核心认知框架：

1. **Agent 的本质**：以 LLM 为核心，具备感知、推理、行动能力的自治系统
2. **三种主流架构**：ReAct（边想边做）、Plan-and-Execute（先想后做）、Reflexion（做完再想）
3. **四大核心组件**：LLM（大脑）、工具集（手）、记忆系统（经验）、规划器（策略）
4. **生命周期管理**：从初始化到清理的完整流程
5. **感知-推理-行动循环**：Agent 运转的核心机制
6. **评估指标**：任务完成度、效率、成本等多维度评价
7. **常见陷阱**：无限循环、成本失控、工具误用等

掌握了这些核心概念，你已经有了一个完整的 Agent 认知地图。接下来的章节将逐一深入每个组件的实现细节——下一章我们将聚焦 Agent 的"大脑"：LLM 与 Prompt Engineering。

---

> **下一章**：[第5章：LLM 基础与 Prompt Engineering](ch05_LLM基础与Prompt_Engineering.md) —— 理解 Agent 推理引擎的工作原理，掌握高效 Prompt 设计技巧。
