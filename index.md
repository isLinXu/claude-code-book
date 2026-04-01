---
layout: home

hero:
  name: "Agent 开发实战"
  text: "从原理到生产级实践"
  tagline: "12卷 · 52章 · 22万字 · 863个代码示例 · 7本可安装技能书 · 特别篇：Agent编程思想"
  actions:
    - theme: brand
      text: 👤 人类阅读模式
      link: /vol1/vol1_index
    - theme: alt
      text: 🤖 Agent 阅读模式
      link: /agent
    - theme: alt
      text: 💡 编程思想
      link: /think/think_index

features:
  - icon: 📖
    title: 三层知识架构
    details: "认知层（卷一~三）→ 实践层（卷四~八）→ 工程层（卷九~十二）。从「什么是Agent」到「如何部署到生产」的完整链路"
  - icon: 🤖
    title: 为 Agent 而生
    details: "遵循 llms.txt 标准，提供结构化 JSON API。Agent 可直接 fetch 解析，无需爬虫。780 个核心概念语义索引"
    link: /agent
  - icon: 📚
    title: 可安装技能书
    details: "7 本 SKILL.md 格式技能包，从多章节交叉提炼。一句话安装到你的 Agent 技能系统"
    link: /skillbooks
  - icon: 🧪
    title: AI Native 设计
    details: "对话式导读 Prompt 模板、学习路径推荐、llms.txt / llms-full.txt，传统技术书站点没有的东西"
    link: /ai-native
  - icon: 💡
    title: 特别篇 · 编程思想
    details: "以 Claude Code 源码为标本，解剖 Agent 式编程。5卷19章，从指令式→对象式→Agent式的编程范式演进"
    link: /think/think_index
  - icon: 🔍
    title: 源码剖析 · Claude Code
    details: "v2.1.88 完整逆向分析。22篇文档覆盖架构、工具系统、MCP、配置、API — 从发布包还原工程真相"
    link: /source/source_index
---

<div class="custom-home">

## 三层知识架构

<div class="layer-grid">

### 🧠 认知层：理解 Agent 本质

<p class="layer-desc">不写一行代码，先建立对 Agent 的完整认知框架</p>

| 卷 | 内容 | 章数 |
|-----|------|------|
| [卷一 · 认知篇](/vol1/vol1_index) | Agent 定义、技术演进、编程范式 | 3 章 |
| [卷二 · 基础篇](/vol2/vol2_index) | 核心概念、LLM、工具调用、记忆 | 4 章 |
| [卷三 · 进阶篇](/vol3/vol3_index) | 多 Agent 协作、推理规划、安全对齐 | 4 章 |

### 🔨 实践层：动手构建 Agent

<p class="layer-desc">从单个 Agent 到复杂系统的完整实现技术</p>

| 卷 | 内容 | 章数 |
|-----|------|------|
| [卷四 · 高级篇](/vol4/vol4_index) | RAG 增强、外部系统集成、多模态 | 4 章 |
| [卷五 · 专项篇](/vol5/vol5_index) | 代码 Agent、数据分析、内容创作 | 4 章 |
| [卷六 · 附录](/vol6/vol6_index) | 框架对比、工具速查、部署指南 | 4 章 |
| [卷七 · 开发技法](/vol7/vol7_index) | Prompt 技巧、状态机、错误处理、测试 | 6 章 |
| [卷八 · 实战案例](/vol8/vol8_index) | 客服系统、代码审查、内容流水线 | 5 章 |

### 🏗️ 工程层：走向生产级

<p class="layer-desc">架构设计、设计模式、运维体系——让 Agent 跑在生产环境</p>

| 卷 | 内容 | 章数 |
|-----|------|------|
| [卷九 · 设计模式](/vol9/vol9_index) | 单 Agent、多 Agent 编排、企业级模式 | 5 章 |
| [卷十 · 生产级平台](/vol10/vol10_index) | 架构设计、高可用、监控告警、CI/CD | 5 章 |
| [卷十一 · 生态跨平台](/vol11/vol11_index) | 生态全景、跨平台部署、商业化 | 4 章 |
| [卷十二 · 未来展望](/vol12/vol12_index) | Agent 原生应用、AGI、伦理、行动指南 | 4 章 |

</div>

---

## 双模式阅读

<div class="dual-mode">

### 👤 人类阅读

VitePress 构建的精美站点。侧边栏导航、全文搜索、代码高亮、响应式设计。按卷按章，从头读到尾。

→ [开始阅读](/vol1/vol1_index)

### 🤖 Agent 阅读

结构化 JSON API + 可安装技能书。Agent 通过 HTTP GET 直接获取结构化内容，无需解析 HTML。支持依赖图驱动的按需加载。

→ [接入指南](/agent) · [API 参考](/agent-api-reference) · [技能书](/skillbooks)

</div>

---

## AI Native 特性

本站不只是"放在网上的书"，它是**为 AI Agent 原生设计的知识系统**。

| 特性 | 说明 |
|------|------|
| 📄 **llms.txt** | 遵循 [llms.txt 标准](https://llmstxt.org/)，LLM 访问 `/llms.txt` 即可理解站点 |
| 🗂️ **结构化 API** | `manifest.json` → `chapters/{id}.json` → `skills/{id}.md` |
| 🧩 **可安装技能** | 7 本 SKILL.md 技能包，Agent 一句话安装 |
| 💬 **对话式导读** | 可直接复制给 Agent 的 Prompt 模板，粘贴即用 |
| 🗺️ **依赖图** | 48 条章节依赖边，Agent 自动规划学习路径 |
| 📊 **Token 优化** | key_takeaways 摘要优先，按需加载全文，节约 85%+ token |

→ [查看 AI Native 功能](/ai-native)

</div>

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #5b6ee1 30%, #41d1ff);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #5b6ee1dd 50%, #41d1ffdd 50%);
  --vp-home-hero-image-filter: blur(44px);
}

.custom-home {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 24px 60px;
}

.custom-home h2 {
  font-size: 1.6em;
  border-bottom: 2px solid var(--vp-c-brand-1);
  padding-bottom: 8px;
  margin-top: 48px;
}

.custom-home h3 {
  margin-top: 24px;
  color: var(--vp-c-brand-1);
}

.layer-desc {
  color: var(--vp-c-text-2);
  font-size: 0.95em;
  margin-top: -8px;
}

.dual-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 640px) {
  .dual-mode {
    grid-template-columns: 1fr;
  }
}

.dual-mode > div, .dual-mode > h3 {
  padding: 0;
}
</style>
