
> 与 `vendor/ripgrep` 呼应：Grep 很可能直接使用内置 rg，确保跨平台一致。

### 4.2 系统命令执行（Bash）与任务控制

- `Bash`（`command, timeout, run_in_background, dangerouslyDisableSandbox`）
  - 输出支持：后台 taskId、persistedOutputPath/persistedOutputSize（大输出落盘）
- `TaskOutput`：轮询后台任务输出
- `TaskStop`：终止任务

### 4.3 网络与知识检索

- `WebSearch`（`query, allowed_domains?, blocked_domains?`）
- `WebFetch`（`url, prompt`）：“抓取网页 + 用 prompt 处理输出”

**设计意图**：把“检索/抓取”能力标准化为工具，避免模型直接自由上网；同时用域名白/黑名单做管控。

### 4.4 会话与交互（权限、澄清、计划）

- `AskUserQuestion`：1-4 个问题，每题 2-4 选项，支持多选与预览（非常适合高风险操作前确认）
- `TodoWrite`：结构化任务清单（可视化进度）
- `Config`：获取/设置配置（如默认权限模式、主题、模型偏好等）
- `ExitPlanMode`：计划模式收敛点（`allowedPrompts` 以语义描述授予可执行动作类别）

### 4.5 Git 工作树隔离（降低破坏性）

`EnterWorktree / ExitWorktree`：

- 在隔离 worktree 里执行改动（特别适合大改动/试验）
- Exit 时支持 keep/remove，并要求显式 `discard_changes` 来避免误删

### 4.6 MCP（扩展协议）

从协议角度看，当前包内暴露的 MCP 相关工具是：

- `ListMcpResourcesInput/Output`：列出 MCP 服务器的资源
- `ReadMcpResourceInput/Output`：读取资源（文本/二进制）
- `McpInput/McpOutput`：通用 MCP 执行结果（这里输出被类型定义为 `string`）

**拆解结论**：Claude Code 的扩展面主要来自 MCP 的“资源与工具”生态，而本地工具协议则提供“统一执行器”。

---

## 5. 权限与安全模型（为什么它敢让模型改代码/跑命令）

从协议与文档可推断出三层安全闸：

1) **输入层约束（Schema）**  
   - 工具参数都有结构化 schema；例如 File* 要求绝对路径，Grep 限制输出规模字段，WebSearch 有域名 allow/block。

2) **会话/模式约束（Permission modes + Plan）**  
   - AgentInput 的 `mode` 支持：`default / acceptEdits / dontAsk / bypassPermissions / plan`
   - ExitPlanMode 引入“语义授权”（允许的动作类别，而非具体命令文本）

3) **执行层沙箱（Bash）**  
   - `dangerouslyDisableSandbox` 明确标注为危险开关（默认应为沙箱执行）

此外，Worktree 隔离也是安全性/可回滚性的关键补丁。

---

## 6. 性能与可观测性（为什么需要这些字段）

从 `sdk-tools.d.ts` 可见多个典型的“工程化”设计点：

- **大输出落盘**：persistedOutputPath / persistedOutputSize（避免把超大 stdout 塞进上下文）
- **搜索限额**：Grep 的 head_limit/offset、Glob 默认截断
- **流式消息**：降低首 token 延迟 & 避免大对象一次性堆积

对 `cli.js` 的抽样也显示其使用流式事件模型，并包含 token counting、结构化输出 parse 等能力，说明它在“长会话成本/性能”方面做了大量工程投入。

---

## 7. 可扩展点与二次开发路径（在“包产物”视角下）

如果你要基于 Claude Code 做二次开发/集成，优先考虑两条路：

1) **MCP 扩展**（推荐）
   - 把外部系统（知识库、Issue 系统、内部 API、资产库等）封装为 MCP server
   - Claude Code 通过 List/Read/通用 MCP 调用接入，不需要改 `cli.js`

2) **新增/增强内置工具**
   - 需要改动 Tool Schema（生成 `sdk-tools.d.ts` 的 JSON Schema 源）+ CLI 运行时注册/执行逻辑
   - 但在当前“单文件 bundle”形态下，这条路不适合直接在此目录做；应回到源码仓库

---

## 8. 进一步“深挖到源码级”的建议（你可以怎么配合我）

如果你确实拥有源码仓库，请你确认目录中是否存在以下任一项（任意一项都能显著提升拆解深度）：

- `src/`、`packages/`、`tsconfig.json`、`bunfig.toml`、`pnpm-lock.yaml`、`yarn.lock`
- 构建脚本（如 `build.ts`、`esbuild`/`rollup` 配置、`scripts/`）
- 未压缩的 `.ts/.tsx` 文件

如果你只有当前产物目录，也可以提供：

- `cli.js.map` 的可访问方式（它很大；但如果我能读取/抽样，能把 bundle 还原到“源文件路径级”的模块映射）
- 或者你在本机运行：
  - `node --inspect-brk $(which claude)` / `claude --help` 输出（用于确认命令/子命令结构）
  - 将 help/usage 输出贴给我，我可以按“命令面 → 模块职责”继续拆

---

## 9. 结论（拆解摘要）

- **这是发布包产物，不是源码仓库**：`cli.js` 单文件承载绝大多数实现，搭配 `sdk-tools.d.ts` 描述工具协议。
- **架构核心**：CLI（会话/权限/工具执行） + Anthropic Messages API（流式/结构化输出） + 工具协议（本地执行能力） + MCP（外部扩展）。
- **工程化亮点**：严格 schema、权限/计划模式、沙箱开关、worktree 隔离、输出落盘、内置 rg。

