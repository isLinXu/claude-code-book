# 第6章：工具调用与 Function Calling

> **工具是 Agent 从"对话系统"进化为"行动系统"的关键——它让 LLM 从纸上谈兵变为真枪实干**

---

## 6.1 Function Calling 机制

### 6.1.1 什么是 Function Calling

Function Calling（函数调用）是 LLM 提供的一种结构化能力，允许模型生成符合预定义 Schema 的函数调用请求，而非纯文本输出。

关键理解：**LLM 本身不执行函数**。它只是告诉你"我想调用这个函数，参数是这样的"。实际执行由你的应用代码完成，然后将结果返回给 LLM。

```
用户请求: "北京今天天气怎么样？"
        │
        ▼
┌──────────────────────────────────────────┐
│  LLM 推理:                                │
│  "用户想知道北京天气，我应该调用天气查询工具" │
│                                          │
│  输出 (不是文本！):                        │
│  {                                       │
│    "function": "get_weather",            │
│    "arguments": {"city": "北京"}         │
│  }                                       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  你的应用代码:                             │
│  1. 解析 LLM 的函数调用请求                │
│  2. 调用实际的天气 API                     │
│  3. 将结果返回给 LLM                      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  LLM 基于工具结果生成自然语言回答:          │
│  "北京今天晴，温度 25°C，风力 3 级。"       │
└──────────────────────────────────────────┘
```

### 6.1.2 Function Calling vs 传统方式

在 Function Calling 出现之前，让 LLM 调用工具通常使用基于文本解析的方式：

```python
# 传统方式：基于文本解析（脆弱、不稳定）
traditional_prompt = """你可以使用以下命令：
- WEATHER <城市>: 查询天气
- CALC <表达式>: 计算数学表达式

用户问：北京天气怎么样？"""

# LLM 可能输出: "WEATHER 北京" 或 "WEATHER(city=北京)" 或其他变体
# 你需要用正则表达式/字符串匹配来解析——非常脆弱

# Function Calling 方式（结构化、可靠）
# LLM 输出的是标准化的 JSON:
# {"name": "get_weather", "arguments": {"city": "北京"}}
# 解析可靠，不依赖文本格式
```

### 6.1.3 主流模型的 Function Calling 支持

| 提供商 | API | 特点 |
|--------|-----|------|
| OpenAI | `tools` 参数 | 最成熟，支持并行调用 |
| Anthropic | `tool_choice` + `tools` | 支持 cache_control 优化 |
| Google Gemini | `function_declarations` | 支持原生 Python 函数导入 |
| Anthropic Bedrock | 同 Anthropic | AWS 集成 |

```python
# OpenAI Function Calling 基本示例
from openai import OpenAI

client = OpenAI()

# 1. 定义工具
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如 北京、上海、New York"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 2. 发送请求
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "北京和上海今天哪个热？"}],
    tools=tools,
    tool_choice="auto"  # 让模型自动决定是否调用工具
)

# 3. 检查是否有工具调用
message = response.choices[0].message
if message.tool_calls:
    for tool_call in message.tool_calls:
        print(f"工具: {tool_call.function.name}")
        print(f"参数: {tool_call.function.arguments}")
        # 输出:
        # 工具: get_weather
        # 参数: {"city": "北京", "unit": "celsius"}
```

---

## 6.2 工具定义与描述

### 6.2.1 JSON Schema 规范

工具的参数定义遵循 JSON Schema 规范。LLM 依赖这些定义来理解工具能做什么、需要什么参数。

```python
# 完整的工具定义示例
tool_definition = {
    "type": "function",
    "function": {
        "name": "search_database",
        "description": """在数据库中搜索记录。支持按字段筛选、排序和分页。
        
        适合场景：查找用户信息、订单记录、产品数据等结构化数据。
        不适合：全文搜索（使用 search_documents）、实时数据（使用 get_realtime_data）。
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["users", "orders", "products", "reviews"],
                    "description": "要查询的数据表"
                },
                "query": {
                    "type": "object",
                    "description": "查询条件",
                    "properties": {
                        "field": {
                            "type": "string",
                            "description": "查询字段名"
                        },
                        "operator": {
                            "type": "string",
                            "enum": ["eq", "ne", "gt", "lt", "gte", "lte", "like", "in"],
                            "description": "比较运算符"
                        },
                        "value": {
                            "description": "查询值，类型根据字段而定"
                        }
                    },
                    "required": ["field", "operator", "value"]
                },
                "sort_by": {
                    "type": "string",
                    "description": "排序字段"
                },
                "sort_order": {
                    "type": "string",
                    "enum": ["asc", "desc"],
                    "default": "desc"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 10,
                    "description": "返回结果数量"
                }
            },
            "required": ["table", "query"]
        }
    }
}
```

### 6.2.2 工具描述的艺术

工具描述是 LLM 决定是否调用该工具、如何调用该工具的唯一依据。写好描述至关重要。

```python
# ❌ 糟糕的描述
bad_tools = [
    {
        "name": "db",
        "description": "数据库操作",
        "parameters": {
            "type": "object",
            "properties": {
                "q": {"type": "string"},
                "opts": {"type": "object"}
            }
        }
    }
]

# ✅ 优秀的描述
good_tools = [
    {
        "name": "query_user_orders",
        "description": """查询指定用户的历史订单。
        
        返回订单列表，包含订单号、金额、状态、创建时间。
        按创建时间倒序排列。
        
        注意：只能查询已完成的订单，进行中的订单请使用 get_active_order。
        """,
        "parameters": {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "用户唯一标识符"
                },
                "status": {
                    "type": "string",
                    "enum": ["completed", "cancelled", "refunded"],
                    "description": "订单状态筛选，不传则返回所有状态"
                },
                "date_from": {
                    "type": "string",
                    "format": "date",
                    "description": "起始日期 (YYYY-MM-DD)"
                },
                "date_to": {
                    "type": "string",
                    "format": "date",
                    "description": "截止日期 (YYYY-MM-DD)"
                }
            },
            "required": ["user_id"]
        }
    }
]
```

**工具描述的黄金法则：**

1. **说清楚做什么**，不要只说名字
2. **说清楚适用场景**，帮助 LLM 做出正确选择
3. **说清楚不适合的场景**，避免误用
4. **参数描述要具体**，包含格式、范围、示例
5. **标注必填/可选**，减少无效调用

### 6.2.3 从 Python 函数自动生成工具定义

手动编写 JSON Schema 既繁琐又容易出错。我们可以从 Python 函数自动生成：

```python
import inspect
from typing import get_type_hints, get_origin, get_args

def function_to_tool(
    func: callable,
    name: str | None = None,
    description: str | None = None
) -> dict:
    """将 Python 函数转换为工具定义"""
    
    # 获取函数信息
    sig = inspect.signature(func)
    hints = get_type_hints(func)
    doc = inspect.getdoc(func) or ""
    
    # 解析参数
    properties = {}
    required = []
    
    for param_name, param in sig.parameters.items():
        if param_name == "self":
            continue
        
        param_type = hints.get(param_name, str)
        param_info = {"type": _python_type_to_json_type(param_type)}
        
        # 默认值
        if param.default != inspect.Parameter.empty:
            param_info["default"] = param.default
        else:
            required.append(param_name)
        
        # 从 docstring 提取参数描述
        param_desc = _extract_param_description(doc, param_name)
        if param_desc:
            param_info["description"] = param_desc
        
        properties[param_name] = param_info
    
    return {
        "type": "function",
        "function": {
            "name": name or func.__name__,
            "description": description or doc.split("\n\n")[0] if doc else "",
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }
    }


def _python_type_to_json_type(python_type) -> str:
    """将 Python 类型映射为 JSON Schema 类型"""
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
    }
    
    if python_type in type_map:
        return type_map[python_type]
    
    origin = get_origin(python_type)
    if origin is list:
        args = get_args(python_type)
        return "array"
    
    return "string"  # 默认


def _extract_param_description(docstring: str, param_name: str) -> str:
    """从 docstring 提取参数描述"""
    import re
    # 匹配 Args: 部分
    match = re.search(
        rf'{param_name}\s*[:：]\s*(.+?)(?:\n|$)',
        docstring,
        re.IGNORECASE
    )
    return match.group(1).strip() if match else ""


# ===== 使用示例 =====

def search_documents(
    query: str,
    top_k: int = 5,
    filter_category: str | None = None
) -> list[dict]:
    """在文档库中搜索相关文档。
    
    Args:
        query: 搜索关键词或问题
        top_k: 返回的最大文档数量，默认5
        filter_category: 按类别筛选，如 "技术文档"、"API参考"
    
    Returns:
        匹配的文档列表，每个文档包含 title, content, score
    """
    pass

# 自动生成工具定义
tool_def = function_to_tool(search_documents)
print(tool_def)
# 输出标准的 OpenAI tools 格式
```

---

## 6.3 工具注册与发现

### 6.3.1 工具注册中心

当 Agent 拥有大量工具时，需要一个统一的注册和发现机制：

```python
from typing import Any, Callable
from pydantic import BaseModel, Field, create_model
from enum import Enum

class ToolCategory(Enum):
    """工具分类"""
    SEARCH = "search"          # 搜索与检索
    CALCULATION = "calc"       # 计算与数学
    FILE_IO = "file"           # 文件操作
    COMMUNICATION = "comm"     # 通信与消息
    DATA_ACCESS = "data"       # 数据访问
    SYSTEM = "system"          # 系统操作
    CUSTOM = "custom"          # 自定义

class ToolMeta(BaseModel):
    """工具元数据"""
    name: str
    description: str
    category: ToolCategory
    version: str = "1.0.0"
    requires_auth: bool = False
    rate_limit: int | None = None  # 每分钟调用次数限制
    timeout_seconds: float = 30.0
    cost_per_call: float = 0.0     # 每次调用的成本（美元）

class RegisteredTool:
    """已注册的工具"""
    
    def __init__(
        self,
        handler: Callable,
        definition: dict,
        meta: ToolMeta
    ):
        self.handler = handler
        self.definition = definition
        self.meta = meta
        self._call_count = 0
        self._error_count = 0
    
    def execute(self, **kwargs) -> Any:
        """执行工具"""
        import time
        self._call_count += 1
        
        start = time.time()
        try:
            # 参数验证（使用 Pydantic）
            validated = self._validate_args(kwargs)
            result = self.handler(**validated)
            return {"status": "success", "data": result}
        except Exception as e:
            self._error_count += 1
            return {"status": "error", "error": str(e)}
        finally:
            duration = time.time() - start
            if duration > self.meta.timeout_seconds:
                print(f"⚠️ 工具 {self.meta.name} 执行超时: {duration:.1f}s")
    
    def _validate_args(self, args: dict) -> dict:
        """验证参数"""
        # 从工具定义构建 Pydantic 模型并验证
        schema = self.definition["function"]["parameters"]
        properties = schema.get("properties", {})
        
        validated = {}
        for key, value in args.items():
            if key in properties:
                validated[key] = value
            else:
                print(f"⚠️ 未知参数: {key}")
        
        # 检查必填参数
        for required in schema.get("required", []):
            if required not in validated:
                raise ValueError(f"缺少必填参数: {required}")
        
        return validated
    
    @property
    def stats(self) -> dict:
        return {
            "name": self.meta.name,
            "calls": self._call_count,
            "errors": self._error_count,
            "error_rate": (
                self._error_count / self._call_count
                if self._call_count > 0 else 0
            )
        }


class ToolRegistry:
    """工具注册中心"""
    
    def __init__(self):
        self._tools: dict[str, RegisteredTool] = {}
    
    def register(
        self,
        handler: Callable,
        definition: dict,
        meta: ToolMeta
    ):
        """注册工具"""
        tool = RegisteredTool(handler, definition, meta)
        self._tools[meta.name] = tool
    
    def register_from_function(
        self,
        func: Callable,
        category: ToolCategory = ToolCategory.CUSTOM,
        description: str | None = None,
        **meta_kwargs
    ):
        """从 Python 函数注册"""
        tool_def = function_to_tool(func, description=description)
        meta = ToolMeta(
            name=func.__name__,
            description=description or inspect.getdoc(func) or "",
            category=category,
            **meta_kwargs
        )
        self.register(func, tool_def, meta)
    
    def get(self, name: str) -> RegisteredTool | None:
        """获取工具"""
        return self._tools.get(name)
    
    def get_all_definitions(self) -> list[dict]:
        """获取所有工具定义（用于发送给 LLM）"""
        return [tool.definition for tool in self._tools.values()]
    
    def get_definitions_by_category(self, category: ToolCategory) -> list[dict]:
        """按分类获取工具定义"""
        return [
            tool.definition
            for tool in self._tools.values()
            if tool.meta.category == category
        ]
    
    def discover(self, query: str) -> list[str]:
        """根据自然语言描述发现相关工具"""
        """简单的关键词匹配发现"""
        relevant = []
        query_lower = query.lower()
        
        for name, tool in self._tools.items():
            score = 0
            desc = tool.meta.description.lower()
            name_lower = name.lower()
            
            # 关键词匹配
            for word in query_lower.split():
                if word in desc:
                    score += 2
                if word in name_lower:
                    score += 3
            
            if score > 0:
                relevant.append((score, name))
        
        relevant.sort(reverse=True)
        return [name for _, name in relevant]
    
    def list_tools(self) -> list[dict]:
        """列出所有工具及其状态"""
        return [tool.stats for tool in self._tools.values()]


# ===== 使用示例 =====
registry = ToolRegistry()

# 注册工具
registry.register_from_function(
    search_documents,
    category=ToolCategory.SEARCH,
    requires_auth=False
)

registry.register_from_function(
    get_weather,
    category=ToolCategory.DATA_ACCESS,
    rate_limit=60
)

# 发现工具
print(registry.discover("帮我查一下天气"))  # ['get_weather']
print(registry.discover("搜索相关文档"))    # ['search_documents']

# 获取所有工具定义
all_tools = registry.get_all_definitions()
```

### 6.3.2 工具发现优化

当工具数量很多时（如超过20个），直接将所有工具定义发给 LLM 会导致：

1. Token 消耗大
2. LLM 选择准确率下降
3. 响应变慢

解决方案——两级发现策略：

```python
class SmartToolSelector:
    """智能工具选择器"""
    
    def __init__(self, registry: ToolRegistry, llm):
        self.registry = registry
        self.llm = llm
    
    def select_tools(self, query: str, max_tools: int = 5) -> list[dict]:
        """为查询选择最相关的工具"""
        
        # 第一级：快速关键词过滤
        candidate_names = self.registry.discover(query)
        
        if len(candidate_names) <= max_tools:
            # 候选工具不太多，直接返回
            return [
                self.registry.get(name).definition
                for name in candidate_names
            ]
        
        # 第二级：LLM 精选
        candidates = [
            {
                "name": name,
                "description": self.registry.get(name).meta.description
            }
            for name in candidate_names
        ]
        
        prompt = f"""用户请求：{query}

以下是可以使用的工具：
{json.dumps(candidates, ensure_ascii=False, indent=2)}

请选择最相关的 {max_tools} 个工具来处理这个请求。
只返回工具名称的 JSON 数组，如 ["tool1", "tool2"]。"""
        
        response = self.llm.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        
        try:
            selected_names = json.loads(response.content)
            return [
                self.registry.get(name).definition
                for name in selected_names
                if self.registry.get(name)
            ]
        except json.JSONDecodeError:
            # 降级：返回前 N 个候选
            return [
                self.registry.get(name).definition
                for name in candidate_names[:max_tools]
            ]
```

---

## 6.4 并行工具调用

### 6.4.1 并行调用的意义

当 LLM 判断多个工具调用之间没有依赖关系时，可以并行发起多个调用，显著提升效率。

```
用户: "帮我查一下北京、上海、深圳的天气，然后计算三个城市的平均温度"

串行执行（慢）:
  get_weather(北京) → 等待 → get_weather(上海) → 等待 → get_weather(深圳) → 等待 → calculator()

并行执行（快）:
  get_weather(北京) ──┐
  get_weather(上海) ──┤ 同时执行
  get_weather(深圳) ──┘
          ↓
      calculator()  ← 依赖前面三个结果
```

### 6.4.2 并行调用实现

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelToolExecutor:
    """并行工具执行器"""
    
    def __init__(self, registry: ToolRegistry, max_workers: int = 5):
        self.registry = registry
        self.max_workers = max_workers
    
    async def execute_parallel(
        self,
        tool_calls: list[dict]
    ) -> list[dict]:
        """
        并行执行多个工具调用
        
        tool_calls: [
            {
                "id": "call_abc123",
                "function": {
                    "name": "get_weather",
                    "arguments": '{"city": "北京"}'
                }
            },
            ...
        ]
        """
        semaphore = asyncio.Semaphore(self.max_workers)
        
        async def execute_one(call: dict) -> dict:
            async with semaphore:
                func_name = call["function"]["name"]
                func_args = json.loads(call["function"]["arguments"])
                
                tool = self.registry.get(func_name)
                if not tool:
                    return {
                        "tool_call_id": call["id"],
                        "content": f"错误：未知工具 {func_name}",
                        "status": "error"
                    }
                
                try:
                    result = await asyncio.to_tool(
                        tool.handler, **func_args
                    )
                    return {
                        "tool_call_id": call["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                        "status": "success"
                    }
                except Exception as e:
                    return {
                        "tool_call_id": call["id"],
                        "content": f"错误：{str(e)}",
                        "status": "error"
                    }
        
        # 并发执行所有工具调用
        results = await asyncio.gather(
            *[execute_one(call) for call in tool_calls],
            return_exceptions=True
        )
        
        return [
            r if isinstance(r, dict) else {
                "status": "error",
                "content": f"执行异常：{str(r)}"
            }
            for r in results
        ]
    
    def analyze_dependencies(
        self,
        tool_calls: list[dict]
    ) -> list[list[dict]]:
        """
        分析工具调用之间的依赖关系，分组为可并行执行的批次
        
        返回：[batch1, batch2, ...]
        batch1 中的所有调用可以并行，batch2 依赖 batch1 的结果
        """
        # 简化实现：没有参数引用之前调用结果的，都可以并行
        # 更复杂的实现需要分析参数间的数据流
        
        batches = []
        current_batch = []
        
        for call in tool_calls:
            args = json.loads(call["function"]["arguments"])
            depends_on_previous = False
            
            # 检查参数是否引用了之前调用的结果
            for value in args.values():
                if isinstance(value, str) and "$" in value:
                    depends_on_previous = True
                    break
            
            if depends_on_previous:
                batches.append(current_batch)
                current_batch = [call]
            else:
                current_batch.append(call)
        
        if current_batch:
            batches.append(current_batch)
        
        return batches
```

### 6.4.3 OpenAI 的并行调用

OpenAI API 原生支持并行工具调用：

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "北京和上海天气对比"}],
    tools=tools,
    parallel_tool_calls=True  # 启用并行调用
)

message = response.choices[0].message

# message.tool_calls 可能包含多个调用
if message.tool_calls:
    print(f"LLM 请求了 {len(message.tool_calls)} 个并行调用")
    
    # 工具调用1
    call1 = message.tool_calls[0]
    # call1.function.name = "get_weather"
    # call1.function.arguments = '{"city": "北京"}'
    
    # 工具调用2
    call2 = message.tool_calls[1]
    # call2.function.name = "get_weather"
    # call2.function.arguments = '{"city": "上海"}'
    
    # 并行执行两个调用，然后一次性返回所有结果
    results = await parallel_executor.execute_parallel(message.tool_calls)
    
    # 将所有结果一起返回给 LLM
    messages = [
        {"role": "user", "content": "北京和上海天气对比"},
        message.model_dump(),  # 包含 tool_calls 的 assistant 消息
        *[
            {"role": "tool", "tool_call_id": r["tool_call_id"], "content": r["content"]}
            for r in results
        ]
    ]
    
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools
    )
```

---

## 6.5 工具调用的错误处理

### 6.5.1 常见错误类型

```python
class ToolError(Exception):
    """工具错误基类"""
    def __init__(self, message: str, recoverable: bool = True):
        super().__init__(message)
        self.recoverable = recoverable

class ToolNotFoundError(ToolError):
    """工具不存在"""
    def __init__(self, tool_name: str):
        super().__init__(f"工具 '{tool_name}' 不存在", recoverable=False)

class ToolExecutionError(ToolError):
    """工具执行失败"""
    def __init__(self, tool_name: str, reason: str):
        super().__init__(
            f"工具 '{tool_name}' 执行失败：{reason}",
            recoverable=True
        )

class ToolTimeoutError(ToolError):
    """工具执行超时"""
    def __init__(self, tool_name: str, timeout: float):
        super().__init__(
            f"工具 '{tool_name}' 执行超时（{timeout}s）",
            recoverable=True
        )

class ToolArgumentError(ToolError):
    """工具参数错误"""
    def __init__(self, tool_name: str, reason: str):
        super().__init__(
            f"工具 '{tool_name}' 参数错误：{reason}",
            recoverable=True
        )

class ToolRateLimitError(ToolError):
    """工具调用频率超限"""
    def __init__(self, tool_name: str, retry_after: float = 60.0):
        super().__init__(
            f"工具 '{tool_name}' 频率超限，{retry_after}s 后重试",
            recoverable=True
        )
        self.retry_after = retry_after

class ToolPermissionError(ToolError):
    """权限不足"""
    def __init__(self, tool_name: str, required_permission: str):
        super().__init__(
            f"工具 '{tool_name}' 需要权限：{required_permission}",
            recoverable=False
        )
```

### 6.5.2 错误处理中间件

```python
import asyncio
from functools import wraps
from datetime import datetime, timedelta

class ToolErrorHandler:
    """工具错误处理器"""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self._error_log: list[dict] = []
    
    async def safe_execute(
        self,
        tool: RegisteredTool,
        args: dict
    ) -> dict:
        """安全执行工具（带重试和降级）"""
        
        for attempt in range(self.max_retries + 1):
            try:
                # 检查超时
                result = await asyncio.wait_for(
                    asyncio.to_tool(tool.handler, **args),
                    timeout=tool.meta.timeout_seconds
                )
                return {"status": "success", "data": result}
            
            except asyncio.TimeoutError:
                self._log_error(tool.meta.name, "TIMEOUT", None)
                if attempt < self.max_retries:
                    await self._backoff(attempt)
                    continue
                return self._handle_timeout(tool)
            
            except ToolRateLimitError as e:
                self._log_error(tool.meta.name, "RATE_LIMIT", str(e))
                if attempt < self.max_retries:
                    await asyncio.sleep(e.retry_after)
                    continue
                return {"status": "error", "error": "频率超限，请稍后重试"}
            
            except ToolArgumentError as e:
                self._log_error(tool.meta.name, "ARGUMENT_ERROR", str(e))
                return {"status": "error", "error": f"参数错误：{e}", "recoverable": True}
            
            except ToolPermissionError as e:
                self._log_error(tool.meta.name, "PERMISSION", str(e))
                return {"status": "error", "error": f"权限不足：{e}", "recoverable": False}
            
            except Exception as e:
                self._log_error(tool.meta.name, "UNKNOWN", str(e))
                if attempt < self.max_retries:
                    await self._backoff(attempt)
                    continue
                return {"status": "error", "error": f"未知错误：{e}"}
        
        return {"status": "error", "error": "重试次数已耗尽"}
    
    def _backoff(self, attempt: int):
        """指数退避"""
        delay = self.base_delay * (2 ** attempt)
        import random
        delay = delay * (0.5 + random.random())  # 添加随机抖动
        return asyncio.sleep(delay)
    
    def _handle_timeout(self, tool: RegisteredTool) -> dict:
        """处理超时"""
        return {
            "status": "error",
            "error": f"工具 {tool.meta.name} 执行超时",
            "suggestion": "尝试简化请求或稍后重试",
            "recoverable": True
        }
    
    def _log_error(self, tool_name: str, error_type: str, message: str):
        """记录错误"""
        self._error_log.append({
            "tool": tool_name,
            "error_type": error_type,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_error_summary(self) -> dict:
        """获取错误摘要"""
        if not self._error_log:
            return {"total_errors": 0}
        
        from collections import Counter
        type_counts = Counter(e["error_type"] for e in self._error_log)
        tool_counts = Counter(e["tool"] for e in self._error_log)
        
        return {
            "total_errors": len(self._error_log),
            "by_type": dict(type_counts),
            "by_tool": dict(tool_counts),
            "recent_errors": self._error_log[-5:]
        }
```

### 6.5.3 将错误信息返回给 LLM

```python
def format_error_for_llm(error_result: dict) -> str:
    """将错误信息格式化为 LLM 友好的文本"""
    if error_result["status"] == "success":
        return json.dumps(error_result["data"], ensure_ascii=False)
    
    error = error_result.get("error", "未知错误")
    recoverable = error_result.get("recoverable", True)
    suggestion = error_result.get("suggestion", "")
    
    parts = [f"工具调用失败：{error}"]
    
    if recoverable:
        parts.append("这是一个可恢复的错误。你可以：")
        parts.append("1. 检查参数是否正确，重新调用")
        parts.append("2. 尝试使用其他工具达到相同目的")
        parts.append("3. 基于已有信息给出回答")
    else:
        parts.append("这是一个不可恢复的错误。请放弃此工具，尝试其他方案。")
    
    if suggestion:
        parts.append(f"建议：{suggestion}")
    
    return "\n".join(parts)

# 在 Agent 循环中使用
# 当工具返回错误时，将格式化的错误信息作为 tool result 返回给 LLM
# LLM 会根据错误信息决定是否重试或切换策略
```

---

## 6.6 自定义工具开发

### 6.6.1 工具开发框架

```python
from abc import ABC, abstractmethod

class BaseTool(ABC):
    """工具基类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述"""
        pass
    
    @property
    @abstractmethod
    def parameters_schema(self) -> dict:
        """参数 JSON Schema"""
        pass
    
    @abstractmethod
    def execute(self, **kwargs) -> Any:
        """执行工具"""
        pass
    
    def to_openai_tool(self) -> dict:
        """转换为 OpenAI tools 格式"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters_schema
            }
        }
    
    def validate_args(self, args: dict) -> dict:
        """验证参数"""
        schema = self.parameters_schema
        required = schema.get("required", [])
        properties = schema.get("properties", {})
        
        for field in required:
            if field not in args:
                raise ToolArgumentError(
                    self.name, f"缺少必填参数：{field}"
                )
        
        for key, value in args.items():
            if key not in properties:
                raise ToolArgumentError(
                    self.name, f"未知参数：{key}"
                )
        
        return args
```

### 6.6.2 实战：开发一个代码执行工具

```python
class CodeExecutionTool(BaseTool):
    """安全代码执行工具"""
    
    def __init__(
        self,
        timeout: float = 30.0,
        max_output_length: int = 10000,
        allowed_modules: list[str] | None = None
    ):
        self.timeout = timeout
        self.max_output_length = max_output_length
        self.allowed_modules = allowed_modules or [
            "math", "json", "re", "datetime",
            "collections", "itertools", "statistics"
        ]
    
    @property
    def name(self) -> str:
        return "execute_code"
    
    @property
    def description(self) -> str:
        return """执行 Python 代码并返回结果。
        
        支持标准库中的 math, json, re, datetime 等模块。
        不支持网络请求、文件系统操作。
        
        使用场景：数学计算、数据处理、算法验证。
        不适合：需要外部 API、文件操作的任务。"""
    
    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "要执行的 Python 代码"
                },
                "language": {
                    "type": "string",
                    "enum": ["python"],
                    "default": "python",
                    "description": "编程语言（目前仅支持 Python）"
                }
            },
            "required": ["code"]
        }
    
    def execute(self, code: str, language: str = "python") -> dict:
        """执行代码"""
        import sys
        from io import StringIO
        import traceback
        
        # 安全检查
        self._security_check(code)
        
        # 准备执行环境
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        stdout_capture = StringIO()
        stderr_capture = StringIO()
        
        # 限制可用模块
        safe_globals = {
            "__builtins__": {
                "print": print,
                "range": range,
                "len": len,
                "int": int,
                "float": float,
                "str": str,
                "list": list,
                "dict": dict,
                "set": set,
                "tuple": tuple,
                "sorted": sorted,
                "enumerate": enumerate,
                "zip": zip,
                "map": map,
                "filter": filter,
                "min": min,
                "max": max,
                "sum": sum,
                "abs": abs,
                "round": round,
                "type": type,
                "isinstance": isinstance,
                "True": True,
                "False": False,
                "None": None,
            }
        }
        
        # 加载允许的模块
        for module_name in self.allowed_modules:
            try:
                safe_globals[module_name] = __import__(module_name)
            except ImportError:
                pass
        
        result = {
            "stdout": "",
            "stderr": "",
            "error": None,
            "return_value": None
        }
        
        try:
            sys.stdout = stdout_capture
            sys.stderr = stderr_capture
            
            # 使用信号或线程实现超时
            exec(code, safe_globals, safe_globals)
            
        except Exception as e:
            result["error"] = f"{type(e).__name__}: {str(e)}"
            result["stderr"] = traceback.format_exc()
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
        
        result["stdout"] = stdout_capture.getvalue()[:self.max_output_length]
        result["stderr"] = stderr_capture.getvalue()[:self.max_output_length]
        
        return result
    
    def _security_check(self, code: str):
        """安全检查"""
        dangerous_patterns = [
            r'\bimport\s+(?!math|json|re|datetime|collections|itertools|statistics)',
            r'\b__import__\b',
            r'\bos\.',
            r'\bsubprocess\b',
            r'\bexec\b',
            r'\beval\b',
            r'\bopen\s*\(',
            r'\bgetattr\b',
            r'\bsetattr\b',
            r'\bdelattr\b',
            r'\bcompile\b',
            r'\bglobals\b',
            r'\blocals\b',
        ]
        
        import re
        for pattern in dangerous_patterns:
            if re.search(pattern, code):
                raise ToolPermissionError(
                    self.name,
                    f"代码包含不允许的操作：{pattern}"
                )
```

### 6.6.3 实战：开发一个 API 调用工具

```python
class APICallTool(BaseTool):
    """通用 API 调用工具"""
    
    def __init__(
        self,
        base_url: str,
        default_headers: dict | None = None,
        auth_token: str | None = None,
        timeout: float = 15.0
    ):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}
        self.auth_token = auth_token
        self.timeout = timeout
    
    @property
    def name(self) -> str:
        return "api_call"
    
    @property
    def description(self) -> str:
        return f"""调用 {self.base_url} 的 API 接口。
        
        支持 GET、POST、PUT、DELETE 方法。
        自动处理认证和错误重试。
        
        使用场景：获取远程数据、提交表单、更新资源。
        """
    
    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "method": {
                    "type": "string",
                    "enum": ["GET", "POST", "PUT", "DELETE"],
                    "default": "GET",
                    "description": "HTTP 方法"
                },
                "endpoint": {
                    "type": "string",
                    "description": "API 端点路径，如 /users, /orders/123"
                },
                "params": {
                    "type": "object",
                    "description": "查询参数（GET 请求）"
                },
                "body": {
                    "type": "object",
                    "description": "请求体（POST/PUT 请求）"
                }
            },
            "required": ["endpoint"]
        }
    
    def execute(
        self,
        endpoint: str,
        method: str = "GET",
        params: dict | None = None,
        body: dict | None = None
    ) -> dict:
        """执行 API 调用"""
        import httpx
        
        url = f"{self.base_url}{endpoint}"
        headers = {
            **self.default_headers,
            "Content-Type": "application/json"
        }
        
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.request(
                    method=method,
                    url=url,
                    params=params,
                    json=body,
                    headers=headers
                )
                
                result = {
                    "status_code": response.status_code,
                    "data": None,
                    "error": None
                }
                
                try:
                    result["data"] = response.json()
                except Exception:
                    result["data"] = response.text
                
                if response.status_code >= 400:
                    result["error"] = f"HTTP {response.status_code}: {response.text[:500]}"
                
                return result
                
        except httpx.TimeoutException:
            raise ToolTimeoutError(self.name, self.timeout)
        except httpx.ConnectError as e:
            raise ToolExecutionError(self.name, f"连接失败：{e}")
```

### 6.6.4 工具组合与编排

有时一个高级功能需要组合多个基础工具：

```python
class CompositeTool(BaseTool):
    """组合工具——将多个工具组合为一个高级功能"""
    
    def __init__(self, name: str, description: str, steps: list[dict]):
        self._name = name
        self._description = description
        self.steps = steps
        self._registry: ToolRegistry | None = None
    
    def set_registry(self, registry: ToolRegistry):
        self._registry = registry
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    @property
    def parameters_schema(self) -> dict:
        # 从所有步骤中提取输入参数
        input_params = {}
        for step in self.steps:
            if step.get("type") == "input":
                for param_name, param_schema in step.get("params", {}).items():
                    input_params[param_name] = param_schema
        
        return {
            "type": "object",
            "properties": input_params,
            "required": [
                k for k, v in input_params.items()
                if not v.get("default")
            ]
        }
    
    def execute(self, **kwargs) -> Any:
        """按步骤执行组合工具"""
        context = dict(kwargs)  # 共享上下文
        
        for i, step in enumerate(self.steps):
            step_type = step["type"]
            
            if step_type == "tool_call":
                tool_name = step["tool"]
                tool = self._registry.get(tool_name)
                if not tool:
                    raise ToolNotFoundError(tool_name)
                
                # 从上下文中填充参数
                args = {}
                for param_name, param_source in step.get("args", {}).items():
                    if isinstance(param_source, str) and param_source.startswith("$"):
                        # 引用上下文变量
                        var_name = param_source[1:]
                        args[param_name] = context[var_name]
                    else:
                        args[param_name] = param_source
                
                result = tool.execute(**args)
                context[f"step_{i}_result"] = result
                
                if isinstance(result, dict) and result.get("status") == "error":
                    return result
                
            elif step_type == "transform":
                # 数据转换步骤
                source = step["source"]
                if source.startswith("$"):
                    context[f"step_{i}_result"] = context[source[1:]]
            
            elif step_type == "output":
                # 最终输出
                source = step["source"]
                if source.startswith("$"):
                    return context[source[1:]]
        
        return context.get("step_result", "执行完成")


# 示例：创建一个"获取城市信息"的组合工具
city_info_tool = CompositeTool(
    name="get_city_info",
    description="获取城市的综合信息，包括天气、人口、景点等",
    steps=[
        {"type": "input", "params": {
            "city": {"type": "string", "description": "城市名称"}
        }},
        {"type": "tool_call", "tool": "get_weather", "args": {"city": "$city"}},
        {"type": "tool_call", "tool": "search_wiki", "args": {"query": "$city"}},
        {"type": "output", "source": "$step_2_result"}
    ]
)
```

---

## 6.7 常见陷阱与最佳实践

### 6.7.1 常见陷阱

#### 陷阱1：工具定义不一致

```python
# ❌ 定义与实际实现不一致
definition = {
    "name": "get_user",
    "parameters": {"properties": {"user_id": {"type": "string"}}}
}

# 但实际函数接受的参数是 "id" 而不是 "user_id"
def get_user(id: int):  # 类型也不一致！
    ...

# ✅ 确保定义与实现一致
# 使用前面介绍的 function_to_tool 自动生成
```

#### 陷阱2：不限制工具的副作用

```python
# ❌ 没有确认机制的破坏性操作
def delete_all_records(table: str):
    db.execute(f"DELETE FROM {table}")  # 直接删除！

# ✅ 添加确认机制和审计日志
def delete_records(table: str, condition: str, dry_run: bool = True):
    if dry_run:
        return preview_deletion(table, condition)
    else:
        audit_log(f"DELETE from {table} where {condition}")
        return actual_delete(table, condition)
```

#### 陷阱3：工具返回信息过多

```python
# ❌ 返回整个数据库记录
def search_products(query: str):
    return db.query("SELECT * FROM products WHERE name LIKE ?", f"%{query}%")
    # 可能返回数千条记录，消耗大量 Token

# ✅ 限制返回数量，只返回必要字段
def search_products(query: str, limit: int = 5):
    results = db.query(
        "SELECT id, name, price FROM products WHERE name LIKE ? LIMIT ?",
        f"%{query}%", limit
    )
    return results
```

### 6.7.2 最佳实践

```python
# 完整的工具开发检查清单
TOOL_DEVELOPMENT_CHECKLIST = """
## 工具开发最佳实践清单

### ✅ 设计
- [ ] 工具职责单一（Single Responsibility）
- [ ] 描述清晰，包含适用/不适用场景
- [ ] 参数命名符合直觉，有完整的描述
- [ ] 有合理的默认值

### ✅ 安全
- [ ] 输入验证（类型、范围、格式）
- [ ] SQL注入/XSS 防护
- [ ] 破坏性操作需要确认机制
- [ ] 资源访问权限检查
- [ ] 敏感数据脱敏

### ✅ 可靠性
- [ ] 超时保护
- [ ] 重试机制（带指数退避）
- [ ] 错误信息对 LLM 友好
- [ ] 返回结果大小可控

### ✅ 可观测性
- [ ] 调用日志记录
- [ ] 执行耗时监控
- [ ] 错误率统计
- [ ] 审计追踪

### ✅ 测试
- [ ] 单元测试覆盖正常/异常路径
- [ ] 集成测试验证端到端流程
- [ ] LLM 调用准确性测试
"""
```

---

## 6.8 本章小结

本章我们全面探讨了工具调用与 Function Calling 的实现：

1. **Function Calling 机制**：LLM 生成结构化调用请求，应用代码执行并返回结果
2. **工具定义**：JSON Schema 规范，工具描述的艺术，从 Python 函数自动生成定义
3. **工具注册与发现**：注册中心模式，智能工具选择器
4. **并行工具调用**：提升多工具场景下的执行效率
5. **错误处理**：分类错误体系、重试策略、错误信息格式化
6. **自定义工具开发**：基础框架、代码执行工具、API 调用工具、组合工具

**核心洞察：** Function Calling 是 Agent 的"手和脚"。精心设计的工具定义是 Agent 高效工作的前提。好的工具系统应该安全、可靠、可观测，并且对 LLM 友好。

---

> **下一章**：[第7章：记忆与上下文管理](ch07_记忆与上下文管理.md) —— 让 Agent 拥有"记忆"，不再每次都从零开始。
