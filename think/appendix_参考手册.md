
> 本附录基于 `sdk-tools.d.ts` 自动生成文件，完整记录了 Claude Code v2.1.88 中所有 25 个内置工具的输入/输出类型定义。每个工具均包含字段说明、类型约束和使用要点。

## A.1 工具总览表

Claude Code 的工具系统采用严格的输入/输出类型定义，所有工具的 Schema 由 `json-schema-to-typescript` 自动生成。以下表格展示了全部工具的分类和功能定位：

| 分类 | 工具名 | 输入类型 | 输出类型 | 核心功能 |
|------|--------|----------|----------|----------|
| **Agent 编排** | Agent | `AgentInput` | `AgentOutput` | 生成子 Agent 执行任务 |
| **Shell 执行** | Bash | `BashInput` | `BashOutput` | 执行 Shell 命令 |
| | TaskOutput | `TaskOutputInput` | — | 获取后台任务输出 |
| | TaskStop | `TaskStopInput` | `TaskStopOutput` | 停止后台任务 |
| **文件操作** | FileRead | `FileReadInput` | `FileReadOutput` | 读取文件/图片/PDF/Notebook |
| | FileEdit | `FileEditInput` | `FileEditOutput` | 精确字符串替换编辑 |
| | FileWrite | `FileWriteInput` | `FileWriteOutput` | 创建/覆盖写入文件 |
| | Glob | `GlobInput` | `GlobOutput` | 文件名模式匹配搜索 |
| | NotebookEdit | `NotebookEditInput` | `NotebookEditOutput` | Jupyter Notebook 单元编辑 |
| **搜索** | Grep | `GrepInput` | `GrepOutput` | 正则表达式内容搜索（基于 ripgrep） |
| **MCP** | Mcp | `McpInput` | `McpOutput` | 调用 MCP Server 工具 |
| | ListMcpResources | `ListMcpResourcesInput` | `ListMcpResourcesOutput` | 列出 MCP 资源 |
| | ReadMcpResource | `ReadMcpResourceInput` | `ReadMcpResourceOutput` | 读取 MCP 资源内容 |
| **网络** | WebFetch | `WebFetchInput` | `WebFetchOutput` | 获取并处理网页内容 |
| | WebSearch | `WebSearchInput` | `WebSearchOutput` | 联网搜索 |
| **交互** | AskUserQuestion | `AskUserQuestionInput` | `AskUserQuestionOutput` | 向用户提问（2-4选项） |
| **配置** | Config | `ConfigInput` | `ConfigOutput` | 读写运行时配置 |
| **工作区** | EnterWorktree | `EnterWorktreeInput` | `EnterWorktreeOutput` | 进入 Git Worktree 隔离环境 |
| | ExitWorktree | `ExitWorktreeInput` | `ExitWorktreeOutput` | 退出 Git Worktree |
| **计划模式** | ExitPlanMode | `ExitPlanModeInput` | `ExitPlanModeOutput` | 退出计划模式并执行 |
| **状态管理** | TodoWrite | `TodoWriteInput` | `TodoWriteOutput` | 更新任务列表 |

---

## A.2 Agent 工具详解

### A.2.1 AgentInput — 子 Agent 生成

`AgentInput` 是 Claude Code 多 Agent 编排系统的核心接口。它允许主 Agent 派生子 Agent 执行独立任务，支持后台运行和团队协作。

```typescript
interface AgentInput {
  description: string;           // 任务简述（3-5词）
  prompt: string;                // 完整的任务指令
  subagent_type?: string;        // 专用 Agent 类型
  model?: "sonnet" | "opus" | "haiku";  // 模型覆盖
  run_in_background?: boolean;   // 后台运行
  name?: string;                 // Agent 名称（可寻址）
  team_name?: string;            // 团队名称
  mode?: "acceptEdits" | "bypassPermissions" | "default" | "dontAsk" | "plan";
  isolation?: "worktree";        // 隔离模式
}
```

**字段详解：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `description` | `string` | ✅ | 任务简短描述，3-5 个词。用于日志记录和 Agent 识别 |
| `prompt` | `string` | ✅ | 完整的任务指令文本，子 Agent 的全部上下文 |
| `subagent_type` | `string` | ❌ | 专用 Agent 类型标识。常见值：`code-explorer`、`write-code` |
| `model` | `"sonnet"\|"opus"\|"haiku"` | ❌ | 模型覆盖。优先级：此字段 > Agent 定义中的 model frontmatter > 父 Agent 的模型 |
| `run_in_background` | `boolean` | ❌ | 设为 `true` 后台运行，完成后通知主 Agent |
| `name` | `string` | ❌ | Agent 命名，使其可通过 `SendMessage({to: name})` 寻址 |
| `team_name` | `string` | ❌ | 团队上下文名称。省略时使用当前团队上下文 |
| `mode` | `string` | ❌ | 权限模式：`acceptEdits`（自动接受编辑）、`bypassPermissions`（跳过权限）、`default`（默认）、`dontAsk`（不询问）、`plan`（计划模式） |
| `isolation` | `"worktree"` | ❌ | 隔离模式。`worktree` 创建临时 git worktree，Agent 在隔离的仓库副本上工作 |

### A.2.2 AgentOutput — 子 Agent 结果

`AgentOutput` 是一个联合类型（Union Type），根据 Agent 的执行状态返回不同的数据结构：

**状态一：`completed`（同步完成）**

```typescript
{
  agentId: string;
  agentType?: string;
  content: { type: "text"; text: string }[];
  totalToolUseCount: number;
  totalDurationMs: number;
  totalTokens: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
    server_tool_use: { web_search_requests: number; web_fetch_requests: number } | null;
    service_tier: "standard" | "priority" | "batch" | null;
    cache_creation: {
      ephemeral_1h_input_tokens: number;
      ephemeral_5m_input_tokens: number;
    } | null;
  };
  status: "completed";
  prompt: string;
}
```

**状态二：`async_launched`（异步启动）**

```typescript
{
  status: "async_launched";
  agentId: string;           // 异步 Agent ID
  description: string;       // 任务描述
  prompt: string;            // 任务指令
  outputFile: string;        // 输出文件路径（检查进度）
  canReadOutputFile?: boolean;  // 调用者是否有能力读取输出
}
```

**状态对比：**

| 属性 | `completed` | `async_launched` |
|------|-------------|------------------|
| `agentId` | ✅ 完成 ID | ✅ 异步 ID |
| `content` | ✅ 文本结果数组 | ❌ |
| `usage` | ✅ 完整 Token 用量 | ❌ |
| `totalToolUseCount` | ✅ 工具调用次数 | ❌ |
| `totalDurationMs` | ✅ 执行耗时 | ❌ |
| `outputFile` | ❌ | ✅ 进度文件路径 |
| `canReadOutputFile` | ❌ | ✅ 是否可读取进度 |

---

## A.3 Bash 工具详解

### A.3.1 BashInput — 命令执行

```typescript
interface BashInput {
  command: string;                    // 要执行的命令
  timeout?: number;                   // 超时毫秒数（最大 600000）
  description?: string;               // 命令描述
  run_in_background?: boolean;        // 后台运行
  dangerouslyDisableSandbox?: boolean; // 危险：禁用沙箱
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `command` | `string` | ✅ | 要执行的 Shell 命令 |
| `timeout` | `number` | ❌ | 超时时间（毫秒），最大值 `600000`（10分钟）。超出将被强制终止 |
| `description` | `string` | ❌ | 命令描述。简单命令保持 5-10 词；复杂命令（管道、罕见 flag）需补充上下文 |
| `run_in_background` | `boolean` | ❌ | 后台运行，之后可用 `TaskOutput` 读取输出 |
| `dangerouslyDisableSandbox` | `boolean` | ❌ | ⚠️ 危险选项，禁用沙箱保护直接执行 |

**description 编写规范：**

```
简单命令（5-10词）：
  ls                          → "List files in current directory"
  git status                  → "Show working tree status"
  npm install                 → "Install package dependencies"

复杂命令（需更多上下文）：
  find . -name "*.tmp" -exec rm {} \;
    → "Find and delete all .tmp files recursively"
  git reset --hard origin/main
    → "Discard all local changes and match remote main"
  curl -s url | jq '.data[]'
    → "Fetch JSON from URL and extract data array elements"
```

### A.3.2 BashOutput — 命令结果

```typescript
interface BashOutput {
  stdout: string;                     // 标准输出
  stderr: string;                     // 标准错误
  rawOutputPath?: string;             // 大型 MCP 工具输出的原始文件路径
  interrupted: boolean;               // 是否被中断
  isImage?: boolean;                  // stdout 是否包含图片数据
  backgroundTaskId?: string;          // 后台任务 ID
  backgroundedByUser?: boolean;       // 用户手动后台化（Ctrl+B）
  assistantAutoBackgrounded?: boolean; // Agent 自动后台化
  dangerouslyDisableSandbox?: boolean; // 是否绕过了沙箱
  returnCodeInterpretation?: string;  // 返回码的语义解释
  noOutputExpected?: boolean;         // 成功时是否预期无输出
  structuredContent?: unknown[];      // 结构化内容块
  persistedOutputPath?: string;       // 持久化输出路径（输出过大时）
  persistedOutputSize?: number;       // 持久化输出大小
}
```

**关键输出字段速查：**

| 场景 | 关键字段 | 说明 |
|------|----------|------|
| 普通命令 | `stdout`, `stderr` | 标准输出和错误流 |
| 长运行命令 | `backgroundTaskId` | 用于后续 `TaskOutput` 查询 |
| 输出过大 | `persistedOutputPath` | 输出被持久化到文件而非内联 |
| 图片输出 | `isImage: true` | stdout 包含 base64 图片数据 |
| 被中断 | `interrupted: true` | 命令执行被用户或超时中断 |
| 沙箱绕过 | `dangerouslyDisableSandbox: true` | 命令在沙箱外执行 |

---

## A.4 文件操作工具详解

### A.4.1 FileRead — 文件读取

```typescript
interface FileReadInput {
  file_path: string;   // 绝对路径
  offset?: number;     // 起始行号
  limit?: number;      // 读取行数
  pages?: string;      // PDF 页码范围（如 "1-5", "3", "10-20"）
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_path` | `string` | ✅ | 文件绝对路径 |
| `offset` | `number` | ❌ | 起始行号（仅当文件过大时使用） |
| `limit` | `number` | ❌ | 读取行数（仅当文件过大时使用） |
| `pages` | `string` | ❌ | PDF 页码范围。格式：`"1-5"`、`"3"`、`"10-20"`。每次最多 20 页 |

**FileReadOutput 六种返回类型：**

| 类型 | 说明 | 关键字段 |
|------|------|----------|
| `text` | 文本文件 | `filePath`, `content`, `numLines`, `startLine`, `totalLines` |
| `image` | 图片文件 | `base64`, `type`(jpeg/png/gif/webp), `originalSize`, `dimensions` |
| `notebook` | Jupyter Notebook | `filePath`, `cells` |
| `pdf` | PDF 文件 | `filePath`, `base64`, `originalSize` |
| `parts` | PDF 分页提取 | `filePath`, `originalSize`, `count`, `outputDir` |
| `file_unchanged` | 文件无变化 | `filePath` |

**图片维度信息（dimensions）：**

| 字段 | 说明 |
|------|------|
| `originalWidth` / `originalHeight` | 原始图片像素尺寸 |
| `displayWidth` / `displayHeight` | 调整后显示尺寸 |

### A.4.2 FileEdit — 精确替换编辑

```typescript
interface FileEditInput {
  file_path: string;    // 绝对路径
  old_string: string;   // 被替换的文本
  new_string: string;   // 替换后的文本（必须与 old_string 不同）
  replace_all?: boolean; // 全部替换（默认 false）
}
```

**设计哲学：**

FileEdit 采用"精确字符串匹配"而非行号定位，这一设计选择蕴含着深层的工程考量：

1. **原子性保证**：`old_string` 必须在文件中唯一匹配，否则编辑失败。这防止了误改相似代码段
2. **与人类编辑对齐**：开发者编辑代码时也是"选中一段 → 替换"，而非"跳到第 N 行"
3. **抗漂移**：行号会因为上方编辑而偏移，但字符串内容是稳定的锚点

```typescript
interface FileEditOutput {
  filePath: string;                    // 编辑的文件路径
  oldString: string;                   // 被替换的原始文本
  newString: string;                   // 替换后的新文本
  originalFile: string;                // 编辑前的完整文件内容
  structuredPatch: {                   // Diff 补丁
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }[];
  userModified: boolean;               // 用户是否修改了提案
  replaceAll: boolean;                 // 是否全局替换
  gitDiff?: {                          // Git 差异信息
    filename: string;
    status: "modified" | "added";
    additions: number;
    deletions: number;
    changes: number;
    patch: string;
    repository?: string | null;
  };
}
```

### A.4.3 FileWrite — 文件写入

```typescript
interface FileWriteInput {
  file_path: string;   // 绝对路径（不允许相对路径）
  content: string;     // 要写入的内容
}
```

```typescript
interface FileWriteOutput {
  type: "create" | "update";          // 创建新文件 或 更新已有文件
  filePath: string;
  content: string;
  structuredPatch: { ... }[];          // Diff 补丁（更新时）
  originalFile: string | null;         // 原始内容（null 表示新建）
  gitDiff?: { ... };                   // Git 差异
}
```

### A.4.4 Glob — 文件名模式匹配

```typescript
interface GlobInput {
  pattern: string;   // Glob 模式
  path?: string;     // 搜索目录（省略则使用当前目录）
}
```

> ⚠️ `path` 字段如果不需要，应直接省略（不要传 `null` 或 `undefined`）。

```typescript
interface GlobOutput {
  durationMs: number;    // 搜索耗时（毫秒）
  numFiles: number;      // 匹配文件数
  filenames: string[];   // 匹配的文件路径数组
  truncated: boolean;    // 结果是否被截断（上限 100 文件）
}
```

### A.4.5 NotebookEdit — Jupyter Notebook 编辑

```typescript
interface NotebookEditInput {
  notebook_path: string;                        // 绝对路径
  cell_id?: string;                             // 单元格 ID（插入时为参照位置）
  new_source: string;                           // 新源码
  cell_type?: "code" | "markdown";              // 单元格类型
  edit_mode?: "replace" | "insert" | "delete";  // 编辑模式（默认 replace）
}
```

| 编辑模式 | `cell_id` | `cell_type` | 行为 |
|----------|-----------|-------------|------|
| `replace` | ✅ 需要 | 可选（默认保持） | 替换指定单元格内容 |
| `insert` | 可选（省略则插入到开头） | ✅ 需要 | 在指定单元格后插入新单元格 |
| `delete` | ✅ 需要 | ❌ 不需要 | 删除指定单元格 |

---

## A.5 搜索工具详解

### A.5.1 Grep — 正则表达式搜索

Grep 工具封装了 `ripgrep (rg)`，提供了丰富的搜索参数：

```typescript
interface GrepInput {
  pattern: string;              // 正则表达式
  path?: string;                // 搜索路径（默认 cwd）
  glob?: string;                // 文件过滤 Glob
  output_mode?: "content" | "files_with_matches" | "count";  // 输出模式
  "-B"?: number;                // 前置上下文行数
  "-A"?: number;                // 后置上下文行数
  "-C"?: number;                // 上下文行数（同时设置 -B 和 -A）
  context?: number;             // 同 -C
  "-n"?: boolean;               // 显示行号（默认 true）
  "-i"?: boolean;               // 忽略大小写
  type?: string;                // 文件类型（rg --type）
  head_limit?: number;          // 输出限制（默认 250）
  offset?: number;              // 跳过前 N 条
  multiline?: boolean;          // 多行模式（. 匹配换行符）
}
```

**参数速查表：**

| 参数 | rg 等效 | 说明 | 适用模式 |
|------|---------|------|----------|
| `pattern` | `PATTERN` | 正则表达式 | 全部 |
| `path` | `PATH` | 搜索路径 | 全部 |
| `glob` | `--glob` | 文件名过滤，如 `"*.js"`、`"*.{ts,tsx}"` | 全部 |
| `output_mode` | — | `content`：匹配行；`files_with_matches`：文件路径；`count`：匹配计数 | 全部 |
| `-B` | `-B` | 前置行数 | `content` |
| `-A` | `-A` | 后置行数 | `content` |
| `-C` / `context` | `-C` | 前后行数 | `content` |
| `-n` | `-n` | 显示行号（默认启用） | `content` |
| `-i` | `-i` | 忽略大小写 | 全部 |
| `type` | `--type` | 文件类型，如 `js`、`py`、`rust`、`go`、`java` | 全部 |
| `head_limit` | `| head -N` | 输出限制，默认 250，0 为无限制 | 全部 |
| `offset` | `| tail -n +N \| head -N` | 分页偏移 | 全部 |
| `multiline` | `-U --multiline-dotall` | 多行模式 | 全部 |

```typescript
interface GrepOutput {
  mode?: "content" | "files_with_matches" | "count";
  numFiles: number;          // 匹配的文件数
  filenames: string[];       // 文件路径列表
  content?: string;          // 匹配内容（content 模式）
  numLines?: number;         // 匹配行数
  numMatches?: number;       // 匹配次数
  appliedLimit?: number;     // 实际应用的限制
  appliedOffset?: number;    // 实际应用的偏移
}
```

---

## A.6 网络工具详解

### A.6.1 WebSearch — 联网搜索

```typescript
interface WebSearchInput {
  query: string;                  // 搜索查询
  allowed_domains?: string[];     // 白名单域名
  blocked_domains?: string[];     // 黑名单域名
}
```

| 字段 | 说明 | 示例 |
|------|------|------|
| `query` | 搜索关键词 | `"Claude Code 2.0 new features"` |
| `allowed_domains` | 仅包含指定域名的结果 | `["docs.anthropic.com", "github.com"]` |
| `blocked_domains` | 排除指定域名的结果 | `["ads.example.com"]` |

```typescript
interface WebSearchOutput {
  query: string;           // 执行的搜索查询
  results: (               // 搜索结果（联合类型）
    {
      tool_use_id: string;
      content: { title: string; url: string }[];
    }
    | string               // 或纯文本评论
  )[];
  durationSeconds: number; // 搜索耗时
}
```

### A.6.2 WebFetch — 网页获取

```typescript
interface WebFetchInput {
  url: string;      // 目标 URL
  prompt: string;   // 对获取内容的处理提示
}
```

> WebFetch 的独特之处在于：它不仅获取网页内容，还会用 LLM 根据 `prompt` 对内容进行智能处理和摘要。这意味着一次 WebFetch 调用 = HTTP GET + 内容提取 + LLM 处理，三步合一。

```typescript
interface WebFetchOutput {
  bytes: number;         // 内容大小（字节）
  code: number;          // HTTP 状态码
  codeText: string;      // HTTP 状态文本
  result: string;        // LLM 处理后的结果
  durationMs: number;    // 获取+处理耗时
  url: string;           // 实际获取的 URL（可能经过重定向）
}
```

---

## A.7 交互与配置工具详解

### A.7.1 AskUserQuestion — 用户提问

```typescript
interface AskUserQuestionInput {
  questions: [           // 1-4 个问题
    {
      question: string;  // 完整问题（以问号结尾）
      header: string;    // 简短标签（最多 12 字符）
      options: [         // 2-4 个选项
        {
          label: string;        // 选项文本（1-5 词）
          description: string;  // 选项说明
          preview?: string;     // 预览内容（代码片段、Mockup 等）
        }
        // ... 2-4 个选项
      ];
      multiSelect: boolean;  // 是否允许多选
    }
    // ... 1-4 个问题
  ];
  answers?: { [k: string]: string };   // 用户回答
  annotations?: { [k: string]: {        // 用户批注
    preview?: string;
    notes?: string;
  }};
  metadata?: { source?: string };        // 元数据（如 "remember"）
}
```

**约束规则总结：**

| 约束 | 值 | 说明 |
|------|-----|------|
| 最少问题数 | 1 | 至少一个问题 |
| 最多问题数 | 4 | 最多四个问题 |
| 最少选项数 | 2 | 每题至少 2 个选项 |
| 最多选项数 | 4 | 每题最多 4 个选项 |
| header 长度 | ≤12 字符 | 简短标签 |
| label 长度 | 1-5 词 | 选项文本 |
| "Other" 选项 | 自动提供 | 不需要手动添加 |

**预览功能（preview）**：每个选项可附带 `preview` 字段，支持代码片段、HTML Mockup 等内容。当用户聚焦到该选项时，预览内容会被渲染展示，帮助用户做决策。

### A.7.2 Config — 运行时配置

```typescript
interface ConfigInput {
  setting: string;                          // 配置键（如 "theme", "model"）
  value?: string | boolean | number;        // 新值（省略则读取当前值）
}

interface ConfigOutput {
  success: boolean;           // 是否成功
  operation?: "get" | "set";  // 操作类型
  setting?: string;           // 配置键
  value?: unknown;            // 当前值
  previousValue?: unknown;    // 旧值（set 操作）
  newValue?: unknown;         // 新值（set 操作）
  error?: string;             // 错误信息
}
```

---

## A.8 工作区与计划工具详解

### A.8.1 Worktree — Git 工作树隔离

```typescript
// EnterWorktreeInput
{
  name?: string;   // Worktree 名称（每段仅允许字母、数字、点、下划线、连字符；最长 64 字符）
}

// EnterWorktreeOutput
{
  worktreePath: string;        // Worktree 文件路径
  worktreeBranch?: string;     // Worktree 分支名
  message: string;             // 描述信息
}

// ExitWorktreeInput
{
  action: "keep" | "remove";   // "keep" 保留文件和分支；"remove" 删除
  discard_changes?: boolean;    // remove 时若有未提交文件，需显式设为 true
}

// ExitWorktreeOutput
{
  action: "keep" | "remove";
  originalCwd: string;          // 原始工作目录
  worktreePath: string;
  worktreeBranch?: string;
  tmuxSessionName?: string;     // 关联的 tmux 会话
  discardedFiles?: number;      // 丢弃的文件数
  discardedCommits?: number;    // 丢弃的提交数
  message: string;
}
```

### A.8.2 ExitPlanMode — 计划模式退出

```typescript
interface ExitPlanModeInput {
  allowedPrompts?: [
    {
      tool: "Bash";             // 目前仅支持 Bash 工具
      prompt: string;           // 语义描述，如 "run tests", "install dependencies"
    }
  ];
}

interface ExitPlanModeOutput {
  plan: string | null;                 // 计划内容
  isAgent: boolean;                    // 是否为 Agent 模式
  filePath?: string;                   // 计划保存的文件路径
  hasTaskTool?: boolean;               // 当前上下文是否可用 Agent 工具
  planWasEdited?: boolean;             // 用户是否编辑了计划
  awaitingLeaderApproval?: boolean;    // 是否等待团队领导审批
  requestId?: string;                  // 审批请求 ID
}
```

### A.8.3 TodoWrite — 任务列表管理

```typescript
interface TodoWriteInput {
  todos: [
    {
      content: string;        // 任务内容描述
      status: "pending" | "in_progress" | "completed";
      activeForm: string;     // 活跃形式描述
    }
  ];
}

interface TodoWriteOutput {
  oldTodos: { content: string; status: string; activeForm: string }[];
  newTodos: { content: string; status: string; activeForm: string }[];
  verificationNudgeNeeded?: boolean;   // 是否需要验证提醒
}
```

---

## A.9 MCP 工具详解

### A.9.1 Mcp — MCP Server 工具调用

```typescript
interface McpInput {
  [k: string]: unknown;    // 动态键值，取决于 MCP Server 定义
}
```

Mcp 工具的输入完全由 MCP Server 的 Tool 定义决定，Claude Code 本身不做额外约束。输出为纯字符串：

```typescript
type McpOutput = string;
```

### A.9.2 ListMcpResources — MCP 资源列表

```typescript
// Input
{ server?: string }   // 可选，按 Server 名过滤

// Output（数组）
[
  {
    uri: string;           // 资源 URI
    name: string;          // 资源名称
    mimeType?: string;     // MIME 类型
    description?: string;  // 资源描述
    server: string;        // 所属 Server
  }
]
```

### A.9.3 ReadMcpResource — 读取 MCP 资源

```typescript
// Input
{
  server: string;   // MCP Server 名称
  uri: string;      // 资源 URI
}

// Output
{
  contents: [
    {
      uri: string;              // 资源 URI
      mimeType?: string;        // MIME 类型
      text?: string;            // 文本内容
      blobSavedTo?: string;     // 二进制内容保存路径
    }
  ]
}
```

---

## A.10 辅助工具详解

### A.10.1 TaskOutput — 后台任务输出

```typescript
interface TaskOutputInput {
  task_id: string;    // 任务 ID
  block: boolean;     // 是否等待完成
  timeout: number;    // 最大等待时间（毫秒）
}
```

### A.10.2 TaskStop — 停止后台任务

```typescript
interface TaskStopInput {
  task_id?: string;     // 任务 ID（推荐）
  shell_id?: string;    // 已废弃，使用 task_id
}

interface TaskStopOutput {
  message: string;      // 状态消息
  task_id: string;      // 被停止的任务 ID
  task_type: string;    // 任务类型
  command?: string;     // 被停止的命令
}
```

---

# 附录B：CLI 命令完整参考

> 本附录基于 Claude Code v2.1.88 的 `cli.js` 源码逆向分析，完整记录了所有 CLI 命令、选项和子命令。Claude Code 使用 Commander.js 风格的命令行框架。

## B.1 命令体系总览

Claude Code 的 CLI 采用经典的 **主命令 + 子命令 + 全局选项** 三层结构：

```
claude [全局选项] [prompt]          ← 主入口（交互模式 / 单次执行）
  ├── claude mcp ...                ← MCP 服务器管理
  ├── claude auth ...               ← 认证管理
  ├── claude plugin(s) ...          ← 插件管理
  ├── claude agents ...             ← Agent 配置查看
  ├── claude auto-mode ...          ← 自动模式配置
  ├── claude setup-token            ← Token 安装
  ├── claude doctor                 ← 诊断检查
  ├── claude update / upgrade       ← 版本升级
  ├── claude install [target]       ← 安装
  └── claude remote-control / rc    ← 远程控制（隐藏）
```

---

## B.2 主命令：claude

### B.2.1 基本用法

```bash
claude [options] [prompt]
```

| 用法 | 说明 |
|------|------|
| `claude` | 进入交互模式（REPL） |
| `claude "帮我修复这个 bug"` | 单次执行模式 |
| `claude -p "ls"` | 非交互模式（print） |

### B.2.2 全局选项完整列表

**模型与 API：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--model` | | string | 指定模型（如 `claude-sonnet-4-20250514`） |
| `--fallback-model` | | string | 后备模型（主模型不可用时） |
| `--max-budget-usd` | | number | 单次会话最大预算（美元） |
| `--task-budget` | | string | 任务级预算控制 |

**输出控制：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--print` | `-p` | — | 非交互模式，输出后退出 |
| `--verbose` | | — | 详细输出 |
| `--debug` | | — | 调试模式 |
| `--output-format` | | string | 输出格式（`text` / `json` / `stream-json`） |
| `--input-format` | | string | 输入格式 |
| `--brief` | | — | 精简输出模式 |

**系统提示词：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--system-prompt` | | string | 完整替换系统提示词 |
| `--append-system-prompt` | | string | 追加系统提示词 |

**会话管理：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--continue` | | — | 继续上一次会话 |
| `--resume` | | string | 恢复指定会话 |
| `--session-id` | | string | 指定会话 ID |

**工作环境：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--worktree` | `-w` | — | 在 Git Worktree 中工作 |
| `--tmux` | | — | 在 tmux 会话中运行 |

**推理与能力：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--thinking` | | string | 推理模式（`enabled` / `adaptive` / `disabled`） |
| `--effort` | | string | 推理力度级别 |
| `--max-turns` | | number | 最大对话轮数 |
| `--json-schema` | | string | 强制 JSON Schema 输出 |

**Agent 与工具：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--agent` | | string | 指定 Agent 定义文件 |
| `--allowedTools` | | string[] | 允许的工具列表 |
| `--disallowedTools` | | string[] | 禁止的工具列表 |

**权限：**

| 选项 | 简写 | 类型 | 说明 |
|------|------|------|------|
| `--permission-mode` | | string | 权限模式（`default` / `plan` / `bypassPermissions` 等） |

---

## B.3 子命令详解

### B.3.1 claude mcp — MCP 服务器管理

MCP（Model Context Protocol）是 Claude Code 的核心扩展机制，允许接入外部工具服务器。

```bash
claude mcp <subcommand> [options]
```

**子命令完整列表：**

| 子命令 | 说明 | 关键选项 |
|--------|------|----------|
| `serve` | 启动 MCP Server | — |
| `add` | 添加 MCP Server | `<name> <commandOrUrl> [args...]` |
| `add-json` | 以 JSON 格式添加 | — |
| `add-from-claude-desktop` | 从 Claude Desktop 导入 | — |
| `remove` | 移除 MCP Server | — |
| `list` | 列出所有 MCP Server | — |
| `get` | 获取 MCP Server 详情 | — |
| `reset-project-choices` | 重置项目级 Server 选择 | — |
| `xaa` | XAA (SEP-990) IdP 管理 | 见下表 |

**`claude mcp add` 详解：**

```bash
claude mcp add <name> <commandOrUrl> [args...]
```

支持两种添加方式：
- **本地命令**：`claude mcp add my-server npx my-mcp-server`
- **远程 URL**：`claude mcp add remote-server https://example.com/mcp`

**`claude mcp xaa` 子命令：**

| 子命令 | 说明 | 关键选项 |
|--------|------|----------|
| `setup` | 配置 IdP 连接（一次性设置） | `--issuer <url>`, `--client-id <id>`, `--client-secret`, `--callback-port <port>` |
| `login` | IdP 登录认证 | — |
| `show` | 显示当前 IdP 配置 | — |

XAA 是 Claude Code 的企业级认证方案（SEP-990），通过 OIDC 协议与企业的 Identity Provider 集成，使 MCP Server 可以无感认证。

### B.3.2 claude auth — 认证管理

```bash
claude auth <subcommand>
```

| 子命令 | 说明 |
|--------|------|
| `login` | OAuth 登录（打开浏览器获取 Token） |
| `status` | 查看当前认证状态 |
| `logout` | 登出并清除 Token |

**认证 Token 来源优先级：**

```
环境变量 CLAUDE_CODE_OAUTH_TOKEN
  > 环境变量 CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR
    > OAuth 登录获取的 Token
      > claude setup-token 安装的 Token
```

**认证验证逻辑要点（来自源码）：**

- `claude setup-token` 安装的 Token 不包含 `claude-code-sandbox` scope
- 验证时会检查 Token 对应的 organization UUID
- 托管设置（managed settings）场景下，`CLAUDE_CODE_OAUTH_TOKEN` 必须匹配机器的 organization

### B.3.3 claude plugin / plugins — 插件管理

```bash
claude plugin <subcommand>     # 简写
claude plugins <subcommand>    # 完整
```

| 子命令 | 说明 |
|--------|------|
| `validate` | 验证插件合法性 |
| `list` | 列出已安装插件 |
| `install` | 安装插件 |
| `uninstall` | 卸载插件 |
| `enable` | 启用插件 |
| `disable` | 禁用插件 |
| `update` | 更新插件 |

**`marketplace` 子命令：**

```bash
claude plugins marketplace <subcommand>
```

| 子命令 | 说明 |
|--------|------|
| `add` | 添加市场源 |
| `list` | 列出可用市场 |
| `remove` | 移除市场源 |
| `update` | 更新市场索引 |

### B.3.4 claude agents — Agent 管理

```bash
claude agents [--setting-sources]
```

| 选项 | 说明 |
|------|------|
| `--setting-sources` | 显示 Agent 配置的来源（settings sources） |

此命令用于查看当前项目中可用的 Agent 定义及其配置来源。

### B.3.5 claude auto-mode — 自动模式

```bash
claude auto-mode <subcommand>
```

| 子命令 | 说明 |
|--------|------|
| `defaults` | 查看自动模式默认值 |
| `config` | 配置自动模式参数 |
| `critique` | 对自动模式的决策进行审查 |

### B.3.6 其他子命令

| 命令 | 说明 |
|------|------|
| `claude setup-token` | 安装 API Token（手动设置认证） |
| `claude doctor` | 运行诊断检查（环境、权限、网络等） |
| `claude update` | 更新到最新版本 |
| `claude upgrade` | 同 `update`，升级 Claude Code |
| `claude install [target]` | 安装指定目标组件 |

**隐藏命令：**

| 命令 | 说明 |
|------|------|
| `claude remote-control` / `claude rc` | 远程控制模式（不对外公开文档） |

---

## B.4 快捷键参考

### B.4.1 交互模式快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行（不发送） |
| `Ctrl + C` | 中断当前操作 |
| `Ctrl + B` | 将运行中的命令后台化 |
| `Ctrl + G` | 编辑计划（Plan 模式） |
| `Escape` | 取消当前输入 / 退出 |

### B.4.2 命令行快捷方式

```bash
# 管道输入
echo "fix the bug in this code" | claude -p
cat error.log | claude -p "analyze this error"

# 管道输出
claude -p "generate a function" > output.js

# 组合使用
claude -p "$(cat context.txt) -- analyze and refactor"
```

---

# 附录C：配置项速查

> 本附录收录了 Claude Code 的所有配置机制，包括 `settings.json` 配置文件、`.mcp.json` MCP 配置、环境变量、以及 `allowedSettingSources` 多源配置优先级系统。

## C.1 配置体系总览

Claude Code 采用**多层配置合并**策略，不同来源的配置具有不同优先级。理解这一体系是定制 Claude Code 行为的关键：

```
┌─────────────────────────────────────────────────┐
│                  配置优先级（低→高）                │
├─────────────────────────────────────────────────┤
│  1. flagSettings      — 功能标志默认值            │
│  2. userSettings      — 用户全局配置              │
│  3. projectSettings   — 项目级配置                │
│  4. localSettings     — 本地覆盖配置              │
│  5. policySettings    — 组织策略配置（最高优先）   │
└─────────────────────────────────────────────────┘
```

## C.2 settings.json 结构

### C.2.1 核心配置项

| 配置键 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `model` | `string` | 默认模型 | `"claude-sonnet-4-20250514"` |
| `defaultView` | `string` | 默认视图模式 | — |
| `autoUpdatesChannel` | `string` | 自动更新通道 | `"stable"` |
| `skipWebFetchPreflight` | `boolean` | 跳过 WebFetch 预检 | `false` |
| `autoMode` | `object` | 自动模式配置 | — |
| `permissions` | `object` | 权限配置 | — |
| `sandbox` | `object` | 沙箱配置 | — |
| `hooks` | `object` | 生命周期钩子 | — |

### C.2.2 permissions 配置

```json
{
  "permissions": {
    "allow": [],           // 允许的工具/操作列表
    "deny": [],            // 拒绝的工具/操作列表
    "ask": [],             // 需要确认的工具/操作列表
    "defaultMode": "",     // 默认权限模式
    "disableBypassPermissionsMode": false,  // 禁用绕过权限模式
    "disableAutoMode": false,              // 禁用自动模式
    "additionalDirectories": []             // 额外允许访问的目录
  }
}
```

**可用权限模式：**

| 模式 | 说明 |
|------|------|
| `default` | 默认模式，需要确认危险操作 |
| `acceptEdits` | 自动接受文件编辑 |
| `bypassPermissions` | 跳过所有权限检查 |
| `dontAsk` | 不询问，自动执行 |
| `plan` | 计划模式，先规划后执行 |

### C.2.3 sandbox 配置

```json
{
  "sandbox": {
    "enabled": true,                        // 是否启用沙箱
    "failIfUnavailable": false,             // 沙箱不可用时是否失败
    "allowUnsandboxedCommands": [],         // 允许在沙箱外执行的命令
    "network": "allow",                     // 网络策略：allow / deny / outbound-only
    "filesystem": "allow",                  // 文件系统策略
    "ignoreViolations": false,              // 是否忽略沙箱违规
    "excludedCommands": [],                 // 排除的命令
    "autoAllowBashIfSandboxed": true,       // 沙箱内自动允许 Bash
    "enableWeakerNestedSandbox": false,     // 启用弱化嵌套沙箱
    "enableWeakerNetworkIsolation": false,  // 启用弱化网络隔离
    "ripgrep": "allow"                      // ripgrep 策略
  }
}
```

### C.2.4 hooks 配置

Claude Code 支持在关键生命周期节点插入自定义钩子脚本：

```json
{
  "hooks": {
    "PreToolUse": [],         // 工具调用前
    "PostToolUse": [],        // 工具调用后
    "Notification": [],       // 通知事件
    "UserPromptSubmit": [],   // 用户提交 Prompt
    "SessionStart": [],       // 会话开始
    "SessionEnd": [],         // 会话结束
    "Stop": [],               // 停止事件
    "SubagentStop": [],       // 子 Agent 停止
    "PreCompact": [],         // 上下文压缩前
    "PostCompact": [],        // 上下文压缩后
    "TeammateIdle": [],       // 团队成员空闲
    "TaskCreated": [],        // 任务创建
    "TaskCompleted": []       // 任务完成
  }
}
```

| Hook | 触发时机 | 用途示例 |
|------|----------|----------|
| `PreToolUse` | 每次工具调用前 | 审计日志、权限二次检查 |
| `PostToolUse` | 每次工具调用后 | 结果过滤、副作用处理 |
| `Notification` | 通知事件 | 自定义通知路由 |
| `UserPromptSubmit` | 用户提交消息 | 内容过滤、Prompt 增强 |
| `SessionStart` | 会话启动 | 环境准备、上下文注入 |
| `SessionEnd` | 会话结束 | 清理、报告生成 |
| `Stop` | Agent 停止 | 资源释放 |
| `PreCompact` | 上下文压缩前 | 保存重要上下文 |
| `PostCompact` | 上下文压缩后 | 验证压缩质量 |

---

## C.3 .mcp.json 格式

`.mcp.json` 文件定义了 MCP Server 的连接配置，支持 stdio 和 SSE 两种传输方式。

### C.3.1 基本格式

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-name"],
      "env": {
        "API_KEY": "your-api-key"
      }
    },
    "remote-server": {
      "url": "https://example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

### C.3.2 stdio 类型配置

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem", "/path/to/dir"],
      "env": {}
    },
    "python-server": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "PYTHONPATH": "/path/to/modules"
      }
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | `string` | 启动命令 |
| `args` | `string[]` | 命令参数 |
| `env` | `object` | 环境变量 |

### C.3.3 SSE/HTTP 类型配置

```json
{
  "mcpServers": {
    "remote": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer token",
        "X-Custom-Header": "value"
      }
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | MCP Server 的 SSE 端点 URL |
| `headers` | `object` | HTTP 请求头（如认证信息） |

### C.3.4 XAA 认证配置

```json
{
  "mcpServers": {
    "enterprise-server": {
      "command": "npx",
      "args": ["-y", "@company/mcp-server"],
      "xaa": true
    }
  }
}
```

当 `xaa: true` 时，Claude Code 会通过 OIDC IdP 自动完成认证，无需手动配置 Token。

---

## C.4 环境变量完整列表

### C.4.1 认证相关

| 环境变量 | 说明 |
|----------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥（最常用的认证方式） |
| `ANTHROPIC_BASE_URL` | API 基础 URL（用于代理或自托管） |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth Token（直接注入） |
| `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` | 从文件描述符读取 OAuth Token |
| `MCP_XAA_IDP_CLIENT_SECRET` | XAA IdP 客户端密钥 |

### C.4.2 运行时配置

| 环境变量 | 说明 |
|----------|------|
| `CLAUDE_CODE_USE_BEDROCK` | 使用 AWS Bedrock 作为后端 |
| `CLAUDE_CODE_USE_VERTEX` | 使用 Google Vertex AI 作为后端 |
| `NODE_OPTIONS` | Node.js 运行选项 |
| `CLAUDE_CONFIG` | 自定义配置目录路径 |
| `CLAUDE_CODE_DIAGNOSTICS_FILE` | 诊断日志文件路径 |

### C.4.3 权限与安全

| 环境变量 | 说明 |
|----------|------|
| `DISABLE_AUTOUPDATER` | 禁用自动更新 |

---

## C.5 allowedSettingSources — 多源配置优先级

Claude Code v2.1.88 引入了精细的配置来源管理系统，每个配置项可以控制哪些来源允许修改它：

```json
{
  "allowedSettingSources": {
    "userSettings": true,      // 允许用户全局配置修改
    "projectSettings": true,   // 允许项目配置修改
    "localSettings": true,     // 允许本地配置修改
    "flagSettings": true,      // 允许功能标志默认值
    "policySettings": true     // 允许组织策略配置修改
  }
}
```

**配置来源详解：**

| 来源 | 路径 | 说明 | 典型场景 |
|------|------|------|----------|
| `flagSettings` | 内置 | 功能标志的默认值 | 新功能的灰度发布 |
| `userSettings` | `~/.claude/settings.json` | 用户全局配置 | 个人偏好（模型、主题） |
| `projectSettings` | `.claude/settings.json` | 项目级配置 | 团队共享的项目规范 |
| `localSettings` | `.claude/settings.local.json` | 本地覆盖（不提交 Git） | 个人开发环境差异 |
| `policySettings` | 组织管理平台 | 企业策略强制执行 | 合规要求、安全限制 |

**合并策略（来自源码分析）：**

1. **数值类型**：数组类型执行**并集合并**（`union`），保留所有来源的配置
2. **对象类型**：按优先级**深度合并**，高优先级覆盖低优先级
3. **布尔类型**：高优先级**直接覆盖**

**Settings 路径约定（来自源码常量）：**

```
用户配置：  ~/.claude/settings.json
项目配置：  <project>/.claude/settings.json
本地配置：  <project>/.claude/settings.local.json
远程配置：  remote-settings.json（企业托管场景）
```

**配置热加载**：当检测到配置文件变更时，Claude Code 会自动重新加载。`DW()` 函数在源码中负责触发配置刷新。

---

# 附录D：逆向分析方法论

> 本附录总结了分析 Claude Code v2.1.88 单文件 Bundle（`cli.js`，约 16,668 行，1.3MB）的完整方法论。这些技术不仅适用于 Claude Code，也适用于任何 Node.js/JavaScript 单文件打包产物的逆向分析。

## D.1 分析对象概述

### D.1.1 文件特征

| 属性 | 值 |
|------|-----|
| 文件名 | `cli.js` |
| 文件大小 | 约 1.3MB |
| 总行数 | 16,668 行 |
| 打包工具 | 自定义打包器（类 esbuild 风格） |
| 输出格式 | 单文件 Bundle（包含 `.node` 原生模块引用） |
| 混淆程度 | 变量名短化，结构保留 |
| Source Map | 有（`cli.js.map`） |

### D.1.2 文件组成

```
claude-code-2.1.88/
├── cli.js          ← 主程序 Bundle（JS + 内联资源）
├── cli.js.map      ← Source Map（映射到原始源码）
├── package.json    ← 包元数据
├── sdk-tools.d.ts  ← 工具 Schema 类型定义（自动生成）
├── bun.lock        ← 依赖锁定文件
├── LICENSE.md      ← 许可证
├── README.md       ← 文档
└── vendor/         ← 原生模块（.node 文件和 .exe）
    ├── *.node      ← Node.js 原生插件（6个）
    └── *.exe       ← Windows 可执行文件（2个）
```

**关键洞察**：`sdk-tools.d.ts` 是由 `json-schema-to-typescript` 从 JSON Schema 自动生成的，文件头部明确标注：

```typescript
// This file was automatically generated by json-schema-to-typescript.
// DO NOT MODIFY IT BY HAND.
```

这意味着：**工具协议的定义存在于一个 JSON Schema 源文件中**，而非直接写在 TypeScript 代码里。这是一个重要的架构决策——Schema-first 设计。

---

## D.2 Bundle 结构分析策略

### D.2.1 单文件 Bundle 的典型特征

Claude Code 的 `cli.js` 具有以下单文件 Bundle 的典型特征：

**1. 模块注册表模式（Module Registry）**

```javascript
var XXXX = y(() => {
  // 模块代码
});
```

这是最核心的结构模式。`y()` 是模块注册函数，`XXXX` 是模块 ID。每个模块通过这个模式注册到全局模块表中。

**模式识别要点：**

```
var <moduleId> = y(() => {
  // import 语句被转为函数调用
  a_7();  // 导入模块 a_7
  k8();   // 导入模块 k8
  
  // 模块主体代码
  function someFunction() { ... }
  
  // 导出
  var R15 = y(() => { ... });  // 嵌套模块注册
});
```

**2. 动态导入识别（Dynamic Imports）**

```javascript
Promise.resolve().then(() => __toESM(require_module()));
```

动态 `import()` 被编译为 `Promise.resolve().then()` 链，这是一种懒加载模式。在 Claude Code 中，大量模块采用这种方式按需加载。

**3. 内联第三方库识别**

Bundle 中内联了多个第三方库，可通过以下特征识别：

| 特征 | 示例库 | 识别方法 |
|------|--------|----------|
| `async_hooks` | Node.js 内置 | `import { AsyncLocalStorage } from "async_hooks"` |
| `path` | Node.js 内置 | `join`, `dirname`, `basename` 调用 |
| `fs` | Node.js 内置 | `readFileSync`, `writeFileSync`, `statSync` |
| `crypto` | Node.js 内置 | `randomUUID`, `createHash` |
| `child_process` | Node.js 内置 | `spawn`, `execSync` |
| Commander 风格 | CLI 框架 | `.command()`, `.option()`, `.action()` |

**4. 第三方库内联模式**

第三方库通常以以下模式出现在 Bundle 中：

```javascript
// 库的入口模块
var libModule = y(() => {
  // 库的完整代码，变量名被短化
  function originalApiName() { ... }
  // 但字符串常量通常保留
  "some-library-version-string";
});
```

### D.2.2 模块依赖图还原

通过追踪模块间的引用关系，可以还原出大致的模块依赖图：

```javascript
// 模块 A 引用模块 B
var moduleA = y(() => {
  k8();   // 引用模块 B（k8 是模块 B 的 ID）
  // ...
});

// 模块 B
var moduleB = y(() => {
  a_7();  // 引用模块 C
  // ...
});
```

**还原步骤：**

1. 收集所有 `var XXXX = y(() => { ... })` 模式
2. 提取每个模块内部调用的其他模块 ID
3. 构建有向图：`模块 → 依赖的模块列表`
4. 从入口模块（通常是最后一个注册的模块）开始，执行拓扑排序
5. 通过模块 ID 的命名规则（如 `h$8`、`R15`、`a_7`）推断模块的注册顺序

---

## D.3 从混淆变量名推断功能

### D.3.1 变量名模式分析

Claude Code 的变量名短化遵循一定的规律，理解这些规律有助于快速定位功能模块：

| 命名模式 | 含义推断 | 示例 |
|----------|----------|------|
| `$` + 数字 | 临时变量/参数 | `$0`, `$1` |
| 小写字母 + `$` + 数字 | 函数参数 | `q`, `K`, `_`, `z`, `Y`, `$`, `A` |
| 大写字母开头的驼峰 | 类/构造函数 | `AsyncLocalStorage`（保留） |
| 全大写 | 常量 | `EW()`, `BS7()` |
| `h$` + 数字 | 可能是模块 ID | `h$8`, `h15` |
| `R` + 数字 | 嵌套模块 | `R15` |
| `a_` + 数字 | 工具函数 | `a_7` |
| `k` + 数字 | 配置相关 | `k8` |

### D.3.2 从字符串常量推断功能

字符串常量在混淆后通常**完整保留**，这是逆向分析最重要的突破口：

```javascript
// 认证模块 — 通过字符串常量识别
"claude setup-token"
"claude auth login"
"CLAUDE_CODE_OAUTH_TOKEN"
"organization.uuid"

// MCP 模块
"mcpServers"
".mcp.json"
"claude mcp add"
"claude mcp serve"
"Add an MCP server to Claude Code"

// 配置模块
"settings.json"
"allowedSettingSources"
"userSettings"
"projectSettings"

// 沙箱模块
"sandbox"
"dangerouslyDisableSandbox"
"failIfUnavailable"

// Hook 模块
"PreToolUse"
"PostToolUse"
"Notification"
"UserPromptSubmit"
```

### D.3.3 从函数签名推断功能

```javascript
// 文件系统操作 — 特征：path + encoding 参数
function readFile(filePath, options) { ... }
function writeFile(filePath, content, options) { ... }

// HTTP 请求 — 特征：url + method + headers
function post(path, { body, timeout, headers, stream }) { ... }

// CLI 命令定义 — 特征：链式 .command().option().action()
q.command("add <name> <commandOrUrl> [args...]")
  .description("Add an MCP server")
  .option("--env <env>")
  .action((args) => { ... });

// 事件系统 — 特征：event + callback
function on(event, callback) { ... }
function emit(event, data) { ... }
```

---

## D.4 全局状态对象识别

### D.4.1 AsyncLocalStorage 模式

Claude Code 使用 Node.js 的 `AsyncLocalStorage` 实现请求级别的上下文传递：

```javascript
import { AsyncLocalStorage } from "async_hooks";

var oL7;  // AsyncLocalStorage 实例

function S$8(q, K) { return oL7.run(q, K); }  // 在上下文中运行
function C$8() { return oL7.getStore() ?? Vx(); }  // 获取当前上下文
function Z8() { try { return C$8(); } catch { return r1(); } }  // 安全获取
```

**逆向要点：**
- `AsyncLocalStorage` 的 `run` 方法接收一个初始值和一个回调
- `getStore()` 返回当前异步上下文中的存储值
- 这是一种**无侵入式**的上下文传递机制，调用链中的任何函数都可以访问上下文

### D.4.2 缓存系统

源码中可以发现一个带 LRU 淘汰的文件缓存系统：

```javascript
class aL7 {
  cache = new Map;
  maxCacheSize = 1000;
  readFile(filePath) {
    let stats = fs.statSync(filePath);
    let cached = this.cache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) {
      return { content: cached.content, encoding: cached.encoding };
    }
    // ... 读取文件并缓存
  }
}
```

**特征识别：**
- `new Map` + `maxCacheSize` = LRU 缓存
- `mtimeMs` 检查 = 文件变更检测（inode-based cache invalidation）
- `statSync` = 同步文件状态查询

### D.4.3 诊断日志系统

```javascript
function c8(level, event, data) {
  let entry = {
    timestamp: new Date().toISOString(),
    level: level,
    event: event,
    data: data ?? {}
  };
  let logPath = process.env.CLAUDE_CODE_DIAGNOSTICS_FILE;
  if (!logPath) return;
  // 追加写入日志文件
}
```

**特征识别：**
- `timestamp` + `level` + `event` + `data` = 结构化日志格式
- `CLAUDE_CODE_DIAGNOSTICS_FILE` = 日志输出路径由环境变量控制
- `appendFileSync` = 同步追加写入（保证日志不丢失）

---

## D.5 CLI 命令树还原

### D.5.1 Commander.js 模式识别

Claude Code 使用类似 Commander.js 的 CLI 框架，其注册模式非常规律：

```javascript
// 一级子命令注册
q.command("mcp").description("Manage MCP servers");
q.command("auth").description("Manage authentication");
q.command("plugin").description("Manage plugins");

// 二级子命令注册
function L15(q) {
  q.command("add <name> <commandOrUrl> [args...]")
    .description("Add an MCP server to Claude Code")
    .option("--env <env>", "Environment variables")
    .action((args) => { ... });
}

// 三级子命令
function h15(q) {
  let K = q.command("xaa")
    .description("Manage the XAA IdP connection");
  K.command("setup").description("Configure IdP connection")
    .requiredOption("--issuer <url>", "IdP issuer URL")
    .requiredOption("--client-id <id>", "Client ID")
    .action((opts) => { ... });
}
```

### D.5.2 命令树还原步骤

1. **搜索 `.command(` 模式**：收集所有命令注册点
2. **提取 `description` 字符串**：获取命令的人类可读描述
3. **分析 `.option(` 调用**：还原命令的选项列表
4. **追踪 `.action(` 回调**：理解命令的实际行为
5. **按嵌套关系构建树**：还原完整的命令层级结构

### D.5.3 选项解析模式

```javascript
// 必需选项
.requiredOption("--issuer <url>", "IdP issuer URL (OIDC discovery)")

// 可选选项
.option("--client-secret", "Read client secret from env var")
.option("--callback-port <port>", "Fixed loopback callback port")

// 布尔标志
.option("--verbose", "Verbose output")
.option("--debug", "Debug mode")
```

---

## D.6 事件日志模式分析

### D.6.1 生命周期事件追踪

通过分析 `c8()` 函数（诊断日志）的调用点，可以还原出 Claude Code 的完整生命周期：

```javascript
// 事件命名模式
c8("info", `${operation}_started`);
c8("info", `${operation}_completed`, { duration_ms: ... });
c8("error", `${operation}_failed`, { duration_ms: ... });
```

**已识别的生命周期事件：**

| 阶段 | 事件模式 | 说明 |
|------|----------|------|
| 启动 | `*_started` | 操作开始时记录 |
| 完成 | `*_completed` | 操作成功时记录（含耗时） |
| 失败 | `*_failed` | 操作失败时记录（含耗时） |
| 错误 | `level: "error"` | 错误级别日志 |

### D.6.2 mW6 异步计时包装器

```javascript
async function mW6(operationName, asyncFn, extractData) {
  let startTime = Date.now();
  c8("info", `${operationName}_started`);
  try {
    let result = await asyncFn();
    let data = extractData ? extractData(result) : {};
    c8("info", `${operationName}_completed`, {
      duration_ms: Date.now() - startTime,
      ...data
    });
    return result;
  } catch (error) {
    c8("error", `${operationName}_failed`, {
      duration_ms: Date.now() - startTime
    });
    throw error;
  }
}
```

这是一个通用的异步操作计时器，用于追踪所有耗时操作的执行情况。模式：**开始 → 执行 → 成功/失败 → 记录耗时**。

---

## D.7 高级分析技巧

### D.7.1 Source Map 利用

如果 `.js.map` 文件可用，可以大幅降低逆向难度：

```bash
# 使用 source-map CLI 工具还原
npx source-map-cli resolve cli.js.map <line> <column>

# 或使用 Mozilla 的 source-map 库
node -e "
  const { SourceMapConsumer } = require('source-map');
  const fs = require('fs');
  const rawSourceMap = JSON.parse(fs.readFileSync('cli.js.map', 'utf8'));
  SourceMapConsumer.with(rawSourceMap, null, consumer => {
    const pos = consumer.originalPositionFor({
      line: 100, column: 0
    });
    console.log(pos);
  });
"
```

### D.7.2 动态分析 — 运行时拦截

```javascript
// 在 Node.js 启动时注入调试代码
NODE_OPTIONS="--require ./debug-hook.js" claude

// debug-hook.js
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  console.log(`[REQUIRE] ${id}`);
  return originalRequire.apply(this, arguments);
};
```

### D.7.3 字符串引用追踪

针对关键功能词进行全文搜索，是最高效的分析方法：

```bash
# 搜索特定功能关键词
rg "settings\.json" cli.js
rg "ANTHROPIC_API_KEY" cli.js
rg "\.command\(" cli.js
rg "allowedSettingSources" cli.js
```

### D.7.4 函数调用图构建

通过追踪函数调用链，可以理解代码的执行流程：

```javascript
// 入口函数识别
function main() {
  // 通常在文件末尾
  setupConfig();
  registerCommands();
  startREPL();
}

// 追踪调用链
main → registerCommands → addMcpCommand → L15
                                     → h15 (xaa)
```

---

## D.8 分析成果检验

### D.8.1 交叉验证策略

| 验证方法 | 说明 |
|----------|------|
| **类型定义对照** | 将逆向结果与 `sdk-tools.d.ts` 交叉验证 |
| **CLI 行为测试** | 实际运行命令，对比预期与实际行为 |
| **字符串完整性** | 验证提取的字符串常量是否完整 |
| **逻辑一致性** | 检查逆向得到的逻辑是否有矛盾 |

### D.8.2 可信度评级

| 信息来源 | 可信度 | 说明 |
|----------|--------|------|
| `sdk-tools.d.ts` 类型定义 | ⭐⭐⭐⭐⭐ | 自动生成，与实际代码高度一致 |
| CLI 字符串常量 | ⭐⭐⭐⭐⭐ | 直接从 Bundle 中提取，100% 准确 |
| 源码结构模式 | ⭐⭐⭐⭐ | 基于模式识别的推断，需验证 |
| 变量名语义推断 | ⭐⭐⭐ | 基于命名规则的猜测，可能有偏差 |
| 逻辑流程还原 | ⭐⭐⭐ | 需要实际运行验证 |

---

## D.9 工具链推荐

| 工具 | 用途 | 适用场景 |
|------|------|----------|
| `ripgrep (rg)` | 正则搜索 | 全文关键词搜索 |
| `jq` | JSON 处理 | 分析 Source Map、配置文件 |
| `source-map-cli` | Source Map 查询 | 定位原始源码位置 |
| Node.js `--inspect` | 调试 | 运行时断点调试 |
| Chrome DevTools | 调试 | Node.js 调试协议客户端 |
| `esprima` / `acorn` | AST 解析 | 结构化代码分析 |
| `prettier` | 代码格式化 | 提高混淆代码可读性 |

---

# 附录索引

| 附录 | 标题 | 主要内容 |
|------|------|----------|
| A | 工具协议完整参考 | 25 个工具的完整 TypeScript 类型定义与使用说明 |
| B | CLI 命令完整参考 | 所有命令、选项、子命令的完整速查 |
| C | 配置项速查 | settings.json、.mcp.json、环境变量、多源配置 |
| D | 逆向分析方法论 | 单文件 Bundle 分析的完整方法论 |

---

> **本卷完**
>
> 本卷作为全书的工具箱和参考手册，旨在为读者提供一份完整、准确、便于查阅的技术参考。所有内容均基于 Claude Code v2.1.88 源码实际分析得出，而非文档抄录。建议读者将本卷作为案头手册，在实际开发和逆向分析中随时翻阅。