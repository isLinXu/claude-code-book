
> **编程思想要点**：复杂性不可消除，只能被组织。Claude Code 通过模块注册表、惰性初始化和分层抽象，将一个庞大的 Agent 系统组织进了 12MB 的单文件中。

## 2.1 从 package.json 读出的技术栈

一个 `package.json` 文件，28 行代码，却道出了整个项目的技术基因。

```json
{
  "name": "@anthropic-ai/claude-code",
  "version": "2.1.88",
  "bin": { "claude": "cli.js" },
  "engines": { "node": ">=18.0.0" },
  "type": "module",
  "dependencies": {},
  "optionalDependencies": {
    "@img/sharp-darwin-arm64": "^0.34.2",
    "@img/sharp-darwin-x64": "^0.34.2"
    // ... 8 个平台的原生绑定
  }
}
```

让我们逐字段解读。

### 2.1.1 "type": "module" — ESM 时代的宣言

`"type": "module"` 是整个项目最基础的技术决策。它告诉 Node.js：这个包使用 ES Modules（ESM），而不是 CommonJS（CJS）。

这个选择的影响是深远的：

```javascript
// ESM 语法：静态导入
import { createRequire } from "node:module";

// 而不是 CJS 的动态 require
// const { createRequire } = require("node:module");
```

ESM 的核心优势是**静态分析**。导入关系在编译时确定，使得 tree-shaking（去除未使用的代码）成为可能。对于一个需要将所有依赖打包进 12MB 单文件的项目来说，tree-shaking 至关重要。

### 2.1.2 "engines": {"node": ">=18.0.0"} — 运行时基线

Node.js 18 是一个有意义的版本分界线。它引入了几个关键特性：

- **原生 Fetch API**：不再需要 `node-fetch` 或 `axios`
- **原生 Test Runner**：内置的测试框架
- **性能改进**：V8 引擎升级，启动速度提升 20-30%
- **长期支持**：18.x 是 Active LTS 版本

从源码中可以确认这一点——Claude Code 使用了原生 `fetch` 和 `crypto.randomUUID()`，这些都是 Node.js 18+ 的原生 API。

### 2.1.3 零依赖的哲学

`"dependencies": {}` ——这是整个 `package.json` 中最引人注目的一行。

零运行时依赖。所有依赖都在构建时打包进了 `cli.js`。这种设计的优势是：

1. **无依赖地狱**：不会出现"版本 A 需要 lodash@4，版本 B 需要 lodash@3"的问题
2. **确定性安装**：`npm install` 只下载一个文件，100% 可重复
3. **离线可用**：安装后不需要网络即可运行
4. **安全可控**：所有依赖经过统一的审计和构建

代价是 `cli.js` 的大小——12.44MB。但正如我们在第1章讨论的，这个大小对于一个完整的 AI Agent 运行时来说是合理的。

### 2.1.4 唯一的例外：sharp

`optionalDependencies` 中只有 `@img/sharp-*`——8 个平台的原生绑定，用于图像处理。

sharp 是高性能的 Node.js 图像处理库，它有原生 C++ 组件，无法被打包进 JavaScript 文件。因此它作为可选依赖存在——如果不安装 sharp，Claude Code 仍然可以工作，只是无法处理图像。

这个设计决策体现了务实主义：在"自包含"和"功能完整性"之间找到最佳平衡点。

### 设计思想：minimal surface area

`package.json` 的设计哲学可以总结为 **minimal surface area（最小暴露面）**：

- 一个入口点（`cli.js`）
- 零必需依赖
- 唯一的可选依赖用于特定功能（图像处理）
- 最低的运行时要求（Node.js 18+）

这与 Claude Code 的产品哲学一脉相承——用户只需要 `claude` 一个命令，不需要配置环境、安装插件、或者理解内部架构。

## 2.2 Bundle 架构深度剖析

`cli.js` 不是简单的"所有代码拼在一起"。它是一个精心设计的模块系统，具有完整的依赖管理、延迟初始化和错误处理。

### 2.2.1 文件结构概览

```javascript
// cli.js 的基本结构（行号约）
// 第 1-7 行：头部信息
#!/usr/bin/env node
// Version: 2.1.88
// Want to see the unminified source? We're hiring!

// 第 8-100 行：运行时 polyfill 和工具函数
import { createRequire as _K5 } from "node:module";
// Object.create, getPrototypeOf, defineProperty...

// 第 100-1000 行：lodash 内联
// _.cloneDeep, _.set, _.get, _.isEqual, _.memoize...

// 第 1000-2000 行：chalk 终端 UI 库内联
// ANSI 颜色、样式、RGB 支持...

// 第 2000-4000 行：@anthropic-ai/sdk 内联
// API 客户端、流处理、错误体系...

// 第 4000-6000 行：核心业务逻辑
// Vj7() 工厂函数、会话管理、消息流...

// 第 6000-8000 行：System Prompt 生成
// 上下文注入、工具描述、MCP 指令...

// 第 8000-10000 行：工具实现
// FileRead, FileEdit, Bash, Glob, Grep...

// 第 10000-12000 行：CLI 命令定义
// Commander.js 配置、子命令、选项...

// 第 12000-16668 行：入口点和启动逻辑
// vsY() 主函数、依赖初始化、性能监控...
```

### 2.2.2 模块注册表：惰性初始化的魔法

Bundle 的核心挑战是：如何在打包所有代码的同时，避免加载所有代码？

答案在源码中随处可见的这种模式：

```javascript
// 惰性初始化模式
var someModule;
var initSomeModule = y(() => {
  // 模块的初始化逻辑
  someModule = /* ... */;
  return someModule;
});

// 使用时才初始化
function useModule() {
  return initSomeModule();
}
```

这里 `y()` 是一个**惰性求值工厂**：

```javascript
var y = (q, K) => () => (q && (K = q(q = 0)), K);
```

让我们解密这段看似晦涩的代码。`y(fn, initialValue)` 返回一个函数，这个函数在第一次被调用时执行 `fn`，后续调用直接返回缓存的结果。这是**单例模式的函数式实现**——等价于：

```javascript
function createLazy(factory) {
  let cache = null;
  let initialized = false;
  return () => {
    if (!initialized) {
      cache = factory();
      initialized = true;
    }
    return cache;
  };
}
```

整个 `cli.js` 中有 **80+ 个这样的惰性模块**，每个都对应一个功能单元。它们构成了一个隐式的**模块注册表**——虽然所有代码都在同一个文件中，但每个模块都是按需加载的。

### 源码透视：模块标识符

在 minified 代码中，每个模块由一个唯一的标识符表示。例如：

```javascript
var v8 = y(() => { Hj7(); Jj7(); Zc(); /* ... */ });  // 全局状态
var k8 = y(() => { zx6 = []; });                       // 事件日志
var m8 = y(() => { /* ... */ });                        // 配置管理
var c9 = y(() => { wr8 = new Set });                   // 关闭钩子
```

这些标识符（v8, k8, m8, c9...）是构建工具生成的，通常看起来毫无意义。但通过阅读模块内部的引用，我们可以推断出它们的功能。

### 2.2.3 内联第三方库的代价与收益

`cli.js` 中内联了至少以下第三方库：

| 库名 | 功能 | 估计大小 |
|------|------|---------|
| lodash | 通用工具函数 | ~70KB |
| Commander.js | CLI 框架 | ~30KB |
| chalk | 终端颜色 | ~20KB |
| @anthropic-ai/sdk | Anthropic API 客户端 | ~200KB |
| chalk 的依赖（color-convert, ansi-styles等） | 颜色转换 | ~15KB |

总计约 335KB 的源码（压缩前），经过 minification 和可能的 tree-shaking，最终打包进 12MB 的 Bundle。

**代价**：
- 文件体积大（12.44MB）
- 源码不可读（minified）
- 更新依赖需要重新构建和发布

**收益**：
- 零安装问题
- 确定性的运行环境
- 启动速度快（无 node_modules 解析）
- 可以精细优化（只打包使用的部分）

### 设计思想：自包含系统

Bundle 架构体现了一种 **self-contained system（自包含系统）** 的设计哲学。

在微服务时代，我们习惯于将系统拆分为多个独立的、通过网络通信的服务。Claude Code 选择了相反的方向——将所有功能压缩到一个文件中。

这不是对微服务的否定，而是对**部署场景的精确匹配**。CLI 工具的使用场景是"安装一次，随处运行"。在这个场景下，自包含性比模块性更有价值。

类比来说，Docker 镜像也是一种"自包含系统"——它将应用及其所有依赖打包成一个可运行的单元。Claude Code 的 Bundle 可以理解为"JavaScript 版的 Docker 镜像"。

## 2.3 入口点分析：从 shebang 到 Agent 循环

当用户在终端输入 `claude` 并按下回车时，究竟发生了什么？让我们追踪完整的执行链路。

### 2.3.1 第一阶段：Node.js 启动

```bash
#!/usr/bin/env node
```

这行 shebang 告诉操作系统：用 `node` 来执行这个文件。`/usr/bin/env` 的写法确保了跨平台兼容性——它会在 PATH 中查找 `node`，而不是硬编码路径。

### 2.3.2 第二阶段：ESM 模块加载

```javascript
import { createRequire as _K5 } from "node:module";
```

这是 `cli.js` 的第一行实际代码。它从 Node.js 的内置 `module` 模块中导入 `createRequire` 函数。

为什么一个 ESM 模块需要 `createRequire`？因为有些 npm 包只提供了 CommonJS 格式。`createRequire` 允许在 ESM 中使用 `require()` 来加载 CJS 模块。这是一个兼容性桥接。

### 2.3.3 第三阶段：全局工具函数

接下来的几十行代码建立了整个程序的基石——一组通用的工具函数：

```javascript
// 对象创建
var o45 = Object.create;
var { getPrototypeOf: a45, defineProperty: Wb6, 
      getOwnPropertyNames: IO7, getOwnPropertyDescriptor: s45 } = Object;

// 属性访问器
function mO7(q) { return this[q]; }

// 模块导入辅助
var O6 = (q, K, _) => {
  // CommonJS 到 ESM 的兼容层
  var z = q != null && typeof q === "object";
  if (z) {
    var Y = K ? t45 ??= new WeakMap : e45 ??= new WeakMap;
    var $ = Y.get(q);
    if ($) return $;
  }
  _ = q != null ? o45(a45(q)) : {};
  let A = K || !q || !q.__esModule 
    ? Wb6(_, "default", { value: q, enumerable: true }) 
    : _;
  for (let O of IO7(q))
    if (!uO7.call(A, O)) 
      Wb6(A, O, { get: mO7.bind(q, O), enumerable: true });
  if (z) Y.set(q, A);
  return A;
};
```

这段代码看起来很晦涩，但它的功能很清晰：

1. **O6 函数**：将 CommonJS 模块转换为 ESM 兼容的格式
2. **WeakMap 缓存**：避免重复转换同一个模块
3. **属性代理**：通过 `getOwnPropertyNames` 和 `defineProperty` 实现懒加载的属性访问

这是 **bundling infrastructure（打包基础设施）** 的典型代码——它不直接实现业务功能，而是为后续的业务代码提供运行环境。

### 2.3.4 第四阶段：核心模块初始化

随着执行链路的深入，各个核心模块按需初始化：

```
1. Vj7() → 全局状态对象（100+ 字段）
2. Dz()  → 事件发射器（subscribe/emit 模式）
3. gX6() → 带缓冲的写入器（flush 机制）
4. m_5() → 平台检测（OS/浏览器/运行时）
5. oj7() → HTTP 头生成（X-Stainless-* 系列）
6. Rx6  → MessageStream（SSE 消息流处理）
7. yZ()  → 错误体系（APIError 层次）
```

### 源码透视：事件发射器 Dz()

```javascript
function Dz() {
  let q = new Set;
  return {
    subscribe(K) { return q.add(K), () => { q.delete(K) }; },
    emit(...K) { for (let _ of q) _(...K); },
    clear() { q.clear(); }
  };
}
```

这是整个 Claude Code 的事件系统基石。只有 **20 行代码**，却实现了完整的发布-订阅模式。它被用于：

- **会话切换**：`onSessionSwitch` 事件
- **滚动检测**：`markScrollActivity` / `isScrollDraining`
- **后压缩**：`markPostCompaction` / `consumePostCompaction`

注意返回的 `subscribe` 方法：它返回一个**取消订阅函数**——这是 JavaScript 中 `Observable` 模式的标准实现。

```javascript
// 使用示例
const events = Dz();
const unsubscribe = events.subscribe((data) => {
  console.log("Event:", data);
});
// 取消订阅
unsubscribe();
```

### 2.3.5 第五阶段：系统提示构建

这是 Claude Code 最核心的环节之一——构建发送给 Anthropic API 的 System Prompt。

从源码中可以看到一个复杂的提示构建流水线：

```javascript
// 概念模型（简化）
async function buildSystemPrompt(tools, directories, flags) {
  let sessionGuidance = VSY(tools, envInfo);
  let memory = GQ8();
  let modelOverride = MSY();
  let envInfoSimple = QgK(directories, flags);
  let language = XSY(settings.language);
  let outputStyle = PSY(modelInfo);
  let mcpInstructions = WSY(hasMcp);
  let scratchpad = RSY();
  
  return [
    sessionGuidance,
    memory,
    modelOverride,
    envInfoSimple,
    language,
    outputStyle,
    mcpInstructions,
    scratchpad,
    // ... 更多部分
  ].filter(part => part !== null);
}
```

这个流水线的精妙之处在于：**System Prompt 不是静态的**。它是动态构建的，根据当前会话状态、可用工具、MCP 服务器连接状态等实时信息来生成。

特别值得注意的是 `mcpInstructions`——MCP（Model Context Protocol）服务器的指令是动态注入的。当 MCP 服务器连接或断开时，System Prompt 会相应更新。

### 2.3.6 第六阶段：Agent 循环启动

最终的启动进入 Agent 循环——这是 Claude Code 的"心跳"：

```
用户输入 → 构建 API 请求 → 调用 Anthropic API → 
解析响应 → 执行工具 → 获取结果 → 
更新上下文 → 构建下一轮请求 → 调用 API → ...
```

这个循环一直持续到：
- AI 认为任务完成（`stop_reason: "end_turn"`）
- 上下文窗口满（触发压缩）
- 用户主动终止
- 发生不可恢复的错误

## 2.4 CLI 命令树结构

Claude Code 使用 Commander.js 构建 CLI 命令树。虽然代码是 minified 的，但我们仍然可以推断出完整的命令结构。

### 2.4.1 根命令

```bash
claude [options] [prompt]
```

这是最常用的形式——不带子命令，直接以自然语言启动对话。

### 2.4.2 子命令体系

从源码和功能推断，Claude Code 的命令树如下：

```
claude
├── mcp                    # MCP 服务器管理
│   ├── add                # 添加 MCP 服务器
│   ├── remove             # 移除 MCP 服务器
│   ├── list               # 列出 MCP 服务器
│   └── reset              # 重置 MCP 配置
├── auth                   # 认证管理
│   ├── login              # 登录
│   └── logout             # 登出
├── plugin                 # 插件管理
│   ├── list               # 列出插件
│   └── install            # 安装插件
├── agents                 # Agent 管理
│   ├── list               # 列出可用 Agent
│   └── create             # 创建自定义 Agent
├── auto-mode              # 自动模式切换
├── doctor                 # 诊断工具
├── update                 # 更新 Claude Code
├── install                # 安装辅助
├── remote-control         # 远程控制
│   ├── rc                 # 远程控制简写
│   ├── remote             # 远程模式
│   ├── sync               # 同步
│   └── bridge             # 桥接
└── [特殊入口]
    ├── --claude-in-chrome-mcp    # Chrome MCP 模式
    ├── --chrome-native-host      # Chrome 原生宿主
    └── --computer-use-mcp        # Computer Use MCP 模式
```

### 源码透视：隐藏命令

Claude Code 有几个特殊的命令行入口，它们不以子命令形式暴露，而是通过标志位触发：

```javascript
// 特殊入口检测
"--claude-in-chrome-mcp"   // 作为 Chrome 扩展的 MCP 服务器
"--chrome-native-host"      // Chrome 原生消息宿主
"--computer-use-mcp"        // Computer Use（屏幕操作）的 MCP 服务器
```

这些特殊入口揭示了 Claude Code 的多面性——它不只是一个 CLI 工具，还可以作为：
- **Chrome 扩展的后端**（通过 `--claude-in-chrome-mcp`）
- **桌面集成的服务**（通过 `--chrome-native-host`）
- **屏幕操作 Agent**（通过 `--computer-use-mcp`）

### 2.4.3 命令注册模式

在 minified 源码中，命令注册的痕迹清晰可见：

```javascript
// Commander.js 的命令注册模式
program
  .command("mcp")
  .description("Manage MCP servers")
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listCommand);
```

Commander.js 采用的是 **命令模式（Command Pattern）**——每个子命令是一个独立的对象，有自己的选项和动作。这种模式使得命令可以嵌套、组合、重用。

### 设计思想：扁平命令表面

Claude Code 的 CLI 设计遵循 **flat command surface（扁平命令表面）** 原则：

- 核心功能通过自然语言（根命令）触发
- 管理功能通过子命令（mcp, auth, plugin）触发
- 高级功能通过隐藏入口（--chrome-mcp 等）触发

这种分层设计确保了 80% 的用户只需要记住一件事：`claude "你的需求"`。

## 2.5 全局状态对象：Vj7() 的 100+ 字段

`Vj7()` 是 Claude Code 的"创世函数"——它创建并返回整个系统的全局状态。这个函数返回的对象有 100+ 个字段，是理解 Claude Code 运行机制的核心。

### 2.5.1 状态分类

我们可以将这些字段分为几大类：

**会话标识**

```javascript
{
  sessionId: randomUUID(),      // 当前会话唯一 ID
  parentSessionId: undefined,   // 父会话 ID（Agent 分支）
  sessionProjectDir: null,      // 会话关联的项目目录
  sessionSource: undefined,     // 会话来源（CLI/SDK/IDE）
}
```

**成本与用量追踪**

```javascript
{
  totalCostUSD: 0,              // 总花费（美元）
  totalAPIDuration: 0,          // API 调用总时长（ms）
  totalAPIDurationWithoutRetries: 0,  // 不含重试的 API 时长
  totalToolDuration: 0,         // 工具执行总时长（ms）
  turnToolDurationMs: 0,        // 当前轮次工具时长
  turnToolCount: 0,             // 当前轮次工具调用次数
  totalLinesAdded: 0,           // 新增代码行数
  totalLinesRemoved: 0,         // 删除代码行数
  modelUsage: {},               // 按模型的 token 使用量
}
```

**模型管理**

```javascript
{
  mainLoopModelOverride: undefined,  // 主循环模型覆盖
  initialMainLoopModel: null,        // 初始模型
  modelStrings: null,                // 模型字符串配置
  hasUnknownModelCost: false,        // 是否有未知模型成本
}
```

**权限与安全**

```javascript
{
  sessionBypassPermissionsMode: false,  // 会话级权限绕过
  sessionTrustAccepted: false,          // 会话信任已接受
  sessionPersistenceDisabled: false,    // 会话持久化已禁用
  strictToolResultPairing: false,       // 严格工具结果配对
}
```

**Agent 与团队**

```javascript
{
  mainThreadAgentType: undefined,      // 主线程 Agent 类型
  sessionCreatedTeams: new Set(),      // 创建的 Agent 团队
  invokedSkills: new Map(),            // 调用的技能
  agentColorMap: new Map(),            // Agent 颜色映射（终端 UI）
  agentColorIndex: 0,                  // Agent 颜色索引
}
```

**缓存与优化**

```javascript
{
  systemPromptSectionCache: new Map(),  // System Prompt 段缓存
  promptCache1hEligible: null,         // 1小时 Prompt Cache 资格
  promptCache1hAllowlist: null,        // Prompt Cache 白名单
  cachedClaudeMdContent: null,         // CLAUDE.md 缓存内容
  planSlugCache: new Map(),            // 计划 slug 缓存
}
```

** observability（可观测性）**

```javascript
{
  loggerProvider: null,       // 日志提供者
  eventLogger: null,          // 事件日志器
  meterProvider: null,        // 指标提供者
  tracerProvider: null,       // 追踪提供者
  meter: null,                // 指标收集器
  sessionCounter: null,       // 会话计数器
  tokenCounter: null,         // Token 计数器
  costCounter: null,          // 成本计数器
  statsStore: null,           // 统计存储
  inMemoryErrorLog: [],       // 内存错误日志（最多100条）
  slowOperations: [],         // 慢操作日志（10秒窗口）
}
```

### 2.5.2 状态访问模式

Vj7() 返回的状态对象不是直接暴露的。Claude Code 通过一组 getter/setter 函数来访问状态：

```javascript
// 创建全局状态实例
var G8 = Vj7();

// Getter 函数
function getSessionId() { return G8.sessionId; }
function getTotalCostUSD() { return G8.totalCostUSD; }
function getModelUsage() { return G8.modelUsage; }
function getIsInteractive() { return G8.isInteractive; }
function getProjectRoot() { return G8.projectRoot; }

// Setter 函数
function setIsInteractive(value) { G8.isInteractive = value; }
function setProjectRoot(value) { G8.projectRoot = value.normalize("NFC"); }
function setModelStrings(value) { G8.modelStrings = value; }
```

这种间接访问层有几个好处：
1. **封装性**：可以在 setter 中添加验证逻辑
2. **可观测性**：可以在 getter/setter 中插入日志
3. **兼容性**：可以修改内部结构而不影响外部接口
4. **测试性**：可以 mock getter/setter 来测试不同状态

### 源码透视：Unicode 规范化

注意一个细节：`setProjectRoot` 中的 `.normalize("NFC")`。

```javascript
function setProjectRoot(value) {
  G8.projectRoot = value.normalize("NFC");
}
```

NFC（Normalization Form Canonical Composition）是 Unicode 的一种规范化形式。它会将等价的不同 Unicode 表示合并为同一种形式。

例如，字符 `é` 可以用两种方式表示：
- **组合形式**：`e` + `´` (U+0065 + U+0301)
- **预组合形式**：`é` (U+00E9)

`.normalize("NFC")` 确保文件路径始终使用预组合形式，避免了路径比较时因 Unicode 表示不同而失败的问题。这是一个容易被忽略但至关重要的细节。

### 2.5.3 状态的生命周期

Vj7() 状态的生命周期与一次 Claude Code 会话一致：

```
会话开始 → Vj7() 创建初始状态
         → 用户交互中状态持续更新
         → （可能的）会话切换：switchSession()
         → （可能的）状态持久化：用于恢复会话
         → 会话结束：状态丢弃
```

有几个关键的生命周期事件：

**会话切换**
```javascript
function switchSession(newSessionId, projectDir = null) {
  G8.planSlugCache.delete(G8.sessionId);  // 清理旧缓存
  G8.sessionId = newSessionId;             // 设置新 ID
  G8.sessionProjectDir = projectDir;       // 关联项目目录
  sessionSwitchEmitter.emit(newSessionId); // 通知订阅者
}
```

**成本重置**
```javascript
function resetCostState() {
  G8.totalCostUSD = 0;
  G8.totalAPIDuration = 0;
  G8.totalToolDuration = 0;
  G8.startTime = Date.now();
  G8.totalLinesAdded = 0;
  G8.totalLinesRemoved = 0;
  G8.modelUsage = {};
  G8.promptId = null;
}
```

**上下文压缩标记**
```javascript
function markPostCompaction() {
  G8.pendingPostCompaction = true;
}

function consumePostCompaction() {
  let result = G8.pendingPostCompaction;
  G8.pendingPostCompaction = false;
  return result;
}
```

### 设计思想：全局状态即世界观

Vj7() 的 100+ 字段构成了 Agent 的"世界观"——它理解自己是谁（sessionId）、在哪里工作（projectRoot）、花了多少钱（totalCostUSD）、用了哪些工具（modelUsage）、创造了什么（totalLinesAdded/Removed）。

这个"世界观"在每轮对话中持续更新，为 Agent 的决策提供上下文。当 Agent 需要决定"是否应该继续这个任务"时，它会参考 `totalCostUSD` 和 `modelUsage`。当它需要决定"下一步该做什么"时，它会参考 `invokedSkills` 和 `systemPromptSectionCache`。

这与传统编程中的"全局变量是邪恶的"教条形成有趣对比。在 Agent 编程中，全局状态不是要避免的——它是 Agent 的**记忆**和**身份**。没有全局状态，Agent 就像一个每天醒来都失忆的人，无法做出连贯的决策。

## 小结

本章我们从架构的视角解剖了 Claude Code：

1. **技术栈**：ESM + Node.js 18+，零运行时依赖，唯一的可选依赖是 sharp
2. **Bundle 架构**：通过惰性初始化（80+ 模块）实现单文件中的按需加载
3. **入口链路**：从 shebang 到 Agent 循环的六阶段启动过程
4. **命令树**：根命令（自然语言）+ 子命令（管理功能）+ 隐藏入口（特殊模式）
5. **全局状态**：Vj7() 的 100+ 字段构成 Agent 的"世界观"

核心设计哲学：
- **Minimal Surface Area**：最小暴露面——一个命令，一个文件，零配置
- **Self-contained System**：自包含系统——Bundle = JavaScript 版的 Docker 镜像
- **Global State as Worldview**：全局状态即世界观——100+ 字段是 Agent 的记忆和身份

在下一章中，我们将从"是什么"转向"怎么想"——Agent 编程需要什么样的思维模型？

## 思考与练习

★ **1.** 运行 `wc -l cli.js && wc -c cli.js`，统计 Claude Code 的行数和字节数。然后用 `grep -c "var.*=.*y(" cli.js` 统计惰性模块的数量。这些数字说明了什么？

★ **2.** 在 `cli.js` 中搜索 `"claude-opus-4"`, `"claude-sonnet-4"`, `"claude-haiku-4"` 这些字符串。理解 Claude Code 支持哪些模型，以及模型选择如何影响行为。

★★ **3.** 分析 Vj7() 返回对象中的所有 `boolean` 类型字段（以 `false` 为初始值的字段），将它们按功能分组。思考：这些布尔标志中有哪些是"模式开关"，哪些是"状态标记"？

★★ **4.** 找到 Dz() 事件发射器的所有使用位置。列出所有被订阅的事件，并画出事件流图。思考：这些事件之间的因果关系是什么？

★★★ **5.** 假设你要将 Claude Code 从单文件 Bundle 拆分为多文件模块化结构。你会如何划分模块边界？哪些模块应该被延迟加载？哪些必须同步初始化？画出你设计的模块依赖图。

---

# 第3章：Agent 编程思维 — 超越传统编程范式