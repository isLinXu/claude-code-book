# 第16章：代码 Agent

> "代码 Agent 不是要取代程序员，而是让程序员从机械重复中解放出来，专注于真正需要创造力的工作。"

## 16.1 概述：当 AI 学会写代码

代码 Agent 是 Agent 技术在软件工程领域的深度应用。它不仅仅是"AI 代码补全"——那只是 NLP 的简单应用；真正的代码 Agent 是一个能够理解项目上下文、自主完成复杂编码任务的智能体。

### 16.1.1 代码 Agent 的能力光谱

```
补全 → 生成 → 解释 → 重构 → Debug → 审查 → 架构设计 → 全流程开发
 │      │      │      │      │      │       │          │
简单   单文件  理解   模式   定位   质量门  系统级    自主完成
触发   级别   已有   级别   并修   禁     思考     完整项目
              代码   优化   复问题  防护
```

- **代码补全**（Code Completion）：根据上下文预测下一个 Token，如 GitHub Copilot 的行内补全
- **代码生成**（Code Generation）：根据自然语言描述生成完整函数或模块
- **代码解释**（Code Explanation）：理解并解释现有代码的逻辑和意图
- **代码重构**（Code Refactoring）：在保持行为不变的前提下改进代码结构
- **Bug 检测与修复**（Bug Detection & Fix）：定位缺陷并提供修复方案
- **代码审查**（Code Review）：系统性检查代码质量、安全性、性能
- **项目脚手架**（Project Scaffolding）：从零搭建项目结构、配置、依赖

### 16.1.2 代码 Agent 与传统 IDE 辅助的本质区别

| 维度 | 传统 IDE 辅助 | 代码 Agent |
|------|--------------|-----------|
| 交互模式 | 被动触发 | 主动规划与执行 |
| 上下文范围 | 当前文件/光标位置 | 整个项目仓库 |
| 任务粒度 | 行级/块级补全 | 功能级/模块级任务 |
| 自主性 | 无 | 多步规划、工具调用、自我修正 |
| 反馈循环 | 无 | 运行测试、读取错误、迭代修复 |

## 16.2 代码 Agent 的核心架构

### 16.2.1 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户界面层                        │
│  IDE 插件 / CLI / Web IDE / 聊天界面                │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
┌──────────────▼──────────────────────▼───────────────┐
│                  Agent 编排层                        │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │ 任务规划 │  │ 上下文管理 │  │ 自我反思与修正  │   │
│  │ Planner  │  │ Context   │  │ Reflector      │   │
│  │         │  │ Manager  │  │                 │   │
│  └────┬────┘  └────┬─────┘  └────────┬────────┘   │
└───────┼────────────┼─────────────────┼─────────────┘
        │            │                 │
┌───────▼────────────▼─────────────────▼─────────────┐
│                    工具层                           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐  │
│  │ 文件   │ │ 代码   │ │ 终端   │ │ 搜索      │  │
│  │ 读写   │ │ 解析   │ │ 执行   │ │ 引擎      │  │
│  └────────┘ └────────┘ └────────┘ └───────────┘  │
│  ┌────────┐ ┌────────┐ ┌───────────────────────┐  │
│  │ Git    │ │ 包管理  │ │ LSP / 语言服务       │  │
│  │ 操作   │ │        │ │                       │  │
│  └────────┘ └────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────┐
│                  项目环境层                          │
│  文件系统 / 依赖管理 / 配置文件 / 测试框架           │
└─────────────────────────────────────────────────────┘
```

### 16.2.2 上下文管理：代码 Agent 的生命线

上下文管理是代码 Agent 最关键的挑战。代码项目通常有数万甚至数十万行代码，远超 LLM 的上下文窗口。

**分层上下文策略：**

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import os

class ContextPriority(Enum):
    """上下文优先级，用于决定哪些内容优先放入 Prompt"""
    CRITICAL = 1    # 当前编辑的文件、直接依赖
    HIGH = 2        # 相关接口定义、类型声明
    MEDIUM = 3      # 项目配置、架构说明
    LOW = 4         # 历史对话、相似代码片段

@dataclass
class CodeContext:
    """代码上下文单元"""
    file_path: str
    content: str
    priority: ContextPriority
    token_count: int = 0
    relevance_score: float = 0.0

    def __post_init__(self):
        # 粗略估算 Token 数（实际应使用 tokenizer）
        self.token_count = len(self.content) // 4

@dataclass
class ContextManager:
    """代码上下文管理器"""
    max_tokens: int = 128000
    reserved_for_response: int = 8000
    contexts: list[CodeContext] = field(default_factory=list)

    @property
    def available_tokens(self) -> int:
        used = sum(c.token_count for c in self.contexts)
        return self.max_tokens - self.reserved_for_response - used

    def add_context(self, ctx: CodeContext) -> bool:
        """添加上下文，返回是否成功"""
        if ctx.token_count <= self.available_tokens:
            self.contexts.append(ctx)
            self.contexts.sort(key=lambda c: c.priority.value)
            return True
        return False

    def build_prompt_context(self) -> str:
        """构建最终 Prompt 中的上下文"""
        sections = []
        for ctx in self.contexts:
            sections.append(
                f"--- File: {ctx.file_path} ---\n"
                f"```{self._get_language(ctx.file_path)}\n"
                f"{ctx.content}\n```\n"
            )
        return "\n".join(sections)

    @staticmethod
    def _get_language(file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        lang_map = {
            '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
            '.rs': 'rust', '.go': 'go', '.java': 'java',
            '.cpp': 'cpp', '.c': 'c', '.rb': 'ruby',
        }
        return lang_map.get(ext, '')
```

### 16.2.3 工具集设计

代码 Agent 的能力取决于其工具集。以下是生产级代码 Agent 的核心工具：

```python
from abc import ABC, abstractmethod
from typing import Any
import subprocess
import os

class BaseTool(ABC):
    """工具基类"""
    @property
    @abstractmethod
    def name(self) -> str: pass

    @property
    @abstractmethod
    def description(self) -> str: pass

    @abstractmethod
    def execute(self, **kwargs) -> Any: pass

    def to_schema(self) -> dict:
        """转换为 OpenAI Function Calling 格式"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self._get_parameters_schema()
            }
        }

    @abstractmethod
    def _get_parameters_schema(self) -> dict: pass


class FileReadTool(BaseTool):
    """文件读取工具 — 带安全检查"""
    def __init__(self, working_dir: str, max_lines: int = 2000):
        self.working_dir = working_dir
        self.max_lines = max_lines

    @property
    def name(self) -> str:
        return "read_file"

    @property
    def description(self) -> str:
        return "读取指定文件的内容，支持指定行范围。"

    def execute(self, path: str, offset: int = 0, limit: int = None) -> str:
        full_path = os.path.join(self.working_dir, path)
        # 安全检查：防止路径遍历攻击
        real_path = os.path.realpath(full_path)
        if not real_path.startswith(os.path.realpath(self.working_dir)):
            return "错误：不允许访问工作目录之外的文件"
        try:
            with open(real_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            limit = limit or self.max_lines
            selected = lines[offset:offset + limit]
            numbered = [
                f"{i + offset + 1:>6}: {line.rstrip()}"
                for i, line in enumerate(selected)
            ]
            return "\n".join(numbered)
        except FileNotFoundError:
            return f"错误：文件 {path} 不存在"

    def _get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "offset": {"type": "integer", "description": "起始行号", "default": 0},
                "limit": {"type": "integer", "description": "读取行数", "default": 2000}
            },
            "required": ["path"]
        }


class TerminalTool(BaseTool):
    """终端命令执行工具 — 白名单安全策略"""
    def __init__(self, working_dir: str, timeout: int = 60):
        self.working_dir = working_dir
        self.timeout = timeout
        self.allowed_commands = [
            'python', 'pip', 'npm', 'npx', 'cargo', 'go',
            'git', 'ls', 'cat', 'grep', 'find', 'pytest',
            'eslint', 'prettier', 'mypy', 'ruff'
        ]

    @property
    def name(self) -> str:
        return "run_command"

    @property
    def description(self) -> str:
        return "在项目目录中执行终端命令，仅允许预定义的安全命令列表。"

    def execute(self, command: str) -> str:
        first_word = command.strip().split()[0] if command.strip() else ''
        base_cmd = os.path.basename(first_word)
        if base_cmd not in self.allowed_commands:
            return f"错误：命令 '{base_cmd}' 不在允许列表中"
        try:
            result = subprocess.run(
                command, shell=True, cwd=self.working_dir,
                capture_output=True, text=True, timeout=self.timeout
            )
            output = []
            if result.stdout:
                output.append(result.stdout[:5000])
            if result.stderr:
                output.append(f"[STDERR] {result.stderr[:3000]}")
            if result.returncode != 0:
                output.append(f"[退出码] {result.returncode}")
            return "\n".join(output) if output else "(无输出)"
        except subprocess.TimeoutExpired:
            return f"错误：命令执行超时（{self.timeout}秒）"
        except Exception as e:
            return f"执行错误：{e}"

    def _get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的命令"}
            },
            "required": ["command"]
        }


class CodeSearchTool(BaseTool):
    """代码搜索工具"""
    def __init__(self, working_dir: str):
        self.working_dir = working_dir
        self.skip_dirs = {
            '.git', 'node_modules', '__pycache__',
            '.venv', 'target', 'dist', 'build'
        }

    @property
    def name(self) -> str:
        return "search_code"

    @property
    def description(self) -> str:
        return "在项目中搜索代码，支持文件名搜索和内容正则搜索。"

    def execute(self, pattern: str, file_pattern: str = None,
                max_results: int = 20) -> str:
        import re
        results = []
        regex = re.compile(pattern, re.IGNORECASE)
        for root, dirs, files in os.walk(self.working_dir):
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            for fname in files:
                if file_pattern and not re.match(file_pattern, fname):
                    continue
                fpath = os.path.join(root, fname)
                rel_path = os.path.relpath(fpath, self.working_dir)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append(f"{rel_path}:{i}: {line.strip()[:120]}")
                                if len(results) >= max_results:
                                    return "\n".join(results)
                except (IOError, OSError):
                    continue
        return "\n".join(results) if results else "(未找到匹配)"

    def _get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "搜索模式（正则表达式）"},
                "file_pattern": {"type": "string", "description": "文件名过滤"},
                "max_results": {"type": "integer", "description": "最大结果数", "default": 20}
            },
            "required": ["pattern"]
        }
```

**关键设计要点：**

1. **路径安全**：所有文件操作必须验证路径不越界，防止路径遍历攻击
2. **命令白名单**：终端执行只允许预定义的安全命令，禁止 `rm -rf` 等危险操作
3. **输出截断**：限制命令输出和搜索结果长度，避免上下文爆炸
4. **超时控制**：所有命令执行设置超时，防止死循环

## 16.3 代码生成与补全

### 16.3.1 从补全到生成：范式转变

传统代码补全是"填空题"——已知上下文，预测下一行。而代码 Agent 的生成能力是"作文题"——给定需求描述，产出完整实现。

```python
from dataclasses import dataclass

@dataclass
class GenerationRequest:
    description: str          # 自然语言描述
    language: str             # 目标语言
    existing_code: str = ""   # 已有代码
    style_guide: str = ""     # 编码风格指南
    tests_required: bool = True

@dataclass
class GenerationResult:
    code: str
    explanation: str
    test_code: str = ""
    dependencies: list[str] = None
    confidence: float = 0.0


class AgentCodeGenerator:
    """基于 Agent 的代码生成器"""

    def __init__(self, llm_client, context_manager):
        self.llm = llm_client
        self.context = context_manager

    def generate(self, request: GenerationRequest) -> GenerationResult:
        """生成代码的完整流程"""
        # Step 1: 任务分析
        task_plan = self._analyze_task(request)
        # Step 2: 收集上下文
        relevant_ctx = self.context.select_for_task(request.description)
        # Step 3: 生成代码
        code = self._generate_code(request, task_plan, relevant_ctx)
        # Step 4: 自我审查
        reviewed_code = self._self_review(code, request)
        # Step 5: 生成测试
        test_code = ""
        if request.tests_required:
            test_code = self._generate_tests(reviewed_code, request.language)
        return GenerationResult(
            code=reviewed_code,
            explanation=task_plan['approach'],
            test_code=test_code,
            confidence=task_plan.get('confidence', 0.8)
        )

    def _analyze_task(self, request: GenerationRequest) -> dict:
        """分析任务，生成实现计划"""
        prompt = f"""分析以下代码生成任务。

需求：{request.description}
语言：{request.language}

输出 JSON：
{{
    "complexity": "simple|medium|complex",
    "approach": "实现思路",
    "edge_cases": ["边界情况"],
    "confidence": 0.8
}}"""
        response = self.llm.generate(prompt)
        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"complexity": "medium", "approach": response, "confidence": 0.6}

    def _generate_code(self, request, plan, contexts) -> str:
        ctx_text = "\n\n".join(
            f"// {c.file_path}\n{c.content}" for c in contexts[:5]
        )
        prompt = f"""根据需求生成 {request.language} 代码。

需求：{request.description}
思路：{plan['approach']}
复杂度：{plan['complexity']}

上下文：
{ctx_text}

要求：完整可运行、遵循最佳实践、包含类型注解和文档。"""
        return self.llm.generate(prompt)

    def _self_review(self, code: str, request: GenerationRequest) -> str:
        """自我审查生成的代码"""
        prompt = f"""审查以下 {request.language} 代码：
1. 逻辑错误  2. 安全问题  3. 性能问题  4. 风格  5. 是否满足需求

需求：{request.description}

```{request.language}
{code}
```

有问题直接输出修正后的完整代码，没问题输出原代码。"""
        return self.llm.generate(prompt)

    def _generate_tests(self, code: str, language: str) -> str:
        prompt = f"""为以下 {language} 代码生成单元测试，覆盖正常和边界情况。

```{language}
{code}
```

只输出测试代码。"""
        return self.llm.generate(prompt)
```

### 16.3.2 多文件代码生成

真实项目中的代码生成通常涉及多个文件。Agent 需要理解项目结构，按依赖顺序分步生成：

```python
@dataclass
class FileSpec:
    path: str
    purpose: str
    depends_on: list[str]
    content: str = None

class MultiFileGenerator:
    """多文件代码生成器"""

    def generate_module(self, module_name: str, description: str,
                        language: str) -> list[FileSpec]:
        # Step 1: 规划文件结构
        file_specs = self._plan_file_structure(module_name, description, language)
        # Step 2: 按依赖顺序生成
        generated = []
        for spec in file_specs:
            dep_contents = {
                g.path: g.content for g in generated
                if g.path in spec.depends_on
            }
            spec.content = self._generate_single_file(spec, dep_contents, language)
            generated.append(spec)
        return generated

    def _plan_file_structure(self, module_name, description, language):
        """通过 LLM 规划模块文件结构"""
        prompt = f"""为 {language} 模块规划文件结构。

模块：{module_name}
功能：{description}

输出 JSON 文件列表：[{{"path": "...", "purpose": "...", "depends_on": ["..."]}}]"""
        # 实际实现需解析 LLM 返回的 JSON
        ...
```

## 16.4 代码审查与重构

### 16.4.1 自动化代码审查

代码审查 Agent 需要像资深工程师一样思考——不仅检查语法，还要审查设计、安全、性能。

```python
from enum import Enum

class Severity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ReviewCategory(Enum):
    SECURITY = "安全"
    PERFORMANCE = "性能"
    CORRECTNESS = "正确性"
    DESIGN = "设计"

@dataclass
class ReviewIssue:
    file_path: str
    line_number: int
    severity: Severity
    category: ReviewCategory
    title: str
    description: str
    suggestion: str

@dataclass
class ReviewReport:
    issues: list[ReviewIssue]
    summary: str
    overall_score: float
    files_reviewed: int


class CodeReviewAgent:
    """代码审查 Agent — 多维度审查"""

    REVIEW_DIMENSIONS = {
        ReviewCategory.SECURITY: """检查：SQL 注入、XSS、硬编码密钥、
不安全反序列化、路径遍历、权限校验缺失""",
        ReviewCategory.PERFORMANCE: """检查：N+1 查询、不必要嵌套循环、
内存分配、同步阻塞、缓存缺失""",
        ReviewCategory.CORRECTNESS: """检查：空值处理、边界条件、
竞态条件、异常遗漏、资源泄漏""",
        ReviewCategory.DESIGN: """检查：单一职责、过度耦合、
魔法数字、代码重复、缺少抽象""",
    }

    def review_diff(self, diff_content: str,
                    file_context: dict[str, str] = None) -> ReviewReport:
        """审查 Git Diff"""
        all_issues = []
        for category, prompt_prefix in self.REVIEW_DIMENSIONS.items():
            issues = self._review_dimension(
                diff_content, category, prompt_prefix, file_context
            )
            all_issues.extend(issues)

        score = self._calculate_score(all_issues)
        summary = self._generate_summary(all_issues, score)
        return ReviewReport(
            issues=all_issues, summary=summary,
            overall_score=score,
            files_reviewed=len(file_context or {})
        )

    def _review_dimension(self, diff, category, prompt_prefix, file_context):
        """按单维度审查 — 返回问题列表"""
        context_text = ""
        if file_context:
            for path, content in list(file_context.items())[:3]:
                context_text += f"\n--- {path} ---\n{content[:1500]}\n"

        prompt = f"""{prompt_prefix}

代码变更：
```
{diff[:6000]}
```
{context_text}

输出 JSON 问题列表（无问题则为空数组）：
[{{"file_path":"...", "line_number":42, "severity":"warning",
"title":"...", "description":"...", "suggestion":"..."}}]"""
        # 解析 LLM 返回并构建 ReviewIssue 列表
        ...

    def _calculate_score(self, issues: list[ReviewIssue]) -> float:
        deductions = {
            Severity.CRITICAL: 3.0, Severity.ERROR: 2.0,
            Severity.WARNING: 1.0, Severity.INFO: 0.2,
        }
        total = sum(deductions.get(i.severity, 0) for i in issues)
        return max(0.0, 10.0 - total)
```

### 16.4.2 智能代码重构

重构 Agent 比审查更进一步——直接修改代码，并通过测试验证正确性：

```python
class RefactoringAgent:
    """智能重构 Agent"""

    REFACTORING_PATTERNS = {
        "extract_function": "提取函数：将重复或过长的代码块提取为独立函数",
        "simplify_conditional": "简化条件：简化复杂的 if/else 逻辑",
        "eliminate_duplicate": "消除重复：识别并合并重复代码",
        "type_annotation": "添加类型注解：为函数和变量添加类型提示",
    }

    def apply_refactoring(self, file_path: str, pattern: str,
                          target: str) -> dict:
        """应用重构并通过测试验证"""
        original = self.file_tools.read(file_path)

        # 生成重构后的代码
        prompt = f"""对以下代码应用「{pattern}」重构。

目标区域：{target}
```python
{original[:8000]}
```

重构说明：{self.REFACTORING_PATTERNS.get(pattern, pattern)}
要求：只修改目标区域，功能完全不变。输出完整文件。"""

        new_content = self.llm.generate(prompt)

        # 写入并验证
        self.file_tools.write(file_path, new_content)
        test_result = self.terminal.execute("pytest -x -q 2>&1 | head -50")

        if "passed" not in test_result.lower() or "failed" in test_result.lower():
            self.file_tools.write(file_path, original)  # 回滚
            return {"success": False, "reason": "测试失败，已回滚"}

        return {"success": True, "message": f"成功应用 {pattern}"}
```

## 16.5 Bug 检测与修复

### 16.5.1 Agent 驱动的 Bug 修复流程

Bug 修复 Agent 需要：理解错误信息 → 追踪代码路径 → 定位根因 → 生成修复 → 验证修复。

```python
@dataclass
class BugReport:
    error_message: str
    stack_trace: str = ""
    reproduction_steps: str = ""
    expected_behavior: str = ""
    actual_behavior: str = ""

@dataclass
class BugFix:
    diagnosis: str
    root_cause_file: str
    root_cause_line: int
    fix_description: str
    fix_code: str
    confidence: float


class BugFixAgent:
    """Bug 检测与修复 Agent"""

    def diagnose_and_fix(self, bug: BugReport) -> BugFix:
        # 1. 分析错误信息
        analysis = self._analyze_error(bug)
        # 2. 收集相关代码
        files = self._collect_relevant_code(bug, analysis)
        # 3. 定位根因
        root_cause = self._locate_root_cause(bug, files, analysis)
        # 4. 生成修复
        fix = self._generate_fix(bug, root_cause, files)
        # 5. 验证修复
        return self._verify_fix(fix)

    def _analyze_error(self, bug: BugReport) -> str:
        prompt = f"""分析错误信息，推断原因。

错误：{bug.error_message}
堆栈：{bug.stack_trace[:3000]}
复现步骤：{bug.reproduction_steps}

输出：错误类型、涉及的模块、排查方向。"""
        return self.llm.generate(prompt)

    def _collect_relevant_code(self, bug, analysis):
        """从堆栈跟踪中提取文件路径，读取相关代码"""
        import re
        files = {}
        paths = re.findall(r'File "([^"]+)"', bug.stack_trace)
        for p in paths:
            content = self.tools['file'].execute(path=p)
            if content and "错误" not in content:
                files[p] = content
        return files

    def _locate_root_cause(self, bug, files, analysis):
        """通过 LLM 定位根因"""
        files_text = "\n".join(f"=== {p} ===\n{c[:4000]}" for p, c in files.items())
        prompt = f"""根据错误和代码，定位根因。

错误：{bug.error_message}
分析：{analysis}

代码：
{files_text}

输出 JSON：{{"root_cause_file":"...", "root_cause_line":42,
"explanation":"...", "fix_direction":"..."}}"""
        import json
        response = self.llm.generate(prompt)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"explanation": response, "confidence": 0.3}
```

### 16.5.2 常见 Bug 模式库

维护 Bug 模式库可显著增强检测能力：

```python
BUG_PATTERNS = [
    {
        "pattern": "unhashable_type_in_set",
        "description": "不可哈希类型放入 set 或 dict 键",
        "detection": r"TypeError.*unhashable type",
        "auto_fix": "使用 frozenset 或 tuple 替代"
    },
    {
        "pattern": "off_by_one",
        "description": "循环边界或索引偏移错误",
        "detection": r"IndexError.*out of range",
        "auto_fix": "检查 range() 和 slice 的边界"
    },
    {
        "pattern": "null_reference",
        "description": "空值解引用",
        "detection": r"AttributeError.*NoneType",
        "auto_fix": "添加 None 检查或 Optional 类型"
    },
    {
        "pattern": "resource_leak",
        "description": "文件/连接未正确关闭",
        "detection": r"open\(.*[^:]with",
        "auto_fix": "使用 with 语句"
    },
]
```

## 16.6 代码解释与文档生成

### 16.6.1 智能代码解释

```python
class CodeExplainer:
    """根据受众调整解释深度"""

    LEVELS = {
        "beginner": "用类比帮助理解，避免术语",
        "intermediate": "解释实现细节和设计决策",
        "expert": "分析架构权衡和性能特征",
    }

    def explain(self, code: str, language: str = "python",
                level: str = "intermediate") -> str:
        style = self.LEVELS[level]
        prompt = f"""解释以下 {language} 代码。受众：{level}（{style}）

```{language}
{code[:6000]}
```

格式：
## 功能概述
## 工作原理（逐步）
## 关键概念
## 设计要点"""
        return self.llm.generate(prompt)
```

### 16.6.2 文档自动生成

```python
class DocGenerator:
    """文档生成 Agent"""

    def generate_docstring(self, code: str, language: str) -> str:
        """Google 风格文档字符串"""
        prompt = f"""为以下代码生成 Google 风格文档字符串。
包含 Args, Returns, Raises, Example。

```{language}
{code}
```

直接输出文档字符串（含三引号）。"""
        return self.llm.generate(prompt)

    def generate_readme(self, project_name: str,
                        description: str, files_info: str) -> str:
        prompt = f"""为项目生成 README.md。

项目：{project_name}
描述：{description}
文件信息：{files_info}

格式：标题、描述、功能、安装、快速开始、配置、API、贡献。"""
        return self.llm.generate(prompt)
```

## 16.7 项目脚手架生成

### 16.7.1 从描述到完整项目

```python
@dataclass
class ProjectSpec:
    name: str
    description: str
    tech_stack: str
    features: list[str]
    deployment: str = "docker"
    testing: str = "pytest"

class ProjectScaffolder:
    """项目脚手架 Agent"""

    def scaffold(self, spec: ProjectSpec) -> dict:
        # 1. 规划结构
        structure = self._plan_structure(spec)
        # 2. 生成源文件
        created = []
        for f in structure['files']:
            content = self._generate_file(f, spec)
            self.file.write(f['path'], content)
            created.append(f['path'])
        # 3. 生成配置（pyproject.toml, Dockerfile, .gitignore 等）
        configs = self._generate_configs(spec)
        for path, content in configs.items():
            self.file.write(path, content)
            created.append(path)
        # 4. 安装依赖并验证
        return {
            "project": spec.name,
            "files": created,
            "install": self.terminal.execute("pip install -r requirements.txt"),
        }

    def _generate_configs(self, spec: ProjectSpec) -> dict[str, str]:
        configs = {}
        if 'python' in spec.tech_stack.lower():
            configs['pyproject.toml'] = self._gen_pyproject(spec)
            configs['requirements.txt'] = self._gen_requirements(spec)
        if 'docker' in spec.deployment:
            configs['Dockerfile'] = self._gen_dockerfile(spec)
            configs['docker-compose.yml'] = self._gen_compose(spec)
        configs['.gitignore'] = self._gen_gitignore(spec)
        configs['README.md'] = self._gen_readme(spec)
        return configs
```

## 16.8 生产级实践：Claude Code 与 Cursor 的 Agent 化

### 16.8.1 Claude Code 的 Agentic Loop

Claude Code 代表了代码 Agent 的前沿实践：

1. **Agentic Loop**：Agent 自主规划、执行、验证
2. **Full Context**：读取整个仓库理解全局
3. **Tool Use**：通过工具与项目交互
4. **Self-Correction**：失败时自动分析、调整

```python
class AgenticCodeAssistant:
    """模拟 Claude Code 风格的 Agentic Loop"""

    def __init__(self, llm_client, working_dir: str):
        self.llm = llm_client
        self.tools = self._setup_tools(working_dir)
        self.history: list[dict] = []
        self.max_iterations = 20

    def run(self, task: str) -> str:
        self.history = [
            {"role": "system", "content": self._system_prompt()},
            {"role": "user", "content": task}
        ]
        for _ in range(self.max_iterations):
            response = self.llm.chat(self.history)
            if not self._needs_tool_call(response):
                return response  # 任务完成
            tool_results = self._execute_tools(response)
            self.history.append({"role": "assistant", "content": response})
            self.history.append({"role": "user", "content": tool_results})
        return "达到最大迭代次数。"

    def _system_prompt(self) -> str:
        return """你是高级编程助手。工作流程：
1. 理解需求 → 2. 阅读代码 → 3. 制定计划 →
4. 逐步实现 → 5. 运行测试 → 6. 自我修正

原则：最小化修改，修改后必须验证，不确定先问。"""
```

### 16.8.2 Cursor 风格的 IDE 集成模式

```
┌─────────────────────────────────────────┐
│              Cursor / IDE               │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Tab补全   │  │  Chat    │  │Composer│ │
│  │ 行内预测  │  │ 上下文对话│  │ 多文件  │ │
│  └─────┬────┘  └─────┬────┘  └───┬───┘ │
│        │             │          │      │
│  ┌─────▼─────────────▼──────────▼───┐  │
│  │        Context Engine            │  │
│  │  嵌入索引 + 相关性检索 +         │  │
│  │  语义去重 + Token 预算管理        │  │
│  └─────────────┬───────────────────┘  │
│                │                      │
│  ┌─────────────▼───────────────────┐  │
│  │        Codebase Index           │  │
│  │  AST解析 + 向量索引 + 符号表    │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 16.9 最佳实践与常见陷阱

### 16.9.1 最佳实践

**1. 分层上下文策略**
- CRITICAL 层：当前编辑的文件及其直接依赖
- HIGH 层：接口定义、类型声明
- MEDIUM 层：项目配置、架构文档
- 严格管理 Token 预算，为 LLM 回复预留空间

**2. 增量修改优于全量生成**
- 使用精确的字符串替换，而非重写整个文件
- `replace_in_file(old_string, new_string)` 比 `write_file(whole_content)` 更安全
- 修改前创建备份，失败时可回滚

**3. 测试驱动验证**
- 每次修改后运行测试，确保不引入回归
- 先运行已有测试确认当前状态（baseline）
- 修改后对比测试结果，只处理新增失败

**4. 安全边界**
- 文件操作：禁止路径遍历（`realpath` + 前缀检查）
- 命令执行：白名单策略，禁止 shell 元字符拼接
- 代码生成：拒绝生成包含恶意模式的代码

**5. 用户确认机制**
- 破坏性操作（删除文件、执行不可逆命令）前要求确认
- 展示 diff 预览，让用户审核后再应用
- 提供撤销能力（git stash 或文件备份）

### 16.9.2 常见陷阱

**陷阱 1：上下文幻觉**
- Agent 可能"编造"不存在的函数或 API
- 缓解：强制 Agent 先用搜索工具验证函数是否存在

**陷阱 2：过度重构**
- Agent 可能把能用的代码"优化"到无法运行
- 缓解：每次重构后必须运行测试；无测试的文件禁止重构

**陷阱 3：依赖冲突**
- Agent 生成的代码可能引入与项目不兼容的依赖
- 缓解：读取现有依赖文件（requirements.txt / package.json），在约束内选择

**陷阱 4：循环修正**
- Agent 修复 A 时引入 B，修复 B 时又引入 A，陷入死循环
- 缓解：设置最大迭代次数；记录已修复的问题列表

**陷阱 5：忽略项目约定**
- Agent 可能不遵循项目的编码规范和架构约定
- 缓解：将 `.eslintrc`、`pyproject.toml` 等配置文件纳入上下文

## 16.10 总结

代码 Agent 是 Agent 技术最成熟的应用领域之一。其核心挑战不是"能不能生成代码"，而是如何：

1. **理解上下文**：在有限 Token 预算内传递最相关的项目信息
2. **保证正确性**：通过测试验证和自我审查确保生成代码的质量
3. **安全可控**：在给予 Agent 能力的同时设置安全边界
4. **渐进增强**：从补全到生成，从单文件到多文件，从辅助到自主

未来的代码 Agent 将更加深入地集成开发工具链——从需求分析到代码编写、测试、部署、监控，形成完整的软件开发闭环。但核心原则不变：**Agent 是工具，开发者是决策者。** 最终的代码质量责任，永远在人而不在机器。

## 16.11 延伸阅读

1. **Claude Code 官方文档** — Anthropic 的 Agentic 编程助手设计理念
2. **Cursor 文档** — IDE 集成式 AI 编程的最佳实践
3. **Aider** — 开源终端代码 Agent，支持多种 LLM
4. **SWE-bench** — 代码 Agent 的标准评测基准
5. **HumanEval / MBPP** — 代码生成能力的评估数据集