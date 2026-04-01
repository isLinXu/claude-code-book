# 卷九：Agent 设计模式

## 卷首语

> "设计模式是面向对象设计中可复用问题的解决方案。它们不是可以直接转换成代码的设计，而是描述了在不同情况下解决一般问题的模板。" —— GoF《设计模式》

软件工程史上，GoF（Gang of Four）的《设计模式》一书将分散的编程智慧凝练为 23 种经典模式，深刻影响了整整一代开发者。如今，AI Agent 的崛起正在催生新一轮的"模式语言"——我们面对的不再是对象与方法的排列组合，而是推理、记忆、工具、协作与安全的多维交织。

本卷以 GoF 设计模式的经典体例为蓝本，系统梳理 Agent 编程领域的设计模式。每个模式都遵循统一的表述框架：**意图、动机、结构、参与者、协作、效果、实现、代码示例、适用场景与相关模式**，力求兼具理论深度与实践指导。

## 本卷结构

| 章节 | 标题 | 核心主题 |
|------|------|----------|
| 第31章 | 单Agent模式 | ReAct、Plan-and-Execute、Reflection、Router、Guardrails、Adapter |
| 第32章 | 多Agent编排模式 | Orchestrator、Blackboard、Pipeline、Swarm、Hierarchical、Peer-to-Peer |
| 第33章 | 人机协作模式 | Human-in/on/over-the-Loop、Approval Gate、Delegation、Escalation |
| 第34章 | 工具使用模式 | Tool Registry、Composition、Cache、Fallback、Semantic Router、MCP Client |
| 第35章 | 企业级设计模式 | Circuit Breaker、Rate Limiter、Token Budget、Audit Trail、Feature Flag、Configuration Driven |

## 阅读指引

**推荐阅读路径：**

- **架构师路径**：第31章 → 第32章 → 第35章（从单Agent到多Agent再到企业治理）
- **产品经理路径**：第33章 → 第31章 → 第35章（从人机交互到Agent能力到生产治理）
- **全栈开发者路径**：按序阅读第31-35章（系统掌握全部模式）
- **快速参考**：直接翻阅需要的模式，每个模式都是自包含的

**与其他卷的关系：**

- 卷一（认知篇）提供了理解Agent思维模式的理论基础
- 卷二（基础篇）介绍了Agent的基本构建块
- 卷七（Agent编程技法）提供了模式的底层技术实现
- 卷十（生产级Agent平台）展示了模式的规模化应用

## 模式分类体系

本卷的 24 种模式按照关注点分为四大类：

```
Agent设计模式分类
├── 行为模式（Behavioral）
│   ├── ReAct模式
│   ├── Plan-and-Execute模式
│   ├── Reflection模式
│   └── Delegation模式
├── 结构模式（Structural）
│   ├── Router模式
│   ├── Adapter模式
│   ├── Tool Registry
│   ├── Tool Composition
│   └── Semantic Router
├── 编排模式（Orchestration）
│   ├── Orchestrator模式
│   ├── Blackboard模式
│   ├── Pipeline模式
│   ├── Swarm模式
│   ├── Hierarchical模式
│   └── Peer-to-Peer模式
└── 治理模式（Governance）
    ├── Guardrails模式
    ├── Human-in/on/over-the-Loop
    ├── Approval Gate
    ├── Escalation
    ├── Circuit Breaker
    ├── Rate Limiter
    ├── Token Budget
    ├── Audit Trail
    ├── Feature Flag
    ├── Configuration Driven
    ├── Tool Cache
    ├── Tool Fallback
    └── MCP Client
```

## 体例说明

每个模式按照以下结构组织：

1. **模式名称**（中英文）
2. **意图（Intent）**：一两句话概括模式要解决的问题
3. **动机（Motivation）**：为什么需要这个模式，解决什么痛点
4. **结构（Structure）**：模式的核心组件和它们之间的关系
5. **参与者（Participants）**：模式中的关键角色
6. **协作（Collaboration）**：参与者之间的交互时序
7. **效果（Consequences）**：使用该模式的优缺点
8. **实现（Implementation）**：关键实现要点
9. **代码示例（Example Code）**：可运行的代码示例
10. **适用场景（When to Use）**：推荐使用的场景
11. **相关模式（Related Patterns）**：与之关联的其他模式

---

*"好的设计不是没有东西可以添加，而是没有东西可以删除。"*
*—— Antoine de Saint-Exupéry*
