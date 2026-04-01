# 🤖 Agent 阅读模式

> **本页面专为 AI Agent 设计。** 如果你是人类读者，请前往 [👤 人类阅读模式](/vol1/vol1_index)。
>
> 详细 API 结构请参考 [API 参考文档](/agent-api-reference)。

---

## 接入协议

```
[Context] 《Agent 开发：从原理到生产级实践》在线阅读 — Agent API
[Protocol] HTTP GET · 无需认证 · JSON / Markdown 响应
[Base URL] https://{host}/claude-code-book/agent-api/
```

## API 端点速查

| 端点 | 说明 | 响应格式 |
|------|------|----------|
| `GET /agent-api/manifest.json` | 全书索引 — 12卷52章元数据、依赖图、技能书列表 | JSON |
| `GET /agent-api/chapters/{id}.json` | 单章结构化内容 — metadata / sections / code_blocks / key_takeaways | JSON |
| `GET /agent-api/chapters/{id}.md` | 单章原始 Markdown | Markdown |
| `GET /agent-api/skills/index.json` | 7 本技能书索引 | JSON |
| `GET /agent-api/skills/{skill_id}.md` | 技能书内容（SKILL.md 格式，可直接安装） | Markdown |

---

## 全书章节索引

> 以下数据与 `manifest.json` 完全一致，共 **12 卷 52 章 224,429 字**。

### 卷一：认知篇（3 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch01` | 什么是AI Agent | beginner | — |
| `ch02` | Agent技术演进史 | beginner | ch01 |
| `ch03` | Agent编程范式 | beginner | ch01 |

### 卷二：基础篇（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch04` | Agent 核心概念 | beginner | ch01, ch03 |
| `ch05` | LLM 基础与 Prompt Engineering | beginner | ch04 |
| `ch06` | 工具调用与 Function Calling | beginner | ch04, ch05 |
| `ch07` | 记忆与上下文管理 | beginner | ch04 |

### 卷三：进阶篇（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch08` | 多Agent协作 | intermediate | ch04, ch06 |
| `ch09` | Agent推理与规划 | intermediate | ch04, ch05 |
| `ch10` | Agent评估与优化 | intermediate | ch04 |
| `ch11` | 安全与对齐 | intermediate | ch04 |

### 卷四：高级篇（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch12` | RAG增强Agent | intermediate | ch04, ch07 |
| `ch13` | Agent与外部系统集成 | intermediate | ch06 |
| `ch14` | 多模态Agent | intermediate | ch04 |
| `ch15` | Agent的可观测性 | intermediate | ch04 |

### 卷五：专项篇（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch16` | 代码 Agent | intermediate | ch06, ch09 |
| `ch17` | 数据分析 Agent | intermediate | ch06, ch09 |
| `ch18` | 内容创作 Agent | intermediate | ch05, ch06 |
| `ch19` | 自动化工作流 Agent | intermediate | ch06, ch09 |

### 卷六：附录（4 篇）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `appendixA` | Agent框架对比 | beginner | — |
| `appendixB` | 常用工具与API速查 | beginner | — |
| `appendixC` | Agent部署指南 | beginner | — |
| `appendixD` | 术语表 | beginner | — |

### 卷七：Agent 开发技法（6 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch20` | Prompt高级技巧 | intermediate | ch05 |
| `ch21` | 状态机与流程编排 | intermediate | ch09 |
| `ch22` | 错误处理与重试策略 | intermediate | ch06 |
| `ch23` | Agent测试方法 | intermediate | ch10 |
| `ch24` | 性能调优 | intermediate | ch04 |
| `ch25` | 调试与诊断 | intermediate | ch15 |

### 卷八：实战案例集（5 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch26` | 智能客服系统 | advanced | ch06, ch07, ch08 |
| `ch27` | 代码审查助手 | advanced | ch16 |
| `ch28` | 数据分析平台 | advanced | ch17 |
| `ch29` | 内容生成流水线 | advanced | ch18 |
| `ch30` | 多Agent协作项目管理系统 | advanced | ch08, ch32 |

### 卷九：Agent 设计模式（5 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch31` | 单Agent模式 | advanced | ch04 |
| `ch32` | 多Agent编排模式 | advanced | ch08 |
| `ch33` | 人机协作模式 | advanced | ch08 |
| `ch34` | 工具使用模式 | advanced | ch06 |
| `ch35` | 企业级设计模式 | advanced | ch31, ch32, ch33, ch34 |

### 卷十：生产级 Agent 平台（5 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch36` | 生产环境架构设计 | advanced | ch35 |
| `ch37` | 可扩展性与高可用 | advanced | ch36 |
| `ch38` | 监控与告警体系 | advanced | ch15, ch36 |
| `ch39` | 安全与权限管理 | advanced | ch11, ch36 |
| `ch40` | CI/CD与版本管理 | advanced | ch36 |

### 卷十一：生态与跨平台（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch41` | Agent 生态全景 | intermediate | ch04 |
| `ch42` | 跨平台部署 | intermediate | ch36 |
| `ch43` | 开源社区与贡献 | intermediate | ch04 |
| `ch44` | 商业化实践 | intermediate | ch36 |

### 卷十二：Agent 开发的未来（4 章）

| ID | 标题 | 难度 | 前置 |
|----|------|------|------|
| `ch45` | Agent原生应用 | beginner | ch04 |
| `ch46` | AI Agent与AGI | beginner | ch04 |
| `ch47` | 伦理与社会影响 | beginner | ch11 |
| `ch48` | 展望与行动指南 | beginner | ch04 |

---

## 技能书速查

共 **7 本**技能书，从多个章节交叉提炼的实战指南，支持直接安装到 Agent 技能系统。

| ID | 名称 | 难度 | 涉及章节 |
|----|------|------|----------|
| `first-agent` | 构建你的第一个Agent | 🟢 beginner | ch01, ch04, ch06 |
| `prompt-engineering` | Prompt Engineering 实战 | 🟢 beginner | ch05, ch20 |
| `rag-agent` | 构建RAG增强Agent | 🟡 intermediate | ch04, ch07, ch12 |
| `multi-agent` | 多Agent协作系统 | 🟡 intermediate | ch08, ch32 |
| `agent-testing` | Agent测试与评估 | 🟡 intermediate | ch10, ch23 |
| `production-deploy` | 生产级Agent部署 | 🔴 advanced | ch36, ch37, ch38, ch40 |
| `enterprise-patterns` | 企业级设计模式 | 🔴 advanced | ch35, ch39 |

安装命令：`GET /agent-api/skills/{id}.md` → 保存为 `~/.workbuddy/skills/agent-book-{id}/SKILL.md`

---

## Agent 推荐工作流

### 场景一：按主题检索知识

```
[Step 1] GET /agent-api/manifest.json
         → 缓存到会话上下文（约 3K tokens）

[Step 2] 从 manifest.volumes[*].chapters[*].key_concepts 匹配用户问题
         → 找到目标章节 ID

[Step 3] 检查 manifest.dependency_graph[target_id]
         → 确认需要先读哪些前置章节

[Step 4] GET /agent-api/chapters/{id}.json
         → 先读 metadata.key_concepts + key_takeaways（约 200 tokens）
         → 判断是否需要全文

[Step 5] 如需全文：读 sections[*].content + code_blocks[*].code
```

### 场景二：安装技能书

```
[Step 1] GET /agent-api/skills/index.json
         → 浏览可用技能书

[Step 2] GET /agent-api/skills/{skill_id}.md
         → 获取 SKILL.md 完整内容

[Step 3] 保存到 ~/.workbuddy/skills/agent-book-{skill_id}/SKILL.md
         → 或 .workbuddy/skills/agent-book-{skill_id}/SKILL.md（项目级）
```

### 场景三：提取可运行代码

```
[Step 1] GET /agent-api/chapters/{id}.json

[Step 2] 过滤 code_blocks 中 runnable == true 的条目

[Step 3] 检查 code_blocks[*].dependencies 确保环境具备

[Step 4] 直接使用 code_blocks[*].code
```

---

## Token 效率指南

| 策略 | 预估节约 | 说明 |
|------|----------|------|
| 只读 manifest 索引 | ~95% | 通过 key_concepts 定位，避免扫描全文 |
| JSON 替代 Markdown | ~30% | JSON 去除了排版标记和客套话 |
| 先读 key_takeaways | ~85% | 每章摘要约 200 tokens，快速判断相关性 |
| 只提取 code_blocks | ~70% | 跳过文字解说，直接获取可运行代码 |
| 使用技能书 | ~60% | 跨章节精炼内容，目标驱动的紧凑格式 |
