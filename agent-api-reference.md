# Agent API 参考文档

> 本文档描述 Agent 阅读模式的 API 结构。所有端点均为静态文件，通过 HTTP GET 访问，无需认证。

---

## 基础信息

```
Base URL: https://{host}/claude-code-book/agent-api/
Protocol: HTTP GET
Response: JSON / Markdown
Auth:     无需认证
```

---

## 端点一览

| # | 端点 | 说明 |
|---|------|------|
| 1 | `GET /agent-api/manifest.json` | 全书索引 |
| 2 | `GET /agent-api/chapters/{id}.json` | 单章结构化 JSON |
| 3 | `GET /agent-api/chapters/{id}.md` | 单章原始 Markdown |
| 4 | `GET /agent-api/skills/index.json` | 技能书索引 |
| 5 | `GET /agent-api/skills/{id}.md` | 技能书内容 |

---

## 1. Manifest — 全书索引

```
GET /agent-api/manifest.json
```

**顶层字段：**

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `title` | string | `"Agent 开发：从原理到生产级实践"` | 书名 |
| `version` | string | `"1.0.0"` | 内容版本 |
| `build_time` | string | `"2026-04-01T09:26:13.062Z"` | 构建时间 |
| `total_chapters` | number | `52` | 总章数（含附录） |
| `total_word_count` | number | `224429` | 总字数 |
| `volumes` | Volume[] | — | 12 卷列表 |
| `skills` | SkillRef[] | — | 7 本技能书列表 |
| `dependency_graph` | object | `{"ch01":[],"ch02":["ch01"],...}` | 48 章依赖关系图 |
| `agent_instructions` | object | — | Agent 接入指引 |

**Volume 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 卷 ID，如 `"vol1"` |
| `title` | string | 卷名，如 `"认知篇"` |
| `chapters` | ChapterRef[] | 该卷下的章节列表 |

**ChapterRef 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 章节 ID，如 `"ch01"` / `"appendixA"` |
| `title` | string | 章节标题 |
| `file` | string | JSON 文件名，如 `"ch01.json"` |
| `markdown` | string | Markdown 文件名，如 `"ch01.md"` |
| `word_count` | number | 字数 |
| `key_concepts` | string[] | 前 5 个核心概念 |
| `dependencies` | string[] | 前置章节 ID |
| `difficulty` | string | `"beginner"` / `"intermediate"` / `"advanced"` |

**SkillRef 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 技能书 ID，如 `"rag-agent"` |
| `title` | string | 技能书名称 |
| `description` | string | 一句话描述 |
| `difficulty` | string | 难度级别 |
| `chapters` | string[] | 涉及章节 ID |

---

## 2. Chapter JSON — 单章结构化内容

```
GET /agent-api/chapters/{id}.json
```

**参数：** `id` = `ch01` ~ `ch48` 或 `appendixA` ~ `appendixD`

**顶层字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `metadata` | ChapterMeta | 章节元数据 |
| `overview` | string | 章节概述文本 |
| `sections` | Section[] | 按二级标题拆分的内容段 |
| `code_blocks` | CodeBlock[] | 全部代码块（独立索引） |
| `tables` | Table[] | 全部表格 |
| `key_takeaways` | string[] | 章节要点摘要 |
| `common_pitfalls` | string[] | 常见陷阱 |
| `related_chapters` | string[] | 关联章节 ID |

**ChapterMeta 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 章节 ID |
| `title` | string | 章节标题 |
| `volume` | string | 所属卷 ID |
| `volume_title` | string | 所属卷名称 |
| `word_count` | number | 字数 |
| `difficulty` | string | 难度级别 |
| `prerequisites` | string[] | 前置章节 ID |
| `key_concepts` | string[] | 核心概念列表（最多 15 个） |
| `learning_objectives` | string[] | 学习目标 |
| `estimated_tokens` | number | 预估消耗 token 数 |
| `source_file` | string | 源文件路径，如 `"vol1/ch01_什么是AI_Agent.md"` |

**Section 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 节编号，如 `"1.1"` |
| `title` | string | 节标题 |
| `level` | number | 标题级别（2 = ##） |
| `content` | string | 该节正文（不含子节） |
| `subsections` | Subsection[] | 子节列表 |

**Subsection 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 子节编号，如 `"1.1.1"` |
| `title` | string | 子节标题 |
| `content` | string | 子节正文 |

**CodeBlock 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 代码块 ID，如 `"code-1"` |
| `language` | string | 语言，如 `"python"` / `"typescript"` / `"text"` |
| `description` | string | 代码说明（从上文推断） |
| `code` | string | 代码内容 |
| `section_ref` | string | 所在章节编号 |
| `runnable` | boolean | 是否可直接运行（python/ts/js 为 true） |
| `dependencies` | string[] | 运行依赖（自动从 import 提取） |

**Table 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `headers` | string[] | 表头列名 |
| `data` | string[][] | 行数据 |

---

## 3. Chapter Markdown — 原始内容

```
GET /agent-api/chapters/{id}.md
```

返回章节原始 Markdown 文本。适合需要完整排版格式的场景。

---

## 4. Skills Index — 技能书索引

```
GET /agent-api/skills/index.json
```

**结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 版本号 |
| `skills` | SkillEntry[] | 技能书列表 |
| `install_instructions` | object | 安装指引 |

**SkillEntry 结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 技能书 ID |
| `title` | string | 名称 |
| `description` | string | 一句话描述 |
| `difficulty` | string | 难度级别 |
| `chapters` | string[] | 涉及章节 |
| `file` | string | 文件名，如 `"rag-agent.md"` |

---

## 5. Skill Content — 技能书内容

```
GET /agent-api/skills/{id}.md
```

返回 SKILL.md 格式的技能书。包含以下结构化区域：

| 区域 | 说明 |
|------|------|
| YAML frontmatter | title, description, difficulty, source |
| 学习目标 | 编号列表 |
| 前置知识 | 引用的章节 ID 和标题 |
| 依赖清单 | `[Dependency Inventory]` 运行环境要求 |
| 核心知识点 | 从章节 key_takeaways 提取 |
| 代码示例 | 从章节 code_blocks 提取（标注来源） |
| 验证步骤 | `[Self-Verification]` 检查清单 |
| 常见错误 | `[Error Handling]` 错误处理指引 |

---

## 有效章节 ID 列表

```
ch01 ch02 ch03 ch04 ch05 ch06 ch07 ch08 ch09 ch10
ch11 ch12 ch13 ch14 ch15 ch16 ch17 ch18 ch19 ch20
ch21 ch22 ch23 ch24 ch25 ch26 ch27 ch28 ch29 ch30
ch31 ch32 ch33 ch34 ch35 ch36 ch37 ch38 ch39 ch40
ch41 ch42 ch43 ch44 ch45 ch46 ch47 ch48
appendixA appendixB appendixC appendixD
```

## 有效技能书 ID 列表

```
first-agent  prompt-engineering  rag-agent  multi-agent
agent-testing  production-deploy  enterprise-patterns
```
