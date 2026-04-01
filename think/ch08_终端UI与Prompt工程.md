
## 12.1 引言：终端作为第一公民

在绝大多数开发者的认知中，终端是一个简单的文本输入输出界面——你在左侧敲命令，右侧看到结果。然而，Claude Code 重新定义了"终端应用"的边界：它把 React 这套为浏览器DOM设计的声明式UI框架，移植到了无DOM的终端环境中，构建出一个具备富文本渲染、交互式组件、实时动画的沉浸式命令行体验。

这一章将深入剖析 Claude Code 的终端UI架构——它是如何用 `createRoot()` 在终端里"种"出一棵React组件树的，Ink 框架的渲染管线如何将虚拟DOM映射到ANSI转义序列，以及整个多Agent界面如何通过 `expandedView` 和 `selectedIPAgentIndex` 管理状态多态。

### 12.1.1 设计哲学：为什么选择React+Ink

传统CLI工具通常采用"命令模式"——用户输入一个命令，程序执行，输出文本结果。这种模式的本质是过程式的、线性的。但 Claude Code 的交互模型远比这复杂：

1. **流式输出**：AI的回复是逐token到达的，不是一次性返回的
2. **并行操作**：多个工具调用可能同时执行，需要实时展示进度
3. **状态切换**：交互式输入 → 思考中 → 工具执行 → 结果展示，状态机复杂
4. **嵌套结构**：Agent任务可能包含子Agent，UI需要支持递归展示

这些需求与传统CLI框架（如 Commander.js、Inkquirer、oclif）的设计理念相悖。它们擅长的是静态表单和菜单，而非动态的、状态驱动的界面。

React + Ink 的组合提供了完美的基础设施：

- **声明式渲染**：UI = f(state)，状态变化自动触发重渲染
- **组件化**：将复杂的终端界面拆分为可复用的独立组件
- **Hooks系统**：`useInput`、`useApp` 等终端专用Hook，封装了底层ANSI操作
- **虚拟DOM diff**：只更新变化的部分，避免全屏重绘带来的闪烁

这是一个典型的"用合适的抽象层次解决正确的问题"的工程决策。

## 12.2 Ink渲染引擎：从虚拟DOM到ANSI

### 12.2.1 createRoot()：终端渲染的入口点

在浏览器React中，`ReactDOM.createRoot(document.getElementById('root'))` 是一切的开始。Ink 的 `createRoot()` 遵循相同的API契约，但渲染目标从DOM节点变成了 `process.stdout`：

```typescript
// Ink 内部的渲染入口
import { createRoot } from './renderer';

// Claude Code 的启动流程
const root = createRoot({
  stdout: process.stdout,
  stderr: process.stderr,
  stdin: process.stdin,
});

// 挂载应用组件
root.render(<ClaudeApp {...initialProps} />);
```

`createRoot()` 返回的 Root 对象承担了与 ReactDOM.createRoot() 相同的职责：

1. **管理渲染生命周期**：控制首次挂载（mount）、更新（update）和卸载（unmount）
2. **批量更新**：将多个 setState 调用合并为一次渲染
3. **错误边界**：捕获组件树中的错误，防止整个终端崩溃

### 12.2.2 JSX到终端字符的映射管线

Ink 的渲染管线可以概括为四步：

```
JSX Element → Fiber Tree → Virtual DOM (Yoga Layout) → ANSI Escape Codes
```

**第一步：JSX到Fiber树**

与React 18一致，Ink使用Fiber架构作为内部表示。每个JSX元素被转换为Fiber节点，形成一颗树结构。Fiber节点包含：

```typescript
interface FiberNode {
  type: string | Function;       // 组件类型
  props: Record<string, any>;    // 组件属性
  children: FiberNode[];         // 子节点
  layout: YogaNode | null;       // 布局节点
  output: string | null;         // 最终输出的ANSI字符串
}
```

**第二步：Yoga布局引擎**

这是Ink最核心的工程决策——引入Facebook的Yoga布局引擎（与React Native相同的布局系统）。Yoga实现了Flexbox布局规范，使得终端UI可以使用CSS Flexbox的思维来组织：

```
<Box flexDirection="column">
  <Box> ← 顶部状态栏（flexShrink: 0）
  <Box flexGrow={1}> ← 主内容区
  <Box> ← 底部输入区（flexShrink: 0）
</Box>
```

Yoga将Fiber树中的 `<Box>` 组件转换为二维布局树，计算每个节点的绝对位置（行号、列号、宽高）。这个计算过程考虑了：

- **Terminal尺寸感知**：通过 `process.stdout.columns` 和 `process.stdout.rows` 获取终端尺寸，动态调整布局
- **文本换行**：长文本自动折行，Yoga的文本测量模块会考虑CJK字符宽度
- **边距与内距**：`padding`、`margin` 映射到空格字符

**第三步：渲染为ANSI**

经过Yoga布局后，每个节点都有了精确的屏幕位置。Ink的渲染器遍历布局树，生成ANSI转义序列：

```typescript
// Ink 内部渲染函数（简化）
function renderNode(node: FiberNode): string {
  const { x, y, width, height } = node.layout.getComputedLayout();
  
  let output = '';
  // 移动光标到节点位置
  output += `\x1b[${y + 1};${x + 1}H`;
  // 设置样式
  if (node.props.color) output += wrapAnsi(node.props.color);
  if (node.props.bold) output += '\x1b[1m';
  if (node.props.dimColor) output += '\x1b[2m';
  // 输出文本内容
  output += truncate(node.props.children, width);
  // 重置样式
  output += '\x1b[0m';
  
  return output;
}
```

**第四步：Diff与增量更新**

Ink实现了完整的虚拟DOM diff算法。当组件状态变化时：

1. 生成新的Fiber树
2. 与旧树进行对比（O(n)的启发式算法）
3. 只将差异部分写入stdout（而不是清屏重绘）

这意味着Claude Code可以在AI流式输出token时，以极低的性能开销逐字符更新界面，而不会引起终端闪烁。

### 12.2.3 全屏渲染模式 vs 逐行渲染模式

Ink支持两种渲染策略：

- **全屏模式（Full-screen）**：接管整个终端，清除所有现有内容，完全由Ink控制。Claude Code的主交互界面使用此模式
- **逐行模式（Line-by-line）**：在现有终端输出下方追加内容，不清屏。`--print` 模式使用此策略

```typescript
// Claude Code 的渲染模式切换
if (options.print || options.outputFormat === 'text') {
  // 逐行模式：直接写入stdout
  const output = formatResponse(response);
  process.stdout.write(output + '\n');
} else {
  // 全屏模式：通过Ink管理
  root.render(<InteractiveUI />);
}
```

## 12.3 交互式组件体系

### 12.3.1 输入框组件（InputBox）

Claude Code的输入框远不止一个简单的 `readline` 调用。它是一个完整的富文本编辑器，支持：

**多行输入**：通过 `Shift+Enter` 换行，`Enter` 发送。这需要一个完整的行缓冲区管理器：

```typescript
// 输入框核心逻辑（简化）
function useInputBuffer() {
  const [buffer, setBuffer] = useState({ lines: [''], cursor: { row: 0, col: 0 } });
  
  useInput((input, key) => {
    if (key.return && !key.shift) {
      // 发送消息
      onSubmit(buffer.lines.join('\n'));
      return;
    }
    if (key.return && key.shift) {
      // 插入换行
      insertNewline(buffer, setBuffer);
      return;
    }
    // ... 处理方向键、退格、删除等
  });
  
  return buffer;
}
```

**输入历史**：上下箭头浏览历史命令，支持模糊搜索。

**自动补全提示**：`/` 命令补全、文件路径补全、@提及补全。

**粘贴处理**：处理终端粘贴事件的特殊字符序列（Bracketed Paste Mode）。

### 12.3.2 Markdown渲染器

Claude Code在终端中渲染Markdown格式，这是一个非同小可的工程挑战。终端不支持HTML标签，所有格式必须通过ANSI转义序列实现：

```typescript
// Markdown到ANSI的映射规则
const MARKDOWN_STYLES = {
  heading1:  { bold: true, underline: true },      // # → ANSI bold + underline
  heading2:  { bold: true },                        // ## → ANSI bold
  bold:      { bold: true },                        // **text** → ANSI bold
  italic:    { italic: true },                      // *text* → ANSI italic (not widely supported)
  code:      { bg: 'gray' },                        // `code` → 反色背景
  codeBlock: { bg: 'gray', dimColor: false },       // ``` → 灰色背景块
  link:      { underline: true, color: 'blue' },    // [text](url) → 下划线 + 蓝色
  list:      { indent: 2 },                         // - → 缩进 + 项目符号
};
```

Claude Code的Markdown渲染器实现了一个轻量级的AST解析器：

1. **词法分析**：将Markdown文本分割为token流（heading、bold、code、list等）
2. **语法分析**：构建嵌套的AST节点树
3. **渲染遍历**：将AST节点递归转换为ANSI格式化字符串

特别值得注意的是代码块的渲染——Claude Code根据语言标识符应用语法高亮：

```typescript
// 代码块语法高亮（简化）
function renderCodeBlock(code: string, language: string): string {
  try {
    // 使用轻量级语法高亮库（如 prism 对应的终端版）
    const highlighted = highlight(code, language);
    return highlighted; // 已包含ANSI颜色码
  } catch {
    // 不支持的语言，返回纯文本
    return wrapInBox(code); // 灰色背景框
  }
}
```

### 12.3.3 工具调用展示组件

当Claude执行工具调用时，终端UI需要实时展示工具的执行状态。Claude Code采用了"卡片式"设计：

```
┌─ 📁 Read File ──────────────────────────────┐
│ Path: /src/utils/auth.ts                     │
│ Status: ✅ Complete (23ms)                    │
│ Lines: 1-50                                  │
└──────────────────────────────────────────────┘
```

每个工具调用经历以下状态转换：

```
pending → running → complete | error | cancelled
```

这个状态机被封装为一个独立的React组件：

```typescript
interface ToolCallProps {
  toolName: string;
  input: Record<string, any>;
  status: 'pending' | 'running' | 'complete' | 'error';
  output?: string;
  duration?: number;
  isExpanded: boolean; // 用户是否展开查看详情
}
```

对于长时间运行的工具（如大型文件搜索），组件会显示实时进度：

```typescript
// 实时进度展示
function ToolCallProgress({ status, output }) {
  if (status === 'running') {
    // 显示spinner动画
    return <Spinner label={status} />;
  }
  // ... 其他状态
}
```

### 12.3.4 流式输出组件

AI的回复是流式到达的，这意味着UI需要处理"半成品"的Markdown——上一行可能是一个未闭合的代码块，下一个token到来时才闭合。

Claude Code的流式Markdown渲染器采用"增量解析"策略：

```typescript
// 流式Markdown渲染
function useStreamingMarkdown() {
  const [content, setContent] = useState('');
  const [rendered, setRendered] = useState('');
  
  useEffect(() => {
    // 每次新token到达时，增量解析
    const newRendered = incrementalParse(content);
    setRendered(newRendered);
  }, [content]);
  
  return { appendToken, rendered };
}
```

关键技术点：

1. **增量词法分析**：不需要每次从头解析整个文档，只解析新增的token
2. **容错处理**：未闭合的标记（如 `**bold without closing`）不会导致崩溃，而是当作纯文本显示
3. **光标定位**：渲染后光标需要正确定位，否则下一个token会出现在错误的位置

## 12.4 多Agent界面：状态多态的实现

### 12.4.1 expandedView：视图模式的三态切换

Claude Code支持多Agent协作模式，用户可以在不同的视图之间切换来查看不同层次的执行状态。`expandedView` 是控制这一行为的核心状态变量：

```typescript
type ExpandedView = 'teammates' | 'tasks' | 'none';

// 视图切换的UI逻辑
function useAgentView() {
  const [expandedView, setExpandedView] = useState<ExpandedView>('none');
  
  // 用户通过键盘快捷键切换视图
  useInput((input, key) => {
    if (key.tab) {
      // Tab键循环切换
      const views: ExpandedView[] = ['none', 'teammates', 'tasks'];
      const currentIndex = views.indexOf(expandedView);
      setExpandedView(views[(currentIndex + 1) % views.length]);
    }
  });
  
  return { expandedView, setExpandedView };
}
```

三种视图模式的设计意图：

- **`none`（默认）**：简洁模式，只显示当前Agent的对话流。适合单Agent场景
- **`teammates`**：展开队友面板，显示所有协作Agent的状态、进度和输出摘要。适合监控多Agent协作
- **`tasks`**：展开任务面板，显示所有Agent的任务队列、完成状态、阻塞关系。适合项目管理和问题排查

### 12.4.2 selectedIPAgentIndex：焦点管理

在多Agent视图中，用户可以在Agent之间切换焦点。`selectedIPAgentIndex` 记录当前选中的Agent索引：

```typescript
interface AgentViewState {
  expandedView: ExpandedView;
  selectedIPAgentIndex: number; // -1 表示未选中任何Agent
  agents: AgentInfo[];
}

interface AgentInfo {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'waiting' | 'complete';
  currentTask: string | null;
  outputPreview: string;       // 最近输出的预览
  unreadMessages: number;      // 未读消息计数
}
```

焦点切换的逻辑：

```typescript
function useAgentNavigation(state: AgentViewState) {
  useInput((input, key) => {
    if (state.expandedView === 'teammates') {
      if (key.upArrow) {
        // 上移焦点
        updateSelectedIndex(Math.max(0, state.selectedIPAgentIndex - 1));
      } else if (key.downArrow) {
        // 下移焦点
        updateSelectedIndex(Math.min(state.agents.length - 1, state.selectedIPAgentIndex + 1));
      } else if (key.return) {
        // Enter键：展开选中Agent的完整输出
        expandAgentDetail(state.agents[state.selectedIPAgentIndex]);
      }
    }
  });
}
```

### 12.4.3 多Agent状态同步

在多Agent协作场景中，状态同步是一个核心挑战。每个Agent的执行是异步的，但UI需要实时反映所有Agent的状态变化。Claude Code采用"事件驱动 + 状态聚合"的架构：

```typescript
// 事件总线
class AgentEventBus {
  private handlers: Map<string, Function[]> = new Map();
  
  on(event: string, handler: Function) { /* ... */ }
  emit(event: string, data: any) { /* ... */ }
}

// 状态聚合器
function useAgentStateAggregator(eventBus: AgentEventBus) {
  const [agents, setAgents] = useState<Map<string, AgentInfo>>(new Map());
  
  useEffect(() => {
    const unsubscribe = eventBus.on('agent:update', (update) => {
      setAgents(prev => {
        const next = new Map(prev);
        next.set(update.id, { ...next.get(update.id), ...update });
        return next;
      });
    });
    return unsubscribe;
  }, [eventBus]);
  
  return agents;
}
```

## 12.5 通知系统：优先级队列与异步展示

### 12.5.1 notifications.queue：优先级分级的通知队列

Claude Code的通知系统不是简单的 `console.log`，而是一个完整的优先级队列：

```typescript
interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message?: string;
  priority: number;        // 数字越大优先级越高
  duration?: number;       // 自动消失时间（毫秒）
  dismissible: boolean;    // 是否可手动关闭
  timestamp: number;
}

class NotificationQueue {
  private queue: Notification[] = [];
  
  enqueue(notification: Notification) {
    // 按优先级插入队列
    const index = this.queue.findIndex(n => n.priority < notification.priority);
    if (index === -1) {
      this.queue.push(notification);
    } else {
      this.queue.splice(index, 0, notification);
    }
  }
  
  dequeue(): Notification | undefined {
    return this.queue.shift();
  }
}
```

通知的显示位置和样式根据类型动态调整：

- **error**：红色，显示在顶部，带闪烁效果
- **warning**：黄色，显示在顶部
- **success**：绿色，短暂显示后自动消失
- **info**：蓝色/灰色，显示在底部状态栏

### 12.5.2 elicitation.queue：用户确认请求队列

Claude Code在需要用户确认操作时（如执行高风险命令、访问敏感文件），会将请求加入 `elicitation.queue`。与通知不同，elicitation是阻塞式的——Agent的执行会暂停，等待用户响应：

```typescript
interface Elicitation {
  id: string;
  type: 'confirm' | 'select' | 'input';
  title: string;
  description: string;
  options?: { label: string; value: string }[];
  required: boolean;          // 是否必须响应
  timeout?: number;           // 超时自动拒绝
}

class ElicitationQueue {
  private queue: Elicitation[] = [];
  private active: Elicitation | null = null;
  
  // 新的elicitation入队
  push(elicitation: Elicitation) {
    if (!this.active) {
      this.active = elicitation;
      this.presentToUser(elicitation);
    } else {
      this.queue.push(elicitation);
    }
  }
  
  // 用户响应后，处理下一个
  resolve(response: any) {
    this.emit('resolved', { id: this.active.id, response });
    this.active = this.queue.shift() || null;
    if (this.active) {
      this.presentToUser(this.active);
    }
  }
}
```

### 12.5.3 通知展示的视觉设计

通知的终端渲染需要在不中断主界面的前提下"弹出"。Claude Code使用了一种称为"浮层叠加"的技术：

```typescript
function NotificationOverlay({ notifications }: { notifications: Notification[] }) {
  return (
    <Box flexDirection="column" position="absolute" top={0} left={0}>
      {notifications.slice(0, 3).map(notif => (
        <NotificationCard key={notif.id} notification={notif} />
      ))}
    </Box>
  );
}
```

## 12.6 非交互式模式：Headless执行

### 12.6.1 runHeadless()：无UI执行路径

并非所有使用场景都需要交互式UI。CI/CD流水线、脚本自动化、API集成等场景需要"无头模式"——程序只处理输入，输出结果，不渲染任何UI。

```typescript
async function runHeadless(options: HeadlessOptions): Promise<void> {
  // 禁用所有UI渲染
  const root = createRoot({ stdout: new WritableStream(), stdin: new ReadableStream() });
  
  // 初始化Agent（无UI）
  const agent = createAgent({ ...options, headless: true });
  
  // 处理输入
  const prompt = options.prompt || await readStdin();
  const result = await agent.processPrompt(prompt);
  
  // 输出结果
  switch (options.outputFormat) {
    case 'text':
      process.stdout.write(result.text + '\n');
      break;
    case 'stream-json':
      // 逐事件输出JSON
      for await (const event of result.stream) {
        process.stdout.write(JSON.stringify(event) + '\n');
      }
      break;
    case 'json':
      // 完整JSON输出
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      break;
  }
}
```

### 12.6.2 三种输出格式的设计意图

`--output-format` 提供三种格式，面向不同的消费场景：

| 格式 | 用途 | 特点 |
|------|------|------|
| `text` | 人类阅读 | Markdown渲染后的纯文本 |
| `json` | 程序集成 | 完整结构化结果，包含所有元数据 |
| `stream-json` | 流式集成 | 逐事件输出，支持实时处理 |

`stream-json` 是最精巧的设计——它将Claude的完整执行过程编码为事件流：

```json
{"type":"init","session_id":"abc123","model":"claude-sonnet-4-20250514"}
{"type":"message_start","role":"assistant"}
{"type":"content_block_start","index":0,"type":"text"}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"让我"}}
{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"分析"}}
{"type":"tool_use_start","id":"tool_1","name":"ReadFile","input":{"path":"/src/main.ts"}}
{"type":"tool_use_result","id":"tool_1","output":"...file content..."}
{"type":"message_end","stop_reason":"end_turn"}
```

这种设计使得外部程序可以精确追踪Claude的每一步行为，而不需要解析自由格式的文本输出。

### 12.6.3 --print 模式：一次性执行

`--print` 是最简洁的非交互模式——执行一条指令，输出结果，退出：

```typescript
// --print 模式的执行路径
async function runPrintMode(prompt: string, options: PrintOptions) {
  // 创建一次性会话
  const session = await createSession({ ...options, ephemeral: true });
  
  // 执行指令
  const result = await session.send(prompt);
  
  // 输出并退出
  if (options.outputFormat === 'json') {
    process.stdout.write(JSON.stringify(result.toJSON()) + '\n');
  } else {
    process.stdout.write(result.text + '\n');
  }
  
  // 不保存会话，不显示UI
  await session.destroy();
  process.exit(result.success ? 0 : 1);
}
```

## 12.7 FPS指标：getFpsMetrics 与渲染性能监控

### 12.7.1 终端UI为什么需要FPS监控

在Web开发中，60FPS是流畅度的黄金标准。终端UI虽然没有GPU加速，但同样面临渲染性能问题：

- **重绘频率**：流式输出时，每个新token都可能触发重绘
- **全屏刷新**：Yoga布局计算 + ANSI序列生成的CPU开销
- **终端仿真器限制**：某些终端仿真器的渲染速度是瓶颈

Claude Code内置了 `getFpsMetrics()` 来监控渲染性能：

```typescript
interface FpsMetrics {
  currentFps: number;       // 当前帧率
  averageFps: number;       // 平均帧率
  minFps: number;           // 最低帧率
  maxFps: number;           // 最高帧率
  frameCount: number;       // 总帧数
  droppedFrames: number;    // 丢帧数
  renderTime: {             // 每帧渲染耗时分布
    p50: number;
    p95: number;
    p99: number;
  };
}
```

### 12.7.2 帧率优化策略

当FPS低于阈值时，Claude Code采用多层优化策略：

**第一层：批量更新（Batching）**

```typescript
// 将多个快速到达的token合并为一次渲染
const BATCH_WINDOW = 16; // ~60fps

function scheduleRender(updateFn: () => void) {
  if (!pendingRender) {
    pendingRender = requestAnimationFrame(() => {
      pendingRender = null;
      updateFn();
    });
  }
}
```

**第二层：虚拟滚动（Virtual Scrolling）**

当对话历史很长时，只渲染可见区域的内容：

```typescript
function VirtualizedMessageList({ messages, visibleRange }) {
  return (
    <Box flexDirection="column" height={terminalHeight - headerHeight - inputHeight}>
      {/* 只渲染可见区域 + 上下各1行的缓冲 */}
      {messages
        .slice(visibleRange.start - 1, visibleRange.end + 1)
        .map(msg => <MessageRow key={msg.id} message={msg} />)
      }
    </Box>
  );
}
```

**第三层：降级渲染**

当终端性能极差时，切换到低复杂度渲染模式——禁用动画、简化布局、减少颜色使用。

## 12.8 架构总结：终端UI的抽象层次

回顾Claude Code终端UI的完整架构，可以提炼出一个清晰的分层模型：

```
┌─────────────────────────────────────────┐
│  应用层：ClaudeApp / AgentView / ...    │  ← 业务逻辑
├─────────────────────────────────────────┤
│  组件层：InputBox / Markdown / ToolCard │  ← 可复用UI组件
├─────────────────────────────────────────┤
│  状态层：useAgentState / useNotifyQueue │  ← 状态管理Hooks
├─────────────────────────────────────────┤
│  框架层：Ink (React + Yoga)            │  ← 渲染引擎
├─────────────────────────────────────────┤
│  终端层：ANSI / PTY / stdout           │  ← 平台抽象
└─────────────────────────────────────────┘
```

每一层都通过明确定义的接口与上下层交互，这正是"多态与抽象"的核心精神——**选择正确的复杂性边界，让每一层只需要理解自己的职责**。

---

# 第13章 Prompt工程：在代码中编排智能

## 13.1 引言：Prompt作为代码

在大多数AI应用中，Prompt是一个写在配置文件或代码注释中的静态字符串。开发者通常不会把Prompt当作"代码"来对待——它没有类型检查、没有版本管理、没有复用机制。

Claude Code彻底改变了这种范式。在Claude Code的架构中，Prompt是一等公民（first-class citizen），它拥有与业务代码同等地位的工程基础设施：分层组装、缓存优化、动态压缩、结构化输出约束。这一章将深入剖析Claude Code的Prompt工程体系——这不是一本"如何写好Prompt"的教程，而是一份"如何在代码中构建Prompt系统"的工程指南。

## 13.2 System Prompt的分层架构

### 13.2.1 五层Prompt栈

Claude Code的System Prompt不是一整块文本，而是一个五层叠加的栈：

```
┌─────────────────────────────────────┐
│  Layer 5: Chrome Extension Prompt   │  ← 浏览器扩展特定指令
├─────────────────────────────────────┤
│  Layer 4: Plugin Prompts            │  ← MCP插件注入的指令
├─────────────────────────────────────┤
│  Layer 3: Agent System Prompt       │  ← 多Agent角色定义
├─────────────────────────────────────┤
│  Layer 2: --append-system-prompt     │  ← 用户自定义追加
├─────────────────────────────────────┤
│  Layer 1: Base System Prompt         │  ← 核心行为定义
└─────────────────────────────────────┘
```

每一层都有不同的职责和注入时机：

**Layer 1：Base System Prompt（基础层）**

这是Claude Code的核心身份定义——它告诉Claude"你是谁、你能做什么、你必须遵守什么规则"。基础Prompt包含：

- 身份声明（你是Claude Code，一个AI编程助手）
- 工具使用规范（如何正确调用每个工具）
- 安全约束（不能做什么、必须怎么做）
- 输出格式要求（Markdown、代码块等）

基础Prompt是硬编码在代码中的，不会因用户配置而变化。它是整个系统的"宪法"。

**Layer 2：--append-system-prompt（用户追加层）**

通过CLI参数 `--append-system-prompt "你的指令"`，用户可以在基础Prompt之上追加自定义指令。这层的设计意图是让团队/组织可以注入项目特定的规范：

```bash
# 团队统一规范
claude --append-system-prompt "所有代码必须遵循TypeScript strict模式，使用ESLint + Prettier"

# 项目特定指令
claude --append-system-prompt "这个项目使用GraphQL，不要使用REST API"
```

**Layer 3：Agent System Prompt（Agent层）**

在多Agent模式下，每个Agent有自己的角色定义。Agent Prompt定义了该Agent的专业领域、决策边界和协作规则：

```typescript
// Agent Prompt 组装
function buildAgentSystemPrompt(agentConfig: AgentConfig): string {
  return [
    `你是 ${agentConfig.name}，一个 ${agentConfig.specialty} 专家。`,
    `你的核心职责：${agentConfig.responsibilities.join('、')}。`,
    `你的决策边界：${agentConfig.constraints.join('、')}。`,
    `与其他Agent的协作规则：${agentConfig.collaborationRules}`,
  ].join('\n\n');
}
```

**Layer 4：Plugin Prompts（插件层）**

MCP插件可以通过协议注入自己的System Prompt片段。这使得插件可以定义自己的行为规范，而不需要修改Claude Code的核心代码：

```typescript
// 插件Prompt注入
interface McpPluginPrompt {
  pluginName: string;
  systemPrompt: string;   // 插件特定的行为指令
  toolDescriptions: string; // 插件工具的使用说明
}

// 组装时将所有插件Prompt合并
function assemblePluginPrompts(plugins: McpPlugin[]): string {
  return plugins
    .map(p => `[${p.name} 插件指令]\n${p.systemPrompt}`)
    .join('\n\n');
}
```

**Layer 5：Chrome Extension Prompt（浏览器层）**

当Claude Code作为浏览器扩展运行时，会注入额外的上下文——当前页面的DOM信息、用户选择的文本、浏览器API的使用约束等。这一层确保Claude在浏览器环境中不会误用不存在的API。

### 13.2.2 Prompt层叠的工程意义

这种分层设计的核心优势是**关注点分离（Separation of Concerns）**：

1. **可测试性**：每层Prompt可以独立测试其效果
2. **可配置性**：用户只修改Layer 2，不影响核心行为
3. **可扩展性**：新插件只需注入Layer 4，不需要改动其他层
4. **安全性**：Layer 1的约束不会被更高层覆盖（通过prompt注入防护）

## 13.3 Prompt Cache：Token成本的工程化控制

### 13.3.1 为什么Prompt需要缓存

在Claude Code的典型使用场景中，System Prompt可能长达数万token。每次对话都要将这个巨大的Prompt发送给API，不仅增加延迟，更重要的是**直接增加成本**——输入token是要计费的。

Anthropic的Prompt Cache功能允许缓存System Prompt，使得重复使用时只按缓存读取计费（约为正常价格的10%）。Claude Code将这一功能发挥到了极致。

### 13.3.2 systemPromptSectionCache：段落级缓存

Claude Code不是简单地将整个System Prompt作为一个缓存单元，而是实现了**段落级缓存**：

```typescript
// System Prompt段落缓存
const systemPromptSectionCache = new Map<string, {
  content: string;
  cacheKey: string;
  lastUsed: number;
  hitCount: number;
}>();
```

为什么需要段落级缓存？因为System Prompt的不同部分有不同的变化频率：

| 段落 | 变化频率 | 缓存策略 |
|------|---------|---------|
| 基础身份定义 | 从不变 | 永久缓存 |
| 工具描述 | 偶尔变化（插件加载/卸载） | 会话级缓存 |
| 项目规范 | 项目切换时变化 | 项目级缓存 |
| 动态上下文 | 每次对话都变 | 不缓存 |

```typescript
// 段落级缓存组装
function assembleCachedSystemPrompt(sections: PromptSection[]): SystemPromptMessage {
  const cachedSections = sections.map(section => {
    if (section.cacheable) {
      const cached = systemPromptSectionCache.get(section.id);
      if (cached && cached.content === section.content) {
        // 缓存命中
        return { ...section, cacheControl: { type: 'ephemeral' } };
      }
      // 更新缓存
      systemPromptSectionCache.set(section.id, {
        content: section.content,
        cacheKey: generateCacheKey(section.content),
        lastUsed: Date.now(),
        hitCount: 0,
      });
    }
    return section;
  });
  
  return { role: 'user', content: cachedSections, cache_control: { type: 'ephemeral' } };
}
```

### 13.3.3 promptCache1hAllowlist 与 promptCache1hEligible

Anthropic支持两种Prompt Cache时长：

- **短期缓存**（默认）：约5分钟
- **1小时缓存**（`promptCache1h`）：需要额外申请，适用于高频重复场景

Claude Code维护了两个配置：

```typescript
// 1小时缓存白名单：只有这些Prompt段落在白名单中才会使用1h缓存
const promptCache1hAllowlist = new Set<string>([
  'base-system-prompt',        // 基础身份定义
  'tool-definitions',          // 工具描述
  'claude-md-project',         // 项目级CLAUDE.md
]);

// 运行时判断某段落是否有资格使用1h缓存
function promptCache1hEligible(sectionId: string): boolean {
  return promptCache1hAllowlist.has(sectionId);
}
```

白名单设计体现了工程上的审慎态度：只有"几乎永远不变"的内容才使用1小时缓存，避免因内容变化导致的缓存不一致问题。

## 13.4 Thinking模式：让模型先思考再回答

### 13.4.1 三种Thinking模式

Claude Code支持三种Thinking配置：

```typescript
type ThinkingMode = 'adaptive' | 'enabled' | 'disabled';
```

- **`disabled`**：完全关闭Thinking。适合简单任务、快速问答
- **`enabled`**：始终启用Thinking。适合复杂任务、代码审查、架构设计
- **`adaptive`**（默认）：根据任务复杂度自动决定是否启用Thinking

### 13.4.2 adaptive模式的启发式规则

`adaptive` 模式的实现是一个精巧的启发式系统，它根据多个信号判断是否需要Thinking：

```typescript
function shouldEnableThinking(context: ConversationContext): boolean {
  // 信号1：对话轮次（前几轮通常不需要深度思考）
  if (context.turnCount < 3) return false;
  
  // 信号2：token预算（如果接近限制，不启用Thinking以节省token）
  if (context.remainingTokens < MIN_TOKENS_FOR_THINKING) return false;
  
  // 信号3：任务复杂度（基于Prompt长度、工具数量等启发式判断）
  const complexity = estimateComplexity(context.lastUserMessage, context.activeTools);
  if (complexity < COMPLEXITY_THRESHOLD) return false;
  
  // 信号4：历史成功率（如果之前的简单回答已经解决了问题，不需要Thinking）
  if (context.recentSuccessRate > 0.9) return false;
  
  return true;
}
```

### 13.4.3 maxThinkingTokens 与 MAX_THINKING_TOKENS

Thinking消耗的token需要精细控制。Claude Code提供了两层Token预算：

```typescript
// 用户可配置的最大Thinking Token数
const maxThinkingTokens: number | undefined; // 由--max-thinking-tokens参数设置

// 系统硬性上限
const MAX_THINKING_TOKENS = 32768; // 32K token上限
```

Token预算的分配逻辑：

```typescript
function resolveThinkingBudget(userConfig: number | undefined): number {
  if (userConfig !== undefined) {
    // 用户显式设置，尊重用户选择（但不超过硬上限）
    return Math.min(userConfig, MAX_THINKING_TOKENS);
  }
  
  // 默认值根据模型和任务动态确定
  const model = getCurrentModel();
  const contextWindow = model.contextWindow; // e.g., 200K
  
  // 默认使用上下文窗口的10%作为Thinking预算
  return Math.min(Math.floor(contextWindow * 0.1), MAX_THINKING_TOKENS);
}
```

这个设计体现了"合理默认值 + 用户覆盖"的工程哲学。

## 13.5 结构化输出：从自由文本到类型安全

### 13.5.1 --json-schema 参数

Claude Code支持通过 `--json-schema` 参数指定输出格式，强制Claude以JSON格式响应：

```bash
claude --json-schema '{"type":"object","properties":{"files":{"type":"array"}}}'
```

这在需要程序化消费Claude输出的场景中至关重要——它将"自然语言理解"的模糊性转变为"JSON解析"的确定性。

### 13.5.2 structured output Beta：内部的结构化输出

除了外部的 `--json-schema`，Claude Code内部也大量使用Anthropic的Structured Output Beta功能，确保工具调用的参数格式严格符合Schema定义：

```typescript
// 内部结构化输出配置
interface StructuredOutputConfig {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: JSONSchema7;
    strict: boolean;  // 严格模式：拒绝额外字段
  };
}

// 工具定义中的结构化输出约束
function defineToolWithSchema(name: string, schema: JSONSchema7) {
  return {
    name,
    input_schema: {
      type: 'object' as const,
      properties: schema.properties,
      required: schema.required,
    },
    // 启用严格模式，确保输出完全匹配Schema
  };
}
```

结构化输出的工程价值在于：**它将大语言模型的输出从"概率性文本生成"转变为"确定性数据结构"**。这使得下游代码可以用标准的方式处理Claude的响应，而不需要编写脆弱的正则表达式或自然语言解析器。

## 13.6 续写压缩：vH7模板

### 13.6.1 长上下文的成本问题

Claude Code支持超长会话——一个项目可能涉及数百轮对话、数千条工具调用。如果将完整的对话历史发送给Claude，会迅速耗尽上下文窗口，且token成本极高。

Claude Code使用"续写压缩"策略：在对话过长时，不是截断历史，而是将历史信息**压缩为结构化摘要**，然后让Claude基于摘要继续工作。

### 13.6.2 vH7模板：四段式压缩格式

vH7模板定义了压缩后的历史信息格式，包含四个核心段落：

```typescript
interface V7HTemplate {
  taskOverview: string;      // 任务概述：用户的核心需求是什么
  currentState: string;       // 当前状态：已经完成了什么、进行到哪一步
  importantFindings: string;  // 重要发现：过程中发现的关键信息
  nextSteps: string;          // 下一步：接下来应该做什么
}
```

模板的填充逻辑：

```typescript
async function compressConversation(history: Message[], tokenBudget: number): Promise<V7HTemplate> {
  // 使用Claude自身来压缩对话历史（"用AI压缩AI的输出"）
  const compressionPrompt = `请将以下对话历史压缩为四个段落：
1. 任务概述：用户的核心需求
2. 当前状态：已完成的工作和当前进度
3. 重要发现：过程中发现的关键信息（文件路径、配置值、错误信息等）
4. 下一步：接下来应该做什么

注意：保留所有具体的文件路径、错误信息、配置值等工程细节。

对话历史：
${history.map(m => `[${m.role}]: ${m.content}`).join('\n')}`;

  const compressed = await callClaude(compressionPrompt, {
    maxTokens: tokenBudget,
    responseFormat: 'json', // 确保输出为结构化JSON
  });
  
  return JSON.parse(compressed);
}
```

### 13.6.3 压缩的时机与策略

压缩不是在每次对话时都执行的，而是基于以下条件触发：

```typescript
function shouldCompress(context: ConversationContext): boolean {
  // 条件1：对话历史超过阈值
  if (context.historyTokenCount > COMPRESSION_THRESHOLD) return true;
  
  // 条件2：上下文窗口使用率超过80%
  if (context.contextWindowUsage > 0.8) return true;
  
  // 条件3：最近的工具调用结果过大（大文件内容等）
  if (context.lastToolOutputSize > LARGE_OUTPUT_THRESHOLD) return true;
  
  return false;
}
```

压缩的核心挑战是**信息保留率的平衡**——压缩太多会丢失关键上下文，压缩太少则无法节省token。vH7模板通过结构化字段来确保最关键的工程信息（文件路径、错误信息、配置值）被保留。

## 13.7 Prompt工程的架构启示

Claude Code的Prompt工程体系揭示了几个重要的架构原则：

1. **Prompt是代码**：它应该有与代码同等的工程标准——分层、测试、缓存、版本管理
2. **Token是成本**：每一次API调用都是真金白银，缓存和压缩不是优化，而是必需
3. **结构化优于自由文本**：无论是输入还是输出，结构化约束都带来确定性和可靠性
4. **分层组装**：将Prompt拆分为独立管理的段落，每段有自己的生命周期和缓存策略

---

# 第14章 可观测性：系统的神经系统

## 14.1 引言：为什么可观测性比功能更重要

一个功能完善的系统如果不可观测，就像一个没有仪表盘的飞机——你不知道它在飞向哪里，也不知道它是否即将坠毁。Claude Code作为一个复杂的AI编程助手，其内部运行状态极其复杂：流式API调用、工具执行链、Token消耗、缓存命中率、延迟分布……如果没有完善的可观测性体系，开发者将无法诊断问题、优化性能、追踪成本。

这一章将剖析Claude Code的可观测性架构——从底层的事件日志到上层的OpenTelemetry集成，从性能探针到错误体系，构建出一个完整的"系统神经系统"。

## 14.2 事件日志系统

### 14.2.1 d() 与 bj7()：同步与异步日志

Claude Code的日志系统使用混淆后的函数名（`d()` 和 `bj7()`），这是生产代码的常见做法——缩短函数名以减少bundle体积。

**d() - 同步日志**

```typescript
// d() 同步日志函数（还原后的逻辑）
function d(level: LogLevel, category: string, message: string, meta?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    category,
    message,
    meta,
    sessionId: getCurrentSessionId(),
  };
  
  // 写入内存缓冲区（批量异步落盘）
  logBuffer.push(entry);
  
  // 如果是错误级别，立即输出到stderr
  if (level >= LogLevel.ERROR) {
    process.stderr.write(formatLogEntry(entry) + '\n');
  }
}
```

**bj7() - 异步日志**

```typescript
// bj7() 异步日志函数
async function bj7(level: LogLevel, category: string, message: string, meta?: Record<string, any>) {
  const entry = await enrichLogEntry({ level, category, message, meta });
  await writeLogAsync(entry);
}
```

`bj7()` 与 `d()` 的区别在于：`bj7()` 会在写入日志前异步收集额外的上下文信息（如当前内存使用量、CPU负载等），适用于诊断性日志。

### 14.2.2 tengu_* 事件命名空间

Claude Code的遥测事件使用 `tengu_` 前缀命名，这是一个统一的命名空间约定：

```typescript
// 事件类型定义
const TenguEvents = {
  // 会话事件
  TENGU_SESSION_START: 'tengu_session_start',
  TENGU_SESSION_END: 'tengu_session_end',
  
  // Token事件
  TENGU_TOKEN_INPUT: 'tengu_token_input',
  TENGU_TOKEN_OUTPUT: 'tengu_token_output',
  
  // 代码事件
  TENGU_LOC_ADDED: 'tengu_loc_added',      // 新增代码行数
  TENGU_LOC_DELETED: 'tengu_loc_deleted',   // 删除代码行数
  TENGU_LOC_MODIFIED: 'tengu_loc_modified', // 修改代码行数
  
  // 提交事件
  TENGU_COMMIT: 'tengu_commit',
  
  // 成本事件
  TENGU_COST_API: 'tengu_cost_api',
  TENGU_COST_CACHE_HIT: 'tengu_cost_cache_hit',
} as const;
```

### 14.2.3 zx6 缓冲：日志的批量写入

高频事件如果逐条写入磁盘，会严重拖慢主流程。Claude Code使用 `zx6` 缓冲区实现批量写入：

```typescript
// zx6 日志缓冲区（还原后的逻辑）
class LogBuffer {
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timer;
  private maxBufferSize: number = 100;
  private maxFlushInterval: number = 5000; // 5秒
  
  constructor() {
    this.flushInterval = setInterval(() => this.flush(), this.maxFlushInterval);
  }
  
  push(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush(); // 缓冲区满，立即写入
    }
  }
  
  private flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    writeBatch(batch).catch(err => {
      // 写入失败不影响主流程
      process.stderr.write(`Log flush failed: ${err.message}\n`);
    });
  }
}
```

缓冲策略的设计考量：

- **容量触发**：100条日志立即写入，避免内存泄漏
- **时间触发**：5秒定时写入，确保日志不会在进程退出前丢失
- **异步写入**：`writeBatch` 返回Promise，不阻塞主线程
- **容错设计**：写入失败只输出到stderr，不抛出异常

## 14.3 OpenTelemetry集成

### 14.3.1 为什么选择OpenTelemetry

OpenTelemetry（OTel）是云原生计算基金会（CNCF）的可观测性标准，提供统一的Tracing、Metrics、Logging API。Claude Code选择OTel的原因：

1. **厂商中立**：不绑定任何特定的APM（Application Performance Monitoring）后端
2. **标准化**：统一的API使得可以轻松切换不同的监控后端（Datadog、Grafana、Jaeger等）
3. **生态丰富**：大量的Exporter和集成开箱即用
4. **轻量级**：SDK本身对性能的影响极小

### 14.3.2 meterProvider：指标采集

```typescript
// OpenTelemetry Meter 初始化（还原后的逻辑）
import { MeterProvider, ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 60000, // 每分钟导出一次
    }),
  ],
});

// 注册全局Meter
const meter = meterProvider.getMeter('claude-code');
```

Claude Code定义了以下核心Metrics：

| Meter名称 | 类型 | 描述 |
|-----------|------|------|
| `session` | Counter | 会话创建/结束计数 |
| `token` | Histogram | Token使用量分布 |
| `loc` | Counter | 代码行变更统计 |
| `pr` | Counter | Pull Request相关操作 |
| `commit` | Counter | Git提交次数 |
| `cost` | Gauge | API调用成本 |

```typescript
// 示例：Token使用量Histogram
const tokenHistogram = meter.createHistogram('claude_code_token_usage', {
  description: 'Token usage per API call',
  unit: 'tokens',
  boundaries: [100, 500, 1000, 5000, 10000, 50000, 100000],
});

// 记录一次API调用的Token使用
tokenHistogram.record(inputTokens + outputTokens, {
  model: 'claude-sonnet-4-20250514',
  cache_hit: wasCached,
});
```

### 14.3.3 tracerProvider：分布式追踪

```typescript
import { TracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

const tracerProvider = new TracerProvider({
  // 配置采样策略
});

tracerProvider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

const tracer = tracerProvider.getTracer('claude-code');
```

Claude Code的追踪覆盖了关键的执行路径：

```typescript
// 示例：API调用追踪
async function callAnthropicAPI(messages: Message[]) {
  const span = tracer.startSpan('anthropic_api.call', {
    attributes: {
      'model': messages[0].model,
      'message_count': messages.length,
      'total_tokens_estimate': estimateTokens(messages),
    },
  });
  
  try {
    const response = await anthropic.messages.create({
      model: messages[0].model,
      messages,
    });
    span.setAttributes({
      'response.status': response.stop_reason,
      'response.input_tokens': response.usage.input_tokens,
      'response.output_tokens': response.usage.output_tokens,
    });
    return response;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

## 14.4 性能探针：profileCheckpoint 与时间戳

### 14.4.1 profileCheckpoint：分段计时

Claude Code使用 `profileCheckpoint` 机制来精确测量各个执行阶段的耗时：

```typescript
// 性能探针系统（还原后的逻辑）
class PerformanceProfiler {
  private checkpoints: Map<string, number> = new Map();
  
  // 设置检查点
  checkpoint(name: string): void {
    this.checkpoints.set(name, performance.now());
  }
  
  // 计算两个检查点之间的耗时
  elapsed(startName: string, endName: string): number {
    const start = this.checkpoints.get(startName);
    const end = this.checkpoints.get(endName);
    if (start === undefined || end === undefined) return -1;
    return end - start;
  }
  
  // 获取所有检查点的耗时报告
  report(): PerformanceReport {
    const entries = Array.from(this.checkpoints.entries());
    const checkpoints = entries.map(([name, time], i) => ({
      name,
      time,
      elapsed: i > 0 ? time - entries[i - 1][1] : 0,
    }));
    return { checkpoints, totalTime: checkpoints[checkpoints.length - 1]?.time - checkpoints[0]?.time };
  }
}
```

Claude Code在关键路径上设置了多个检查点：

```
[startup] → [config_load] → [prompt_assemble] → [api_call_start] → [api_call_end] → [response_parse] → [render_start] → [render_end]
```

### 14.4.2 U4()：时间戳宏

`U4()` 是一个轻量级的时间戳获取函数，在源码中以混淆名称出现。它的功能简单但关键——提供纳秒级精度的执行时间测量：

```typescript
// U4() 时间戳宏（还原后的逻辑）
function U4(): number {
  return performance.now(); // 毫秒精度
}

// 使用示例：测量函数执行时间
const t0 = U4();
await expensiveOperation();
const duration = U4() - t0;
if (duration > SLOW_THRESHOLD) {
  slowOperations.push({ name: 'expensiveOperation', duration });
}
```

### 14.4.3 slowOperations：慢操作追踪

Claude Code维护了一个慢操作列表，用于识别性能瓶颈：

```typescript
interface SlowOperation {
  name: string;
  duration: number;
  timestamp: number;
  context?: Record<string, any>;
}

const slowOperations: SlowOperation[] = [];

function recordSlowOperation(name: string, duration: number, context?: Record<string, any>) {
  if (duration > SLOW_OPERATION_THRESHOLD) {
    slowOperations.push({ name, duration, timestamp: Date.now(), context });
    // 发出告警
    d(LogLevel.WARN, 'performance', `Slow operation: ${name} took ${duration.toFixed(2)}ms`, context);
  }
}
```

慢操作追踪的价值不仅在于诊断，更在于**数据驱动的性能优化决策**——通过收集慢操作的统计数据，可以精确地知道哪些函数最需要优化。

## 14.5 错误体系：分层与分类

### 14.5.1 O4(AnthropicError)：错误基类

Claude Code的错误体系以 `O4()`（混淆后的AnthropicError构造函数）为基类，构建了一个分层错误体系：

```typescript
// 错误体系（还原后的逻辑）
class AnthropicError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

// API错误：API返回了非200状态码
class APIError extends AnthropicError {
  constructor(
    message: string,
    public status: number,
    public code: string | null,
    public param: string | null,
  ) {
    super(message, status);
    this.name = 'APIError';
  }
}

// 连接错误：网络层故障
class APIConnectionError extends AnthropicError {
  constructor(message: string, public cause: Error) {
    super(message);
    this.name = 'APIConnectionError';
  }
}

// 超时错误：请求在规定时间内未完成
class APITimeoutError extends AnthropicError {
  constructor(message: string, public timeout: number) {
    super(message);
    this.name = 'APITimeoutError';
  }
}
```

### 14.5.2 错误处理的策略模式

Claude Code对不同类型的错误采用不同的恢复策略：

```typescript
async function handleError(error: unknown): Promise<RecoveryAction> {
  if (error instanceof APITimeoutError) {
    // 超时：指数退避重试
    return { action: 'retry', delay: calculateBackoff(error.timeout) };
  }
  
  if (error instanceof APIConnectionError) {
    // 连接失败：检查网络，建议用户检查代理设置
    return { action: 'notify', message: '网络连接失败，请检查网络设置' };
  }
  
  if (error instanceof APIError) {
    switch (error.status) {
      case 429: // Rate limit
        return { action: 'retry', delay: parseRetryAfter(error.headers) };
      case 500: // Server error
        return { action: 'retry', delay: 5000 };
      case 401: // Unauthorized
        return { action: 'reauth' };
      default:
        return { action: 'abort', message: `API错误: ${error.message}` };
    }
  }
  
  // 未知错误
  return { action: 'abort', message: '未知错误' };
}
```

### 14.5.3 H6()：错误格式化

`H6()` 是错误信息的格式化函数，将复杂的错误对象转换为用户友好的文本：

```typescript
// H6() 错误格式化（还原后的逻辑）
function H6(error: unknown): string {
  if (error instanceof AnthropicError) {
    return [
      `❌ ${error.name}`,
      `   ${error.message}`,
      error.statusCode ? `   Status: ${error.statusCode}` : null,
    ].filter(Boolean).join('\n');
  }
  
  if (error instanceof Error) {
    return `❌ Error: ${error.message}`;
  }
  
  return `❌ Unknown error: ${String(error)}`;
}
```

### 14.5.4 inMemoryErrorLog：内存错误日志

Claude Code维护了一个最多100条记录的内存错误日志，用于诊断和问题报告：

```typescript
// 内存错误日志（还原后的逻辑）
const MAX_ERROR_LOG_SIZE = 100;
const inMemoryErrorLog: ErrorEntry[] = [];

function logError(error: Error, context?: Record<string, any>) {
  const entry: ErrorEntry = {
    timestamp: Date.now(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  };
  
  inMemoryErrorLog.push(entry);
  
  // 超过100条时，移除最旧的记录
  if (inMemoryErrorLog.length > MAX_ERROR_LOG_SIZE) {
    inMemoryErrorLog.shift();
  }
}
```

100条上限是一个权衡——足够记录一次会话中的所有关键错误，又不会造成内存泄漏。

## 14.6 可观测性的分层架构

Claude Code的可观测性体系可以总结为四个层次：

```
┌──────────────────────────────────────────┐
│  业务层：tengu_* 事件（会话/Token/成本）  │  ← 面向产品指标
├──────────────────────────────────────────┤
│  追踪层：OpenTelemetry Traces            │  ← 面向请求链路
├──────────────────────────────────────────┤
│  诊断层：d()/bj7() 日志 + 性能探针        │  ← 面向问题诊断
├──────────────────────────────────────────┤
│  基础层：错误体系 + 慢操作追踪             │  ← 面向系统稳定
└──────────────────────────────────────────┘
```

每一层服务于不同的受众和目的，但它们共享同一个基础设施——时间戳、会话ID、统一的日志格式。

---

# 第15章 会话持久化：跨越时间的对话