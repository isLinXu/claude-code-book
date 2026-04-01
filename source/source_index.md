# 🔍 源码剖析：Claude Code v2.1.88

> **对 Anthropic 官方 Agent 编程工具的完整逆向分析与架构解读。**
>
> 基于 `@anthropic-ai/claude-code` v2.1.88 发布包产物（12MB 单文件 Bundle + 2720 行类型定义），通过逆向工程还原其内部架构、工具协议、安全模型和工程实践。

---

## 项目概览

| 指标 | 数值 |
|------|------|
| 版本 | 2.1.88 |
| 核心文件 | `cli.js`（12MB, 16,668 行编译后代码） |
| 类型定义 | `sdk-tools.d.ts`（2,720 行, 20+ 工具协议） |
| 运行时 | Node.js >= 18, ES Modules |
| 构建工具 | Bun + esbuild Bundle |
| 内嵌二进制 | ripgrep（跨 6 平台）、audio-capture |

---

## 文档导航

### 🏗️ 架构分析

| 文档 | 内容 |
|------|------|
| [框架架构深度拆解](./architecture) | 五层分层架构、Agentic Loop 核心循环、消息流、全局状态管理 |
| [深度拆解报告](./deep-analysis) | 工具系统拆解、安全模型分析、性能设计、可扩展点 |
| [项目概述](./overview) | 项目结构、核心组件、架构总览、依赖关系 |

### 🔧 工具系统

| 文档 | 内容 |
|------|------|
| [工具系统总览](./tool-system) | 工具注册、类型协议、执行管线 |
| [内置工具详解](./builtin-tools) | FileRead/FileEdit/FileWrite/Bash/Grep/Glob/WebSearch/WebFetch 等 |
| [权限管理系统](./permission) | Schema 层 / 会话模式 / 沙箱三层安全防御 |
| [自定义工具开发](./custom-tools) | 工具开发规范、MCP 工具扩展 |

### 🔌 MCP 集成

| 文档 | 内容 |
|------|------|
| [MCP 协议概述](./mcp-overview) | Model Context Protocol 架构、资源与工具模型 |
| [MCP 服务器配置](./mcp-config) | stdio / SSE 服务器配置、多作用域管理 |
| [MCP 认证与安全](./mcp-auth) | OAuth 2.0 PKCE 流程、Token 管理 |
| [MCP 故障排除](./mcp-troubleshooting) | 常见问题诊断、日志分析 |

### ⚙️ 配置管理

| 文档 | 内容 |
|------|------|
| [配置管理总览](./config-management) | 多层配置优先级链、CLAUDE.md 规范 |
| [用户配置](./user-config) | 用户级配置项详解 |
| [项目配置](./project-config) | 项目级 .claude/settings.json |
| [环境变量](./env-vars) | 完整环境变量参考 |

### 📖 使用指南

| 文档 | 内容 |
|------|------|
| [快速开始](./quickstart) | 安装、认证、首次使用 |
| [开发者指南](./developer-guide) | SDK 集成、编程接口、最佳实践 |
| [会话管理](./session) | 会话生命周期、持久化、恢复、远程会话 |
| [CLI 命令参考](./cli-reference) | 完整命令行参数列表 |
| [故障排除](./troubleshooting) | 常见问题与解决方案 |

### 🔬 API 参考

| 文档 | 内容 |
|------|------|
| [核心接口](./core-api) | Message / Tool / Session 核心类型定义 |
| [配置 API](./config-api) | 配置读写接口 |

---

## 为什么剖析 Claude Code？

Claude Code 是目前最成熟的 Agent 编码工具之一。通过剖析它的架构，可以学到：

1. **真实的 Agentic Loop 实现** — 不是教科书上的流程图，而是 16,668 行代码中的实际工程
2. **工具系统设计** — 20+ 工具如何通过统一类型协议（`sdk-tools.d.ts`）注册和调用
3. **安全三层防御** — Schema 约束 → 会话模式 → 执行沙箱的生产级安全模型
4. **MCP 可扩展性** — 如何通过协议而非修改源码来扩展 Agent 能力
5. **性能工程** — 大输出落盘、流式处理、Token 预算控制等实战技巧

> 💡 **建议搭配阅读**：[编程思想篇](/think/think_index) 从设计哲学角度解读相同的架构，本栏目则从源码实现角度提供技术细节。
