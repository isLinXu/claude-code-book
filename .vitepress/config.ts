import { defineConfig } from 'vitepress'

const bookTitle = 'Agent 开发实战'
const bookFullTitle = 'Agent 开发：从原理到生产级实践'

// Volume/Chapter structure
const volumes = [
  {
    text: '卷一：认知篇',
    collapsed: false,
    items: [
      { text: '第1章 什么是AI Agent', link: '/vol1/ch01_什么是AI_Agent' },
      { text: '第2章 Agent技术演进史', link: '/vol1/ch02_Agent技术演进史' },
      { text: '第3章 Agent编程范式', link: '/vol1/ch03_Agent编程范式' },
    ]
  },
  {
    text: '卷二：基础篇',
    collapsed: true,
    items: [
      { text: '第4章 Agent核心概念', link: '/vol2/ch04_Agent核心概念' },
      { text: '第5章 LLM基础与Prompt Engineering', link: '/vol2/ch05_LLM基础与Prompt_Engineering' },
      { text: '第6章 工具调用与Function Calling', link: '/vol2/ch06_工具调用与Function_Calling' },
      { text: '第7章 记忆与上下文管理', link: '/vol2/ch07_记忆与上下文管理' },
    ]
  },
  {
    text: '卷三：进阶篇',
    collapsed: true,
    items: [
      { text: '第8章 多Agent协作', link: '/vol3/ch08_多Agent协作' },
      { text: '第9章 Agent推理与规划', link: '/vol3/ch09_Agent推理与规划' },
      { text: '第10章 Agent评估与优化', link: '/vol3/ch10_Agent评估与优化' },
      { text: '第11章 安全与对齐', link: '/vol3/ch11_安全与对齐' },
    ]
  },
  {
    text: '卷四：高级篇',
    collapsed: true,
    items: [
      { text: '第12章 RAG增强Agent', link: '/vol4/ch12_RAG增强Agent' },
      { text: '第13章 Agent与外部系统集成', link: '/vol4/ch13_Agent与外部系统集成' },
      { text: '第14章 多模态Agent', link: '/vol4/ch14_多模态Agent' },
      { text: '第15章 Agent的可观测性', link: '/vol4/ch15_Agent的可观测性' },
    ]
  },
  {
    text: '卷五：专项篇',
    collapsed: true,
    items: [
      { text: '第16章 代码Agent', link: '/vol5/ch16_代码Agent' },
      { text: '第17章 数据分析Agent', link: '/vol5/ch17_数据分析Agent' },
      { text: '第18章 内容创作Agent', link: '/vol5/ch18_内容创作Agent' },
      { text: '第19章 自动化工作流Agent', link: '/vol5/ch19_自动化工作流Agent' },
    ]
  },
  {
    text: '卷六：附录',
    collapsed: true,
    items: [
      { text: '附录A Agent框架对比', link: '/vol6/appendixA_Agent框架对比' },
      { text: '附录B 常用工具与API速查', link: '/vol6/appendixB_常用工具与API速查' },
      { text: '附录C Agent部署指南', link: '/vol6/appendixC_Agent部署指南' },
      { text: '附录D 术语表', link: '/vol6/appendixD_术语表' },
    ]
  },
  {
    text: '卷七：Agent开发技法',
    collapsed: true,
    items: [
      { text: '第20章 Prompt高级技巧', link: '/vol7/ch20_Prompt高级技巧' },
      { text: '第21章 状态机与流程编排', link: '/vol7/ch21_状态机与流程编排' },
      { text: '第22章 错误处理与重试策略', link: '/vol7/ch22_错误处理与重试策略' },
      { text: '第23章 Agent测试方法', link: '/vol7/ch23_Agent测试方法' },
      { text: '第24章 性能调优', link: '/vol7/ch24_性能调优' },
      { text: '第25章 调试与诊断', link: '/vol7/ch25_调试与诊断' },
    ]
  },
  {
    text: '卷八：实战案例集',
    collapsed: true,
    items: [
      { text: '第26章 智能客服系统', link: '/vol8/ch26_智能客服系统' },
      { text: '第27章 代码审查助手', link: '/vol8/ch27_代码审查助手' },
      { text: '第28章 数据分析平台', link: '/vol8/ch28_数据分析平台' },
      { text: '第29章 内容生成流水线', link: '/vol8/ch29_内容生成流水线' },
      { text: '第30章 多Agent协作项目管理', link: '/vol8/ch30_多Agent协作项目管理系统' },
    ]
  },
  {
    text: '卷九：Agent设计模式',
    collapsed: true,
    items: [
      { text: '第31章 单Agent模式', link: '/vol9/ch31_单Agent模式' },
      { text: '第32章 多Agent编排模式', link: '/vol9/ch32_多Agent编排模式' },
      { text: '第33章 人机协作模式', link: '/vol9/ch33_人机协作模式' },
      { text: '第34章 工具使用模式', link: '/vol9/ch34_工具使用模式' },
      { text: '第35章 企业级设计模式', link: '/vol9/ch35_企业级设计模式' },
    ]
  },
  {
    text: '卷十：生产级Agent平台',
    collapsed: true,
    items: [
      { text: '第36章 生产环境架构设计', link: '/vol10/ch36_生产环境架构设计' },
      { text: '第37章 可扩展性与高可用', link: '/vol10/ch37_可扩展性与高可用' },
      { text: '第38章 监控与告警体系', link: '/vol10/ch38_监控与告警体系' },
      { text: '第39章 安全与权限管理', link: '/vol10/ch39_安全与权限管理' },
      { text: '第40章 CI/CD与版本管理', link: '/vol10/ch40_CI_CD与版本管理' },
    ]
  },
  {
    text: '卷十一：生态与跨平台',
    collapsed: true,
    items: [
      { text: '第41章 Agent生态全景', link: '/vol11/ch41_Agent生态全景' },
      { text: '第42章 跨平台部署', link: '/vol11/ch42_跨平台部署' },
      { text: '第43章 开源社区与贡献', link: '/vol11/ch43_开源社区与贡献' },
      { text: '第44章 商业化实践', link: '/vol11/ch44_商业化实践' },
    ]
  },
  {
    text: '卷十二：Agent开发的未来',
    collapsed: true,
    items: [
      { text: '第45章 Agent原生应用', link: '/vol12/ch45_Agent原生应用' },
      { text: '第46章 AI Agent与AGI', link: '/vol12/ch46_AI_Agent与AGI' },
      { text: '第47章 伦理与社会影响', link: '/vol12/ch47_伦理与社会影响' },
      { text: '第48章 展望与行动指南', link: '/vol12/ch48_展望与行动指南' },
    ]
  },
]

// 编程思想 + Opus 4.6 特别篇
const thinkSidebar = [
  {
    text: '🔬 编程思想',
    collapsed: false,
    items: [
      { text: '特别篇总览', link: '/think/think_index' },
      { text: '第1章 编程范式的三次浪潮', link: '/think/ch01_编程范式的三次浪潮' },
      { text: '第2章 Claude Code 全景架构', link: '/think/ch02_Claude_Code全景架构' },
      { text: '第3章 Agent 编程思维模型', link: '/think/ch03_Agent编程思维模型' },
      { text: '第4章 工具系统与配置体系', link: '/think/ch04_工具系统与配置体系' },
      { text: '第5章 状态管理与安全模型', link: '/think/ch05_状态管理与安全模型' },
      { text: '第6章 流式通信与 MCP 协议', link: '/think/ch06_流式通信与MCP协议' },
      { text: '第7章 多代理协作与插件生态', link: '/think/ch07_多代理协作与插件生态' },
      { text: '第8章 终端 UI 与 Prompt 工程', link: '/think/ch08_终端UI与Prompt工程' },
      { text: '第9章 工程化实践', link: '/think/ch09_工程化实践' },
    ]
  },
  {
    text: '🧬 Claude Opus 4.6',
    collapsed: false,
    items: [
      { text: '第10章 能力与基准评测', link: '/think/ch10_Opus46能力评测' },
      { text: '第11章 安全、对齐与模型福利', link: '/think/ch11_Opus46安全与对齐' },
    ]
  },
  {
    text: '📎 参考',
    collapsed: true,
    items: [
      { text: '参考手册', link: '/think/appendix_参考手册' },
    ]
  },
]

// 源码剖析栏目
const sourceSidebar = [
  {
    text: '🏗️ 架构分析',
    collapsed: false,
    items: [
      { text: '源码剖析总览', link: '/source/source_index' },
      { text: '框架架构深度拆解', link: '/source/architecture' },
      { text: '深度拆解报告', link: '/source/deep-analysis' },
      { text: '项目概述', link: '/source/overview' },
    ]
  },
  {
    text: '🔧 工具系统',
    collapsed: true,
    items: [
      { text: '工具系统总览', link: '/source/tool-system' },
      { text: '内置工具详解', link: '/source/builtin-tools' },
      { text: '权限管理系统', link: '/source/permission' },
      { text: '自定义工具开发', link: '/source/custom-tools' },
    ]
  },
  {
    text: '🔌 MCP 集成',
    collapsed: true,
    items: [
      { text: 'MCP 协议概述', link: '/source/mcp-overview' },
      { text: 'MCP 服务器配置', link: '/source/mcp-config' },
      { text: 'MCP 认证与安全', link: '/source/mcp-auth' },
      { text: 'MCP 故障排除', link: '/source/mcp-troubleshooting' },
    ]
  },
  {
    text: '⚙️ 配置管理',
    collapsed: true,
    items: [
      { text: '配置管理总览', link: '/source/config-management' },
      { text: '用户配置', link: '/source/user-config' },
      { text: '项目配置', link: '/source/project-config' },
      { text: '环境变量', link: '/source/env-vars' },
    ]
  },
  {
    text: '📖 使用指南',
    collapsed: true,
    items: [
      { text: '快速开始', link: '/source/quickstart' },
      { text: '开发者指南', link: '/source/developer-guide' },
      { text: '会话管理', link: '/source/session' },
      { text: 'CLI 命令参考', link: '/source/cli-reference' },
      { text: '故障排除', link: '/source/troubleshooting' },
    ]
  },
  {
    text: '🔬 API 参考',
    collapsed: true,
    items: [
      { text: '核心接口', link: '/source/core-api' },
      { text: '配置 API', link: '/source/config-api' },
    ]
  },
]

export default defineConfig({
  title: bookTitle,
  description: `${bookFullTitle} — 人类与Agent双模式阅读`,
  lang: 'zh-CN',

  // GitHub Pages base path
  base: '/claude-code-book/',

  // agent-api 中的 md 副本含相对链接不需要校验
  ignoreDeadLinks: [
    /\/agent-api\//,
    /^\.\/vol\d+_index/,
    /^\.\/ch\d+/,
    /^\.\/appendix/,
    /^file:\/\//,
    /\.md$/,
  ],

  // 排除不需要处理的目录
  srcExclude: [
    'node_modules/**',
    '.github/**',
    'scripts/**',
    '.workbuddy/**',
    'docs/**',
    'public/**',
  ],

  themeConfig: {
    siteTitle: bookTitle,

    nav: [
      { text: '👤 人类阅读', link: '/vol1/vol1_index' },
      { text: '🤖 Agent 阅读', link: '/agent' },
      { text: '📚 技能书', link: '/skillbooks' },
      { text: '🧪 AI Native', link: '/ai-native' },
      { text: '💡 编程思想', link: '/think/think_index' },
      { text: '🔍 源码剖析', link: '/source/source_index' },
      {
        text: '快速导航',
        items: [
          { text: '卷一 认知篇', link: '/vol1/vol1_index' },
          { text: '卷二 基础篇', link: '/vol2/vol2_index' },
          { text: '卷三 进阶篇', link: '/vol3/vol3_index' },
          { text: '卷四 高级篇', link: '/vol4/vol4_index' },
          { text: '卷五 专项篇', link: '/vol5/vol5_index' },
          { text: '卷六 附录', link: '/vol6/vol6_index' },
          { text: '卷七 开发技法', link: '/vol7/vol7_index' },
          { text: '卷八 实战案例', link: '/vol8/vol8_index' },
          { text: '卷九 设计模式', link: '/vol9/vol9_index' },
          { text: '卷十 生产级平台', link: '/vol10/vol10_index' },
          { text: '卷十一 生态跨平台', link: '/vol11/vol11_index' },
          { text: '卷十二 未来展望', link: '/vol12/vol12_index' },
        ]
      },
    ],

    sidebar: {
      '/vol': volumes,
      '/think': thinkSidebar,
      '/source': sourceSidebar,
      '/agent': [
        {
          text: '🤖 Agent 与 AI Native',
          items: [
            { text: 'Agent 阅读模式', link: '/agent' },
            { text: 'API 参考文档', link: '/agent-api-reference' },
            { text: '技能书', link: '/skillbooks' },
            { text: 'AI Native 功能', link: '/ai-native' },
          ]
        }
      ],
      '/skillbooks': [
        {
          text: '🤖 Agent 与 AI Native',
          items: [
            { text: 'Agent 阅读模式', link: '/agent' },
            { text: 'API 参考文档', link: '/agent-api-reference' },
            { text: '技能书', link: '/skillbooks' },
            { text: 'AI Native 功能', link: '/ai-native' },
          ]
        }
      ],
      '/agent-api-reference': [
        {
          text: '🤖 Agent 与 AI Native',
          items: [
            { text: 'Agent 阅读模式', link: '/agent' },
            { text: 'API 参考文档', link: '/agent-api-reference' },
            { text: '技能书', link: '/skillbooks' },
            { text: 'AI Native 功能', link: '/ai-native' },
          ]
        }
      ],
      '/ai-native': [
        {
          text: '🤖 Agent 与 AI Native',
          items: [
            { text: 'Agent 阅读模式', link: '/agent' },
            { text: 'API 参考文档', link: '/agent-api-reference' },
            { text: '技能书', link: '/skillbooks' },
            { text: 'AI Native 功能', link: '/ai-native' },
          ]
        }
      ],
    },

    outline: {
      level: [2, 3],
      label: '本页目录'
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索全书', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除搜索',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/gatilin/claude-code-book' }
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: `《${bookFullTitle}》`
    },

    editLink: {
      pattern: 'https://github.com/gatilin/claude-code-book/edit/main/:path',
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新于'
    },

    docFooter: {
      prev: '上一章',
      next: '下一章'
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/claude-code-book/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#5b6ee1' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: bookFullTitle }],
    ['meta', { property: 'og:description', content: '12卷48章，人类与Agent双模式阅读的AI Agent开发权威指南' }],
  ],

  markdown: {
    lineNumbers: true,
  },
})
