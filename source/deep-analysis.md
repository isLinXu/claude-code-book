# Claude Code v2.1.88 深度拆解报告

> 本报告从**发布包产物**视角对 Claude Code 进行拆解。不同于源码级分析（见 [框架架构深度拆解](./architecture)），本报告聚焦于从可观测的外部接口（`sdk-tools.d.ts` 类型定义 + `cli.js` 行为）反推内部设计逻辑。

---

## 1. 拆解对象与方法论

### 拆解对象

| 文件 | 大小 | 作用 |
|------|------|------|
| `cli.js` | 12MB, 16,668 行 | 编译后的单文件可执行入口（所有逻辑） |
| `sdk-tools.d.ts` | 114KB, 2,720 行 | 工具输入/输出 TypeScript 类型定义 |
| `package.json` | 1.2KB | 包元数据、二进制入口 |
| `vendor/ripgrep/` | 跨 6 平台 | 内嵌的 ripgrep 二进制 |
| `vendor/audio-capture/` | 跨 6 平台 | 内嵌的音频捕获二进制 |

### 拆解方法

1. **类型驱动分析**：从 `sdk-tools.d.ts` 的 Union Type 出发，还原工具系统的完整协议
2. **行为抽样**：对 `cli.js` 关键代码段进行反混淆和语义分析
3. **配置推断**：从 package.json + bun.lock 推断技术栈和构建方式
4. **运行时观察**：通过实际运行 CLI 观察其行为模式

---

## 2. 架构核心：四层协议栈

从外部可观测的接口，可以推断出 Claude Code 的四层协议栈：

```
┌─────────────────────────────────────────────┐
│  CLI 交互层（终端 UI + 命令解析）              │
│  命令树：claude / claude mcp / claude auth    │
├─────────────────────────────────────────────┤
│  会话管理层（状态 + 权限 + 成本追踪）          │
│  模式：default / acceptEdits / plan / bypass  │
├─────────────────────────────────────────────┤
│  工具执行层（22 种工具 + MCP 扩展）            │
│  协议：ToolInputSchemas / ToolOutputSchemas   │
├─────────────────────────────────────────────┤
│  API 通信层（Anthropic Messages API + SSE）    │
│  流式对话 + Token 计数 + 结构化输出解析         │
└─────────────────────────────────────────────┘
```

---

## 3. 工具系统完整拆解

### 3.1 工具分类全景

从 `sdk-tools.d.ts` 可提取出 **22 种工具**，组织为 `ToolInputSchemas` 联合类型：

| 分类 | 工具 | 核心参数 | 设计意图 |
|------|------|----------|----------|
| **文件操作** | FileRead | `file_path, offset?, limit?` | 支持分页读取大文件 |
| | FileEdit | `file_path, old_string, new_string` | 精确字符串替换（非行号） |
| | FileWrite | `file_path, content` | 创建/覆盖写入 |
| | Glob | `pattern, path?` | 文件名模式匹配 |
| | NotebookEdit | `notebook_path, edit` | Jupyter Notebook 编辑 |
| **搜索** | Grep | `pattern, path?, include?, head_limit?` | 基于内嵌 ripgrep |
| **系统命令** | Bash | `command, timeout?, run_in_background?` | 支持后台执行 + 大输出落盘 |
| | TaskOutput | `task_id` | 轮询后台任务输出 |
| | TaskStop | `task_id` | 终止后台任务 |
| **网络** | WebSearch | `query, allowed_domains?, blocked_domains?` | 域名白/黑名单管控 |
| | WebFetch | `url, prompt` | 抓取 + 用 prompt 处理 |
| **Agent 编排** | Agent | `prompt, mode, max_turns?` | 生成子 Agent |
| **MCP** | Mcp | `server, tool, input` | 调用外部 MCP 工具 |
| | ListMcpResources | `server` | 列出 MCP 资源 |
| | ReadMcpResource | `server, uri` | 读取 MCP 资源 |
| **交互** | AskUserQuestion | `questions` | 1-4 题，2-4 选项 |
| | TodoWrite | `todos, merge?` | 结构化任务清单 |
| | Config | `action, key?, value?` | 运行时配置读写 |
| **工作区** | EnterWorktree | `name?` | 进入 Git Worktree 隔离 |
| | ExitWorktree | `keep?, discard_changes?` | 退出时保留/丢弃 |
| **模式** | ExitPlanMode | `allowedPrompts` | 从计划模式转入执行 |

### 3.2 文件操作三件套的设计哲学

为什么是 FileRead / FileEdit / FileWrite 而不是一个统一的 `File` 工具？

**FileEdit 的精妙之处**：使用 `old_string → new_string` 而非行号替换，因为：
1. 行号在多步编辑中会漂移
2. 字符串匹配天然幂等——重复执行不会错
3. 人类审查时一眼就能看出改了什么

**FileRead 的分页设计**：`offset + limit` 支持按需读取，避免将整个大文件塞入上下文窗口。

### 3.3 Grep 与内嵌 ripgrep

> 与 `vendor/ripgrep` 呼应：Grep 工具直接使用内嵌的 rg 二进制，确保跨平台一致性和原生性能。

`head_limit` 和 `offset` 参数限制输出规模，这是"大输出管控"策略的一部分——避免搜索结果淹没上下文。

### 3.4 网络工具的管控设计

- `WebSearch`：域名 `allowed_domains` / `blocked_domains` 实现白/黑名单管控
- `WebFetch`：不是简单的 HTTP GET，而是"抓取 + 用 prompt 处理输出"——模型先看到网页内容，然后根据 prompt 提取所需信息

**设计意图**：将"检索/抓取"能力标准化为工具接口，避免模型直接自由上网。这是安全性与功能性的平衡。

### 3.5 会话交互工具

- `AskUserQuestion`：支持 1-4 个问题，每题 2-4 选项，支持多选和预览——非常适合高风险操作前的确认
- `TodoWrite`：结构化任务清单，支持增量合并（`merge: true`）
- `ExitPlanMode`：引入"**语义授权**"——`allowedPrompts` 以语义描述（而非具体命令文本）授予可执行动作类别

### 3.6 Git 工作树隔离

`EnterWorktree / ExitWorktree` 的设计展示了"降低破坏性"的工程思维：
- 在隔离的 worktree 中执行改动（特别适合大规模重构/实验）
- 退出时支持 `keep` / `remove`，并要求显式 `discard_changes` 避免误删
- 本质上是给 Agent 操作增加了"事务性"——可回滚

---

## 4. 权限与安全模型

从协议与行为可推断出**三层安全闸**：

### 第一层：Schema 约束（输入验证）

工具参数都有结构化 Schema：
- `File*` 工具要求绝对路径
- `Grep` 限制输出规模字段（`head_limit`）
- `WebSearch` 有域名 allow/block
- `Bash` 的 `dangerouslyDisableSandbox` 明确标注为危险开关

### 第二层：会话模式约束（权限控制）

`AgentInput.mode` 支持 5 种模式：

| 模式 | 安全级别 | 说明 |
|------|----------|------|
| `default` | 最高 | 每个操作需要确认 |
| `acceptEdits` | 中 | 自动接受文件编辑 |
| `dontAsk` | 中低 | 跳过确认对话 |
| `plan` | 只读 | 只能规划不能执行 |
| `bypassPermissions` | 最低 | 跳过所有权限检查 |

### 第三层：执行层沙箱

- Bash 工具默认在沙箱中执行
- `dangerouslyDisableSandbox` 是显式的安全开关
- Worktree 隔离提供额外的"可回滚"保障

---

## 5. 性能与可观测性设计

从 `sdk-tools.d.ts` 和 `cli.js` 抽样可见的工程化设计：

| 策略 | 实现 | 目的 |
|------|------|------|
| **大输出落盘** | `persistedOutputPath` / `persistedOutputSize` | 避免超大 stdout 塞入上下文 |
| **搜索限额** | Grep 的 `head_limit/offset`，Glob 默认截断 | 控制输出规模 |
| **流式消息** | SSE 事件流 | 降低首 token 延迟 |
| **Token 计数** | 运行时 token counting | 成本追踪和预算控制 |
| **结构化输出** | 结构化输出 parse | 工具调用结果的可靠提取 |

---

## 6. 可扩展点与二次开发路径

### 路径一：MCP 扩展（推荐）

将外部系统封装为 MCP Server，Claude Code 通过标准 MCP 协议接入：
- 适用于：知识库、Issue 系统、内部 API、资产库等
- 不需要修改 `cli.js`
- 通过 `mcp add` / `.mcp.json` 配置即可

### 路径二：SDK 集成

通过 `@anthropic-ai/claude-code` 的 SDK 接口进行编程集成：
- 适用于：IDE 插件、CI/CD 管线、自动化工作流
- 需要 Node.js 运行时

### 路径三：Source Map 还原（高级）

如果能访问 `cli.js.map`（约 57MB），可以将 bundle 还原到源文件路径级别的模块映射，实现更深层的定制。

---

## 7. 拆解结论

| 维度 | 结论 |
|------|------|
| **产物形态** | 发布包产物（非源码仓库），`cli.js` 单文件承载全部逻辑 |
| **架构核心** | CLI + Anthropic Messages API + 工具协议 + MCP |
| **工具系统** | 22 种工具，Union Type 统一协议，每种工具有严格的 Schema |
| **安全模型** | Schema 约束 → 会话模式 → 执行层沙箱，三层递进 |
| **工程亮点** | 严格 Schema、权限/计划模式、沙箱开关、Worktree 隔离、大输出落盘、内嵌 rg |
| **扩展路径** | MCP（推荐） > SDK 集成 > Source Map 还原 |

> **延伸阅读**：
> - [框架架构深度拆解](./architecture)（38KB）— 五层分层架构、Agentic Loop 核心循环详解
> - [编程思想篇](/think/think_index) — 从设计哲学角度解读相同架构
