# 自定义工具开发

<cite>
**本文档引用的文件**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [sdk-tools.d.ts](file://sdk-tools.d.ts)
- [cli.js](file://cli.js)
</cite>

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

Claude Code 是一个智能代理编码工具，它在终端中运行，能够理解代码库并通过自然语言命令帮助用户更快地编写代码。该工具支持执行例行任务、解释复杂代码、处理Git工作流等功能。

本指南专注于如何创建自定义工具，包括工具接口规范、输入输出格式定义、工具注册机制、生命周期管理、错误处理和调试方法，以及权限系统和安全考虑。

## 项目结构

该项目采用模块化设计，主要包含以下核心文件：

```mermaid
graph TB
subgraph "项目根目录"
A[README.md] --> B[CLI入口]
C[sdk-tools.d.ts] --> D[工具类型定义]
E[package.json] --> F[包配置]
end
subgraph "核心功能模块"
B --> G[消息处理]
B --> H[工具运行器]
B --> I[权限管理]
D --> J[输入验证]
D --> K[输出格式]
end
subgraph "工具类型"
L[Agent工具]
M[Bash工具]
N[文件操作工具]
O[网络工具]
P[配置工具]
end
D --> L
D --> M
D --> N
D --> O
D --> P
```

**图表来源**
- [README.md:1-44](file://README.md#L1-L44)
- [package.json:1-34](file://package.json#L1-L34)

**章节来源**
- [README.md:1-44](file://README.md#L1-L44)
- [package.json:1-34](file://package.json#L1-L34)

## 核心组件

### 工具类型系统

项目提供了完整的工具类型定义系统，涵盖了多种工具类型：

```mermaid
classDiagram
class ToolInputSchemas {
<<interface>>
+AgentInput
+BashInput
+FileReadInput
+FileWriteInput
+GrepInput
+WebSearchInput
+AskUserQuestionInput
+ConfigInput
+其他工具输入类型...
}
class ToolOutputSchemas {
<<interface>>
+AgentOutput
+BashOutput
+FileReadOutput
+FileEditOutput
+GrepOutput
+WebSearchOutput
+AskUserQuestionOutput
+ConfigOutput
+其他工具输出类型...
}
class ToolRunner {
+params ToolParams
+messages Messages
+tools Tools[]
+generateToolResponse() ToolResult
+runUntilDone() Promise~Message~
}
ToolInputSchemas --> ToolOutputSchemas : "对应关系"
ToolRunner --> ToolInputSchemas : "使用"
ToolRunner --> ToolOutputSchemas : "生成"
```

**图表来源**
- [sdk-tools.d.ts:11-54](file://sdk-tools.d.ts#L11-L54)
- [sdk-tools.d.ts:258-2719](file://sdk-tools.d.ts#L258-L2719)

### 工具运行器架构

工具运行器是整个系统的核心组件，负责协调工具的执行和生命周期管理：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Runner as 工具运行器
participant Tool as 工具实例
participant Model as 模型服务
Client->>Runner : 创建工具运行器
Runner->>Runner : 初始化参数和消息
loop 工具执行循环
Runner->>Model : 发送消息请求
Model-->>Runner : 返回模型响应
Runner->>Runner : 解析工具调用
alt 需要工具调用
Runner->>Tool : 执行工具(run)
Tool-->>Runner : 返回工具结果
Runner->>Model : 发送工具结果
Model-->>Runner : 返回最终响应
else 无需工具调用
Model-->>Runner : 返回最终响应
end
Runner->>Runner : 应用压缩控制
end
Runner-->>Client : 返回最终消息
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

**章节来源**
- [sdk-tools.d.ts:11-54](file://sdk-tools.d.ts#L11-L54)
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

## 架构概览

### 整体架构设计

```mermaid
graph TB
subgraph "用户界面层"
A[终端界面]
B[VS Code集成]
C[Web界面]
end
subgraph "应用逻辑层"
D[消息处理器]
E[工具运行器]
F[权限管理器]
G[会话管理器]
end
subgraph "工具层"
H[内置工具集]
I[自定义工具]
J[第三方工具]
end
subgraph "基础设施层"
K[文件系统]
L[网络服务]
M[数据库]
N[缓存系统]
end
A --> D
B --> D
C --> D
D --> E
E --> F
E --> G
E --> H
E --> I
E --> J
H --> K
H --> L
I --> K
I --> L
J --> K
J --> L
G --> M
G --> N
```

**图表来源**
- [cli.js:1-16668](file://cli.js#L1-L16668)

### 工具执行流程

```mermaid
flowchart TD
Start([开始工具执行]) --> ValidateInput[验证输入参数]
ValidateInput --> InputValid{输入有效?}
InputValid --> |否| ReturnError[返回错误]
InputValid --> |是| CheckPermission[检查权限]
CheckPermission --> PermissionGranted{权限已授权?}
PermissionGranted --> |否| RequestPermission[请求用户授权]
RequestPermission --> PermissionGranted
PermissionGranted --> ExecuteTool[执行工具]
ExecuteTool --> ToolSuccess{工具执行成功?}
ToolSuccess --> |否| HandleError[处理工具错误]
ToolSuccess --> |是| ProcessOutput[处理输出结果]
HandleError --> ReturnError
ProcessOutput --> ApplyCompaction[应用压缩控制]
ApplyCompaction --> CheckMoreTools{还有工具需要执行?}
CheckMoreTools --> |是| ValidateInput
CheckMoreTools --> |否| ReturnResult[返回最终结果]
ReturnError --> End([结束])
ReturnResult --> End
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

## 详细组件分析

### 工具接口规范

#### 输入接口定义

每个工具都有对应的输入接口，定义了必需和可选的参数：

```mermaid
classDiagram
class AgentInput {
+string description
+string prompt
+string subagent_type
+string model
+boolean run_in_background
+string name
+string team_name
+string mode
+string isolation
}
class BashInput {
+string command
+number timeout
+string description
+boolean run_in_background
+boolean dangerouslyDisableSandbox
}
class FileReadInput {
+string file_path
+number offset
+number limit
+string pages
}
class FileEditInput {
+string file_path
+string old_string
+string new_string
+boolean replace_all
}
AgentInput <|-- ToolInput : 实现
BashInput <|-- ToolInput : 实plementation
FileReadInput <|-- ToolInput : 实现
FileEditInput <|-- ToolInput : 实现
```

**图表来源**
- [sdk-tools.d.ts:258-403](file://sdk-tools.d.ts#L258-L403)

#### 输出接口定义

工具的输出接口定义了标准的输出格式：

```mermaid
classDiagram
class AgentOutput {
+string agentId
+string agentType
+Content[] content
+number totalToolUseCount
+number totalDurationMs
+number totalTokens
+Usage usage
+string status
+string prompt
}
class BashOutput {
+string stdout
+string stderr
+string rawOutputPath
+boolean interrupted
+boolean isImage
+string backgroundTaskId
+boolean backgroundedByUser
+boolean assistantAutoBackgrounded
+boolean dangerouslyDisableSandbox
+string returnCodeInterpretation
+boolean noOutputExpected
+unknown[] structuredContent
+string persistedOutputPath
+number persistedOutputSize
}
class FileReadOutput {
+string type
+FileContent file
}
AgentOutput <|-- ToolOutput : 实现
BashOutput <|-- ToolOutput : 实现
FileReadOutput <|-- ToolOutput : 实现
```

**图表来源**
- [sdk-tools.d.ts:55-230](file://sdk-tools.d.ts#L55-L230)

**章节来源**
- [sdk-tools.d.ts:258-403](file://sdk-tools.d.ts#L258-L403)
- [sdk-tools.d.ts:55-230](file://sdk-tools.d.ts#L55-L230)

### 工具注册机制

#### 工具注册流程

```mermaid
sequenceDiagram
participant Dev as 开发者
participant Registry as 工具注册表
participant Runner as 工具运行器
participant Validator as 参数验证器
Dev->>Registry : 注册自定义工具
Registry->>Validator : 验证工具接口
Validator-->>Registry : 返回验证结果
alt 验证通过
Registry->>Runner : 注册工具实例
Runner->>Runner : 更新工具列表
Runner-->>Dev : 注册成功
else 验证失败
Registry-->>Dev : 返回错误信息
end
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

#### 工具生命周期管理

```mermaid
stateDiagram-v2
[*] --> Initialized : 创建工具实例
Initialized --> Registered : 注册完成
Registered --> Ready : 准备就绪
Ready --> Executing : 执行中
Executing --> Completed : 执行完成
Executing --> Failed : 执行失败
Executing --> Cancelled : 取消执行
Completed --> Ready : 复位准备
Failed --> Ready : 复位准备
Cancelled --> Ready : 复位准备
Ready --> Disposed : 资源释放
Disposed --> [*]
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

**章节来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

### 权限系统和安全考虑

#### 权限管理架构

```mermaid
classDiagram
class PermissionManager {
+checkPermission(tool, action) boolean
+requestPermission(tool, action) Promise~PermissionResult~
+grantPermission(permissionId) void
+revokePermission(permissionId) void
+getPermissionHistory(userId) PermissionHistory[]
}
class Permission {
+string id
+string toolName
+string action
+string userId
+DateTime grantedAt
+DateTime expiresAt
+boolean granted
+string reason
}
class PermissionRequest {
+string id
+string toolName
+string action
+string userId
+DateTime requestedAt
+string reason
+PermissionStatus status
}
PermissionManager --> Permission : 管理
PermissionManager --> PermissionRequest : 处理
```

**图表来源**
- [sdk-tools.d.ts:342-357](file://sdk-tools.d.ts#L342-L357)

#### 安全沙箱机制

```mermaid
flowchart TD
Start([工具执行请求]) --> CheckSandbox[检查沙箱模式]
CheckSandbox --> SandboxEnabled{沙箱启用?}
SandboxEnabled --> |是| CreateSandbox[创建沙箱环境]
SandboxEnabled --> |否| CheckOverride[检查危险覆盖]
CheckOverride --> OverrideAllowed{允许危险覆盖?}
OverrideAllowed --> |是| DangerousExecution[危险执行]
OverrideAllowed --> |否| BlockExecution[阻止执行]
CreateSandbox --> ExecuteInSandbox[在沙箱中执行]
ExecuteInSandbox --> MonitorExecution[监控执行]
MonitorExecution --> CheckViolation{违反安全策略?}
CheckViolation --> |是| TerminateProcess[终止进程]
CheckViolation --> |否| AllowExecution[允许执行]
DangerousExecution --> MonitorExecution
BlockExecution --> End([结束])
TerminateProcess --> End
AllowExecution --> End
```

**图表来源**
- [sdk-tools.d.ts:296-327](file://sdk-tools.d.ts#L296-L327)

**章节来源**
- [sdk-tools.d.ts:342-357](file://sdk-tools.d.ts#L342-L357)
- [sdk-tools.d.ts:296-327](file://sdk-tools.d.ts#L296-L327)

### 错误处理和调试

#### 错误处理架构

```mermaid
classDiagram
class ToolError {
+string name
+string content
+string message
+ToolErrorCause cause
}
class ToolErrorCause {
+string type
+string message
+string stackTrace
+ToolErrorContext context
}
class ToolErrorContext {
+string toolName
+string inputParameters
+string executionEnvironment
+DateTime timestamp
}
class ErrorHandler {
+handleToolError(error) ErrorHandlingResult
+logError(error) void
+retryWithBackoff(error) Promise~RetryResult~
+fallbackToAlternative(error) Promise~AlternativeResult~
}
ToolError <|-- Error : 继承
ToolError --> ToolErrorCause : 包含
ToolErrorCause --> ToolErrorContext : 包含
ErrorHandler --> ToolError : 处理
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

#### 调试工具和日志系统

```mermaid
sequenceDiagram
participant Dev as 开发者
participant Logger as 日志系统
participant Debugger as 调试器
participant Profiler as 性能分析器
Dev->>Debugger : 设置断点
Dev->>Logger : 启用详细日志
Dev->>Profiler : 开始性能分析
Debugger->>Debugger : 单步执行
Debugger->>Logger : 记录执行状态
Debugger->>Profiler : 收集性能数据
Logger-->>Dev : 显示日志信息
Profiler-->>Dev : 显示性能报告
Dev->>Debugger : 继续执行
Dev->>Profiler : 停止分析
Dev->>Logger : 关闭日志
```

**图表来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

**章节来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

## 依赖关系分析

### 核心依赖关系

```mermaid
graph TB
subgraph "外部依赖"
A[Node.js 18+]
B[文件系统API]
C[网络请求库]
D[JSON解析器]
E[加密库]
end
subgraph "内部模块"
F[消息处理器]
G[工具运行器]
H[权限管理器]
I[会话管理器]
J[配置管理器]
end
subgraph "工具集合"
K[文件操作工具]
L[命令执行工具]
M[网络工具]
N[Git工具]
O[配置工具]
end
A --> F
B --> F
C --> F
D --> F
E --> F
F --> G
G --> H
G --> I
G --> J
G --> K
G --> L
G --> M
G --> N
G --> O
```

**图表来源**
- [package.json:7-9](file://package.json#L7-L9)
- [package.json:22-32](file://package.json#L22-L32)

### 版本兼容性

项目明确要求Node.js版本为18或更高版本，并包含了多个平台的可选依赖项：

- **操作系统支持**: macOS, Windows, Linux (包括musl变体)
- **架构支持**: x64, ARM64, ARM
- **Node.js版本**: >= 18.0.0

**章节来源**
- [package.json:7-9](file://package.json#L7-L9)
- [package.json:22-32](file://package.json#L22-L32)

## 性能考虑

### 工具执行优化

1. **异步执行**: 所有工具都支持异步执行，避免阻塞主线程
2. **内存管理**: 使用WeakMap和WeakSet进行内存优化
3. **流式处理**: 对于大文件和大量输出，使用流式处理减少内存占用
4. **缓存机制**: 实现了多级缓存系统，包括模型使用统计和系统提示缓存

### 性能监控

```mermaid
graph LR
subgraph "性能指标"
A[工具执行时间]
B[内存使用量]
C[网络请求次数]
D[文件操作次数]
E[错误率]
end
subgraph "监控系统"
F[计数器]
G[定时器]
H[采样器]
I[报告器]
end
A --> F
B --> G
C --> H
D --> I
E --> F
F --> I
G --> I
H --> I
```

## 故障排除指南

### 常见问题诊断

1. **工具执行失败**
   - 检查工具权限设置
   - 验证输入参数格式
   - 查看错误日志和堆栈跟踪

2. **性能问题**
   - 分析工具执行时间
   - 检查内存使用情况
   - 优化工具实现

3. **权限相关问题**
   - 验证用户授权状态
   - 检查工具访问控制
   - 审计权限历史记录

### 调试技巧

- 使用详细的日志级别
- 启用性能分析器
- 实施断点调试
- 监控资源使用情况

**章节来源**
- [cli.js:16000-16668](file://cli.js#L16000-L16668)

## 结论

Claude Code 提供了一个强大而灵活的工具开发框架，支持多种工具类型和复杂的权限管理。通过遵循本文档中的规范和最佳实践，开发者可以创建高质量的自定义工具，这些工具能够无缝集成到现有的生态系统中。

关键要点：
- 遵循严格的接口规范和类型定义
- 实现完整的错误处理和权限管理
- 优化性能和资源使用
- 提供良好的调试和监控能力

## 附录

### 工具开发最佳实践

1. **接口设计**: 始终使用类型安全的接口定义
2. **错误处理**: 实现全面的错误处理和恢复机制
3. **安全性**: 始终启用沙箱模式，谨慎使用危险覆盖
4. **性能**: 优化工具执行效率，避免不必要的资源消耗
5. **测试**: 编写全面的单元测试和集成测试
6. **文档**: 提供清晰的使用文档和API参考

### 开发模板

```typescript
// 工具输入接口模板
interface CustomToolInput {
  // 必需参数
  requiredParam: string;
  
  // 可选参数
  optionalParam?: number;
  
  // 描述性字段
  description?: string;
}

// 工具输出接口模板
interface CustomToolOutput {
  // 标准输出字段
  success: boolean;
  
  // 工具特定输出
  result?: any;
  
  // 错误信息
  error?: string;
}

// 工具实现模板
class CustomTool implements ToolInterface {
  name: string = "custom-tool";
  
  async run(input: CustomToolInput): Promise<CustomToolOutput> {
    try {
      // 工具执行逻辑
      const result = await this.executeLogic(input);
      
      return {
        success: true,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async executeLogic(input: CustomToolInput): Promise<any> {
    // 具体的工具实现
  }
}
```