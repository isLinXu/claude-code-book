# 第31章 单Agent模式

> "简单性是可靠性的前提。" —— Edsger W. Dijkstra

## 31.1 概述

单Agent模式是所有Agent设计模式的基石。在复杂的多Agent编排之前，一个设计精良的单Agent就足以解决大量实际业务问题。本章深入探讨六种核心的单Agent行为模式：ReAct、Plan-and-Execute、Reflection、Router、Guardrails 和 Adapter。

单Agent模式的核心挑战在于：**如何让一个Agent既足够智能地处理复杂任务，又足够可控地遵守业务约束**。这六种模式从不同的维度回应了这一挑战——ReAct解决推理与行动的融合，Plan-and-Execute处理长期规划，Reflection实现自我改进，Router处理意图分发，Guardrails确保安全边界，Adapter处理模型异构性。

---

## 31.2 ReAct 模式（Reasoning + Acting）

### 意图

将**推理（Reasoning）**与**行动（Acting）**交织在一起，使Agent能够在每一步推理后决定下一步行动，形成"思考-行动-观察-再思考"的迭代循环。

### 动机

传统的Chain-of-Thought（CoT）方法虽然在推理能力上表现出色，但它是纯粹的思维链，无法与外部世界交互。Agent需要的不只是"想"，还要"做"——查询数据库、调用API、搜索网络。另一方面，纯行动的Agent缺乏推理能力，容易陷入盲目试错。

ReAct模式由 Yao et al.（2023）提出，核心洞察是：**推理和行动不是对立的，而是互补的**。推理帮助选择行动，行动的结果反过来丰富推理的上下文。实验表明，ReAct在HotpotQA和Fever等基准测试上显著优于纯推理（CoT）和纯行动（Act-only）的方法。

在ReAct的框架下，Agent的每一步都包含三个要素：
- **Thought**：当前思考状态，包括对已有信息的分析和下一步的计划
- **Action**：选择要执行的工具或操作
- **Observation**：执行Action后的环境反馈

这种结构使得Agent的推理过程变得**可追踪、可解释、可调试**——每个决策点都有明确的推理依据，每个行动都有可观察的结果。

### 结构

```
┌─────────────────────────────────────────┐
│              ReAct Agent                 │
│                                         │
│  ┌─────────┐     ┌─────────┐           │
│  │ Reasoning│────▶│ Action  │           │
│  │ (思考)   │◀────│ (行动)  │           │
│  └─────────┘     └────┬────┘           │
│       ▲                │                │
│       │         ┌──────▼──────┐         │
│       └─────────│ Observation │         │
│                 │  (观察结果)  │         │
│                 └─────────────┘         │
│                                         │
│  ToolSet: [Search, Lookup, Calculate...]│
└─────────────────────────────────────────┘
```

### 参与者

- **Agent**：执行推理-行动循环的核心实体，维护对话状态和历史记录
- **LLM**：提供推理能力的语言模型，负责Thought生成和Action选择
- **Tool Set**：Agent可以调用的一组工具（搜索、计算、查询等）
- **Observation Buffer**：存储每步行动的观察结果，形成推理上下文
- **Prompt Template**：结构化的提示模板，规范Agent的输出格式

### 协作

1. Agent接收到用户的查询
2. Agent进行**推理**（Thought）：分析问题，决定需要什么信息
3. Agent执行**行动**（Action）：调用工具或API获取信息
4. 系统返回**观察结果**（Observation）
5. Agent基于观察结果进行**新一轮推理**
6. 重复步骤3-5，直到推理得出最终答案
7. Agent输出最终回答（Final Answer）

### 效果

**优点：**
- 推理与行动的自然融合，提高决策质量
- 可解释性强——每一步的推理过程都是透明的
- 灵活性高——可以根据中间结果动态调整策略
- 减少幻觉——通过工具获取真实数据来验证推理
- 天然支持工具使用和知识检索的混合任务

**缺点：**
- 推理链过长时，上下文窗口可能不够
- 每一步都需要LLM推理，Token消耗较高
- 循环次数不受限制时，可能陷入死循环
- 对工具的描述质量要求高，模糊的工具描述会导致错误选择
- 长链条的推理可能导致"注意力漂移"，忽略原始目标

### 实现

关键实现要点：

1. **提示模板设计**：将推理、行动、观察的格式嵌入prompt，确保LLM输出结构化
2. **最大迭代次数**：设置合理的上限（通常5-10次）防止无限循环
3. **终止条件检测**：检测到"Final Answer"关键词时停止循环
4. **工具描述质量**：清晰的工具名称和参数描述帮助LLM选择正确的工具
5. **错误恢复**：当工具调用失败时，Agent应该能够调整策略而非放弃

```python
"""
ReAct模式 - 推理-行动循环实现
"""
from typing import List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import json
import re


class AgentStepType(Enum):
    REASONING = "thought"
    ACTION = "action"
    OBSERVATION = "observation"
    FINAL_ANSWER = "final_answer"


@dataclass
class AgentStep:
    """ReAct循环中的单步记录"""
    step_type: AgentStepType
    content: str
    tool_name: Optional[str] = None
    tool_input: Optional[dict] = None
    step_number: int = 0


@dataclass
class Tool:
    """工具定义"""
    name: str
    description: str
    function: Callable
    parameters: dict = field(default_factory=dict)


class ReActAgent:
    """
    ReAct Agent 核心实现
    
    将推理（Thought）与行动（Action）交织在一起，
    通过"思考-行动-观察"循环解决复杂任务。
    """
    
    def __init__(
        self,
        llm_client,
        tools: List[Tool],
        max_iterations: int = 8,
        verbose: bool = False
    ):
        self.llm = llm_client
        self.tools = {tool.name: tool for tool in tools}
        self.max_iterations = max_iterations
        self.verbose = verbose
        self.history: List[AgentStep] = []
        self._system_prompt = self._build_system_prompt()
    
    def _build_system_prompt(self) -> str:
        tool_descriptions = "\n".join(
            f"- {name}: {tool.description}"
            for name, tool in self.tools.items()
        )
        return f"""你是一个能够通过推理和行动来解决问题的AI助手。

你可以使用以下工具：
{tool_descriptions}

你必须严格按照以下格式回复：

Thought: [你的推理过程]
Action: [工具名称]
Action Input: {{"参数名": "参数值"}}

当你得出最终答案时，使用以下格式：
Thought: [总结推理]
Final Answer: [最终答案]

重要规则：
1. 每次只执行一个行动
2. 在行动前必须说明你的推理
3. 基于观察结果进行下一步推理
4. 如果工具返回错误，调整策略重试"""
    
    def _parse_response(self, response: str) -> AgentStep:
        """解析LLM的响应为结构化步骤"""
        response = response.strip()
        
        # 检查是否是最终答案
        final_match = re.search(
            r'Final Answer:\s*(.+?)(?:\n|$)', response, re.DOTALL
        )
        if final_match:
            return AgentStep(
                step_type=AgentStepType.FINAL_ANSWER,
                content=final_match.group(1).strip()
            )
        
        # 提取推理
        thought_match = re.search(
            r'Thought:\s*(.+?)(?=\nAction:|\nFinal Answer:|$)',
            response, re.DOTALL
        )
        thought = thought_match.group(1).strip() if thought_match else ""
        
        # 提取行动
        action_match = re.search(r'Action:\s*(\w+)', response)
        action_input_match = re.search(
            r'Action Input:\s*(\{.+?\})', response, re.DOTALL
        )
        
        if action_match:
            tool_name = action_match.group(1).strip()
            tool_input = {}
            if action_input_match:
                try:
                    tool_input = json.loads(action_input_match.group(1))
                except json.JSONDecodeError:
                    tool_input = {"raw": action_input_match.group(1)}
            return AgentStep(
                step_type=AgentStepType.ACTION,
                content=thought,
                tool_name=tool_name,
                tool_input=tool_input
            )
        
        return AgentStep(step_type=AgentStepType.REASONING, content=response)
    
    def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """执行工具调用"""
        if tool_name not in self.tools:
            return f"错误：未知工具 '{tool_name}'"
        tool = self.tools[tool_name]
        try:
            result = tool.function(**tool_input)
            return str(result)
        except Exception as e:
            return f"工具执行错误：{str(e)}"
    
    def run(self, query: str) -> str:
        """执行ReAct循环"""
        messages = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": query}
        ]
        
        for iteration in range(self.max_iterations):
            response = self.llm.chat(messages)
            step = self._parse_response(response)
            step.step_number = iteration + 1
            self.history.append(step)
            
            if self.verbose:
                print(f"\n--- 迭代 {iteration + 1} ---")
                print(f"[{step.step_type.value}] {step.content}")
            
            if step.step_type == AgentStepType.FINAL_ANSWER:
                return step.content
            
            if step.step_type == AgentStepType.ACTION:
                observation = self._execute_tool(
                    step.tool_name, step.tool_input or {}
                )
                obs_step = AgentStep(
                    step_type=AgentStepType.OBSERVATION,
                    content=observation,
                    step_number=iteration + 1
                )
                self.history.append(obs_step)
                
                messages.append({"role": "assistant", "content": response})
                messages.append({
                    "role": "user",
                    "content": f"观察结果: {observation}\n\n继续推理和行动。"
                })
        
        return "抱歉，在最大迭代次数内未能找到答案。"
    
    def get_trace(self) -> List[dict]:
        """获取完整的推理-行动追踪"""
        return [
            {"step": s.step_number, "type": s.step_type.value,
             "content": s.content, "tool": s.tool_name, "input": s.tool_input}
            for s in self.history
        ]
```

### 适用场景

- 需要多步推理与外部交互的复合任务（如多跳问答）
- 信息检索与分析类任务（如研究助手、市场调研）
- 数据查询与计算类任务（如数据分析助手、财务分析）
- 需要可解释推理链的应用（如法律咨询、医疗辅助）

### 相关模式

- **Plan-and-Execute**：ReAct的即时决策 vs Plan-and-Execute的预规划——前者灵活但消耗高，后者高效但僵化
- **Reflection**：ReAct关注推理过程，Reflection关注结果质量优化
- **Tool Registry**（第34章）：ReAct依赖工具集，Tool Registry提供工具注册和管理
- **Guardrails**：为ReAct循环添加输入输出安全约束

---

## 31.3 Plan-and-Execute 模式

### 意图

将任务求解过程分为**规划（Planning）**和**执行（Execution）**两个明确的阶段，先制定完整计划，再逐步执行。

### 动机

ReAct模式虽然灵活，但面对复杂的多步骤任务时，"边想边做"的策略容易导致以下问题：

1. **缺乏全局视角**：Agent可能"贪心"地选择当前最优行动，但忽略了长期目标
2. **频繁的方向调整**：没有全局计划，Agent可能在多个方向之间反复横跳
3. **重复推理开销**：每一步都需要完整的推理，Token消耗大
4. **计划不可审查**：用户无法在执行前审核Agent的计划

Plan-and-Execute模式的核心思想是"谋定而后动"——先花时间制定一个高质量的执行计划，然后按计划执行，必要时可以重新规划。这种模式更接近人类专家解决问题的自然方式：面对复杂项目，专家会先规划整体方案，然后分步执行。

Plan-and-Execute的一个重要变体是 **Plan-and-Solve**（Wang et al., 2023），它在计划中加入了更详细的子问题分解和变量跟踪，进一步提高了复杂任务的完成率。

### 结构

```
┌────────────────────────────────────────────┐
│           Plan-and-Execute Agent            │
│                                            │
│  ┌──────────────────┐                      │
│  │    Planner       │                      │
│  │  (规划器/LLM)     │────┐                 │
│  └──────────────────┘    │                 │
│           │              ▼                 │
│           │      ┌──────────────┐          │
│           │      │   Plan       │          │
│           │      │  Step 1 ──▶  │          │
│           │      │  Step 2 ──▶  │          │
│           │      │  Step 3 ──▶  │          │
│           │      └──────┬───────┘          │
│           │             │                  │
│           │             ▼                  │
│           │      ┌──────────────┐          │
│           └─────▶│  Executor    │          │
│   (重新规划)     │  (执行器)     │          │
│                  └──────┬───────┘          │
│                         │                  │
│                         ▼                  │
│                  ┌──────────────┐          │
│                  │   Result     │          │
│                  └──────────────┘          │
└────────────────────────────────────────────┘
```

### 参与者

- **Planner**：制定执行计划的组件，通常是一个LLM，可以接受上下文和反馈
- **Plan**：结构化的执行计划，包含有序的步骤列表，每个步骤有明确的描述和工具需求
- **Executor**：按顺序执行计划中的每一步，可以是另一个LLM或工具调用
- **Replanner**：根据执行结果决定是否需要重新规划的逻辑（可以与Planner合并）

### 协作

1. Planner分析用户请求，生成结构化的执行计划
2. Executor取计划的第一步并执行
3. Executor将结果反馈给Planner（或直接继续下一步）
4. 如果执行遇到问题，Replanner根据错误信息重新规划剩余步骤
5. 所有步骤完成后，汇总结果输出最终答案

### 效果

**优点：**
- 全局视角，计划更完整——减少了短视决策的风险
- 执行效率高——不需要每步都进行完整推理
- 计划可审查——用户可以在执行前审核和修改计划
- 支持计划级别的缓存和复用——相同类型的任务可以共享计划模板

**缺点：**
- 初始规划成本高——复杂任务可能需要多次规划迭代
- 静态计划对动态环境适应性不足——执行过程中的新信息可能使原计划失效
- 规划能力依赖LLM的质量——如果LLM无法理解任务的完整范围，计划就会有缺陷
- 步骤之间的强依赖可能形成瓶颈——前序步骤失败会导致后续步骤无法执行

### 实现

```python
"""
Plan-and-Execute 模式实现
"""
from typing import List, Optional
from dataclasses import dataclass, field
import json
import re


@dataclass
class PlanStep:
    """计划中的单个步骤"""
    step_id: int
    description: str
    tool_name: Optional[str] = None
    tool_input: Optional[dict] = None
    depends_on: List[int] = field(default_factory=list)
    status: str = "pending"  # pending, running, completed, failed


@dataclass
class ExecutionPlan:
    """完整执行计划"""
    goal: str
    steps: List[PlanStep]
    current_step: int = 0


class PlanAndExecuteAgent:
    """
    Plan-and-Execute Agent
    
    将任务求解分为规划和执行两个阶段。
    先制定全局计划，再逐步执行，支持动态重新规划。
    """
    
    def __init__(self, llm_client, tools: dict,
                 max_replan_attempts: int = 3, verbose: bool = False):
        self.llm = llm_client
        self.tools = tools
        self.max_replan_attempts = max_replan_attempts
        self.verbose = verbose
    
    def _planning_prompt(self, goal: str, context: str = "") -> str:
        return f"""你是一个任务规划专家。请为以下目标制定详细的执行计划。

目标: {goal}
{f"上下文信息: {context}" if context else ""}

请以JSON格式返回计划：
{{
    "plan": [
        {{
            "step_id": 1,
            "description": "步骤描述",
            "tool": "工具名称（可选）",
            "input": {{}},
            "depends_on": []
        }}
    ],
    "reasoning": "规划理由"
}}

规则：
1. 步骤应该有序且可执行
2. 每个步骤的描述要具体明确
3. 如果需要使用工具，指定工具名称和输入参数
4. 步骤之间如果有依赖关系，用depends_on标记"""
    
    def create_plan(self, goal: str, context: str = "") -> ExecutionPlan:
        """创建执行计划"""
        prompt = self._planning_prompt(goal, context)
        response = self.llm.chat([{"role": "user", "content": prompt}])
        
        try:
            plan_data = self._parse_plan_response(response)
            steps = [
                PlanStep(
                    step_id=s["step_id"],
                    description=s["description"],
                    tool_name=s.get("tool"),
                    tool_input=s.get("input"),
                    depends_on=s.get("depends_on", [])
                )
                for s in plan_data["plan"]
            ]
            plan = ExecutionPlan(goal=goal, steps=steps)
            
            if self.verbose:
                print(f"\n📋 执行计划 ({len(steps)}步):")
                for step in steps:
                    print(f"  {step.step_id}. {step.description}")
            return plan
        except (KeyError, json.JSONDecodeError) as e:
            raise ValueError(f"计划解析失败: {e}")
    
    def _parse_plan_response(self, response: str) -> dict:
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```',
                               response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        return json.loads(response)
    
    def _execute_step(self, step: PlanStep) -> str:
        """执行单个计划步骤"""
        step.status = "running"
        if step.tool_name and step.tool_name in self.tools:
            try:
                result = self.tools[step.tool_name](**(step.tool_input or {}))
                step.status = "completed"
                return str(result)
            except Exception as e:
                step.status = "failed"
                return f"执行失败: {str(e)}"
        response = self.llm.chat([
            {"role": "system", "content": "你是一个任务执行器。"},
            {"role": "user", "content": f"请执行以下步骤: {step.description}"}
        ])
        step.status = "completed"
        return response
    
    def _replan(self, original_plan: ExecutionPlan,
                failed_step: PlanStep, error: str) -> Optional[ExecutionPlan]:
        """根据失败信息重新规划"""
        context = f"""之前的计划在第{failed_step.step_id}步失败。
失败步骤: {failed_step.description}
失败原因: {error}
已完成的步骤:
{json.dumps([{"step": s.step_id, "desc": s.description, "status": s.status}
    for s in original_plan.steps[:failed_step.step_id]], ensure_ascii=False)}"""
        return self.create_plan(goal=original_plan.goal, context=context)
    
    def run(self, goal: str) -> str:
        """执行Plan-and-Execute流程"""
        plan = self.create_plan(goal)
        replan_count = 0
        results = []
        
        for step in plan.steps:
            if self.verbose:
                print(f"\n▶ 执行步骤 {step.step_id}: {step.description}")
            
            result = self._execute_step(step)
            results.append({
                "step": step.step_id,
                "description": step.description,
                "result": result,
                "status": step.status
            })
            
            if step.status == "failed" and replan_count < self.max_replan_attempts:
                replan_count += 1
                if self.verbose:
                    print(f"\n🔄 第{replan_count}次重新规划...")
                new_plan = self._replan(plan, step, result)
                if new_plan:
                    plan = new_plan
                    continue
            elif step.status == "failed":
                break
        
        # 汇总结果
        summary = self.llm.chat([
            {"role": "system", "content": "请根据执行结果生成摘要。"},
            {"role": "user", "content": f"目标: {goal}\n结果: {json.dumps(results, ensure_ascii=False)}"}
        ])
        return summary
```

### 适用场景

- 复杂的多步骤任务（如项目规划、研究报告生成、代码重构方案）
- 任务步骤之间有明确的依赖关系（如数据处理管道、CI/CD流程）
- 需要可审计执行过程的应用（如合规审查、金融交易）
- 长期目标追踪（如持续数天的研究任务）

### 相关模式

- **ReAct**：即时决策 vs 预先规划——两者可以组合使用，在计划框架内对每个步骤使用ReAct
- **Hierarchical**（第32章）：Plan-and-Execute天然支持层级分解——高层计划可以分解为低层子计划
- **Pipeline**（第32章）：计划中的步骤可以编排为流水线以提高并行度

---

## 31.4 Reflection 模式

### 意图

使Agent能够**审视自己的输出**，识别不足并进行自我优化，形成"生成-评估-改进"的迭代提升循环。

### 动机

LLM的首次输出往往不是最优的——可能遗漏信息、逻辑有误、格式不对、语气不当。人类写文章需要修改，写代码需要调试，做决策需要复盘，Agent也不例外。

Reflection模式的研究可以追溯到 Madaan et al.（2023）提出的 Reflexion 框架，其核心思想是：**如果人类通过反思来改进，Agent也可以通过自我反思来提升输出质量**。

在实际应用中，Reflection的价值尤为突出：
- **代码生成**：首次生成的代码可能有bug，通过自我审查可以发现并修复
- **内容创作**：初稿往往结构松散，通过反思可以优化逻辑和表达
- **决策分析**：初始分析可能遗漏重要因素，通过反思可以补全视角
- **翻译任务**：初译可能不够流畅，通过反思可以提升翻译质量

### 结构

```
┌──────────────────────────────────────┐
│          Reflection Agent            │
│                                      │
│  ┌────────┐    ┌────────────┐        │
│  │Generator│───▶│  Evaluator │        │
│  │ (生成器) │    │  (评估器)   │        │
│  └───┬────┘    └─────┬──────┘        │
│      │               │               │
│      │    ┌──────────▼──────┐        │
│      │    │  Reflection     │        │
│      │    │  Score/Feedback  │        │
│      │    └──────────┬──────┘        │
│      │               │               │
│      │         score < threshold?     │
│      │          /          \          │
│      │        Yes          No        │
│      │         │            │        │
│      └─────────┘            ▼        │
│                    ┌──────────┐       │
│                    │  Output   │       │
│                    └──────────┘       │
└──────────────────────────────────────┘
```

### 参与者

- **Generator**：生成初始输出的组件（可以是同一个LLM的不同prompt）
- **Evaluator**：评估输出质量的组件，从多个维度打分并给出改进建议
- **Reflection Store**：存储反思记录的仓库，用于长期改进和模式识别

### 协作

1. Generator根据输入生成初始输出
2. Evaluator从多个维度评估输出质量（准确性、完整性、清晰度等）
3. 如果评分低于阈值，将评估反馈（评分+改进建议）传回Generator重新生成
4. 重复步骤2-3，直到达到质量要求或达到最大迭代次数
5. 输出最终结果，同时记录反思历史

### 效果

**优点：**
- 输出质量显著提升——研究表明在代码生成任务上可提升20-40%的通过率
- 不需要额外的人工标注数据——使用LLM自身作为评估器
- 反思记录可用于持续改进——分析常见的失败模式可以优化Generator
- 自适应的质量控制——可以根据任务复杂度调整反思轮数

**缺点：**
- 每次迭代都消耗Token——成本随反思轮数线性增长
- 评估标准难以完全自动化——某些质量维度（如创意性）需要人工判断
- 过度反思可能导致过度优化——在某些创意任务中，"完美的"不如"有趣的"
- 评估器本身也可能出错——LLM对自身输出的评估可能不够客观

### 实现

```python
"""
Reflection 模式 - 自我反思优化实现
"""
from typing import List
from dataclasses import dataclass
import json
import re


@dataclass
class ReflectionResult:
    """反思评估结果"""
    score: float           # 0-10 质量评分
    feedback: str          # 改进建议
    strengths: List[str]   # 优点列表
    weaknesses: List[str]  # 不足列表
    revision_needed: bool  # 是否需要修改


class ReflectionAgent:
    """
    Reflection Agent
    
    通过"生成-评估-改进"循环提升输出质量。
    支持多维度评估和自适应迭代控制。
    """
    
    EVALUATION_DIMENSIONS = ["准确性", "完整性", "清晰度", "相关性", "可操作性"]
    
    def __init__(self, llm_client, min_score: float = 7.0,
                 max_reflections: int = 3, verbose: bool = False):
        self.llm = llm_client
        self.min_score = min_score
        self.max_reflections = max_reflections
        self.verbose = verbose
        self.reflection_history: List[dict] = []
    
    def generate(self, task: str, context: str = "") -> str:
        """生成初始输出"""
        prompt = f"""请完成以下任务：{task}
{f"参考上下文: {context}" if context else ""}
要求：内容准确完整、结构清晰、语言简洁专业。"""
        return self.llm.chat([
            {"role": "system", "content": "你是一个高质量内容生成助手。"},
            {"role": "user", "content": prompt}
        ])
    
    def evaluate(self, task: str, output: str, context: str = "") -> ReflectionResult:
        """评估输出质量"""
        prompt = f"""评估以下输出质量：
任务: {task}
{f"上下文: {context}" if context else ""}
输出: {output}
维度: {', '.join(self.EVALUATION_DIMENSIONS)}

返回JSON: {{"score": 0-10, "feedback": "改进建议",
"strengths": ["优点"], "weaknesses": ["不足"], "revision_needed": true/false}}"""
        
        response = self.llm.chat([
            {"role": "system", "content": "你是一个严格的质量评估专家。"},
            {"role": "user", "content": prompt}
        ])
        
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                d = json.loads(json_match.group(0))
                return ReflectionResult(
                    score=float(d.get("score", 5)),
                    feedback=d.get("feedback", ""),
                    strengths=d.get("strengths", []),
                    weaknesses=d.get("weaknesses", []),
                    revision_needed=d.get("revision_needed", False)
                )
        except (json.JSONDecodeError, ValueError):
            pass
        return ReflectionResult(5.0, "评估失败", [], ["评估异常"], False)
    
    def revise(self, task: str, output: str, feedback: ReflectionResult) -> str:
        """基于反馈修改输出"""
        return self.llm.chat([
            {"role": "system", "content": "你善于根据反馈改进内容。"},
            {"role": "user", "content": f"""原始任务: {task}
当前输出: {output}
不足: {', '.join(feedback.weaknesses)}
建议: {feedback.feedback}
请修改输出以提升质量。"""}
        ])
    
    def run(self, task: str, context: str = "") -> dict:
        """执行Reflection循环"""
        output = self.generate(task, context)
        
        for i in range(self.max_reflections):
            reflection = self.evaluate(task, output, context)
            
            if self.verbose:
                print(f"\n🔄 反思轮次 {i+1}: 评分 {reflection.score}/10")
                print(f"   不足: {', '.join(reflection.weaknesses[:2])}")
            
            self.reflection_history.append({
                "round": i+1, "score": reflection.score,
                "feedback": reflection.feedback
            })
            
            if reflection.score >= self.min_score or not reflection.revision_needed:
                break
            
            output = self.revise(task, output, reflection)
        
        final = self.evaluate(task, output, context)
        return {
            "output": output,
            "final_score": final.score,
            "reflections": self.reflection_history,
            "total_rounds": len(self.reflection_history)
        }
```

### 适用场景

- 内容生成类任务（文章、报告、文案、翻译）
- 代码生成与自动审查
- 需要高质量输出的商业应用
- 数据分析与洞察报告

### 相关模式

- **ReAct**：Reflection可以嵌入ReAct循环的每一步——每次行动后进行自我反思
- **Human-in-the-Loop**（第33章）：Reflection的自动评估可以与人工评估结合
- **Guardrails**：Reflection的评估维度可以作为Guardrails的质量检查规则

---

## 31.5 Router 模式

### 意图

根据用户输入的**意图**，将请求**路由**到最合适的处理Agent或处理流程，实现关注点分离和专业化处理。

### 动机

随着Agent能力的扩展，一个Agent处理所有类型的请求既不高效也不可控。就像Web应用中的路由器将不同URL分发到不同的Controller一样，Agent系统也需要一个智能路由层来分发请求。

Router模式将"理解意图"和"处理任务"解耦，使得每个下游Agent可以专注于自己擅长的领域，同时系统整体能力得到灵活扩展。在实践中，Router模式是构建企业级AI系统的必经之路——没有良好的意图分发，系统就无法在保证质量的前提下扩展能力边界。

Router的实现方式有多种：基于关键词匹配的规则路由、基于嵌入向量的语义路由、基于LLM的智能路由。在生产环境中，通常会组合使用多种方式，以提高准确性和鲁棒性。

### 结构

```
┌─────────────────────────────────────────┐
│              Router Agent                │
│                                         │
│  用户输入 ──▶ ┌──────────┐              │
│              │ Intent   │              │
│              │ Classifier│              │
│              └────┬─────┘              │
│                   │                     │
│         ┌────────┼────────┐            │
│         ▼        ▼        ▼            │
│    ┌────────┐ ┌────────┐ ┌────────┐   │
│    │Agent A │ │Agent B │ │Agent C │   │
│    │(客服)   │ │(技术)  │ │(销售)  │   │
│    └────────┘ └────────┘ └────────┘   │
│                                         │
│         ... 更多专业Agent ...            │
└─────────────────────────────────────────┘
```

### 参与者

- **Router**：意图分类和路由决策组件
- **Intent Schema**：预定义的意图类别列表及其描述
- **Specialized Agents**：处理特定类型请求的专业Agent
- **Fallback Handler**：当置信度不足时的默认处理逻辑

### 协作

1. 用户发送请求到Router
2. Router分析请求，识别用户意图并计算置信度
3. Router根据意图将请求转发给对应的专业Agent
4. 专业Agent处理请求并返回结果
5. Router将结果返回给用户（可选地整合多个Agent的结果）

### 效果

**优点：**
- 关注点分离，每个Agent职责明确且可独立优化
- 易于扩展新的处理能力——添加新Agent即可
- 便于独立测试和维护
- 支持A/B测试不同处理策略

**缺点：**
- 路由分类的准确性直接影响用户体验
- 意图边界模糊时，分类可能不准确
- 增加了系统的复杂度和延迟

### 实现

```python
"""
Router 模式 - 意图路由分发实现
"""
from typing import Callable, Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import json
import re


class IntentCategory(Enum):
    CUSTOMER_SERVICE = "customer_service"
    TECHNICAL_SUPPORT = "technical_support"
    SALES = "sales"
    GENERAL_QA = "general_qa"
    CREATIVE = "creative"


@dataclass
class Route:
    """路由规则"""
    intent: IntentCategory
    description: str
    handler: Callable
    confidence_threshold: float = 0.6
    examples: List[str] = None


class RouterAgent:
    """
    Router Agent - 根据用户意图将请求路由到最合适的处理Agent。
    """
    
    def __init__(self, llm_client, routes: Optional[List[Route]] = None,
                 default_handler: Optional[Callable] = None, verbose: bool = False):
        self.llm = llm_client
        self.routes: Dict[IntentCategory, Route] = {}
        self.default_handler = default_handler or self._default_handler
        self.verbose = verbose
        self.routing_stats: Dict[str, int] = {}
        
        if routes:
            for route in routes:
                self.routes[route.intent] = route
    
    def register_route(self, route: Route) -> None:
        """注册新的路由规则"""
        self.routes[route.intent] = route
    
    def classify_intent(self, user_input: str) -> tuple:
        """分类用户意图，返回 (intent_category, confidence)"""
        route_desc = "\n".join(
            f"- {r.intent.value}: {r.description}\n  示例: {', '.join(r.examples[:3]) if r.examples else '无'}"
            for r in self.routes.values()
        )
        
        prompt = f"""将以下用户输入分类到最合适的意图类别。
用户输入: {user_input}
可选类别:
{route_desc}

返回JSON: {{"intent": "<类别>", "confidence": 0.0-1.0, "reasoning": "<理由>"}}"""
        
        response = self.llm.chat([
            {"role": "system", "content": "你是一个精确的意图分类器。"},
            {"role": "user", "content": prompt}
        ])
        
        try:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(0))
                return IntentCategory(result["intent"]), float(result.get("confidence", 0.5))
        except (json.JSONDecodeError, ValueError, KeyError):
            pass
        return IntentCategory.GENERAL_QA, 0.3
    
    def route(self, user_input: str, context: dict = None) -> Any:
        """路由用户请求到对应Agent"""
        intent, confidence = self.classify_intent(user_input)
        self.routing_stats[intent.value] = self.routing_stats.get(intent.value, 0) + 1
        
        if self.verbose:
            print(f"🎯 意图: {intent.value} (置信度: {confidence:.2f})")
        
        route = self.routes.get(intent)
        if route and confidence >= route.confidence_threshold:
            return route.handler(user_input, context)
        return self.default_handler(user_input, context)
    
    def _default_handler(self, user_input: str, context: dict = None) -> str:
        """默认处理器"""
        return self.llm.chat([
            {"role": "system", "content": "你是一个通用助手。"},
            {"role": "user", "content": user_input}
        ])
```

### 适用场景

- 多领域的对话系统（如企业统一客服平台）
- 需要专业化处理的复杂系统
- 多模型协作场景
- 微服务化的AI架构

### 相关模式

- **Semantic Router**（第34章）：Router模式的语义增强版本
- **Orchestrator**（第32章）：Router是简单的分发，Orchestrator是复杂的编排
- **Adapter**：Router分发后，Adapter处理下游Agent的模型差异

---

## 31.6 Guardrails 模式

### 意图

为Agent的输入和输出设置**安全约束**，确保Agent的行为始终在预定义的安全边界内运行。

### 动机

LLM天生存在不可控性——可能输出有害内容、泄露敏感信息、执行危险操作、偏离预设角色。在生产环境中，这种不可控性是不可接受的。Guardrails模式借鉴了Web安全中的输入验证和输出编码思想，为Agent构建多层安全防线。

Guardrails的核心设计理念是**纵深防御（Defense in Depth）**：不是依赖单一的安全检查点，而是在输入、处理、输出的每个环节都设置安全关卡。任何一个关卡发现异常，都可以拦截、修改或升级处理。

在实际应用中，Guardrails需要覆盖多种安全维度：
- **话题安全**：防止讨论政治敏感、暴力、违法等话题
- **隐私保护**：防止泄露用户的个人信息（手机号、身份证、银行卡等）
- **内容毒性**：防止生成仇恨、歧视、冒犯性内容
- **格式约束**：确保输出符合预期的格式（JSON、Markdown、特定模板）
- **业务策略**：确保Agent行为符合业务规则（如不能直接执行删除操作）

### 结构

```
┌──────────────────────────────────────────┐
│            Guardrails Agent              │
│                                          │
│  Input ──▶ ┌──────────────┐             │
│            │  Input Guard  │             │
│            │ (输入校验)     │             │
│            └──────┬───────┘             │
│                   │ ✅                    │
│                   ▼                      │
│            ┌──────────────┐             │
│            │    Agent     │             │
│            │  (核心处理)   │             │
│            └──────┬───────┘             │
│                   │                      │
│                   ▼                      │
│            ┌──────────────┐             │
│            │ Output Guard │             │
│            │ (输出校验)    │             │
│            └──────┬───────┘             │
│                   │ ✅                    │
│                   ▼                      │
│              Output                     │
│                                          │
│  Guard Types:                            │
│  ├── Topic Guard (话题约束)              │
│  ├── PII Guard (隐私保护)                │
│  ├── Toxicity Guard (毒性检测)           │
│  ├── Format Guard (格式约束)             │
│  └── Policy Guard (策略约束)             │
└──────────────────────────────────────────┘
```

### 参与者

- **Input Guard**：校验用户输入的安全性和合规性
- **Output Guard**：校验Agent输出的安全性和合规性
- **Guard Rules**：预定义的约束规则集合（话题、PII、毒性、格式等）
- **Fallback Handler**：违反约束时的处理逻辑（拒绝、修改、转人工）

### 协作

1. 用户输入到达Input Guard
2. Input Guard按顺序检查每条约束规则
3. 如果违规，触发Fallback Handler（拒绝、自动修改或转人工）
4. 如果全部通过，将（可能被修改后的）输入传递给Agent核心
5. Agent生成输出
6. Output Guard检查输出是否合规
7. 如果违规，要求Agent重新生成或使用Fallback

### 效果

**优点：**
- 多层防御，纵深安全——即使某一层被绕过，其他层仍然提供保护
- 可配置的约束规则——不同的部署环境可以使用不同的规则集
- 不影响Agent核心逻辑——Guardrails是正交的关注点
- 便于审计和合规——所有Guard检查都有日志记录

**缺点：**
- 过严格的约束可能影响用户体验（误拒率）
- 需要持续维护和更新规则
- 增加了系统的延迟（每个Guard都需要计算时间）

### 实现

```python
"""
Guardrails 模式 - 输入输出安全约束实现
"""
from typing import List, Optional, Callable, Any
from enum import Enum
import re
import json


class GuardAction(Enum):
    ALLOW = "allow"
    DENY = "deny"
    MODIFY = "modify"
    ESCALATE = "escalate"


class GuardResult:
    """Guard检查结果"""
    def __init__(self, passed: bool, action: GuardAction, 
                 reason: str, guard_name: str = "",
                 modified_content: Optional[str] = None):
        self.passed = passed
        self.action = action
        self.reason = reason
        self.guard_name = guard_name
        self.modified_content = modified_content


class TopicGuard:
    """话题约束Guard"""
    def __init__(self, blocked_topics: List[str]):
        self.name = "TopicGuard"
        self.action = GuardAction.DENY
        self.blocked_topics = blocked_topics
    
    def check(self, content: str) -> GuardResult:
        for topic in self.blocked_topics:
            if topic in content:
                return GuardResult(False, self.action,
                    f"内容涉及被屏蔽的话题: {topic}", self.name)
        return GuardResult(True, GuardAction.ALLOW, "话题检查通过", self.name)


class PIIGuard:
    """隐私信息保护Guard - 检测并脱敏"""
    PII_PATTERNS = {
        "手机号": r"1[3-9]\d{9}",
        "身份证号": r"\d{17}[\dXx]",
        "银行卡号": r"\d{16,19}",
        "邮箱": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    }
    
    def __init__(self, action: GuardAction = GuardAction.MODIFY):
        self.name = "PIIGuard"
        self.action = action
    
    def check(self, content: str) -> GuardResult:
        detected = []
        for pii_type, pattern in self.PII_PATTERNS.items():
            if re.search(pattern, content):
                detected.append(pii_type)
        if detected:
            return GuardResult(False, self.action,
                f"检测到隐私信息: {', '.join(detected)}", self.name)
        return GuardResult(True, GuardAction.ALLOW, "隐私检查通过", self.name)
    
    def fix(self, content: str) -> str:
        content = re.sub(r"1[3-9]\d{4}\d{4}",
            lambda m: m.group()[:3] + "****" + m.group()[7:], content)
        content = re.sub(r"(\d{6})\d{11}(\d{4})",
            lambda m: m.group(1) + "***********" + m.group(2), content)
        return content


class FormatGuard:
    """输出格式约束Guard"""
    def __init__(self, expected_format: str = "text", max_length: int = 5000):
        self.name = "FormatGuard"
        self.action = GuardAction.MODIFY
        self.expected_format = expected_format
        self.max_length = max_length
    
    def check(self, content: str) -> GuardResult:
        issues = []
        if len(content) > self.max_length:
            issues.append(f"长度({len(content)})超过限制({self.max_length})")
        if self.expected_format == "json":
            try:
                json.loads(content)
            except json.JSONDecodeError:
                issues.append("不是有效的JSON格式")
        if issues:
            return GuardResult(False, self.action, "; ".join(issues), self.name)
        return GuardResult(True, GuardAction.ALLOW, "格式检查通过", self.name)
    
    def fix(self, content: str) -> str:
        return content[:self.max_length]


class GuardedAgent:
    """被Guardrails保护的Agent"""
    
    def __init__(self, agent_core: Callable,
                 input_guards: Optional[List] = None,
                 output_guards: Optional[List] = None,
                 max_retries: int = 2, verbose: bool = False):
        self.core = agent_core
        self.input_guards = input_guards or []
        self.output_guards = output_guards or []
        self.max_retries = max_retries
        self.verbose = verbose
    
    def _run_guards(self, guards: list, content: str, direction: str) -> tuple:
        """执行Guard检查链，返回 (passed, content, results)"""
        current = content
        results = []
        all_passed = True
        
        for guard in guards:
            result = guard.check(current)
            results.append(result)
            if self.verbose:
                status = "✅" if result.passed else "❌"
                print(f"  [{direction}] {status} {guard.name}: {result.reason}")
            
            if not result.passed:
                if result.action == GuardAction.DENY:
                    return False, current, results
                elif result.action == GuardAction.MODIFY:
                    current = guard.fix(current)
                    all_passed = False
        return all_passed, current, results
    
    def run(self, user_input: str) -> str:
        """执行被Guard保护的处理流程"""
        if self.verbose:
            print("🔍 输入Guard检查:")
        passed, safe_input, _ = self._run_guards(self.input_guards, user_input, "INPUT")
        if not passed:
            return "抱歉，您的请求未通过安全检查。"
        
        if self.verbose:
            print("\n🤖 Agent核心处理...")
        output = self.core(safe_input)
        
        for retry in range(self.max_retries + 1):
            if self.verbose:
                print(f"\n🔍 输出Guard检查 (尝试 {retry+1}):")
            passed, safe_output, _ = self._run_guards(self.output_guards, output, "OUTPUT")
            if passed:
                return safe_output
            if retry < self.max_retries:
                output = self.core(f"{safe_input}\n\n注意: 上次输出未通过安全检查，请生成合规内容。")
        
        return "抱歉，生成的内容未通过安全检查。请联系人工客服。"
```

### 适用场景

- 面向公众的AI服务
- 处理敏感数据的应用（金融、医疗、法律）
- 受监管行业
- 多租户SaaS平台

### 相关模式

- **Circuit Breaker**（第35章）：Guardrails与Circuit Breaker配合，防止异常请求的级联扩散
- **Audit Trail**（第35章）：Guardrails的检查记录可以作为审计依据
- **Human-in-the-Loop**（第33章）：Guardrails检测到严重问题时升级给人类处理

---

## 31.7 Adapter 模式

### 意图

为不同的LLM模型提供**统一的接口适配层**，使Agent核心逻辑不依赖于特定模型的API差异，实现模型的无缝切换。

### 动机

Agent系统经常需要在不同模型之间切换——OpenAI的GPT系列、Anthropic的Claude、开源的Llama、国内的通义千问等。每个模型的API签名、参数格式、行为特性都不同。Adapter模式借鉴GoF适配器模式的思想，为Agent屏蔽底层模型的差异。

Adapter模式的实际价值体现在多个层面：

1. **供应商锁定规避**：不绑定单一模型供应商，避免供应商涨价或服务中断的风险
2. **成本优化**：简单任务用便宜的小模型，复杂任务用强大的大模型
3. **A/B测试**：同时使用多个模型进行对比实验
4. **降级容灾**：主模型不可用时自动切换到备用模型
5. **模型迭代**：新模型发布时只需添加新的Adapter，无需修改业务逻辑

### 结构

```
┌──────────────────────────────────────────┐
│              Adapter Agent                │
│                                          │
│  ┌────────────────────────────┐          │
│  │     Agent Core Logic       │          │
│  │  (不依赖具体模型)           │          │
│  └────────────┬───────────────┘          │
│               │                          │
│               ▼                          │
│  ┌────────────────────────────┐          │
│  │   LLM Adapter Interface    │          │
│  │   chat(messages) -> str    │          │
│  │   embed(text) -> list      │          │
│  │   count_tokens(text) -> int│          │
│  └────────────┬───────────────┘          │
│               │                          │
│    ┌──────────┼──────────┐              │
│    ▼          ▼          ▼              │
│ ┌──────┐  ┌──────┐  ┌──────┐           │
│ │OpenAI│  │Claude│  │Llama │           │
│ │Adapter│ │Adapter│ │Adapter│           │
│ └──────┘  └──────┘  └──────┘           │
└──────────────────────────────────────────┘
```

### 参与者

- **LLMAdapter Interface**：统一的模型接口抽象
- **Concrete Adapters**：针对特定模型的具体适配器实现
- **Agent Core**：使用统一接口的Agent核心逻辑
- **Model Registry**：模型注册中心，管理可用的适配器实例

### 协作

1. Agent Core通过统一接口调用LLM方法
2. LLMAdapter Interface将调用转发给当前激活的具体适配器
3. 具体适配器处理API差异（参数映射、错误处理、重试逻辑）
4. 具体适配器返回统一格式化的结果

### 效果

**优点：**
- Agent核心逻辑不依赖具体模型——模型是可替换的
- 模型切换零成本——修改配置即可
- 便于A/B测试不同模型的效果
- 支持降级策略——主模型不可用时自动切换

**缺点：**
- 适配器层增加了维护成本
- 某些模型特有功能可能无法通过统一接口暴露
- 统一接口可能成为"最小公约数"，限制了对特定模型优势的利用

### 实现

```python
"""
Adapter 模式 - 模型适配器实现
"""
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod
from enum import Enum
import time


class MessageRole(Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class Message:
    role: MessageRole
    content: str
    name: Optional[str] = None


@dataclass
class LLMResponse:
    content: str
    model: str
    usage: Dict[str, int]
    finish_reason: str = "stop"
    latency_ms: float = 0.0


class LLMAdapter(ABC):
    """LLM适配器接口 - 所有模型适配器都必须实现此接口"""
    
    def __init__(self, model_name: str, api_key: str = "", **kwargs):
        self.model_name = model_name
        self.api_key = api_key
        self.config = kwargs
    
    @abstractmethod
    def chat(self, messages: List[Message], temperature: float = 0.7,
             max_tokens: int = 4096, **kwargs) -> LLMResponse:
        """发送聊天请求"""
        pass
    
    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """计算Token数量"""
        pass
    
    @property
    @abstractmethod
    def max_context_length(self) -> int:
        """最大上下文长度"""
        pass


class OpenAIAdapter(LLMAdapter):
    """OpenAI GPT系列适配器"""
    
    MODEL_CONTEXT_LENGTHS = {
        "gpt-4o": 128000, "gpt-4o-mini": 128000,
        "gpt-4-turbo": 128000, "gpt-3.5-turbo": 16385,
    }
    
    def __init__(self, model_name: str = "gpt-4o", api_key: str = "", **kwargs):
        super().__init__(model_name, api_key, **kwargs)
    
    @property
    def max_context_length(self) -> int:
        return self.MODEL_CONTEXT_LENGTHS.get(self.model_name, 128000)
    
    def chat(self, messages: List[Message], temperature: float = 0.7,
             max_tokens: int = 4096, **kwargs) -> LLMResponse:
        start = time.time()
        openai_msgs = [{"role": m.role.value, "content": m.content} for m in messages]
        
        try:
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            resp = client.chat.completions.create(
                model=self.model_name, messages=openai_msgs,
                temperature=temperature, max_tokens=max_tokens, **kwargs
            )
            return LLMResponse(
                content=resp.choices[0].message.content,
                model=resp.model,
                usage={"prompt_tokens": resp.usage.prompt_tokens,
                       "completion_tokens": resp.usage.completion_tokens,
                       "total_tokens": resp.usage.total_tokens},
                latency_ms=(time.time() - start) * 1000
            )
        except Exception as e:
            return LLMResponse(f"[OpenAI Error: {e}]", self.model_name,
                             {}, latency_ms=(time.time() - start) * 1000)
    
    def count_tokens(self, text: str) -> int:
        try:
            import tiktoken
            enc = tiktoken.encoding_for_model(self.model_name)
            return len(enc.encode(text))
        except ImportError:
            return int(len(text) * 0.4)


class AnthropicAdapter(LLMAdapter):
    """Anthropic Claude系列适配器"""
    
    MODEL_CONTEXT_LENGTHS = {
        "claude-3-5-sonnet-20241022": 200000,
        "claude-3-opus-20240229": 200000,
        "claude-3-haiku-20240307": 200000,
    }
    
    @property
    def max_context_length(self) -> int:
        return self.MODEL_CONTEXT_LENGTHS.get(self.model_name, 200000)
    
    def chat(self, messages: List[Message], temperature: float = 0.7,
             max_tokens: int = 4096, **kwargs) -> LLMResponse:
        start = time.time()
        system_msg = ""
        claude_msgs = []
        
        for m in messages:
            if m.role == MessageRole.SYSTEM:
                system_msg = m.content
            else:
                claude_msgs.append({"role": m.role.value, "content": m.content})
        
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            kwargs_params = {}
            if system_msg:
                kwargs_params["system"] = system_msg
            resp = client.messages.create(
                model=self.model_name, messages=claude_msgs,
                max_tokens=max_tokens, temperature=temperature, **kwargs_params
            )
            return LLMResponse(
                content=resp.content[0].text, model=resp.model,
                usage={"prompt_tokens": resp.usage.input_tokens,
                       "completion_tokens": resp.usage.output_tokens,
                       "total_tokens": resp.usage.input_tokens + resp.usage.output_tokens},
                latency_ms=(time.time() - start) * 1000
            )
        except Exception as e:
            return LLMResponse(f"[Claude Error: {e}]", self.model_name,
                             {}, latency_ms=(time.time() - start) * 1000)
    
    def count_tokens(self, text: str) -> int:
        # Claude的tokenizer约为3.5字符/token
        return int(len(text) / 3.5)


class ModelRegistry:
    """模型注册中心 - 管理和选择模型适配器"""
    
    def __init__(self):
        self._adapters: Dict[str, LLMAdapter] = {}
        self._fallback_chain: List[str] = []
    
    def register(self, name: str, adapter: LLMAdapter, is_primary: bool = False) -> None:
        self._adapters[name] = adapter
        if is_primary:
            self._fallback_chain.insert(0, name)
        else:
            self._fallback_chain.append(name)
    
    def get(self, name: str = None) -> LLMAdapter:
        """获取适配器，支持降级链"""
        if name and name in self._adapters:
            return self._adapters[name]
        for fallback_name in self._fallback_chain:
            if fallback_name in self._adapters:
                return self._adapters[fallback_name]
        raise ValueError("没有可用的模型适配器")


# 使用示例
registry = ModelRegistry()
registry.register("gpt-4o", OpenAIAdapter("gpt-4o", api_key="sk-xxx"), is_primary=True)
registry.register("claude", AnthropicAdapter("claude-3-5-sonnet-20241022", api_key="sk-xxx"))

# Agent核心逻辑只依赖统一接口
adapter = registry.get()
messages = [Message(role=MessageRole.USER, content="你好")]
response = adapter.chat(messages)
print(f"模型: {response.model}, 延迟: {response.latency_ms:.0f}ms")
```

### 适用场景

- 需要支持多个LLM供应商的系统
- 模型A/B测试和效果对比
- 需要降级容灾的生产系统
- 多语言、多模型混合部署

### 相关模式

- **Router**：Adapter提供模型级适配，Router提供意图级分发
- **Configuration Driven**（第35章）：Adapter的配置可以通过配置驱动模式管理
- **Circuit Breaker**（第35章）：当某个模型持续失败时，Circuit Breaker自动切换到备用模型

---

## 31.8 模式组合指南

本章介绍