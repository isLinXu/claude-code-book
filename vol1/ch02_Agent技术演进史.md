# 第2章：Agent技术演进史

> "智能的本质不在于计算的速度，而在于与环境的交互方式。" —— Herbert Simon

## 2.1 引言：从"计算"到"行动"的范式转变

计算机科学的发展史，在某种意义上就是一部从"被动计算"到"主动行动"的演进史。早期的计算机是纯粹的数学工具，接受指令、执行计算、返回结果。而 Agent 技术的核心愿景，则是让计算机从"工具"进化为"行动者"——能够感知环境、做出决策、采取行动，并在与世界的交互中不断学习和进化。

Agent（智能体）这个概念源于哲学和认知科学。在亚里士多德的伦理学中，一个"agent"是有意图和行动能力的实体。当这个概念被引入计算机科学后，它就成为了人工智能研究中最具吸引力的目标之一：创造一个能够自主行动的软件实体。

本章将沿着时间的脉络，回顾 Agent 技术从20世纪60年代至今的演进历程，梳理每一个关键转折点，理解技术演进的内在逻辑，并为读者建立对 Agent 技术的宏观认知。

---

## 2.2 早期AI Agent（1960s-1970s）：对话与理解的萌芽

### 2.2.1 ELIZA：对话式Agent的起点

1966年，MIT的Joseph Weizenbaum开发了ELIZA——世界上第一个对话式计算机程序。ELIZA模拟了一个罗杰斯学派的心理治疗师，通过模式匹配和简单的规则来生成回应。

```python
# ELIZA 的简化实现：模式匹配式对话
import re

class ELIZA:
    """最早的对话式Agent——ELIZA的简化实现"""

    def __init__(self):
        self.name = "ELIZA"
        self.patterns = {
            r"(.*)我是(.*)": [
                "你好，{1}。告诉我更多关于你自己的事。",
                "你觉得{1}怎么样？",
                "为什么你是{1}？"
            ],
            r"(.*)我觉得(.*)": [
                "你确定你觉得{1}吗？",
                "你为什么觉得{1}？",
                "你觉得{1}已经多久了？"
            ],
            r"(.*)(母亲|爸爸|家人)(.*)": [
                "告诉我更多关于你家庭的事。",
                "你的家庭对你的影响很大吗？",
                "家庭关系往往反映了我们内心的状态。"
            ],
            r"(.*)": [
                "请继续。",
                "多告诉我一些。",
                "很有趣，请继续说。",
                "我理解。"
            ]
        }

    def respond(self, user_input):
        """基于模式匹配生成回应"""
        for pattern, responses in self.patterns.items():
            match = re.match(pattern, user_input, re.IGNORECASE)
            if match:
                response = responses[len(user_input) % len(responses)]
                return response.format(*match.groups())
        return "请继续说。"

# 运行示例
eliza = ELIZA()
print(eliza.respond("我觉得很难过"))
# 输出: "你确定你觉得很难过吗？"
print(eliza.respond("我的母亲不理解我"))
# 输出: "告诉我更多关于你家庭的事。"
```

ELIZA的意义不在于它的技术深度（实际上非常简单），而在于它提出了一个深刻的问题：**一个看似理解人类语言的程序，是否真的需要"理解"语言？** 这个问题至今仍是AI Agent研究的核心议题之一。

### 2.2.2 SHRDLU：自然语言理解的里程碑

1971年，Terry Winograd在MIT开发了SHRDLU，这是AI历史上一个真正的里程碑。SHRDLU能够理解自然语言指令，并在一个虚拟的"积木世界"中执行操作。

SHRDLU的核心创新在于它将自然语言理解与物理世界模型结合了起来：

- **世界模型**：维护一个积木世界的内部表示
- **语法分析**：将自然语言解析为结构化指令
- **推理能力**：基于世界模型进行逻辑推理
- **执行能力**：通过操作世界模型来执行指令

```python
# SHRDLU 的概念性实现：积木世界Agent
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class Color(Enum):
    RED = "红色"
    BLUE = "蓝色"
    GREEN = "绿色"
    YELLOW = "黄色"

@dataclass
class Block:
    """积木世界中的积木"""
    name: str
    color: Color
    x: int = 0
    y: int = 0
    z: int = 0  # 堆叠高度
    on_top_of: Optional[str] = None

class BlockWorld:
    """SHRDLU的积木世界"""

    def __init__(self):
        self.blocks: dict[str, Block] = {}
        self._init_world()

    def _init_world(self):
        """初始化积木世界"""
        a = Block("A", Color.RED, x=0, y=0, z=1)
        b = Block("B", Color.BLUE, x=0, y=0, z=2, on_top_of="A")
        c = Block("C", Color.GREEN, x=1, y=0, z=1)
        self.blocks = {"A": a, "B": b, "C": c}

    def pick_up(self, block_name: str) -> str:
        """拿起一个积木"""
        block = self.blocks.get(block_name)
        if not block:
            return f"我不知道{block_name}是什么。"
        if block.on_top_of is None:
            return f"{block_name}已经在桌面上，可以直接拿起。"

        # 检查上面是否有积木
        for other in self.blocks.values():
            if other.on_top_of == block_name:
                return f"无法拿起{block_name}，因为{other.name}在它上面。"

        self.blocks[block.on_top_of].on_top_of = None  # 这行逻辑有问题，但展示概念
        return f"已经拿起了{block_name}。"

    def put_on(self, block_name: str, target_name: str) -> str:
        """将一个积木放到另一个上面"""
        if block_name not in self.blocks or target_name not in self.blocks:
            return "我不认识这个积木。"
        self.blocks[block_name].on_top_of = target_name
        return f"已经把{block_name}放到了{target_name}上面。"

    def describe(self) -> str:
        """描述当前世界状态"""
        lines = []
        for name, block in self.blocks.items():
            loc = f"在{block.on_top_of}上面" if block.on_top_of else "在桌面上"
            lines.append(f"{name}（{block.color.value}积木）{loc}")
        return "\n".join(lines)

# 模拟 SHRDLU 的自然语言交互
world = BlockWorld()
print("=== 积木世界 ===")
print(world.describe())
print("\n用户: 把B放到C上面")
print(f"SHRDLU: {world.put_on('B', 'C')}")
```

### 2.2.3 Terry Winograd的贡献与局限

Terry Winograd的工作代表了早期AI Agent研究的最高水平。他的博士论文《 Procedures as a Representation for Knowledge in Comprehending Conversational Language 》是AI领域最具影响力的论文之一。

然而，Winograd自己也认识到了这些系统的根本局限性：它们只能处理高度受限的"微世界"（microworld），一旦面对现实世界的复杂性，就显得无能为力。这种认识直接导致了AI领域的第一次"寒冬"。

---

## 2.3 符号主义Agent时期（1980s-1990s）：知识与规则的黄金年代

### 2.3.1 专家系统：知识即力量

20世纪80年代，AI研究找到了一个商业上可行的方向——专家系统（Expert System）。专家系统的核心思想是：将人类专家的知识编码为规则，让计算机模拟专家的决策过程。

最著名的专家系统之一是MYCIN（1970年代中期开发），用于诊断细菌感染并推荐抗生素治疗方案。虽然MYCIN的诊断准确率甚至超过了某些人类医生，但它从未真正投入临床使用——因为AI系统无法承担医疗决策的法律责任。

```python
# 专家系统的简化实现：故障诊断Agent
from dataclasses import dataclass
from typing import Optional

@dataclass
class Rule:
    """产生式规则"""
    condition: str      # 条件描述
    conclusion: str     # 结论
    confidence: float   # 置信度 (0-1)

class ExpertSystemAgent:
    """基于规则的产生式系统Agent"""

    def __init__(self, name: str):
        self.name = name
        self.rules: list[Rule] = []
        self.facts: set[str] = set()
        self.inferred: list[tuple[str, float]] = []

    def add_rule(self, condition: str, conclusion: str, confidence: float = 1.0):
        """添加规则"""
        self.rules.append(Rule(condition, conclusion, confidence))

    def add_fact(self, fact: str):
        """添加已知事实"""
        self.facts.add(fact)

    def reason(self, max_iterations: int = 10) -> list[tuple[str, float]]:
        """前向链推理"""
        for _ in range(max_iterations):
            new_inferences = False
            for rule in self.rules:
                # 简单匹配：规则条件中的关键词都在已知事实中
                keywords = set(rule.condition.split())
                if keywords.issubset(self.facts):
                    if rule.conclusion not in self.facts:
                        self.facts.add(rule.conclusion)
                        self.inferred.append((rule.conclusion, rule.confidence))
                        new_inferences = True
            if not new_inferences:
                break
        return self.inferred

# 使用示例：汽车故障诊断Agent
diagnostician = ExpertSystemAgent("汽车故障诊断专家")

# 添加规则
diagnostician.add_rule("发动机 嘎吱异响 冷启动", "正时皮带磨损", 0.85)
diagnostician.add_rule("正时皮带磨损", "需要更换正时皮带", 0.95)
diagnostician.add_rule("发动机抖动 怠速不稳", "火花塞故障", 0.75)
diagnostician.add_rule("火花塞故障 里程超过5万公里", "需要更换火花塞", 0.90)
diagnostician.add_rule("冷却液温度过高 散热风扇不转", "散热风扇故障", 0.88)

# 添加已知事实
diagnostician.add_fact("发动机")
diagnostician.add_fact("嘎吱异响")
diagnostician.add_fact("冷启动")

# 推理
results = diagnostician.reason()
print(f"=== {diagnostician.name} 推理结果 ===")
for conclusion, confidence in results:
    print(f"  → {conclusion} (置信度: {confidence:.0%})")
```

### 2.3.2 规划系统：STRIPS与行动序列

在符号主义时期，另一个重要方向是AI规划（AI Planning）。1971年，Richard Fikes和Nils Nilsson在SRI International开发了STRIPS（Stanford Research Institute Problem Solver），它定义了一种用操作符（operator）来表示行动的方式，每个操作符包含：

- **前置条件（preconditions）**：执行前必须满足的条件
- **添加效果（add effects）**：执行后新增的事实
- **删除效果（delete effects）**：执行后移除的事实

```python
# STRIPS 规划器的简化实现
from dataclasses import dataclass
from typing import Optional
from copy import deepcopy

@dataclass
class StripsAction:
    """STRIPS操作符"""
    name: str
    preconditions: set[str]
    add_effects: set[str]
    delete_effects: set[str]

    def is_applicable(self, state: set[str]) -> bool:
        """检查是否可以执行"""
        return self.preconditions.issubset(state)

    def apply(self, state: set[str]) -> set[str]:
        """执行操作，返回新状态"""
        new_state = state - self.delete_effects
        new_state = new_state | self.add_effects
        return new_state

class StripsPlanner:
    """简单的STRIPS规划器"""

    def __init__(self):
        self.actions: list[StripsAction] = []

    def add_action(self, action: StripsAction):
        self.actions.append(action)

    def plan(self, initial: set[str], goal: set[str], max_depth: int = 10):
        """使用广度优先搜索找到从initial到goal的行动序列"""
        from collections import deque

        queue = deque()
        queue.append((initial, []))

        visited = set()

        while queue:
            current_state, actions_taken = queue.popleft()

            # 到达目标
            if goal.issubset(current_state):
                return actions_taken

            # 超过深度限制
            if len(actions_taken) >= max_depth:
                continue

            state_key = frozenset(current_state)
            if state_key in visited:
                continue
            visited.add(state_key)

            # 尝试所有可用操作
            for action in self.actions:
                if action.is_applicable(current_state):
                    new_state = action.apply(current_state)
                    queue.append((new_state, actions_taken + [action]))

        return None  # 无解

# 使用示例：积木世界规划
planner = StripsPlanner()

planner.add_action(StripsAction(
    name="拿起积木A",
    preconditions={"A在桌上", "手为空"},
    add_effects={"手持A", "手不为空"},
    delete_effects={"A在桌上", "手为空"}
))

planner.add_action(StripsAction(
    name="把A放到B上",
    preconditions={"手持A", "A上方为空", "B上方为空"},
    add_effects={"A在B上"},
    delete_effects={"手持A", "B上方为空"}
))

planner.add_action(StripsAction(
    name="放下积木A",
    preconditions={"手持A"},
    add_effects={"A在桌上", "手为空"},
    delete_effects={"手持A", "A在B上"}
))

# 求解
initial_state = {"A在桌上", "B在桌上", "A上方为空", "B上方为空", "手为空"}
goal_state = {"A在B上", "手为空"}

plan = planner.plan(initial_state, goal_state)
if plan:
    print("=== 找到的规划 ===")
    for i, action in enumerate(plan, 1):
        print(f"  步骤 {i}: {action.name}")
else:
    print("未找到可行规划")
```

### 2.3.3 符号主义的局限

符号主义Agent虽然在特定领域取得了成功，但面临着根本性的挑战：

1. **知识获取瓶颈**：手工编码专家知识极其耗时，且领域专家的知识往往是隐性的
2. **脆弱性**：一旦遇到规则库之外的输入，系统就会崩溃
3. **缺乏学习能力**：符号系统本质上是静态的，无法从经验中学习
4. **组合爆炸**：随着规则和状态空间的增大，推理的计算复杂度急剧上升

这些局限最终导致了符号主义的衰落，但它的核心思想——将知识显式表示、将推理形式化——至今仍是Agent系统设计的重要参考。

---

## 2.4 强化学习Agent的兴起（2010s-2020s）：从感知到决策

### 2.4.1 DeepMind的革命：从Atari到AlphaGo

2013年，DeepMind发表了Deep Q-Network（DQN）论文，展示了深度神经网络可以学会直接从原始像素输入来玩Atari游戏。这标志着深度强化学习（Deep RL）时代的开始。

2016年，AlphaGo击败围棋世界冠军李世石，震撼了整个世界。AlphaGo的成功证明了AI Agent可以在复杂、高维度的环境中做出超越人类的决策。

```python
# 简化的强化学习Agent：Q-Learning
import numpy as np
from collections import defaultdict

class QLearningAgent:
    """经典Q-Learning Agent"""

    def __init__(
        self,
        n_actions: int,
        learning_rate: float = 0.1,
        discount_factor: float = 0.95,
        epsilon: float = 0.1
    ):
        self.n_actions = n_actions
        self.lr = learning_rate
        self.gamma = discount_factor
        self.epsilon = epsilon
        self.q_table: dict[tuple, np.ndarray] = defaultdict(
            lambda: np.zeros(n_actions)
        )

    def choose_action(self, state: tuple, training: bool = True) -> int:
        """ε-贪心策略选择动作"""
        if training and np.random.random() < self.epsilon:
            return np.random.randint(self.n_actions)

        q_values = self.q_table[state]
        return int(np.argmax(q_values))

    def learn(
        self,
        state: tuple,
        action: int,
        reward: float,
        next_state: tuple,
        done: bool
    ):
        """Q-Learning更新"""
        current_q = self.q_table[state][action]

        if done:
            target = reward
        else:
            target = reward + self.gamma * np.max(self.q_table[next_state])

        # Q(s,a) ← Q(s,a) + α[r + γ·max(Q(s')) - Q(s,a)]
        self.q_table[state][action] += self.lr * (target - current_q)

    def get_policy(self) -> dict[tuple, int]:
        """获取学到的策略"""
        return {
            state: int(np.argmax(q_values))
            for state, q_values in self.q_table.items()
        }

# 使用示例：简单的网格世界导航
class GridWorld:
    """4x4网格世界环境"""

    def __init__(self):
        self.size = 4
        self.start = (0, 0)
        self.goal = (3, 3)
        self.obstacles = {(1, 1), (2, 2)}
        self.agent_pos = self.start
        self.actions = ["上", "下", "左", "右"]

    def reset(self):
        self.agent_pos = self.start
        return self.agent_pos

    def step(self, action: int):
        """执行动作，返回 (next_state, reward, done)"""
        moves = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        dr, dc = moves[action]
        new_r = self.agent_pos[0] + dr
        new_c = self.agent_pos[1] + dc

        # 边界检查
        if not (0 <= new_r < self.size and 0 <= new_c < self.size):
            return self.agent_pos, -1.0, False

        # 障碍物检查
        if (new_r, new_c) in self.obstacles:
            return self.agent_pos, -5.0, False

        self.agent_pos = (new_r, new_c)

        # 到达目标
        if self.agent_pos == self.goal:
            return self.agent_pos, 100.0, True

        return self.agent_pos, -0.1, False

# 训练Agent
env = GridWorld()
agent = QLearningAgent(n_actions=4, epsilon=0.2)

print("=== 训练 Q-Learning Agent ===")
for episode in range(500):
    state = env.reset()
    total_reward = 0
    done = False

    while not done:
        action = agent.choose_action(state)
        next_state, reward, done = env.step(action)
        agent.learn(state, action, reward, next_state, done)
        state = next_state
        total_reward += reward

    if (episode + 1) % 100 == 0:
        print(f"  第 {episode+1} 轮，总奖励: {total_reward:.1f}")

print("\n=== 学到的策略 ===")
policy = agent.get_policy()
for r in range(4):
    row_actions = []
    for c in range(4):
        if (r, c) == (3, 3):
            row_actions.append("🏆")
        elif (r, c) in env.obstacles:
            row_actions.append("⬛")
        else:
            row_actions.append(env.actions[policy.get((r, c), 0)])
    print(f"  {row_actions}")
```

### 2.4.2 OpenAI Five：团队协作的极致

2019年，OpenAI的Five系统在Dota 2中击败了世界冠军OG战队（虽然后来正式比赛中失利）。OpenAI Five展示了多个强化学习Agent如何在一个极其复杂的环境中实现高水平的团队协作。

OpenAI Five的关键创新：

- **自我对弈（Self-Play）**：通过Agent之间的对抗来不断学习
- **长视野规划**：游戏中的决策需要考虑数分钟后的后果
- **隐式通信**：五个Agent通过共享的奖励信号学习协作策略
- **大规模并行训练**：使用了数千个GPU进行并行模拟

### 2.4.3 强化学习Agent的局限

尽管取得了令人瞩目的成就，强化学习Agent也面临着挑战：

1. **样本效率低**：AlphaGo需要数千万局对弈，而人类只需要数万局
2. **模拟到现实（Sim2Real）的鸿沟**：在模拟器中学到的策略难以直接迁移到现实世界
3. **奖励函数设计困难**：如何定义一个好的奖励函数本身就是一个大问题
4. **缺乏常识和语言理解**：RL Agent无法理解自然语言指令

这些局限性为下一阶段——大语言模型Agent的出现——埋下了伏笔。

---

## 2.5 大语言模型时代的Agent革命（2020s-至今）：语言即行动

### 2.5.1 从GPT到Agent：范式的质变

2022年底，ChatGPT的发布引爆了全球对AI的热情。但真正让研究者们兴奋的是2023年初出现的一系列LLM-based Agent项目。这些项目展示了一个令人震惊的可能性：**大语言模型可以不仅仅是对话工具，它可以是自主行动的Agent。**

这个质变的核心逻辑是：

1. **语言即世界模型**：LLM在训练过程中已经内化了大量关于世界运行规律的知识
2. **思维链（Chain of Thought）**：LLM可以展示其推理过程，使决策过程可解释
3. **工具使用（Tool Use）**：LLM可以通过API调用外部工具，突破其自身能力的边界
4. **记忆系统**：结合外部存储，LLM Agent可以维持长期记忆

### 2.5.2 WebGPT：让LLM上网

2021年12月，OpenAI发表了WebGPT，展示了如何让GPT-3模型浏览网页来回答问题。WebGPT的关键在于：

- 将网页浏览任务形式化为一个决策过程
- LLM自主决定何时搜索、点击哪些链接、何时给出最终答案
- 使用人类反馈的强化学习（RLHF）来提升浏览效率

虽然WebGPT在当时并未引起广泛关注，但它在技术上奠定了LLM Agent的基础。

### 2.5.3 AutoGPT：自主Agent的引爆点

2023年3月，Significant Gravitas发布的AutoGPT项目在GitHub上迅速获得了超过10万星标，成为了AI Agent概念的"引爆点"。

AutoGPT的核心理念是"给LLM一个目标，让它自主完成"：

```
目标：调研某个市场并写一份报告
→ AutoGPT自主分解任务
→ 自主搜索信息
→ 自主编写报告
→ 自主保存结果
```

```python
# AutoGPT 概念的简化实现：自主任务Agent
import json
from typing import Callable

class AutonomousAgent:
    """简化版自主Agent——模拟AutoGPT的核心循环"""

    def __init__(self, name: str, goal: str, llm_func: Callable):
        self.name = name
        self.goal = goal
        self.llm = llm_func
        self.memory: list[str] = []
        self.max_steps = 10

    def think(self) -> str:
        """让LLM思考下一步行动"""
        prompt = f"""
你是一个自主AI Agent '{self.name}'。
你的目标: {self.goal}
历史记忆: {json.dumps(self.memory[-5:], ensure_ascii=False, indent=2)}

请决定下一步行动。可用的动作类型:
- THINK: 分析当前情况
- SEARCH: 搜索信息（需要提供搜索关键词）
- WRITE: 写入文件（需要提供文件名和内容）
- COMPLETE: 任务完成

请以JSON格式回复: {{"action": "THINK|SEARCH|WRITE|COMPLETE", "content": "..."}}
"""
        return self.llm(prompt)

    def execute(self, action_str: str):
        """执行行动"""
        try:
            action_data = json.loads(action_str)
        except json.JSONDecodeError:
            self.memory.append(f"执行失败: 无法解析动作 {action_str}")
            return

        action_type = action_data.get("action", "THINK")
        content = action_data.get("content", "")

        if action_type == "THINK":
            self.memory.append(f"思考: {content}")
        elif action_type == "SEARCH":
            self.memory.append(f"搜索 '{content}': 找到相关结果...")
        elif action_type == "WRITE":
            self.memory.append(f"写入完成: {content[:50]}...")
        elif action_type == "COMPLETE":
            self.memory.append(f"任务完成: {content}")
        else:
            self.memory.append(f"未知动作: {action_type}")

    def run(self):
        """主循环：思考→执行→反思"""
        print(f"=== {self.name} 启动 ===")
        print(f"目标: {self.goal}\n")

        for step in range(1, self.max_steps + 1):
            print(f"--- 步骤 {step} ---")
            thought = self.think()
            self.execute(thought)

            # 检查是否完成
            if "COMPLETE" in self.memory[-1]:
                print(f"\n✅ {self.name} 在 {step} 步内完成任务")
                return True

        print(f"\n⏱️ 达到最大步数限制，任务未完成")
        return False

# 模拟LLM函数（实际中应调用真正的LLM API）
def mock_llm(prompt: str) -> str:
    """模拟LLM响应"""
    if "自主AI Agent" in prompt and "目标" in prompt:
        if len([l for l in prompt.split('\n') if '历史记忆' in l or 'THINK' in prompt]) < 5:
            return json.dumps({"action": "THINK", "content": "我需要先分析任务，然后搜索相关信息"})
        return json.dumps({"action": "COMPLETE", "content": "任务已完成"})
    return json.dumps({"action": "THINK", "content": "继续分析..."})

# 运行示例
agent = AutonomousAgent("ResearchBot", "调研Python异步编程最佳实践", mock_llm)
agent.run()
```

### 2.5.4 BabyAGI：任务驱动的Agent架构

2023年4月，Yohei Nakajima发布的BabyAGI展示了另一种Agent设计理念：**基于任务列表的自主管理**。

BabyAGI的核心循环极其优雅：

```
1. 从任务列表中取出最优先的任务
2. 用LLM执行任务（可能创建子任务）
3. 用LLM评估结果并更新任务列表
4. 重复
```

```python
# BabyAGI 简化实现：任务驱动Agent
import heapq
from dataclasses import dataclass, field

@dataclass(order=True)
class PrioritizedTask:
    priority: int
    task_id: int = field(compare=False)
    description: str = field(compare=False)
    status: str = field(default="pending", compare=False)

class BabyAGIAgent:
    """BabyAGI风格的任务驱动Agent"""

    def __init__(self, objective: str, llm_func):
        self.objective = objective
        self.llm = llm_func
        self.tasks: list[PrioritizedTask] = []
        self.completed: list[str] = []
        self.task_counter = 0
        self.max_iterations = 15

    def add_task(self, description: str, priority: int = 5):
        """添加新任务"""
        self.task_counter += 1
        heapq.heappush(self.tasks, PrioritizedTask(priority, self.task_counter, description))

    def execute_task(self, task: PrioritizedTask) -> str:
        """执行单个任务"""
        prompt = f"""
目标: {self.objective}
当前任务: {task.description}
已完成: {self.completed[-3:] if self.completed else '无'}

请执行此任务。如果需要创建新的子任务，请在结果末尾列出。
"""
        return self.llm(prompt)

    def prioritize_tasks(self):
        """重新排序任务优先级"""
        if not self.tasks:
            return
        prompt = f"""
目标: {self.objective}
待完成任务: {[t.description for t in self.tasks]}

请根据与目标的关联度，为每个任务分配1-10的优先级分数。
返回JSON数组: [{{"task": "描述", "priority": 分数}}]
"""
        result = self.llm(prompt)
        # 简化：实际中应解析JSON并更新优先级
        return

    def run(self):
        """主循环"""
        print(f"=== BabyAGI Agent 启动 ===")
        print(f"目标: {self.objective}\n")

        # 初始任务
        self.add_task(f"创建实现'{self.objective}'的详细计划", priority=1)

        for iteration in range(self.max_iterations):
            if not self.tasks:
                print("所有任务已完成！")
                break

            task = heapq.heappop(self.tasks)
            print(f"[迭代 {iteration+1}] 执行: {task.description} (优先级: {task.priority})")

            result = self.execute_task(task)
            self.completed.append(task.description)
            print(f"  结果: {result[:80]}...")

            self.prioritize_tasks()

        print(f"\n=== 完成 {len(self.completed)} 个任务 ===")
        for task_desc in self.completed:
            print(f"  ✅ {task_desc}")

# 运行示例
baby_agi = BabyAGIAgent("创建一个简单的Web爬虫", mock_llm)
baby_agi.run()
```

### 2.5.5 关键里程碑总结

以下是LLM Agent发展中的关键里程碑：

| 时间 | 项目/事件 | 意义 |
|------|-----------|------|
| 2021.12 | WebGPT | 首个展示LLM自主浏览网页能力 |
| 2022.12 | ChatGPT | LLM能力质变，Agent基础奠定 |
| 2023.03 | AutoGPT | 自主Agent概念引爆全球 |
| 2023.03 | GPT-4 Plugins | 官方工具使用能力 |
| 2023.04 | BabyAGI | 任务驱动Agent架构 |
| 2023.06 | AutoGen (Microsoft) | 多Agent对话框架 |
| 2023.09 | CrewAI | 角色扮演式多Agent框架 |
| 2023.10 | LangGraph | 有状态的Agent工作流 |
| 2024.01 | OpenAI Assistants API | 官方Agent API |
| 2024.03 | Claude 3 + MCP | 工具协议标准化 |
| 2024.06 | DevIn (字节) | 端到端软件Agent |
| 2024.12 | 多个Agent框架成熟 | 生产级Agent系统涌现 |

---

## 2.6 演进脉络的深层逻辑

回顾Agent技术的演进历程，我们可以发现几条清晰的脉络：

### 2.6.1 从"微世界"到"开放世界"

早期的Agent（如SHRDLU）只能在高度受限的微世界中运作，而现代Agent已经能够在开放的互联网环境中导航。这个转变的关键是**世界知识的内化**——LLM在预训练过程中已经学习了关于世界的海量知识。

### 2.6.2 从"手工规则"到"学习驱动"

符号主义Agent依赖人工编码的规则，强化学习Agent通过试错学习策略，而LLM Agent则通过大规模预训练自动习得通用的推理和行动能力。这个趋势的终点可能是**完全自主的学习Agent**。

### 2.6.3 从"单一目标"到"开放目标"

从Atari游戏中的固定目标，到AutoGPT的开放式目标，Agent面对的任务越来越模糊、越来越接近人类实际面对的复杂目标。这要求Agent具备更强的规划和分解能力。

### 2.6.4 从"孤立个体"到"社会协作"

从单Agent系统到多Agent协作（如AutoGen、CrewAI），Agent正在学会像人类一样进行团队协作、角色分工和知识共享。这可能是通向真正AGI的必经之路。

---

## 2.7 展望：Agent技术的下一个十年

站在2026年的时间节点上，Agent技术正处在一个激动人心的时刻。我们可以预见几个重要方向：

1. **多模态Agent**：不仅能处理文本，还能理解图像、音频、视频，并在物理世界中行动（机器人Agent）
2. **持久化Agent**：具有长期记忆和持续学习能力，不再是"每次对话从零开始"
3. **自进化Agent**：能够自主改进自己的代码、策略和工具使用方式
4. **Agent即服务（AaaS）**：Agent成为新的软件交付形态，用户描述需求，Agent自动构建解决方案
5. **可信Agent**：具备可解释性、可控性和安全性的Agent系统

Agent技术的演进历程告诉我们：**从被动工具到主动行动者，这条路已经走了六十年，而最好的部分才刚刚开始。**

---

## 2.8 本章小结

本章回顾了Agent技术从1960年代到2026年的演进历程：

- **萌芽期（1960s-1970s）**：ELIZA和SHRDLU展示了对话理解和世界交互的雏形
- **符号主义时期（1980s-1990s）**：专家系统和规划系统将知识工程推向顶峰
- **强化学习时期（2010s-2020s）**：AlphaGo等系统展示了通过学习获得超人决策能力的可能
- **LLM Agent时期（2020s-至今）**：大语言模型赋予了Agent前所未有的通用语言理解和推理能力

每一次范式的转变，都不是简单的技术迭代，而是对"什么是Agent"这个根本问题的重新回答。理解这个演进历程，是我们构建下一代Agent系统的基础。

在下一章中，我们将深入探讨现代Agent的编程范式——如何用代码来定义、构建和控制Agent系统。
