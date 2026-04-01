# 第18章：内容创作 Agent

> "内容创作 Agent 不是要取代写作者，而是成为最不知疲倦的创意合伙人——它帮你完成从灵感到成稿的 80% 的苦活。"

## 18.1 概述：当 AI 学会"写作"

内容创作是 Agent 技术在创意领域的深度应用。从营销文案到技术文档，从社交媒体帖子到长篇报告，内容创作 Agent 正在重新定义"写作"的边界。

### 18.1.1 内容创作 Agent 的能力光谱

```
补全 → 改写 → 摘要 → 翻译 → 生成 → 多语言适配 → SEO 优化 → 合规审核
 │     │     │     │     │       │            │           │
续写  语气  提炼  语言  从零   本地化文化    关键词布局    敏感词检测
     调整  核心  转换  创作   适配调整      搜索友好     政策合规
```

- **文章写作与编辑**：长文生成、段落重组、风格调整、多版本迭代
- **营销文案生成**：广告语、产品描述、社交媒体帖子、邮件营销
- **多语言翻译与本地化**：不仅是翻译，更是文化适配
- **SEO 优化**：关键词布局、标题优化、Meta 描述生成
- **内容审核与合规**：敏感词检测、版权检查、品牌一致性

### 18.1.2 内容创作 Agent 的核心挑战

| 挑战 | 说明 | 解决方案 |
|------|------|---------|
| 品牌一致性 | 输出内容需要符合品牌调性 | 品牌风格指南 + Few-Shot 示例 |
| 事实准确性 | AI 可能产生幻觉 | RAG 检索增强 + 事实核查链 |
| 多语言质量 | 不同语言的表达习惯差异大 | 本地化知识库 + 母语者审校 |
| 合规风险 | 广告法、隐私法、平台规则 | 多层审核管道 + 敏感词库 |
| 内容多样性 | 避免千篇一律的"AI味" | Temperature 控制 + 风格注入 |

## 18.2 文章写作与编辑引擎

### 18.2.1 文章结构化管理器

高质量的文章需要清晰的结构。文章结构化管理器负责大纲生成、段落组织和逻辑流控制。

```python
"""
内容创作 Agent - 文章写作与编辑引擎
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import json
import re
import hashlib
import time


class ContentType(Enum):
    BLOG = "blog"              # 博客文章
    TECH_DOC = "tech_doc"      # 技术文档
    MARKETING = "marketing"    # 营销文案
    SOCIAL = "social"          # 社交媒体
    EMAIL = "email"            # 邮件
    PRODUCT_DESC = "product"   # 产品描述
    PRESS_RELEASE = "press"    # 新闻稿
    WHITEPAPER = "whitepaper"  # 白皮书


class ToneStyle(Enum):
    PROFESSIONAL = "professional"  # 专业严谨
    CASUAL = "casual"              # 轻松活泼
    HUMOROUS = "humorous"          # 幽默风趣
    ACADEMIC = "academic"          # 学术规范
    PERSUASIVE = "persuasive"      # 说服性
    STORYTELLING = "storytelling"  # 故事性


@dataclass
class ArticleOutline:
    """文章大纲"""
    title: str
    subtitle: str = ""
    sections: list[dict] = field(default_factory=list)
    target_audience: str = "通用读者"
    estimated_words: int = 0
    keywords: list[str] = field(default_factory=list)

    def to_prompt_context(self) -> str:
        """转化为 Prompt 上下文"""
        lines = [f"# 文章标题: {self.title}"]
        if self.subtitle:
            lines.append(f"副标题: {self.subtitle}")
        lines.append(f"目标读者: {self.target_audience}")
        lines.append(f"目标字数: {self.estimated_words}")
        lines.append(f"核心关键词: {', '.join(self.keywords)}")
        lines.append("\n## 大纲结构\n")
        for i, sec in enumerate(self.sections, 1):
            lines.append(f"{i}. {sec['title']}")
            lines.append(f"   - 核心要点: {', '.join(sec.get('points', []))}")
            if sec.get("estimated_words"):
                lines.append(f"   - 目标字数: {sec['estimated_words']}")
        return "\n".join(lines)


class ArticleGenerator:
    """文章生成器"""

    def __init__(self, llm_client=None, brand_guide: Optional[dict] = None):
        self.llm_client = llm_client
        self.brand_guide = brand_guide or {}
        self.version_history: list[dict] = []

    def _call_llm(self, prompt: str, temperature: float = 0.7) -> str:
        """调用 LLM"""
        if self.llm_client:
            return self.llm_client.chat(prompt, temperature=temperature)
        return self._mock_response(prompt)

    def _mock_response(self, prompt: str) -> str:
        """模拟 LLM 返回"""
        return "这是模拟生成的文章内容。实际使用时请替换为真实 LLM API 调用。"

    def generate_outline(self, topic: str, content_type: ContentType,
                         keywords: list[str], sections_count: int = 5,
                         target_words: int = 2000) -> ArticleOutline:
        """生成文章大纲"""
        prompt = f"""你是一位资深的{content_type.value}写作者。请为以下主题生成一份详细的文章大纲。

主题: {topic}
内容类型: {content_type.value}
核心关键词: {', '.join(keywords)}
目标字数: {target_words}
章节数量: {sections_count}

请以 JSON 格式返回:
```json
{{
    "title": "文章标题",
    "subtitle": "副标题（可选）",
    "target_audience": "目标读者",
    "sections": [
        {{
            "title": "章节标题",
            "points": ["要点1", "要点2", "要点3"],
            "estimated_words": 400
        }}
    ]
}}
```

要求:
1. 标题要吸引眼球且包含核心关键词
2. 章节之间有逻辑递进关系
3. 每个章节的要点要具体、可展开
4. 总字数分配要合理"""

        response = self._call_llm(prompt, temperature=0.8)

        try:
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            data = json.loads(json_match.group(1)) if json_match else json.loads(response)
        except (json.JSONDecodeError, AttributeError):
            data = {
                "title": topic,
                "subtitle": "",
                "target_audience": "通用读者",
                "sections": [
                    {"title": f"第{i}部分", "points": ["待展开"],
                     "estimated_words": target_words // sections_count}
                    for i in range(1, sections_count + 1)
                ]
            }

        # 计算总预估字数
        total = sum(s.get("estimated_words", 0) for s in data["sections"])

        return ArticleOutline(
            title=data["title"],
            subtitle=data.get("subtitle", ""),
            sections=data["sections"],
            target_audience=data.get("target_audience", "通用读者"),
            estimated_words=total,
            keywords=keywords
        )

    def write_section(self, outline: ArticleOutline, section_index: int,
                      context: str = "") -> str:
        """根据大纲写某个章节"""
        if section_index >= len(outline.sections):
            return ""

        section = outline.sections[section_index]
        prev_summary = ""
        if section_index > 0 and self.version_history:
            prev = self.version_history[-1].get("content", "")[:500]
            prev_summary = f"\n\n上一节内容摘要: {prev}..."

        brand_context = ""
        if self.brand_guide:
            brand_context = f"\n\n品牌风格指南:\n- 语气: {self.brand_guide.get('tone', '专业')}\n"
            brand_context += f"- 禁用词: {', '.join(self.brand_guide.get('forbidden_words', []))}\n"
            brand_context += f"- 品牌术语: {json.dumps(self.brand_guide.get('terminology', {}), ensure_ascii=False)}"

        prompt = f"""你是一位专业写作者。请根据大纲撰写以下章节。

## 全文大纲

{outline.to_prompt_context()}

## 当前要写的章节

第 {section_index + 1} 节: {section['title']}
核心要点: {', '.join(section.get('points', []))}
目标字数: {section.get('estimated_words', 500)}
{brand_context}
{prev_summary}
{f"## 额外上下文\n{context}" if context else ""}

要求:
1. 严格围绕核心要点展开，不要跑题
2. 段落之间要有自然的过渡
3. 如果有品牌术语，请正确使用
4. 保持全文的语气和风格一致
5. 避免使用品牌禁用词"""

        content = self._call_llm(prompt, temperature=0.7)

        self.version_history.append({
            "section_index": section_index,
            "section_title": section["title"],
            "content": content,
            "timestamp": time.time()
        })

        return content

    def write_full_article(self, outline: ArticleOutline,
                            context_per_section: Optional[dict] = None) -> str:
        """生成完整文章"""
        sections = []
        context_per_section = context_per_section or {}

        for i in range(len(outline.sections)):
            ctx = context_per_section.get(i, "")
            section_content = self.write_section(outline, i, ctx)
            sections.append(f"## {outline.sections[i]['title']}\n\n{section_content}")

        return f"# {outline.title}\n\n" + "\n\n".join(sections)

    def revise_section(self, section_index: int, instruction: str) -> str:
        """根据指令修改某个章节"""
        if not self.version_history or section_index >= len(self.version_history):
            return ""

        original = self.version_history[section_index]["content"]

        prompt = f"""请根据修改指令，对以下文章段落进行修改。

## 原始内容

{original}

## 修改指令

{instruction}

要求:
1. 只修改与指令相关的部分，保持其余内容不变
2. 保持原有的语气和风格
3. 直接输出修改后的完整内容，不要解释修改了什么"""

        revised = self._call_llm(prompt, temperature=0.5)

        self.version_history[section_index]["content"] = revised
        self.version_history[section_index]["revisions"] = (
            self.version_history[section_index].get("revisions", []) + 1
        )

        return revised
```

### 18.2.2 内容风格控制器

```python
"""
内容风格控制器 - 确保输出符合品牌调性
"""


@dataclass
class BrandGuide:
    """品牌风格指南"""
    name: str
    tone: str                     # 语气描述
    vocabulary_level: str         # 词汇难度: formal / casual / mixed
    forbidden_words: list[str]    # 禁用词列表
    preferred_words: dict         # 术语偏好: {"AI": "人工智能", "app": "应用程序"}
    sentence_style: str           # 句式风格: short / mixed / complex
    emoji_usage: str              # Emoji 使用: allowed / limited / forbidden
    perspective: str              # 人称: first / third / second
    examples: list[str]           # 风格示例文本


class StyleController:
    """风格控制器"""

    def __init__(self, guide: BrandGuide):
        self.guide = guide

    def build_style_prompt(self) -> str:
        """构建风格 Prompt"""
        g = self.guide
        lines = [
            "## 写作风格规范",
            f"- 品牌名称: {g.name}",
            f"- 语气: {g.tone}",
            f"- 词汇级别: {g.vocabulary_level}",
            f"- 句式风格: {g.sentence_style}",
            f"- 人称视角: {g.perspective}",
            f"- Emoji: {g.emoji_usage}",
        ]

        if g.forbidden_words:
            lines.append(f"- 禁用词: {', '.join(g.forbidden_words)}")
        if g.preferred_words:
            pairs = [f'"{k}" → "{v}"' for k, v in g.preferred_words.items()]
            lines.append(f"- 术语偏好: {', '.join(pairs)}")

        if g.examples:
            lines.append("\n### 风格示例\n")
            for i, ex in enumerate(g.examples, 1):
                lines.append(f"示例 {i}:\n{ex}\n")

        return "\n".join(lines)

    def check_compliance(self, text: str) -> dict:
        """检查文本是否符合风格规范"""
        issues = []

        # 检查禁用词
        text_lower = text.lower()
        for word in self.guide.forbidden_words:
            if word.lower() in text_lower:
                # 找到上下文
                idx = text_lower.find(word.lower())
                start = max(0, idx - 20)
                end = min(len(text), idx + len(word) + 20)
                context = text[start:end]
                issues.append({
                    "type": "forbidden_word",
                    "word": word,
                    "context": context,
                    "severity": "high",
                    "suggestion": f"请替换'{word}'为更合适的表达"
                })

        # 检查术语一致性
        for preferred, standard in self.guide.preferred_words.items():
            if preferred.lower() in text_lower:
                count = text_lower.count(preferred.lower())
                issues.append({
                    "type": "terminology",
                    "word": preferred,
                    "suggestion": f"应使用'{standard}'替代'{preferred}'，共 {count} 处",
                    "severity": "medium"
                })

        # 检查句子长度
        sentences = re.split(r'[。！？]', text)
        long_sentences = [s for s in sentences if len(s) > 80]
        if self.guide.sentence_style == "short" and long_sentences:
            issues.append({
                "type": "sentence_length",
                "detail": f"发现 {len(long_sentences)} 个过长的句子（>80字），建议拆分",
                "severity": "low"
            })

        # 检查 Emoji 使用
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF\U0001F700-\U0001F77F"
            "\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF"
            "\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F"
            "\U0001FA70-\U0001FAFF\U00002702-\U000027B0]")
        emojis = emoji_pattern.findall(text)
        if self.guide.emoji_usage == "forbidden" and emojis:
            issues.append({
                "type": "emoji",
                "detail": f"发现 {len(emojis)} 个 Emoji，当前风格不允许使用",
                "severity": "high"
            })
        elif self.guide.emoji_usage == "limited" and len(emojis) > 3:
            issues.append({
                "type": "emoji",
                "detail": f"Emoji 数量 {len(emojis)} 超过限制（最多3个）",
                "severity": "medium"
            })

        return {
            "compliant": len([i for i in issues if i["severity"] == "high"]) == 0,
            "issues": issues,
            "score": max(0, 100 - len(issues) * 10)
        }

    def auto_fix(self, text: str) -> str:
        """自动修复简单的风格问题"""
        result = text
        for old, new in self.guide.preferred_words.items():
            result = result.replace(old, new)
        return result
```

## 18.3 营销文案生成

### 18.3.1 多渠道文案生成器

营销文案需要针对不同渠道（微信、抖音、小红书、邮件等）调整格式和风格。

```python
"""
营销文案生成器 - 多渠道适配
"""

@dataclass
class CampaignBrief:
    """营销活动简报"""
    product_name: str
    product_description: str
    target_audience: str
    key_benefits: list[str]
    promotion_details: str
    cta: str                     # Call-to-Action
    channels: list[str]          # 目标渠道
    constraints: list[str] = field(default_factory=list)


class MarketingCopyGenerator:
    """多渠道营销文案生成器"""

    CHANNEL_TEMPLATES = {
        "wechat": {
            "name": "微信公众号",
            "max_length": 5000,
            "style": "深度内容、情感共鸣",
            "format": "标题 + 导语 + 正文分段 + CTA"
        },
        "xiaohongshu": {
            "name": "小红书",
            "max_length": 1000,
            "style": "种草、真实体验、emoji 丰富",
            "format": "吸睛标题 + 痛点描述 + 使用体验 + Emoji + 标签"
        },
        "douyin": {
            "name": "抖音",
            "max_length": 200,
            "style": "口语化、节奏快、有悬念",
            "format": "3秒钩子 + 核心卖点 + CTA"
        },
        "email": {
            "name": "邮件营销",
            "max_length": 3000,
            "style": "专业、个性化、有紧迫感",
            "format": "主题行 + 个性化称呼 + 价值主张 + CTA"
        },
        "weibo": {
            "name": "微博",
            "max_length": 500,
            "style": "话题性强、可互动",
            "format": "话题标签 + 核心信息 + 互动引导"
        }
    }

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def _call_llm(self, prompt: str, temperature: float = 0.8) -> str:
        if self.llm_client:
            return self.llm_client.chat(prompt, temperature=temperature)
        return "模拟生成的营销文案内容。"

    def generate(self, brief: CampaignBrief, channel: str,
                 variations: int = 3) -> list[dict]:
        """为指定渠道生成多个版本的文案"""
        template = self.CHANNEL_TEMPLATES.get(channel)
        if not template:
            return [{"error": f"不支持的渠道: {channel}"}]

        prompt = f"""你是一位资深营销文案专家。请为以下产品生成 {variations} 个不同版本的{template['name']}文案。

## 产品信息
- 产品名称: {brief.product_name}
- 产品描述: {brief.product_description}
- 目标受众: {brief.target_audience}
- 核心卖点: {', '.join(brief.key_benefits)}
- 促销信息: {brief.promotion_details}
- 行动号召: {brief.cta}

## 渠道要求
- 渠道: {template['name']}
- 风格: {template['style']}
- 格式: {template['format']}
- 最大字数: {template['max_length']}

## 限制条件
{chr(10).join('- ' + c for c in brief.constraints) if brief.constraints else '- 无特殊限制'}

## 输出要求

请为每个版本生成以下 JSON 格式:
```json
{{
    "version": 1,
    "headline": "标题/首句",
    "body": "正文内容",
    "cta": "行动号召语",
    "hashtags": ["标签1", "标签2"],
    "word_count": 实际字数,
    "tone": "该版本的语气描述"
}}
```

请生成 {variations} 个版本，每个版本风格略有不同（如理性/感性/幽默等）。"""

        response = self._call_llm(prompt)

        # 解析多个 JSON 对象
        versions = []
        try:
            json_matches = re.findall(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if not json_matches:
                # 尝试直接解析
                json_matches = [response]

            for match in json_matches:
                try:
                    data = json.loads(match)
                    if isinstance(data, list):
                        versions.extend(data)
                    else:
                        versions.append(data)
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass

        # 如果解析失败，返回模拟结果
        if not versions:
            for i in range(variations):
                versions.append({
                    "version": i + 1,
                    "headline": f"{brief.product_name} - 版本{i+1}",
                    "body": f"模拟生成的{template['name']}文案版本{i+1}",
                    "cta": brief.cta,
                    "hashtags": [brief.product_name],
                    "word_count": 100,
                    "tone": "专业"
                })

        return versions

    def generate_full_campaign(self, brief: CampaignBrief) -> dict:
        """为所有目标渠道生成完整营销素材"""
        campaign = {"brief": brief, "materials": {}}

        for channel in brief.channels:
            versions = self.generate(brief, channel)
            campaign["materials"][channel] = versions

        # 生成统一的品牌关键词
        campaign["brand_keywords"] = (
            [brief.product_name] + brief.key_benefits[:3])

        return campaign
```

## 18.4 多语言翻译与本地化

### 18.4.1 翻译引擎

```python
"""
多语言翻译与本地化引擎
支持术语表、风格适配和文化本地化
"""

from dataclasses import dataclass, field


@dataclass
class Glossary:
    """术语表"""
    language: str
    entries: dict[str, str] = field(default_factory=dict)  # 源语言 -> 目标语言

    def to_prompt(self) -> str:
        lines = [f"## {self.language} 术语表\n"]
        for src, tgt in self.entries.items():
            lines.append(f"- {src} → {tgt}")
        return "\n".join(lines)


@dataclass
class LocaleProfile:
    """地区文化配置"""
    locale: str                  # 如 zh-CN, en-US, ja-JP
    date_format: str = "YYYY-MM-DD"
    number_format: str = "1,234.56"
    currency_symbol: str = "¥"
    reading_direction: str = "ltr"   # ltr 或 rtl
    formality_level: str = "formal"  # formal / casual
    cultural_notes: list[str] = field(default_factory=list)


class TranslationEngine:
    """翻译与本地化引擎"""

    SUPPORTED_LOCALES = {
        "zh-CN": LocaleProfile("zh-CN", "YYYY年MM月DD日", "1,234.56", "¥", "ltr", "formal",
                               ["使用敬语时注意等级", "避免直接否定，使用委婉表达"]),
        "en-US": LocaleProfile("en-US", "MM/DD/YYYY", "1,234.56", "$", "ltr", "casual",
                               ["直接表达，避免过于委婉", "使用美式英语拼写"]),
        "ja-JP": LocaleProfile("ja-JP", "YYYY年MM月DD日", "1,234", "¥", "ltr", "very_formal",
                               ["使用适当的敬语体系", "长句中保持主语明确"]),
        "ko-KR": LocaleProfile("ko-KR", "YYYY.MM.DD", "1,234", "₩", "ltr", "formal",
                               ["注意敬语和非敬语的使用场景"]),
        "de-DE": LocaleProfile("de-DE", "DD.MM.YYYY", "1.234,56", "€", "ltr", "formal",
                               ["德语名词首字母大写", "复合词使用正确"]),
        "ar-SA": LocaleProfile("ar-SA", "DD/MM/YYYY", "١٬٢٣٤٫٥٦", "﷼", "rtl", "formal",
                               ["从右到左书写", "避免使用猪相关的比喻"]),
    }

    def __init__(self, llm_client=None, glossaries: Optional[dict[str, Glossary]] = None):
        self.llm_client = llm_client
        self.glossaries = glossaries or {}

    def _call_llm(self, prompt: str, temperature: float = 0.3) -> str:
        if self.llm_client:
            return self.llm_client.chat(prompt, temperature=temperature)
        return "模拟翻译结果。"

    def translate(self, text: str, source_locale: str,
                  target_locale: str, context: str = "") -> dict:
        """翻译文本"""
        source_profile = self.SUPPORTED_LOCALES.get(source_locale)
        target_profile = self.SUPPORTED_LOCALES.get(target_locale)

        if not target_profile:
            return {"success": False, "error": f"不支持的目标语言: {target_locale}"}

        glossary_text = ""
        if target_locale in self.glossaries:
            glossary_text = self.glossaries[target_locale].to_prompt()

        cultural_notes = ""
        if target_profile.cultural_notes:
            cultural_notes = "\n## 文化注意事项\n" + "\n".join(
                f"- {n}" for n in target_profile.cultural_notes)

        prompt = f"""你是一位专业的翻译专家。请将以下文本从 {source_locale} 翻译为 {target_locale}。

## 源文本

{text}

## 翻译要求

1. 保持原文的语义和语气
2. 使用 {target_profile.formality_level} 语体
3. 确保表达符合目标语言的习惯用法
4. 保留专业术语的准确性
{f"5. 额外上下文: {context}" if context else ""}
{glossary_text}
{cultural_notes}

请以 JSON 格式返回:
```json
{{
    "translated_text": "翻译后的文本",
    "adaptations": ["所做的本地化调整说明"],
    "glossary_used": ["使用的术语表条目"]
}}
```"""

        response = self._call_llm(prompt, temperature=0.3)

        try:
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            result = json.loads(json_match.group(1)) if json_match else json.loads(response)
            result["success"] = True
            return result
        except (json.JSONDecodeError, AttributeError):
            return {"success": False, "translated_text": response}

    def batch_translate(self, segments: list[dict], source_locale: str,
                        target_locale: str) -> list[dict]:
        """批量翻译（保持术语一致性）"""
        results = []
        for seg in segments:
            r = self.translate(
                seg["text"], source_locale, target_locale,
                context=seg.get("context", ""))
            results.append({
                "source": seg["text"],
                **r,
                "segment_id": seg.get("id")
            })
        return results

    def localize_content(self, content: dict, target_locale: str) -> dict:
        """本地化完整内容（包括日期、数字、货币等格式）"""
        profile = self.SUPPORTED_LOCALES.get(target_locale)
        if not profile:
            return {"success": False, "error": f"不支持: {target_locale}"}

        localized = {"locale": target_locale}

        # 翻译文本字段
        for key, value in content.items():
            if isinstance(value, str) and len(value) > 10:
                result = self.translate(value, "zh-CN", target_locale)
                localized[key] = result.get("translated_text", value)
            elif isinstance(value, (int, float)):
                # 数字格式化
                if isinstance(value, float):
                    localized[key] = f"{value:,.2f}"
                else:
                    localized[key] = f"{value:,}"
            else:
                localized[key] = value

        return localized
```

## 18.5 SEO 优化模块

### 18.5.1 智能关键词分析与布局

```python
"""
SEO 优化模块 - 关键词分析、内容优化和排名建议
"""

@dataclass
class SEOKeyword:
    """SEO 关键词"""
    keyword: str
    search_volume: int         # 月搜索量
    difficulty: float          # 竞争难度 0-100
    current_rank: Optional[int] = None
    relevance: float = 0.0     # 与内容的关联度 0-1


class SEOOptimizer:
    """SEO 优化器"""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def _call_llm(self, prompt: str, temperature: float = 0.5) -> str:
        if self.llm_client:
            return self.llm_client.chat(prompt, temperature=temperature)
        return '{"keywords": [], "title": "", "meta_description": ""}'

    def analyze_keywords(self, content: str,
                         target_keywords: list[str]) -> dict:
        """分析内容的关键词使用情况"""
        content_lower = content.lower()
        total_words = len(content)

        analysis = {}
        for kw in target_keywords:
            kw_lower = kw.lower()
            count = content_lower.count(kw_lower)
            density = (count * len(kw.split())) / max(total_words, 1) * 100

            # 检查关键词位置
            in_title = kw_lower in content_lower[:100]
            in_first_para = kw_lower in content_lower[:500]

            analysis[kw] = {
                "count": count,
                "density": round(density, 2),
                "in_title": in_title,
                "in_first_paragraph": in_first_para,
                "status": self._keyword_status(density, in_title)
            }

        return analysis

    def _keyword_status(self, density: float, in_title: bool) -> str:
        """判断关键词使用状态"""
        issues = []
        if density < 0.5:
            issues.append("密度偏低")
        elif density > 3.0:
            issues.append("密度过高（可能被视为关键词堆砌）")
        if not in_title:
            issues.append("未出现在标题中")
        return "良好" if not issues else " | ".join(issues)

    def optimize_content(self, title: str, content: str,
                         keywords: list[str]) -> dict:
        """SEO 内容优化建议"""
        analysis = self.analyze_keywords(content, keywords)

        prompt = f"""你是一位 SEO 专家。请分析以下内容并提供优化建议。

## 当前内容
标题: {title}
正文（前1000字）: {content[:1000]}

## 目标关键词
{', '.join(keywords)}

## 关键词使用分析
{json.dumps(analysis, ensure_ascii=False, indent=2)}

请以 JSON 格式返回:
```json
{{
    "optimized_title": "优化后的标题（含核心关键词，60字以内）",
    "meta_description": "Meta 描述（含核心关键词，150字以内）",
    "h1_suggestion": "H1 标签建议",
    "h2_suggestions": ["H2 子标题建议1", "H2 子标题建议2"],
    "content_improvements": ["内容改进建议1", "内容改进建议2"],
    "internal_link_suggestions": ["内链建议1"],
    "alt_text_suggestions": {{"image_1": "图片 alt 文本建议"}},
    "schema_suggestions": ["结构化数据建议"]
}}
```"""

        response = self._call_llm(prompt)

        try:
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            return json.loads(json_match.group(1)) if json_match else json.loads(response)
        except (json.JSONDecodeError, AttributeError):
            return {"optimized_title": title, "meta_description": content[:150]}

    def generate_meta_tags(self, title: str, content: str,
                            keywords: list[str]) -> dict:
        """生成 SEO Meta 标签"""
        # 标题优化（含核心关键词，控制在60字内）
        primary_kw = keywords[0] if keywords else ""
        opt_title = f"{title} | {primary_kw}" if primary_kw and primary_kw not in title else title
        if len(opt_title) > 60:
            opt_title = opt_title[:57] + "..."

        # Meta 描述（含核心关键词，控制在150字内）
        desc = content[:300].replace("\n", " ").strip()
        # 尝试在描述中自然插入关键词
        if primary_kw and primary_kw not in desc:
            desc = f"{primary_kw}相关的{desc}"
        meta_desc = desc[:147] + "..." if len(desc) > 150 else desc

        return {
            "title": opt_title,
            "description": meta_desc,
            "keywords": ", ".join(keywords),
            "og_title": opt_title,
            "og_description": meta_desc,
            "twitter_card": "summary_large_image",
            "canonical_suggestion": "建议设置 canonical URL 防止重复内容"
        }
```

## 18.6 内容审核与合规

### 18.6.1 多层审核管道

```python
"""
内容审核与合规模块
多层审核：敏感词 → 合规规则 → 品牌一致性
"""

@dataclass
class ComplianceRule:
    """合规规则"""
    name: str
    description: str
    pattern: str               # 正则表达式或关键词
    severity: str              # "error" / "warning" / "info"
    suggestion: str


@dataclass
class AuditResult:
    """审核结果"""
    passed: bool
    score: float               # 0-100
    issues: list[dict] = field(default_factory=list)
    summary: str = ""


class ContentAuditor:
    """内容审核器"""

    # 中国广告法敏感词
    AD_LAW_FORBIDDEN = [
        "最", "第一", "首个", "最好", "最大", "最高级",
        "极品", "顶级", "绝对", "独家", "首家", "首选",
        "国家级", "世界级", "全网最低价", "销量冠军"
    ]

    # 通用敏感词模式
    SENSITIVE_PATTERNS = [
        {"pattern": r'包?(治|好|消|退)', "severity": "warning",
         "suggestion": "避免使用保证性用语，建议改为'有助于'"},
        {"pattern": r'[\d]+%\s*(保证|承诺)', "severity": "warning",
         "suggestion": "避免使用百分比承诺"},
    ]

    def __init__(self, brand_guide: Optional[BrandGuide] = None):
        self.brand_guide = brand_guide
        self.compliance_rules: list[ComplianceRule] = []

    def add_rule(self, rule: ComplianceRule):
        """添加自定义合规规则"""
        self.compliance_rules.append(rule)

    def audit(self, text: str) -> AuditResult:
        """执行完整的内容审核"""
        issues = []

        # 层1: 敏感词检测
        issues.extend(self._check_sensitive_words(text))

        # 层2: 正则模式检测
        issues.extend(self._check_patterns(text))

        # 层3: 自定义合规规则
        issues.extend(self._check_compliance_rules(text))

        # 层4: 品牌一致性检查
        if self.brand_guide:
            style_result = StyleController(self.brand_guide).check_compliance(text)
            for issue in style_result["issues"]:
                issues.append({
                    "layer": "brand_consistency",
                    **issue
                })

        # 计算分数
        error_count = sum(1 for i in issues if i.get("severity") == "error")
        warning_count = sum(1 for i in issues if i.get("severity") == "warning")
        score = max(0, 100 - error_count * 20 - warning_count * 5)

        return AuditResult(
            passed=error_count == 0,
            score=score,
            issues=issues,
            summary=self._generate_summary(issues, score)
        )

    def _check_sensitive_words(self, text: str) -> list[dict]:
        """检测敏感词"""
        issues = []
        text_lower = text.lower()

        for word in self.AD_LAW_FORBIDDEN:
            if word in text_lower:
                # 排除合理的上下文用法
                idx = text_lower.find(word)
                start = max(0, idx - 10)
                end = min(len(text), idx + len(word) + 10)
                context = text[start:end]

                issues.append({
                    "layer": "sensitive_word",
                    "type": "ad_law_violation",
                    "word": word,
                    "context": context,
                    "severity": "error",
                    "suggestion": f"根据《广告法》第九条，禁止使用'{word}'等绝对化用语"
                })

        return issues

    def _check_patterns(self, text: str) -> list[dict]:
        """正则模式检测"""
        issues = []
        for p in self.SENSITIVE_PATTERNS:
            matches = re.findall(p["pattern"], text)
            if matches:
                issues.append({
                    "layer": "pattern_match",
                    "type": "risky_expression",
                    "matches": matches,
                    "severity": p["severity"],
                    "suggestion": p["suggestion"]
                })
        return issues

    def _check_compliance_rules(self, text: str) -> list[dict]:
        """自定义合规规则检测"""
        issues = []
        for rule in self.compliance_rules:
            if re.search(rule.pattern, text):
                issues.append({
                    "layer": "custom_rule",
                    "rule_name": rule.name,
                    "severity": rule.severity,
                    "suggestion": rule.suggestion
                })
        return issues

    def _generate_summary(self, issues: list[dict], score: float) -> str:
        """生成审核摘要"""
        errors = [i for i in issues if i.get("severity") == "error"]
        warnings = [i for i in issues if i.get("severity") == "warning"]

        summary = f"审核完成。评分: {score:.0f}/100。"
        if errors:
            summary += f"发现 {len(errors)} 个严重问题（必须修复）。"
        if warnings:
            summary += f"发现 {len(warnings)} 个警告（建议修复）。"
        if not issues:
            summary += "内容合规，未发现问题。"
        return summary
```

## 18.7 完整集成：内容创作 Agent

### 18.7.1 统一工作流

```python
"""
内容创作 Agent - 完整集成版
"""

class ContentCreationAgent:
    """
    内容创作 Agent 核心入口

    使用示例:
        agent = ContentCreationAgent(brand_guide=my_brand)
        article = agent.create_article("AI在教育领域的应用", ContentType.BLOG, ["AI", "教育"])
    """

    def __init__(self, llm_client=None, brand_guide: Optional[BrandGuide] = None):
        self.llm_client = llm_client
        self.brand_guide = brand_guide
        self.article_gen = ArticleGenerator(llm_client, brand_guide)
        self.style_ctrl = StyleController(brand_guide) if brand_guide else None
        self.seo = SEOOptimizer(llm_client)
        self.auditor = ContentAuditor(brand_guide)

    def create_article(self, topic: str, content_type: ContentType,
                       keywords: list[str], target_words: int = 2000,
                       tone: ToneStyle = ToneStyle.PROFESSIONAL,
                       sections: int = 5) -> dict:
        """
        完整的文章创作工作流:
        大纲生成 → 逐节写作 → SEO优化 → 风格检查 → 合规审核
        """
        result = {"topic": topic, "steps": []}

        # Step 1: 生成大纲
        result["steps"].append("生成文章大纲")
        outline = self.article_gen.generate_outline(
            topic, content_type, keywords, sections, target_words)
        result["outline"] = outline

        # Step 2: 逐节写作
        result["steps"].append("逐节撰写内容")
        full_text = self.article_gen.write_full_article(outline)
        result["draft"] = full_text

        # Step 3: SEO 优化
        result["steps"].append("SEO 优化分析")
        seo_analysis = self.seo.analyze_keywords(full_text, keywords)
        meta_tags = self.seo.generate_meta_tags(outline.title, full_text, keywords)
        result["seo"] = {"keyword_analysis": seo_analysis, "meta_tags": meta_tags}

        # Step 4: 风格检查
        if self.style_ctrl:
            result["steps"].append("品牌风格检查")
            style_result = self.style_ctrl.check_compliance(full_text)
            result["style"] = style_result

        # Step 5: 合规审核
        result["steps"].append("内容合规审核")
        audit_result = self.auditor.audit(full_text)
        result["audit"] = {
            "passed": audit_result.passed,
            "score": audit_result.score,
            "issues_count": len(audit_result.issues),
            "summary": audit_result.summary
        }

        # Step 6: 自动修复风格问题
        if self.style_ctrl:
            full_text = self.style_ctrl.auto_fix(full_text)

        result["final_content"] = full_text
        result["word_count"] = len(full_text)

        return result

    def create_marketing_campaign(self, brief: CampaignBrief) -> dict:
        """创建多渠道营销活动素材"""
        generator = MarketingCopyGenerator(self.llm_client)
        campaign = generator.generate_full_campaign(brief)

        # 对每个渠道的每个版本进行审核
        for channel, versions in campaign["materials"].items():
            for version in versions:
                body = version.get("body", "")
                if body:
                    audit = self.auditor.audit(body)
                    version["audit"] = {
                        "passed": audit.passed,
                        "score": audit.score,
                        "issue_count": len(audit.issues)
                    }

        return campaign

    def translate_and_localize(self, content: str, source: str,
                                target: str) -> dict:
        """翻译并本地化内容"""
        engine = TranslationEngine(self.llm_client)
        result = engine.translate(content, source, target)
        return result
```

### 18.7.2 端到端使用示例

```python
"""
端到端使用示例
"""

if __name__ == "__main__":
    # 创建品牌指南
    brand = BrandGuide(
        name="TechFlow",
        tone="专业但不生硬，用简单语言解释复杂概念",
        vocabulary_level="mixed",
        forbidden_words=["颠覆性", "革命性", "一站式", "赋能"],
        preferred_words={"AI": "人工智能", "app": "应用", "bug": "缺陷"},
        sentence_style="mixed",
        emoji_usage="limited",
        perspective="first_plural",  # "我们"
        examples=[
            "我们相信技术的力量在于让复杂变简单。",
            "在这篇文章中，我们将一起探索..."
        ]
    )

    # 创建 Agent
    agent = ContentCreationAgent(brand_guide=brand)

    # 示例 1: 创建博客文章
    print("=== 创建博客文章 ===")
    result = agent.create_article(
        topic="人工智能如何改变教育行业",
        content_type=ContentType.BLOG,
        keywords=["人工智能", "教育", "在线学习", "个性化教学"],
        target_words=2000,
        tone=ToneStyle.PROFESSIONAL,
        sections=4
    )
    print(f"大纲标题: {result['outline'].title}")
    print(f"字数: {result['word_count']}")
    print(f"审核评分: {result['audit']['score']}/100")
    print(f"审核通过: {'是' if result['audit']['passed'] else '否'}")

    # 示例 2: 营销活动
    print("\n=== 创建营销活动 ===")
    brief = CampaignBrief(
        product_name="TechFlow 智能学习平台",
        product_description="基于人工智能的个性化在线学习平台",
        target_audience="25-40岁的职场人士",
        key_benefits=["AI个性化推荐", "碎片化学习", "实时反馈"],
        promotion_details="新用户注册即享7天免费体验",
        cta="立即注册，开启智能学习之旅",
        channels=["wechat", "xiaohongshu", "email"]
    )
    campaign = agent.create_marketing_campaign(brief)
    for channel, materials in campaign["materials"].items():
        print(f"\n{channel}: {len(materials)} 个版本")

    # 示例 3: 合规审核
    print("\n=== 内容合规审核 ===")
    test_text = "我们提供全网最好的AI教育产品，保证100%提升成绩，效果绝对显著！"
    audit = agent.auditor.audit(test_text)
    print(f"评分: {audit.score}/100")
    print(f"通过: {audit.passed}")
    for issue in audit.issues:
        print(f"  [{issue['severity']}] {issue.get('word', issue.get('type', ''))}: "
              f"{issue.get('suggestion', '')}")
```

## 18.8 生产级考量

### 18.8.1 内容质量保证

| 环节 | 策略 | 说明 |
|------|------|------|
| 事实核查 | RAG + 知识库检索 | 对关键声明进行事实验证 |
| 原创性检测 | 指纹哈希 + 相似度计算 | 防止内容重复发布 |
| A/B 测试 | 多版本生成 + 自动投放 | 数据驱动的内容优化 |
| 反馈循环 | 用户评分 → Prompt 优化 | 持续提升生成质量 |

### 18.8.2 多租户内容管理

```python
"""
多租户内容管理 - 品牌隔离与内容追踪
"""

class TenantContentManager:
    """租户内容管理器"""

    def __init__(self):
        self.tenants: dict[str, dict] = {}

    def register_tenant(self, tenant_id: str, brand_guide: BrandGuide):
        """注册租户并绑定品牌指南"""
        self.tenants[tenant_id] = {
            "brand_guide": brand_guide,
            "content_history": [],
            "usage_stats": {"total_words": 0, "total_articles": 0}
        }

    def track_content(self, tenant_id: str, content_id: str,
                      content: str, metadata: dict = None):
        """记录内容产出"""
        if tenant_id not in self.tenants:
            return
        self.tenants[tenant_id]["content_history"].append({
            "content_id": content_id,
            "word_count": len(content),
            "timestamp": time.time(),
            "metadata": metadata or {}
        })
        self.tenants[tenant_id]["usage_stats"]["total_words"] += len(content)
        self.tenants[tenant_id]["usage_stats"]["total_articles"] += 1

    def get_usage_report(self, tenant_id: str) -> dict:
        """获取租户使用报告"""
        if tenant_id not in self.tenants:
            return {"error": "租户不存在"}
        stats = self.tenants[tenant_id]["usage_stats"]
        history = self.tenants[tenant_id]["content_history"]
        return {
            "total_articles": stats["total_articles"],
            "total_words": stats["total_words"],
            "average_words": (stats["total_words"] / max(stats["total_articles"], 1)),
            "recent_articles": history[-5:] if history else []
        }
```

## 本章小结

本章从文章写作引擎出发，构建了完整的内容创作 Agent 体系：

1. **文章写作与编辑**：结构化大纲生成、逐节写作、多版本迭代修改
2. **品牌风格控制**：品牌指南定义、风格合规检查、自动修复
3. **多渠道营销文案**：渠道适配、多版本生成、统一活动管理
4. **多语言翻译与本地化**：术语表驱动、文化适配、格式本地化
5. **SEO 优化**：关键词分析、Meta 标签生成、内容优化建议
6. **内容审核与合规**：多层审核管道、广告法检测、品牌一致性

核心思想：**内容创作的核心不是"生成文字"，而是"管理约束"**——在品牌调性、法律法规、SEO 要求和用户偏好之间找到最佳平衡点。
