# Agent 开发：从原理到生产级实践

[![Deploy](https://github.com/isLinXu/claude-code-book/actions/workflows/deploy.yml/badge.svg)](https://github.com/isLinXu/claude-code-book/actions/workflows/deploy.yml)

> **12卷 · 52章 · 22万字 · 863个代码示例 · 7本可安装技能书**
>
> 一本为**人类和 AI Agent 双模式阅读**设计的 Agent 开发技术指南。

📖 **在线阅读**：[https://islinxu.github.io/claude-code-book/](https://islinxu.github.io/claude-code-book/)

---

## 特色

| 特性 | 说明 |
|------|------|
| 👤 **人类阅读** | VitePress 构建的精美站点，侧边栏导航、全文搜索、代码高亮 |
| 🤖 **Agent 阅读** | 结构化 JSON API，Agent 可直接 `fetch` 获取内容，无需解析 HTML |
| 📚 **可安装技能书** | 7 本 SKILL.md 格式技能包，Agent 一句话安装到技能系统 |
| 🧪 **AI Native** | 遵循 llms.txt 标准，对话式导读 Prompt 模板，学习路径推荐 |
| 💡 **编程思想** | 以 Claude Code v2.1.88 源码为标本的 Agent 编程设计哲学（9章 + Opus 4.6） |
| 🔍 **源码剖析** | Claude Code 完整逆向分析（22篇），覆盖架构/工具/MCP/配置/API |

## 内容结构

### 正文 12 卷 52 章

```
认知层 ──→ 卷一 认知篇(3章) → 卷二 基础篇(4章) → 卷三 进阶篇(4章)
实践层 ──→ 卷四 高级篇(4章) → 卷五 专项篇(4章) → 卷六 附录(4章)
          → 卷七 开发技法(6章) → 卷八 实战案例(5章)
工程层 ──→ 卷九 设计模式(5章) → 卷十 生产级平台(5章)
          → 卷十一 生态跨平台(4章) → 卷十二 未来展望(4章)
```

### 特别篇

- **编程思想**（`think/`）：编程范式演进 → 全景架构 → 工具系统 → MCP → 多代理 → 工程化 + Opus 4.6 能力与安全评测
- **源码剖析**（`source/`）：Claude Code v2.1.88 的 22 篇逆向分析文档

### Agent API

```
GET /agent-api/manifest.json          → 全书索引（52章元数据 + 依赖图）
GET /agent-api/chapters/{id}.json     → 单章结构化内容
GET /agent-api/chapters/{id}.md       → 单章原始 Markdown
GET /agent-api/skills/{id}.md         → 可安装技能书
GET /llms.txt                         → llms.txt 标准站点描述
```

## 本地开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建（先生成 Agent API，再构建 VitePress）
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
claude-code-book/
├── .vitepress/config.ts       # VitePress 配置
├── vol1/ ~ vol12/             # 正文 12 卷 Markdown
├── think/                     # 编程思想特别篇
│   ├── ch01~ch09              # Claude Code 源码编程思想
│   ├── ch10~ch11              # Opus 4.6 能力与安全评测
│   └── appendix               # 参考手册
├── source/                    # 源码剖析栏目（22篇）
├── scripts/build-agent-api.mjs # Agent API 构建脚本
├── public/
│   ├── llms.txt               # AI 原生站点描述
│   └── agent-api/             # 构建产物（gitignore）
├── index.md                   # 首页
├── agent.md                   # Agent 阅读模式
├── skillbooks.md              # 技能书
├── ai-native.md               # AI Native 功能
└── .github/workflows/deploy.yml # GitHub Pages 自动部署
```

## 技术栈

- **静态站点**：VitePress v1.6.4
- **部署**：GitHub Pages + GitHub Actions
- **Agent API**：构建时生成的静态 JSON/Markdown

## 许可

[MIT License](./LICENSE)
