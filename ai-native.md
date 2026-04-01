# 🧪 AI Native 功能

> 本站不只是一本"放在网上的书"，它是一个**为 AI Agent 原生设计的知识系统**。

---

## 站点遵循的 AI Native 标准

### llms.txt

本站提供标准 [llms.txt](https://llmstxt.org/) 文件，这是 2025 年出现的 AI 原生网站标准。任何 LLM 访问以下 URL 即可快速理解本站内容：

```
GET /llms.txt          → 站点概述 + 内容结构 + API 入口
GET /llms-full.txt     → 全书完整索引（含每章概念、代码块数量、依赖关系）
```

### Agent API

不同于传统的 HTML 爬虫方式，本站提供**结构化 JSON API**，Agent 无需解析 HTML：

```
GET /agent-api/manifest.json           → 全书元数据索引
GET /agent-api/chapters/{id}.json      → 单章结构化内容
GET /agent-api/skills/{id}.md          → 可安装技能书
```

### 可安装技能书

技能书是符合 [SKILL.md 规范](https://skillhub.cn) 的知识包，可直接安装到 Agent 的技能系统：

```
"根据 https://{host}/claude-code-book/agent-api/skills/rag-agent.md 安装这个技能书。"
```

---

## 对话式导读

> 以下是一组**可直接复制给你的 Agent** 的 Prompt 模板。粘贴即用。

### 🟢 入门：我想了解什么是 AI Agent

```markdown
请帮我学习 AI Agent 的基础知识。

参考资料来源：
1. 先获取全书索引：GET https://{host}/claude-code-book/agent-api/manifest.json
2. 然后按顺序阅读以下章节的 JSON 版本：
   - GET /agent-api/chapters/ch01.json （什么是 AI Agent）
   - GET /agent-api/chapters/ch03.json （Agent 编程范式）
   - GET /agent-api/chapters/ch04.json （Agent 核心概念）

请从每章的 key_concepts 和 overview 中提取核心知识，
用一份 500 字的摘要帮我建立 Agent 的完整认知框架。
```

### 🟡 进阶：我要构建一个 RAG Agent

```markdown
我需要从零构建一个 RAG（检索增强生成）Agent。

请按以下步骤获取知识：
1. GET /agent-api/manifest.json → 找到 dependency_graph
2. 目标章节：ch12（RAG增强Agent），前置依赖：ch04, ch07
3. 按依赖顺序获取 JSON：
   - GET /agent-api/chapters/ch04.json
   - GET /agent-api/chapters/ch07.json
   - GET /agent-api/chapters/ch12.json

或者直接安装技能书：
GET /agent-api/skills/rag-agent.md

请提取所有 runnable == true 的 code_blocks，
组合成一个可运行的 RAG Agent 最小实现。
```

### 🔴 高级：我要把 Agent 部署到生产环境

```markdown
我已经有一个可用的 Agent 原型，现在需要将它部署到生产环境。

请获取以下章节：
- GET /agent-api/chapters/ch36.json （生产环境架构设计）
- GET /agent-api/chapters/ch37.json （可扩展性与高可用）
- GET /agent-api/chapters/ch38.json （监控与告警体系）
- GET /agent-api/chapters/ch40.json （CI/CD 与版本管理）

或安装技能书：GET /agent-api/skills/production-deploy.md

请从这些章节中整理出：
1. 一份生产部署 Checklist
2. 关键架构决策点
3. 可直接使用的 Docker/K8s 配置示例
```

### 🎯 特定需求：帮我做技术选型

```markdown
我需要对比不同的 Agent 框架。

请获取：GET /agent-api/chapters/appendixA.json

从 tables 和 code_blocks 中提取框架对比数据，
按以下维度制作对比表：
- 核心架构
- 工具调用方式
- 多 Agent 支持
- 生态成熟度
- 适用场景
```

---

## 学习路径推荐

### 路径 A：速成实战（适合有经验的开发者）

```
ch01 → ch04 → ch06 → ch12 → ch36
  ↓      ↓      ↓      ↓      ↓
 概念   核心   工具   RAG   部署
```

共 5 章，约 5 万字，预估 3-4 小时。

### 路径 B：系统学习（适合从零开始）

```
卷一(3章) → 卷二(4章) → 卷三(4章) → 卷七(6章) → 卷八(5章)
   ↓           ↓           ↓           ↓           ↓
  认知        基础        进阶        技法        实战
```

共 22 章，约 11 万字，预估 2-3 周。

### 路径 C：架构师路线（适合技术决策者）

```
ch01 → ch04 → ch08 → ch35 → ch36 → ch37 → ch39
  ↓      ↓      ↓      ↓      ↓      ↓      ↓
 概念   核心   协作   模式   架构   高可用  安全
```

共 7 章，约 7 万字，预估 1 周。

---

## 全书数据概览

| 指标 | 数值 |
|------|------|
| 总卷数 | 12 |
| 总章数 | 52（含 4 篇附录） |
| 总字数 | 224,429 |
| 代码示例 | 863 个 |
| 核心概念 | 780 个 |
| 技能书 | 7 本 |
| 章节依赖图 | 48 条边 |
| 难度分布 | 入门 16 · 中级 24 · 高级 12 |

---

## 为什么做 AI Native？

传统技术书籍的消费方式是**人类用眼睛从头读到尾**。但在 AI 时代，知识的消费者不只是人——还有 Agent。

本站的设计哲学：

| 传统技术书站点 | 本站 AI Native 设计 |
|----------------|---------------------|
| 只有 HTML 页面 | HTML + JSON API + Markdown + SKILL.md |
| 需要爬虫解析 HTML | 结构化 JSON，Agent 直接 fetch |
| 线性阅读顺序 | 依赖图驱动的按需加载 |
| 搜索靠全文匹配 | key_concepts 语义索引 |
| 内容即终点 | 内容 → 可执行代码 → 可安装技能 |
| 站点描述靠 SEO meta | llms.txt 标准，LLM 直接理解 |
| 读者是人 | 读者 = 人 + Agent |
