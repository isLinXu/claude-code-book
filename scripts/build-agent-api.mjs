/**
 * build-agent-api.mjs
 * 
 * 构建时从原始 Markdown 章节生成结构化 Agent API 文件：
 * 1. manifest.json - 全书索引
 * 2. chapters/{id}.json - 每章的结构化 JSON
 * 3. chapters/{id}.md - 每章的原始 Markdown 副本
 * 4. skills/index.json - 技能书索引
 * 5. skills/{id}.md - 技能书 SKILL.md 文件
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'fs'
import { join, basename, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const OUTPUT = join(ROOT, 'public', 'agent-api')
const CHAPTERS_OUT = join(OUTPUT, 'chapters')
const SKILLS_OUT = join(OUTPUT, 'skills')

// ── 目录结构定义 ──────────────────────────────────────────

const VOLUME_DEFS = [
  { id: 'vol1',  title: '认知篇',           dir: 'vol1',  difficulty: 'beginner' },
  { id: 'vol2',  title: '基础篇',           dir: 'vol2',  difficulty: 'beginner' },
  { id: 'vol3',  title: '进阶篇',           dir: 'vol3',  difficulty: 'intermediate' },
  { id: 'vol4',  title: '高级篇',           dir: 'vol4',  difficulty: 'intermediate' },
  { id: 'vol5',  title: '专项篇',           dir: 'vol5',  difficulty: 'intermediate' },
  { id: 'vol6',  title: '附录',             dir: 'vol6',  difficulty: 'beginner' },
  { id: 'vol7',  title: 'Agent编程技法',    dir: 'vol7',  difficulty: 'intermediate' },
  { id: 'vol8',  title: '实战案例集',       dir: 'vol8',  difficulty: 'advanced' },
  { id: 'vol9',  title: 'Agent设计模式',    dir: 'vol9',  difficulty: 'advanced' },
  { id: 'vol10', title: '生产级Agent平台',  dir: 'vol10', difficulty: 'advanced' },
  { id: 'vol11', title: '生态与跨平台',     dir: 'vol11', difficulty: 'intermediate' },
  { id: 'vol12', title: 'Agent编程的未来',  dir: 'vol12', difficulty: 'beginner' },
]

// 章节依赖关系图
const DEPENDENCY_GRAPH = {
  ch01: [],
  ch02: ['ch01'],
  ch03: ['ch01'],
  ch04: ['ch01', 'ch03'],
  ch05: ['ch04'],
  ch06: ['ch04', 'ch05'],
  ch07: ['ch04'],
  ch08: ['ch04', 'ch06'],
  ch09: ['ch04', 'ch05'],
  ch10: ['ch04'],
  ch11: ['ch04'],
  ch12: ['ch04', 'ch07'],
  ch13: ['ch06'],
  ch14: ['ch04'],
  ch15: ['ch04'],
  ch16: ['ch06', 'ch09'],
  ch17: ['ch06', 'ch09'],
  ch18: ['ch05', 'ch06'],
  ch19: ['ch06', 'ch09'],
  ch20: ['ch05'],
  ch21: ['ch09'],
  ch22: ['ch06'],
  ch23: ['ch10'],
  ch24: ['ch04'],
  ch25: ['ch15'],
  ch26: ['ch06', 'ch07', 'ch08'],
  ch27: ['ch16'],
  ch28: ['ch17'],
  ch29: ['ch18'],
  ch30: ['ch08', 'ch32'],
  ch31: ['ch04'],
  ch32: ['ch08'],
  ch33: ['ch08'],
  ch34: ['ch06'],
  ch35: ['ch31', 'ch32', 'ch33', 'ch34'],
  ch36: ['ch35'],
  ch37: ['ch36'],
  ch38: ['ch15', 'ch36'],
  ch39: ['ch11', 'ch36'],
  ch40: ['ch36'],
  ch41: ['ch04'],
  ch42: ['ch36'],
  ch43: ['ch04'],
  ch44: ['ch36'],
  ch45: ['ch04'],
  ch46: ['ch04'],
  ch47: ['ch11'],
  ch48: ['ch04'],
}

// 技能书定义
const SKILL_DEFS = [
  {
    id: 'first-agent',
    title: '构建你的第一个Agent',
    description: '从零搭建一个能感知、推理、执行工具调用的最小Agent系统',
    difficulty: 'beginner',
    chapters: ['ch01', 'ch04', 'ch06'],
    objectives: [
      '理解Agent的核心定义和五要素',
      '实现LLM + Tools + Memory的最小Agent',
      '掌握Function Calling的完整流程',
    ],
  },
  {
    id: 'prompt-engineering',
    title: 'Prompt Engineering 实战',
    description: '系统掌握面向Agent的Prompt设计技巧',
    difficulty: 'beginner',
    chapters: ['ch05', 'ch20'],
    objectives: [
      '掌握系统提示词设计的核心原则',
      '学会Few-shot/CoT/ReAct等高级技巧',
      '优化Prompt以提升Agent推理质量',
    ],
  },
  {
    id: 'rag-agent',
    title: '构建RAG增强Agent',
    description: '实现检索增强生成，让Agent拥有外部知识库',
    difficulty: 'intermediate',
    chapters: ['ch04', 'ch07', 'ch12'],
    objectives: [
      '理解RAG架构的核心组件',
      '实现向量检索 + LLM生成的完整管线',
      '优化检索质量和上下文窗口利用率',
    ],
  },
  {
    id: 'multi-agent',
    title: '多Agent协作系统',
    description: '设计和实现多Agent编排方案',
    difficulty: 'intermediate',
    chapters: ['ch08', 'ch32'],
    objectives: [
      '掌握多Agent通信协议设计',
      '实现Supervisor/Swarm等编排模式',
      '处理多Agent系统中的竞态和死锁',
    ],
  },
  {
    id: 'agent-testing',
    title: 'Agent测试与评估',
    description: '建立Agent质量保障体系',
    difficulty: 'intermediate',
    chapters: ['ch10', 'ch23'],
    objectives: [
      '设计Agent评估指标体系',
      '实现自动化测试框架',
      '建立回归测试和基准测试流程',
    ],
  },
  {
    id: 'production-deploy',
    title: '生产级Agent部署',
    description: '从开发到生产的完整链路',
    difficulty: 'advanced',
    chapters: ['ch36', 'ch37', 'ch38', 'ch40'],
    objectives: [
      '设计高可用Agent服务架构',
      '实现监控告警体系',
      '建立CI/CD自动化部署流程',
    ],
  },
  {
    id: 'enterprise-patterns',
    title: '企业级设计模式',
    description: '大规模Agent系统的架构模式和最佳实践',
    difficulty: 'advanced',
    chapters: ['ch35', 'ch39'],
    objectives: [
      '掌握企业级Agent架构的核心模式',
      '实现安全与权限管理框架',
      '设计可扩展的Agent平台架构',
    ],
  },
]

// ── Markdown 解析工具 ─────────────────────────────────────

function parseMarkdown(content, chapterId) {
  const lines = content.split('\n')
  const sections = []
  const codeBlocks = []
  const tables = []
  const keyTakeaways = []
  const commonPitfalls = []
  let title = ''
  let learningObjectives = []

  let currentSection = null
  let currentSubsection = null
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockContent = []
  let codeBlockIdx = 0
  let inTable = false
  let tableRows = []
  let overview = ''
  let inOverview = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 书名 / 章节标题
    if (line.startsWith('# ') && !title) {
      title = line.replace(/^# /, '').trim()
      continue
    }

    // 代码块
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.replace('```', '').trim() || 'text'
        codeBlockContent = []
      } else {
        inCodeBlock = false
        codeBlockIdx++
        const codeStr = codeBlockContent.join('\n')
        // 从前面几行推测描述
        let desc = ''
        for (let j = i - codeBlockContent.length - 2; j >= Math.max(0, i - codeBlockContent.length - 5); j--) {
          const prevLine = lines[j].trim()
          if (prevLine && !prevLine.startsWith('```') && !prevLine.startsWith('#')) {
            desc = prevLine.replace(/[*_`]/g, '').slice(0, 100)
            break
          }
        }
        codeBlocks.push({
          id: `code-${codeBlockIdx}`,
          language: codeBlockLang,
          description: desc,
          code: codeStr,
          section_ref: currentSubsection?.id || currentSection?.id || '',
          runnable: codeBlockLang === 'python' || codeBlockLang === 'typescript' || codeBlockLang === 'javascript',
          dependencies: extractDependencies(codeStr, codeBlockLang),
        })
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // 二级标题 → Section
    if (line.startsWith('## ')) {
      const sectionTitle = line.replace(/^## /, '').trim()

      // 检测特殊区域
      if (sectionTitle === '概述') {
        inOverview = true
        continue
      }
      if (inOverview) inOverview = false

      if (sectionTitle.includes('小结') || sectionTitle.includes('要点')) {
        // 后续内容收集为 key_takeaways
      }
      if (sectionTitle.includes('常见陷阱') || sectionTitle.includes('注意事项')) {
        // 后续内容收集为 common_pitfalls
      }

      // 提取节号
      const match = sectionTitle.match(/^(\d+\.\d+)\s+/)
      const sectionId = match ? match[1] : sectionTitle.slice(0, 20)

      currentSection = {
        id: sectionId,
        title: sectionTitle,
        level: 2,
        content: '',
        subsections: [],
      }
      currentSubsection = null
      sections.push(currentSection)
      continue
    }

    // 三级标题 → Subsection
    if (line.startsWith('### ')) {
      const subTitle = line.replace(/^### /, '').trim()
      const match = subTitle.match(/^(\d+\.\d+\.\d+)\s+/)
      const subId = match ? match[1] : subTitle.slice(0, 20)

      currentSubsection = {
        id: subId,
        title: subTitle,
        level: 3,
        content: '',
      }
      if (currentSection) {
        currentSection.subsections.push(currentSubsection)
      }
      continue
    }

    // 收集概述
    if (inOverview) {
      overview += line + '\n'
      continue
    }

    // 表格检测
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true
        tableRows = []
      }
      tableRows.push(line.trim())
    } else if (inTable) {
      inTable = false
      if (tableRows.length > 2) {
        tables.push(parseTable(tableRows))
      }
      tableRows = []
    }

    // 列表项中的学习目标
    if (line.match(/^- .*(能够|理解|掌握|学会|判断|选择)/) && sections.length === 0) {
      learningObjectives.push(line.replace(/^- /, '').trim())
    }

    // 正文追加到当前 section/subsection
    if (currentSubsection) {
      currentSubsection.content += line + '\n'
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }
  }

  // 提取 key_takeaways (从小结部分)
  const summarySection = sections.find(s => s.title.includes('小结') || s.title.includes('要点') || s.title.includes('总结'))
  if (summarySection) {
    const listItems = summarySection.content.match(/^[-*]\s+.+$/gm)
    if (listItems) {
      keyTakeaways.push(...listItems.map(l => l.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '').trim()))
    }
  }

  // 提取 common_pitfalls
  const pitfallSection = sections.find(s => s.title.includes('陷阱') || s.title.includes('注意'))
  if (pitfallSection) {
    const listItems = pitfallSection.content.match(/^[-*]\s+.+$/gm)
    if (listItems) {
      commonPitfalls.push(...listItems.map(l => l.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '').trim()))
    }
  }

  // 字数统计
  const wordCount = content.replace(/```[\s\S]*?```/g, '').replace(/[#|`*_\-\[\]()]/g, '').length

  return {
    title,
    overview: overview.trim(),
    sections,
    codeBlocks,
    tables,
    keyTakeaways,
    commonPitfalls,
    learningObjectives,
    wordCount,
  }
}

function parseTable(rows) {
  if (rows.length < 3) return null
  const headers = rows[0].split('|').filter(Boolean).map(h => h.trim())
  const data = rows.slice(2).map(row =>
    row.split('|').filter(Boolean).map(c => c.trim())
  )
  return { headers, data }
}

function extractDependencies(code, lang) {
  const deps = []
  if (lang === 'python') {
    const imports = code.match(/^(?:from\s+(\S+)|import\s+(\S+))/gm)
    if (imports) {
      imports.forEach(imp => {
        const m = imp.match(/(?:from|import)\s+(\w+)/)
        if (m && !['os', 'sys', 'json', 'typing', 'dataclasses', 'abc', 'enum', 'time', 'asyncio', 'functools', 'collections', 'pathlib', 're', 'datetime', 'logging', 'unittest', 'copy', 'math', 'random', 'hashlib', 'uuid', 'io', 'textwrap', 'inspect'].includes(m[1])) {
          deps.push(m[1])
        }
      })
    }
  }
  return [...new Set(deps)]
}

function getChapterId(filename) {
  const match = filename.match(/^(ch\d+|appendix[A-D])/)
  return match ? match[1] : null
}

// ── 主构建流程 ────────────────────────────────────────────

function build() {
  console.log('🚀 Building Agent API...\n')

  // 确保输出目录
  mkdirSync(CHAPTERS_OUT, { recursive: true })
  mkdirSync(SKILLS_OUT, { recursive: true })

  const manifest = {
    title: 'Agent 开发：从原理到生产级实践',
    version: '1.0.0',
    build_time: new Date().toISOString(),
    total_chapters: 0,
    total_word_count: 0,
    volumes: [],
    skills: SKILL_DEFS.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      difficulty: s.difficulty,
      chapters: s.chapters,
    })),
    dependency_graph: DEPENDENCY_GRAPH,
    agent_instructions: {
      protocol: 'HTTP GET, JSON/Markdown response, no auth required',
      base_url: '/claude-code-book/agent-api/',
      recommended_flow: [
        'GET manifest.json → 获取全书索引',
        'Check dependency_graph → 确定学习顺序',
        'GET chapters/{id}.json → 按需加载章节',
        'Use key_takeaways for quick assessment',
        'GET skills/{id}.md → 安装技能书',
      ],
      token_tips: [
        'manifest.json 约 3K tokens，建议缓存',
        '单章 JSON 约 5-15K tokens',
        '先读 key_takeaways 再决定是否加载全文',
      ],
    },
  }

  // 处理每个卷
  for (const volDef of VOLUME_DEFS) {
    const volDir = join(ROOT, volDef.dir)
    if (!existsSync(volDir)) {
      console.warn(`⚠️ Volume dir not found: ${volDir}`)
      continue
    }

    const files = readdirSync(volDir).filter(f => f.endsWith('.md') && !f.includes('index'))
    const volData = {
      id: volDef.id,
      title: volDef.title,
      chapters: [],
    }

    for (const file of files) {
      const filePath = join(volDir, file)
      const content = readFileSync(filePath, 'utf-8')
      const chapterId = getChapterId(file)

      if (!chapterId) {
        console.warn(`  ⚠️ Skipping unknown file: ${file}`)
        continue
      }

      console.log(`  📄 Processing ${chapterId}: ${file}`)
      const parsed = parseMarkdown(content, chapterId)

      // 构建章节 JSON
      const chapterJson = {
        metadata: {
          id: chapterId,
          title: parsed.title,
          volume: volDef.id,
          volume_title: volDef.title,
          word_count: parsed.wordCount,
          difficulty: volDef.difficulty,
          prerequisites: DEPENDENCY_GRAPH[chapterId] || [],
          key_concepts: extractKeyConcepts(parsed),
          learning_objectives: parsed.learningObjectives,
          estimated_tokens: Math.round(parsed.wordCount * 0.6),
          source_file: `${volDef.dir}/${file}`,
        },
        overview: parsed.overview,
        sections: parsed.sections.map(s => ({
          id: s.id,
          title: s.title,
          level: s.level,
          content: s.content.trim(),
          subsections: s.subsections.map(sub => ({
            id: sub.id,
            title: sub.title,
            content: sub.content.trim(),
          })),
        })),
        code_blocks: parsed.codeBlocks,
        tables: parsed.tables.filter(Boolean),
        key_takeaways: parsed.keyTakeaways,
        common_pitfalls: parsed.commonPitfalls,
        related_chapters: findRelatedChapters(chapterId),
      }

      // 写入 JSON
      writeFileSync(
        join(CHAPTERS_OUT, `${chapterId}.json`),
        JSON.stringify(chapterJson, null, 2),
        'utf-8'
      )

      // 复制原始 Markdown
      copyFileSync(filePath, join(CHAPTERS_OUT, `${chapterId}.md`))

      // 更新 manifest
      volData.chapters.push({
        id: chapterId,
        title: parsed.title,
        file: `${chapterId}.json`,
        markdown: `${chapterId}.md`,
        word_count: parsed.wordCount,
        key_concepts: extractKeyConcepts(parsed).slice(0, 5),
        dependencies: DEPENDENCY_GRAPH[chapterId] || [],
        difficulty: volDef.difficulty,
      })

      manifest.total_chapters++
      manifest.total_word_count += parsed.wordCount
    }

    manifest.volumes.push(volData)
  }

  // 写入 manifest
  writeFileSync(
    join(OUTPUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  )
  console.log(`\n📋 Manifest: ${manifest.total_chapters} chapters, ${manifest.total_word_count.toLocaleString()} chars`)

  // 生成技能书
  buildSkillBooks(manifest)

  console.log('\n✅ Agent API build complete!')
  console.log(`   Output: ${OUTPUT}`)
}

function extractKeyConcepts(parsed) {
  const concepts = new Set()

  // 从二级/三级标题提取
  for (const section of parsed.sections) {
    const cleanTitle = section.title.replace(/^\d+\.\d+\s+/, '').trim()
    if (cleanTitle.length < 30) concepts.add(cleanTitle)
    for (const sub of section.subsections) {
      const cleanSub = sub.title.replace(/^\d+\.\d+\.\d+\s+/, '').trim()
      if (cleanSub.length < 30) concepts.add(cleanSub)
    }
  }

  // 从表格中的关键词列提取
  for (const table of parsed.tables.filter(Boolean)) {
    if (table.headers.some(h => h.includes('关键词') || h.includes('概念') || h.includes('模式') || h.includes('名称'))) {
      table.data.forEach(row => {
        if (row[0]) concepts.add(row[0].replace(/\*\*/g, '').trim())
      })
    }
  }

  return [...concepts].slice(0, 15)
}

function findRelatedChapters(chapterId) {
  const related = new Set()

  // 依赖我的章节
  for (const [ch, deps] of Object.entries(DEPENDENCY_GRAPH)) {
    if (deps.includes(chapterId)) related.add(ch)
  }

  // 我依赖的章节
  const myDeps = DEPENDENCY_GRAPH[chapterId] || []
  myDeps.forEach(d => related.add(d))

  related.delete(chapterId)
  return [...related].sort()
}

function buildSkillBooks(manifest) {
  console.log('\n📚 Building Skill Books...')

  const skillIndex = {
    version: '1.0.0',
    skills: [],
    install_instructions: {
      dialog: '告诉你的Agent: "根据 {url} 安装这个技能书"',
      manual: '下载 SKILL.md 到 ~/.workbuddy/skills/agent-book-{id}/',
      api: 'GET /agent-api/skills/{id}.md',
    },
  }

  for (const skillDef of SKILL_DEFS) {
    console.log(`  📋 Skill: ${skillDef.id} - ${skillDef.title}`)

    // 收集相关章节的 key_takeaways 和 code_blocks
    const chapterSummaries = []
    const allCodeBlocks = []

    for (const chId of skillDef.chapters) {
      const chJsonPath = join(CHAPTERS_OUT, `${chId}.json`)
      if (existsSync(chJsonPath)) {
        const chData = JSON.parse(readFileSync(chJsonPath, 'utf-8'))
        chapterSummaries.push({
          id: chId,
          title: chData.metadata.title,
          takeaways: chData.key_takeaways,
        })
        // 取前3个代码块
        allCodeBlocks.push(...chData.code_blocks.slice(0, 3).map(cb => ({
          ...cb,
          from_chapter: chId,
        })))
      }
    }

    // 生成 SKILL.md
    const skillMd = generateSkillMd(skillDef, chapterSummaries, allCodeBlocks)
    writeFileSync(join(SKILLS_OUT, `${skillDef.id}.md`), skillMd, 'utf-8')

    skillIndex.skills.push({
      id: skillDef.id,
      title: skillDef.title,
      description: skillDef.description,
      difficulty: skillDef.difficulty,
      chapters: skillDef.chapters,
      file: `${skillDef.id}.md`,
    })
  }

  writeFileSync(
    join(SKILLS_OUT, 'index.json'),
    JSON.stringify(skillIndex, null, 2),
    'utf-8'
  )
}

function generateSkillMd(skillDef, chapterSummaries, codeBlocks) {
  const chapterList = chapterSummaries.map(ch =>
    `- [${ch.id}] ${ch.title}`
  ).join('\n')

  const takeawaysList = chapterSummaries.map(ch => {
    if (!ch.takeaways || ch.takeaways.length === 0) return ''
    return `### ${ch.title} (${ch.id})\n${ch.takeaways.map(t => `- ${t}`).join('\n')}`
  }).filter(Boolean).join('\n\n')

  const codeExamples = codeBlocks.slice(0, 5).map(cb =>
    `### ${cb.description || cb.id} (来自 ${cb.from_chapter})\n\n\`\`\`${cb.language}\n${cb.code}\n\`\`\``
  ).join('\n\n')

  const objectivesList = skillDef.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')

  return `---
title: "${skillDef.title}"
description: "${skillDef.description}"
difficulty: "${skillDef.difficulty}"
source: "Agent 开发：从原理到生产级实践"
---

# ${skillDef.title}

[Context] 这是一本来自《Agent 开发：从原理到生产级实践》的技能书
[Objective] ${skillDef.description}
[Difficulty] ${skillDef.difficulty}

## 学习目标

${objectivesList}

## 前置知识

${chapterList}

## 依赖清单

[Dependency Inventory]
- Python >= 3.10
- openai >= 1.0 (或兼容的 LLM SDK)

## 核心知识点

${takeawaysList || '请参考对应章节获取详细内容。'}

## 代码示例

${codeExamples || '请参考对应章节获取代码示例。'}

## 验证步骤

[Self-Verification]
${skillDef.objectives.map((o, i) => `- [ ] 验证点 ${i + 1}: ${o}`).join('\n')}

## 深入阅读

完整内容请访问各章节：
${skillDef.chapters.map(ch => `- GET /agent-api/chapters/${ch}.json`).join('\n')}

## 常见错误

[Error Handling]
- If error "API key not set" occurs: 检查环境变量 OPENAI_API_KEY
- If error "Rate limit exceeded" occurs: 实现指数退避重试
- If error "Context too long" occurs: 参考 ch07 记忆管理进行上下文压缩
`
}

// ── llms-full.txt 生成 ────────────────────────────────────

function buildLlmsFullTxt() {
  console.log('\n📝 Building llms-full.txt...')

  const lines = []
  lines.push('# Agent 开发：从原理到生产级实践 — 完整索引')
  lines.push('')
  lines.push('> 本文件遵循 llms.txt 标准，为 LLM/Agent 提供全书结构化索引。')
  lines.push('')

  let totalCode = 0
  let totalConcepts = 0

  for (const volDef of VOLUME_DEFS) {
    const volDir = join(ROOT, volDef.dir)
    if (!existsSync(volDir)) continue

    const files = readdirSync(volDir).filter(f => f.endsWith('.md') && !f.includes('index'))
    lines.push(`## ${volDef.title}（${volDef.id}）`)
    lines.push('')

    for (const file of files) {
      const chId = getChapterId(file)
      if (!chId) continue

      const chJsonPath = join(CHAPTERS_OUT, `${chId}.json`)
      if (!existsSync(chJsonPath)) continue

      const chData = JSON.parse(readFileSync(chJsonPath, 'utf-8'))
      const meta = chData.metadata
      const codeCount = chData.code_blocks.length
      const conceptCount = meta.key_concepts.length
      totalCode += codeCount
      totalConcepts += conceptCount

      lines.push(`### ${meta.title}`)
      lines.push(`- ID: ${meta.id}`)
      lines.push(`- 字数: ${meta.word_count} · 代码块: ${codeCount} · 概念: ${conceptCount}`)
      lines.push(`- 难度: ${meta.difficulty} · 前置: ${meta.prerequisites.length > 0 ? meta.prerequisites.join(', ') : '无'}`)
      lines.push(`- 核心概念: ${meta.key_concepts.slice(0, 8).join(' / ')}`)
      if (chData.key_takeaways.length > 0) {
        lines.push(`- 要点: ${chData.key_takeaways.slice(0, 3).join(' | ')}`)
      }
      lines.push(`- JSON: /agent-api/chapters/${chId}.json`)
      lines.push(`- Markdown: /agent-api/chapters/${chId}.md`)
      lines.push('')
    }
  }

  lines.push('## 技能书')
  lines.push('')
  for (const skill of SKILL_DEFS) {
    lines.push(`- ${skill.id}: ${skill.title}（${skill.difficulty}）→ /agent-api/skills/${skill.id}.md`)
  }
  lines.push('')
  lines.push('## 统计')
  lines.push(`- 总代码示例: ${totalCode}`)
  lines.push(`- 总核心概念: ${totalConcepts}`)
  lines.push('')

  writeFileSync(join(ROOT, 'public', 'llms-full.txt'), lines.join('\n'), 'utf-8')
  console.log(`  ✅ llms-full.txt generated (${totalCode} code blocks, ${totalConcepts} concepts)`)

  // 生成统计数据 JSON（供首页使用）
  const stats = {
    total_volumes: VOLUME_DEFS.length,
    total_chapters: 52,
    total_word_count: 224429,
    total_code_blocks: totalCode,
    total_key_concepts: totalConcepts,
    total_skills: SKILL_DEFS.length,
    difficulty_distribution: { beginner: 0, intermediate: 0, advanced: 0 },
    build_time: new Date().toISOString(),
  }

  // 统计难度分布
  for (const volDef of VOLUME_DEFS) {
    const volDir = join(ROOT, volDef.dir)
    if (!existsSync(volDir)) continue
    const count = readdirSync(volDir).filter(f => f.endsWith('.md') && !f.includes('index')).length
    if (stats.difficulty_distribution[volDef.difficulty] !== undefined) {
      stats.difficulty_distribution[volDef.difficulty] += count
    }
  }

  writeFileSync(join(OUTPUT, 'stats.json'), JSON.stringify(stats, null, 2), 'utf-8')
  console.log('  ✅ stats.json generated')
}

// ── 执行 ──────────────────────────────────────────────────

build()
buildLlmsFullTxt()
