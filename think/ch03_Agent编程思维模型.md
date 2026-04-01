
> **编程思想要点**：Agent 编程不是"用 AI 写代码"，而是一种全新的编程范式——你不再编写执行步骤，而是定义能力边界和意图空间。

## 3.1 工具即接口：传统 API vs Agent 工具

在传统编程中，接口（Interface）是程序员之间的契约。在 Agent 编程中，工具（Tool）是人与 AI 之间的契约。这个看似微小的转变，实际上是一场认知革命。

### 3.1.1 传统 API 的设计哲学

传统 API 设计遵循几个核心原则：

```typescript
// 传统 API 设计
interface FileService {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  edit(path: string, oldText: string, newText: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string, pattern?: string): Promise<string[]>;
}
```

**核心假设**：
- **调用者知道要做什么**：程序员预先决定调用哪个方法、传什么参数
- **接口是稳定的**：方法签名不应该频繁变化
- **错误是异常的**：预期路径上不应该出错
- **粒度是固定的**：每个方法做一件事

这是一种**命令式接口**——你告诉系统确切地做什么。

### 3.1.2 Agent 工具的设计哲学

现在看看 Claude Code 如何定义同样的文件操作工具：

```typescript
// Claude Code 的 Agent 工具定义
interface FileEditInput {
  /** The absolute path to the file to modify */
  file_path: string;
  
  /** The text to replace */
  old_string: string;
  
  /** The text to replace it with (must be different from old_string) */
  new_string: string;
  
  /** Replace all occurrences of old_string (default false) */
  replace_all?: boolean;
}
```

```typescript
interface FileReadInput {
  /** The absolute path to the file to read */
  file_path: string;
  
  /** The line number to start reading from */
  offset?: number;
  
  /** The number of lines to read */
  limit?: number;
  
  /** Page range for PDF files (e.g., "1-5", "3", "10-20") */
  pages?: string;
}
```

表面上看，这与传统 API 没有太大区别。但关键的差异在于**谁决定使用这些工具**：

- **传统 API**：程序员在代码中调用 `fileService.edit(path, old, new)`
- **Agent 工具**：AI 根据用户意图自主决定调用 `FileEdit`，并自己构造参数

### 源码透视：工具描述的重要性

在 Agent 编程中，工具的文档描述比类型签名更重要。因为 AI（而不是程序员）是工具的使用者，它通过**阅读描述**来理解何时、如何使用工具。

从 `sdk-tools.d.ts` 中可以看到，每个字段都有详细的 JSDoc 注释：

```typescript
interface BashInput {
  /** The command to execute */
  command: string;
  
  /**
   * Clear, concise description of what this command does in active voice.
   * 
   * For simple commands (git, npm, standard CLI tools), keep it brief:
   * - ls → "List files in current directory"
   * - git status → "Show working tree status"
   * 
   * For commands that are harder to parse at a glance:
   * - find . -name "*.tmp" -exec rm {} \; → "Find and delete all .tmp files"
   */
  description?: string;
  
  /** Set to true to run this command in the background */
  run_in_background?: boolean;
  
  /**
   * Set this to true to dangerously override sandbox mode 
   * and run commands without sandboxing.
   */
  dangerouslyDisableSandbox?: boolean;
}
```

注意 `description` 字段的注释——它不仅说明了字段的作用，还给出了**使用示例**和**最佳实践**。这是因为 AI 需要足够的上下文来正确使用这个工具。

再注意 `dangerouslyDisableSandbox` 字段的命名——使用了 "dangerously" 前缀。这不是随意的命名，而是对 AI 的一种**软约束**。当 AI 看到这个名字时，它会倾向于不使用这个选项，除非用户明确要求。

### 3.1.3 FileEdit 的设计哲学

`FileEdit` 工具是最能体现 Agent 编程思维的例子。它不是传统的 `file.write(path, content)`——完全覆盖文件。它是一个**差异编辑器**：

```typescript
interface FileEditInput {
  file_path: string;    // 绝对路径
  old_string: string;   // 要替换的原始文本
  new_string: string;   // 替换后的新文本
  replace_all?: boolean; // 是否替换所有匹配
}
```

为什么是差异编辑而不是全文件覆盖？三个原因：

1. **精确性**：AI 只修改它确定需要修改的部分，而不是重写整个文件
2. **安全性**：如果 `old_string` 不匹配，操作会失败，防止意外覆盖
3. **可审计性**：每次修改都有明确的 before/after，便于审查

这是一种**微创手术式**的设计哲学——最小化每次变更的影响范围。对于 AI Agent 来说，这尤为重要，因为它的操作需要人类的信任。

### 源码透视：子 Agent (AgentInput) 的设计

最令人惊叹的工具设计是 `AgentInput`：

```typescript
interface AgentInput {
  /** A short (3-5 word) description of the task */
  description: string;
  
  /** The task for the agent to perform */
  prompt: string;
  
  /** The type of specialized agent to use */
  subagent_type?: string;
  
  /** Model override: "sonnet" | "opus" | "haiku" */
  model?: string;
  
  /** Run in background */
  run_in_background?: boolean;
  
  /** Name for the spawned agent */
  name?: string;
  
  /** Team name */
  team_name?: string;
  
  /** Permission mode */
  mode?: "acceptEdits" | "bypassPermissions" | "default" | "dontAsk" | "plan";
  
  /** Isolation mode */
  isolation?: "worktree";
}
```

这是一个**嵌套 Agent** 的接口——Agent 可以创建子 Agent 来执行子任务。这种递归的设计体现了 Agent 编程的核心思想：**分解与委托**。

特别注意几个设计亮点：

- **`isolation?: "worktree"`**：子 Agent 在独立的 Git worktree 中工作。这意味着它可以自由修改文件，而不会影响主分支。这是一种**沙盒隔离**——AI 版本的"影子构建"。

- **`mode` 参数的五种权限级别**：
  - `"acceptEdits"`：自动接受文件编辑
  - `"bypassPermissions"`：绕过所有权限检查
  - `"default"`：默认权限模式
  - `"dontAsk"`：不询问用户
  - `"plan"`：只生成计划，不执行

- **`model` 参数**：允许为不同任务选择不同能力的模型。简单任务用 haiku（快且便宜），复杂任务用 opus（慢但能力强）。

## 3.2 推理即执行：Extended Thinking 与自适应计算

传统程序的计算量是**可预测的**——排序 O(n log n)，搜索 O(n)，矩阵乘法 O(n³)。Agent 编程的计算量是**自适应的**——简单问题快速回答，复杂问题深度思考。

### 3.2.1 Extended Thinking：让 AI "想一想"

Anthropic 的 Extended Thinking（扩展思考）功能是 Claude Code 的重要基础。它允许模型在生成最终答案之前进行内部推理。

从 Claude Code 的源码中可以看到与 thinking 相关的多个字段：

```javascript
// Vj7() 状态中的 thinking 相关字段
{
  thinkingClearLatched: null,      // Thinking 清除状态
  systemPromptSectionCache: new Map() // 缓存 thinking 结果
}
```

以及 MessageStream 中对 thinking 事件的处理：

```javascript
// MessageStream 事件类型
case "thinking_delta":
  // 接收增量思考内容
  if (block.type === "thinking")
    message.content[index] = { ...block, 
      thinking: block.thinking + delta.thinking };
  break;

case "signature_delta":
  // 接收思考签名（完整性校验）
  if (block.type === "thinking")
    message.content[index] = { ...block, signature };
  break;
```

Extended Thinking 的工作原理：

```
用户提问 → Claude 开始"思考"（不可见） → 
思考完成（thinking 块） → 生成最终答案 → 
调用工具 → 获取结果 → 可能再次"思考" → ...
```

每个 thinking 块都有一个 **signature**（签名），用于验证思考过程的完整性。这是一种**链式完整性保证**——确保思考内容没有被篡改。

### 3.2.2 自适应思考：thinking_budget

Claude Code 支持**自适应思考预算**——根据任务复杂度动态调整思考深度。

从 Vj7() 状态中可以看到：

```javascript
{
  promptCache1hEligible: null,      // 1小时缓存资格
  promptCache1hAllowlist: null,     // 缓存白名单
  afkModeHeaderLatched: null,       // AFK 模式标记
  fastModeHeaderLatched: null,      // 快速模式标记
}
```

`fastModeHeaderLatched` 字段特别有趣——它指示 Claude Code 是否应该使用"快速模式"。在快速模式下，Claude 可能会减少思考时间、使用更小的模型、或跳过某些验证步骤。

这是一种**计算预算管理**——类似于游戏引擎中的 LOD（Level of Detail）系统，根据场景复杂度动态调整渲染精度。Claude Code 根据**当前模式**（快速/正常/深度）来调整**计算精度**（思考时间/模型大小/验证级别）。

### 3.2.3 Prompt Cache：1小时窗口

Anthropic 的 Prompt Cache 是一个性能优化特性——它允许缓存 System Prompt 和对话历史，避免每次 API 调用都重新发送。

Claude Code 的实现：

```javascript
{
  promptCache1hEligible: null,    // 当前请求是否符合 1h 缓存条件
  promptCache1hAllowlist: null,   // 允许使用 1h 缓存的内容白名单
}
```

`promptCache1hAllowlist` 是一个精心维护的列表——只有被列入白名单的 System Prompt 段才能享受 1 小时缓存。这是因为缓存需要内容完全匹配，任何变化都会导致缓存失效。

Claude Code 的 System Prompt 是**动态构建的**（如我们在第2章所见），但某些部分是**稳定的**——比如工具定义、代码规范、安全规则。这些稳定部分被列入缓存白名单，而动态部分（如 MCP 服务器指令、项目特定信息）则不缓存。

这种**选择性缓存**策略是在性能和灵活性之间的精妙平衡：

```
缓存的内容（稳定）          不缓存的内容（动态）
├── 工具定义               ├── MCP 服务器指令
├── 代码规范               ├── 项目结构信息
├── 安全规则               ├── 用户偏好
└── 基础上下文             └── 会话状态
```

### 设计思想：推理即执行

Extended Thinking 和 Prompt Cache 共同体现了一个核心设计哲学：**推理即执行**。

在传统编程中，"推理"和"执行"是分开的：
- 编译器推理类型，运行时执行代码
- 优化器推理性能，CPU 执行指令
- 测试框架推理正确性，部署系统执行发布

在 Agent 编程中，"推理"和"执行"融为一体：
- AI 的思考过程就是它的执行过程
- 工具调用是思考的延续，而不是独立步骤
- 上下文管理既是推理策略，也是执行优化

这意味着**你不能将推理和执行分开优化**。提高思考质量会直接提高执行质量，提高执行效率会释放更多计算资源给推理。

## 3.3 反馈即控制：权限模式与交互设计

在传统编程中，控制流由代码决定。在 Agent 编程中，控制流由**人机交互**决定。Claude Code 提供了一套精密的权限和交互系统。

### 3.3.1 六种权限模式

从 AgentInput 的 `mode` 字段中，我们已经看到了五种权限级别。加上默认的交互模式，Cla Code 实际上支持六种权限模式：

| 模式 | 描述 | 适用场景 |
|------|------|---------|
| `default` | 默认交互模式，每步询问用户 | 首次使用、敏感操作 |
| `acceptEdits` | 自动接受文件编辑 | 信任度高的批量重构 |
| `bypassPermissions` | 绕过所有权限检查 | CI/CD、自动化流水线 |
| `dontAsk` | 不询问用户，自动执行 | 非交互式（SDK 模式） |
| `plan` | 只生成计划，不执行 | 需要预审的场景 |
| `auto` | 自动模式，平衡安全与效率 | 日常开发 |

从 Vj7() 状态中可以看到相关的控制字段：

```javascript
{
  sessionBypassPermissionsMode: false,   // 会话级权限绕过
  hasExitedPlanMode: false,              // 是否已退出计划模式
  needsPlanModeExitAttachment: false,    // 是否需要计划模式退出附件
  needsAutoModeExitAttachment: false,    // 是否需要自动模式退出附件
}
```

### 源码透视：模式切换的状态机

模式之间的切换不是简单的标志位翻转，而是一个**状态机**：

```javascript
// 计划模式转换处理
function handlePlanModeTransition(currentMode, newMode) {
  if (newMode === "plan" && currentMode !== "plan") {
    G8.needsPlanModeExitAttachment = false;
  }
  if (currentMode === "plan" && newMode !== "plan") {
    G8.needsPlanModeExitAttachment = true;
  }
}

// 自动模式转换处理
function handleAutoModeTransition(currentMode, newMode) {
  if (currentMode === "auto" && newMode === "plan" ||
      currentMode === "plan" && newMode === "auto") {
    return; // plan ↔ auto 是直接切换
  }
  
  let wasAuto = currentMode === "auto";
  let isAuto = newMode === "auto";
  
  if (isAuto && !wasAuto) {
    G8.needsAutoModeExitAttachment = false;
  }
  if (wasAuto && !isAuto) {
    G8.needsAutoModeExitAttachment = true;
  }
}
```

这些状态转换确保了：
- 从计划模式退出时，计划内容会被正确附加
- 从自动模式退出时，操作历史会被保留
- 模式切换的"附件"（attachment）机制确保信息不丢失

### 3.3.2 计划模式（Plan Mode）

计划模式是 Claude Code 最独特的设计之一。在这种模式下，AI **只生成计划而不执行**——它分析问题、分解任务、规划步骤，但不会触碰任何文件或运行任何命令。

计划模式的价值：

1. **信任建立**：在执行前让用户审查 AI 的思路
2. **成本控制**：规划比执行便宜（不需要工具调用）
3. **并行规划**：可以同时让 AI 规划多个方案

从 `ExitPlanModeInput` 的定义中可以看到计划模式的退出机制：

```typescript
interface ExitPlanModeInput {
  /** 
   * Prompt-based permissions for plan execution.
   * These describe categories of actions rather than specific commands.
   */
  allowedPrompts?: {
    /** The tool this prompt applies to */
    tool: "Bash";
    /** Semantic description, e.g. "run tests", "install dependencies" */
    prompt: string;
  }[];
}
```

注意 `allowedPrompts` 的设计——它不是列出具体的命令（如 `npm test`），而是**语义描述**（如 "run tests"）。这是 Agent 编程特有的设计：你描述意图，AI 理解意图。

### 3.3.3 用户交互工具：AskUserQuestion

Claude Code 提供了一个专门的工具来与用户交互：

```typescript
interface AskUserQuestionInput {
  questions: [
    {
      question: string;       // 问题文本
      header: string;         // 短标签（最多12字符）
      options: [              // 2-4个选项
        {
          label: string;           // 选项标签
          description: string;     // 选项描述
          preview?: string;        // 可选的预览内容
        }
      ];
      multiSelect: boolean;   // 是否多选
    }
  ];
}
```

这个工具的设计有几个值得注意的细节：

1. **结构化输入**：不是自由文本问答，而是结构化的选择题。这确保了 AI 能正确解析用户的回答。

2. **preview 字段**：选项可以附带预览内容。例如，当选择不同的重构方案时，可以预览重构后的代码。

3. **multiSelect 支持**：允许多选，适用于"你想要启用哪些功能？"这类问题。

4. **1-4 个问题限制**：一次最多问 4 个问题，避免信息过载。

5. **2-4 个选项限制**：每个问题 2-4 个选项，加上自动提供的"Other"选项。

### 设计思想：人机协同的控制论

Claude Code 的权限系统体现了**人机协同控制论**的核心理念：

- **控制不是二元的**：不是"人类控制一切"或"AI 自主一切"，而是连续的权限光谱
- **信任是渐进的**：从 `plan`（不执行）到 `default`（逐步确认）到 `auto`（自动执行）
- **干预是精确的**：通过 `allowedPrompts` 可以精确控制 AI 在执行阶段能做什么
- **可审计性**：每个决策都有记录（modelUsage, totalCostUSD 等）

## 3.4 编写 Agent 代码的思维模型

理解了 Claude Code 的架构和工具设计之后，我们最后来探讨一个更深层的问题：**编写 Agent 系统需要什么样的思维模型？**

### 3.4.1 从"写步骤"到"描述意图"

传统程序员习惯于写步骤：

```python
# 传统思维：我需要告诉计算机每一步做什么
def deploy_service():
    # 1. 检查环境
    if not os.path.exists("Dockerfile"):
        raise FileNotFoundError("Dockerfile not found")
    
    # 2. 构建镜像
    subprocess.run(["docker", "build", "-t", "myapp", "."])
    
    # 3. 停止旧容器
    subprocess.run(["docker", "stop", "myapp-container"])
    
    # 4. 启动新容器
    subprocess.run(["docker", "run", "-d", "--name", "myapp-container", "myapp"])
    
    # 5. 健康检查
    for i in range(30):
        response = requests.get("http://localhost:8080/health")
        if response.status_code == 200:
            break
        time.sleep(1)
    else:
        raise TimeoutError("Health check failed")
```

Agent 编程者写意图：

```bash
# Agent 思维：我需要告诉 AI 我想要什么结果
claude "帮我部署这个应用到 Docker，确保新容器启动后健康检查通过再停止旧容器"
```

这个转变不只是在语言层面的——从 Python 到自然语言。更根本的是思维方式的转变：

| 维度 | 步骤思维 | 意图思维 |
|------|---------|---------|
| 关注点 | 怎么做 | 做什么 |
| 错误处理 | 预定义所有错误路径 | 让 AI 自适应处理 |
| 边界条件 | 显式检查 | 上下文推断 |
| 抽象层级 | 固定（一个函数做一件事） | 动态（AI 根据任务调整） |
| 验证 | 单元测试 | 人工审查 + AI 自检 |

### 3.4.2 从"防御性编程"到"信任性编程"

传统编程强调防御性编程——假设一切都会出错：

```python
# 防御性编程
def parse_config(path):
    if not isinstance(path, str):
        raise TypeError("path must be a string")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Config file not found: {path}")
    if not os.access(path, os.R_OK):
        raise PermissionError(f"Cannot read config file: {path}")
    
    content = open(path).read()
    if not content.strip():
        raise ValueError("Config file is empty")
    
    config = json.loads(content)
    if "version" not in config:
        raise KeyError("Config missing 'version' field")
    # ...
```

Agent 编程更接近"信任性编程"——假设 Agent 有基本的判断能力：

```bash
# 信任性编程
claude "读取 config.json 并根据配置初始化应用，如果配置有问题就告诉我"
```

这不是放弃验证，而是**转移验证的责任**——从程序代码转移到 Agent 的推理过程。Agent 会检查文件是否存在、内容是否合法、配置是否完整，因为它被训练为这样做。

### 3.4.3 从"确定性"到"概率性"思维

也许这是最难适应的转变：传统程序员期望**确定性**——相同的输入总是产生相同的输出。Agent 编程本质上是**概率性的**——即使相同的输入，AI 也可能做出不同的决策。

这并不意味着 Agent 编程是不可控的。Claude Code 通过多个机制来管理不确定性：

1. **工具约束**：工具的输入输出类型是确定的，AI 只能在工具提供的接口内操作
2. **权限模式**：通过权限级别控制 AI 的自主程度
3. **成本追踪**：通过 token 和费用追踪来监控 AI 的行为
4. **会话审计**：所有操作都有日志，可以事后审查

### 源码透视：不确定性管理

从 Vj7() 的状态设计中可以看到不确定性管理的多个层次：

```javascript
{
  // 第一层：操作审计
  totalLinesAdded: 0,           // 追踪所有变更
  totalLinesRemoved: 0,
  totalToolDuration: 0,
  
  // 第二层：成本控制
  totalCostUSD: 0,              // 花费上限
  modelUsage: {},               // 按模型追踪
  
  // 第三层：行为监控
  inMemoryErrorLog: [],         // 错误日志
  slowOperations: [],           // 慢操作检测
  lastAPIRequest: null,         // 最后一次 API 请求
  
  // 第四层：用户控制
  isInteractive: false,         // 交互/非交互模式
  sessionBypassPermissionsMode: false,  // 权限绕过
  hasExitedPlanMode: false,     // 计划模式控制
}
```

每一层都是对不确定性的一个约束——操作审计告诉你"发生了什么"，成本控制告诉你"花了多少"，行为监控告诉你"是否异常"，用户控制让你"可以干预"。

### 3.4.4 一个完整的思维模型转换案例

让我们通过一个完整的案例来感受思维模型的转变。

**任务**：为一个 Express.js 项目添加 rate limiting 中间件。

**传统思维（步骤化）**：

```javascript
// 1. 安装依赖
// npm install express-rate-limit

// 2. 创建中间件
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 限制 100 次请求
  message: 'Too many requests from this IP'
});

// 3. 应用到路由
app.use('/api/', limiter);

// 4. 添加错误处理
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  next(err);
});

// 5. 编写测试
// test/rate-limit.test.js
// ...
```

**Agent 思维（意图化）**：

```bash
claude "为这个 Express.js API 项目添加 rate limiting，要求：
- 每个 IP 每15分钟最多100次请求
- 对 /api/ 路径生效
- 添加适当的错误处理
- 更新 README 说明这个新功能"
```

注意区别：

1. **传统思维需要知道**：express-rate-limit 的 API、中间件的顺序、错误处理的最佳实践
2. **Agent 思维只需要知道**：业务需求（100次/15分钟）、适用范围（/api/）、期望输出（README 更新）

3. **传统思维的验证方式**：编写单元测试
4. **Agent 思维的验证方式**：AI 自动测试 + 人工审查代码变更

5. **传统思维的修改方式**：找到相关代码，手动修改
6. **Agent 思维的修改方式**：告诉 AI "把限制改成 200 次"，AI 自动找到并修改相关代码

### 3.4.5 Agent 编程的"四象限"思维

最后，我提出一个 Agent 编程的"四象限"思维模型：

```
              明确意图
                │
    ┌───────────┼───────────┐
    │  象限 I    │  象限 II   │
    │  脚本化    │  委托化    │
    │           │           │
    │  传统编程  │  Agent编程 │
    │  的最佳区 │  的最佳区  │
    │  域        │  域        │
隐 │           │           │
含 │───────────┼───────────│
知 │  象限 III  │  象限 IV   │
识 │  探索化    │  协同化    │
    │           │           │
    │  Agent    │  人类+Agent
    │  独立探索 │  深度协作  │
    │           │           │
    └───────────┼───────────┘
                │
              模糊意图
```

- **象限 I（明确+隐性）**：传统编程的最佳领域。明确的步骤，隐含的细节。比如实现一个排序算法。

- **象限 II（明确+显性）**：Agent 编程的最佳领域。明确的意图，显式的约束。比如"重构认证模块为 JWT"。

- **象限 III（模糊+隐性）**：Agent 独立探索的领域。模糊的目标，隐含的需求。比如"优化这个项目的性能"。

- **象限 IV（模糊+显性）**：人类+Agent 深度协作的领域。模糊的愿景，但需要精确执行。比如"设计一个新功能"——愿景模糊，但最终代码需要精确。

优秀的 Agent 编程者知道什么时候用哪个象限的思维：
- 确定性逻辑 → 象限 I（直接写代码）
- 明确需求 → 象限 II（委托给 Agent）
- 探索性问题 → 象限 III（让 Agent 先探索，再审查）
- 复杂设计 → 象限 IV（与 Agent 协同完成）

## 小结

本章我们从思维模型的视角理解了 Agent 编程：

1. **工具即接口**：传统 API 是"命令"，Agent 工具是"能力描述"。工具的文档描述比类型签名更重要，因为 AI（而非程序员）是使用者。FileEdit 的差异编辑设计和 AgentInput 的嵌套 Agent 设计是最佳范例。

2. **推理即执行**：Extended Thinking 将推理过程嵌入执行流程，thinking_budget 实现自适应计算，Prompt Cache 的选择性缓存平衡性能与灵活性。

3. **反馈即控制**：六种权限模式形成连续的控制光谱，计划模式支持"先规划后执行"的工作流，结构化的用户交互工具（AskUserQuestion）确保人机沟通的精确性。

4. **意图思维**：从"写步骤"到"描述意图"，从"防御性编程"到"信任性编程"，从"确定性"到"概率性"思维。四象限模型帮助判断何时用传统编程，何时委托给 Agent。

核心认知转变：
- **你不是在写代码，你是在定义能力边界和意图空间**
- **最好的 Agent 代码是你不写的代码**
- **控制不是限制，而是精确度调节**

---

# 卷一总结：认知篇的三层递进

让我们回顾这三章的递进关系：

**第1章（历史层）**：编程思想的三次浪潮——指令式→对象式→Agent式。理解历史，是为了理解我们正站在什么位置。

**第2章（架构层）**：Claude Code 的全景架构——12MB 单文件中如何组织一个完整的 Agent 系统。理解架构，是为了理解 Agent 的工程实现。

**第3章（思维层）**：Agent 编程的思维模型——工具即接口、推理即执行、反馈即控制。理解思维，是为了改变你"编写软件"的方式。

这三层构成了一个**认知金字塔**：

```
           思维模型
          ╱         ╲
        ╱             ╲
      ╱                 ╲
    ╱                     ╲
  架构实现               ─────
 ╱         ╲
╱             ╲
历史演进       ─────
```

历史是基础，架构是支撑，思维是目标。没有对历史的理解，你无法欣赏架构的精妙；没有对架构的理解，你无法掌握新的思维方式。

在接下来的卷二中，我们将从"认知"走向"实现"——深入 Claude Code 的工具系统、会话管理、MCP 协议和权限模型，看看这些设计理念是如何在代码中落地的。
# 卷二：对象的诞生（基础篇）