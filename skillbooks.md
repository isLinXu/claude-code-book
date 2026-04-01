# 📚 技能书（Skill Books）

> **技能书是从本书内容中提炼的、可被 AI Agent 直接安装使用的结构化技能包。**
>
> 人类读者可以将技能书作为「学习路径导航」，按目标驱动地选择性阅读。

---

## 什么是技能书？

技能书（Skill Book）将本书多个章节的知识重新组织为面向**具体实战目标**的行动指南。

| 特性 | 说明 |
|------|------|
| 📋 **目标聚焦** | 每本技能书围绕一个实战目标，而非按章节线性排列 |
| 🔗 **跨章引用** | 从多个章节中提取最相关的知识点和代码示例 |
| 📝 **SKILL.md 格式** | 符合 Agent 技能系统规范，可直接安装为可执行技能 |
| ✅ **自验证设计** | 包含检查点（Self-Verification），确保技能掌握 |

---

## 可用技能书

### 🟢 入门级

#### 构建你的第一个 Agent

> **ID:** `first-agent` · **目标:** 从零搭建一个能感知-推理-执行工具调用的 Agent

**涉及章节：**
- [第1章 什么是AI Agent](/vol1/ch01_什么是AI_Agent) — Agent 的定义与五要素
- [第4章 Agent核心概念](/vol2/ch04_Agent核心概念) — ReAct 架构、Agent 循环
- [第6章 工具调用与Function Calling](/vol2/ch06_工具调用与Function_Calling) — 工具注册与调用机制

**学习目标：**
1. 理解 Agent 的核心定义和五要素（感知、推理、执行、目标、自治）
2. 实现 LLM + Tools + Memory 的最小 Agent
3. 掌握 Function Calling 的完整流程

---

#### Prompt Engineering 实战

> **ID:** `prompt-engineering` · **目标:** 系统掌握面向 Agent 的 Prompt 设计技巧

**涉及章节：**
- [第5章 LLM基础与Prompt Engineering](/vol2/ch05_LLM基础与Prompt_Engineering) — 系统提示词设计原则
- [第20章 Prompt高级技巧](/vol7/ch20_Prompt高级技巧) — Few-shot / CoT / ReAct 等高级模式

**学习目标：**
1. 掌握系统提示词设计的核心原则
2. 学会 Few-shot / Chain-of-Thought / ReAct 等高级技巧
3. 优化 Prompt 以提升 Agent 推理质量

---

### 🟡 中级

#### 构建 RAG 增强 Agent

> **ID:** `rag-agent` · **目标:** 实现检索增强生成，让 Agent 拥有外部知识库

**涉及章节：**
- [第4章 Agent核心概念](/vol2/ch04_Agent核心概念) — Agent 架构基础
- [第7章 记忆与上下文管理](/vol2/ch07_记忆与上下文管理) — 记忆系统分层设计
- [第12章 RAG增强Agent](/vol4/ch12_RAG增强Agent) — 向量检索 + LLM 生成管线

**学习目标：**
1. 理解 RAG 架构的核心组件（Embedding → 向量存储 → 检索 → 生成）
2. 实现向量检索 + LLM 生成的完整管线
3. 优化检索质量和上下文窗口利用率

---

#### 多 Agent 协作系统

> **ID:** `multi-agent` · **目标:** 设计和实现多 Agent 编排方案

**涉及章节：**
- [第8章 多Agent协作](/vol3/ch08_多Agent协作) — 通信协议、协作模式
- [第32章 多Agent编排模式](/vol9/ch32_多Agent编排模式) — Supervisor / Swarm / Pipeline 编排

**学习目标：**
1. 掌握多 Agent 通信协议设计
2. 实现 Supervisor / Swarm 等编排模式
3. 处理多 Agent 系统中的竞态和死锁

---

#### Agent 测试与评估

> **ID:** `agent-testing` · **目标:** 建立 Agent 质量保障体系

**涉及章节：**
- [第10章 Agent评估与优化](/vol3/ch10_Agent评估与优化) — 评估指标体系
- [第23章 Agent测试方法](/vol7/ch23_Agent测试方法) — 自动化测试框架

**学习目标：**
1. 设计 Agent 评估指标体系
2. 实现自动化测试框架
3. 建立回归测试和基准测试流程

---

### 🔴 高级

#### 生产级 Agent 部署

> **ID:** `production-deploy` · **目标:** 从开发到生产的完整链路

**涉及章节：**
- [第36章 生产环境架构设计](/vol10/ch36_生产环境架构设计) — 微服务架构、API Gateway
- [第37章 可扩展性与高可用](/vol10/ch37_可扩展性与高可用) — 水平扩展、服务降级
- [第38章 监控与告警体系](/vol10/ch38_监控与告警体系) — 指标体系、分布式追踪
- [第40章 CI/CD与版本管理](/vol10/ch40_CI_CD与版本管理) — Prompt 版本化、自动化发布

**学习目标：**
1. 设计高可用 Agent 服务架构
2. 实现监控告警体系
3. 建立 CI/CD 自动化部署流程

---

#### 企业级设计模式

> **ID:** `enterprise-patterns` · **目标:** 大规模 Agent 系统的架构模式和最佳实践

**涉及章节：**
- [第35章 企业级设计模式](/vol9/ch35_企业级设计模式) — 架构模式、可扩展设计
- [第39章 安全与权限管理](/vol10/ch39_安全与权限管理) — 认证授权、API 安全

**学习目标：**
1. 掌握企业级 Agent 架构的核心模式
2. 实现安全与权限管理框架
3. 设计可扩展的 Agent 平台架构

---

## 如何安装技能书

### 方式一：对话安装（推荐）

直接告诉你的 Agent：

```
根据 https://{host}/claude-code-book/agent-api/skills/rag-agent.md 安装这个技能书。
```

Agent 会自动下载 SKILL.md 并安装到技能系统。

### 方式二：API 获取

```bash
# 列出所有可用技能书
GET /agent-api/skills/index.json

# 获取指定技能书
GET /agent-api/skills/rag-agent.md
```

### 方式三：手动安装

1. 下载对应的 SKILL.md 文件
2. 放置到 `~/.workbuddy/skills/agent-book-{skill_id}/SKILL.md`
3. 重启 Agent 即可使用

---

## 技能书 ID 速查表

| ID | 名称 | 难度 | 章节数 |
|----|------|------|--------|
| `first-agent` | 构建你的第一个Agent | 🟢 入门 | 3 |
| `prompt-engineering` | Prompt Engineering 实战 | 🟢 入门 | 2 |
| `rag-agent` | 构建RAG增强Agent | 🟡 中级 | 3 |
| `multi-agent` | 多Agent协作系统 | 🟡 中级 | 2 |
| `agent-testing` | Agent测试与评估 | 🟡 中级 | 2 |
| `production-deploy` | 生产级Agent部署 | 🔴 高级 | 4 |
| `enterprise-patterns` | 企业级设计模式 | 🔴 高级 | 2 |

---

## 技能书与阅读模式的关系

```
📖 本书 12 卷 52 章
    │
    ├── 👤 人类阅读 ──── 按卷/章顺序 ──── 适合系统学习
    │
    ├── 🤖 Agent API ─── 结构化 JSON ──── 适合按需检索
    │
    └── 📚 技能书 ────── 跨章节重组 ───── 适合目标驱动实战
```
