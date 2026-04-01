# 附录B：常用工具与API速查

> **"好的API文档是开发者最好的朋友。"**
> 本附录收录Agent开发中最常用的外部API和工具，力求"即查即用"。

---

## B.1 大语言模型API

### B.1.1 OpenAI API

**基础信息**

| 项目 | 说明 |
|------|------|
| Base URL | `https://api.openai.com/v1` |
| 认证方式 | Bearer Token (`Authorization: Bearer sk-...`) |
| SDK | `pip install openai` |
| 支持模型 | GPT-4o, GPT-4o-mini, o1, o1-mini, o3-mini, DALL-E 3, Whisper, TTS |

**Chat Completion — 最小示例**

```python
from openai import OpenAI

client = OpenAI(api_key="sk-...")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "你是一个有帮助的助手。"},
        {"role": "user", "content": "什么是RAG？"}
    ],
    temperature=0.7,
    max_tokens=1000,
)

print(response.choices[0].message.content)
```

**流式输出**

```python
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

**函数调用（Tool Use）**

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["city"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
    tools=tools,
    tool_choice="auto",
)

# 检查是否有工具调用
if response.choices[0].message.tool_calls:
    tool_call = response.choices[0].message.tool_calls[0]
    function_name = tool_call.function.name
    function_args = json.loads(tool_call.function.arguments)
    # 执行本地函数...
```

**关键参数速查**

| 参数 | 类型 | 说明 | 推荐值 |
|------|------|------|--------|
| `model` | string | 模型名称 | `gpt-4o`（通用）, `gpt-4o-mini`（低成本） |
| `temperature` | float | 随机性 0-2 | 0（事实性）, 0.7（创造性）, 1.0（多样性） |
| `max_tokens` | integer | 最大输出token | 视需求，通常500-4000 |
| `top_p` | float | 核采样 | 1.0（不限制）, 0.9（常用） |
| `frequency_penalty` | float | 频率惩罚 -2到2 | 0（默认） |
| `presence_penalty` | float | 存在惩罚 -2到2 | 0（默认） |
| `stop` | list/string | 停止序列 | `["\n"]`, `"<|im_end|>"] |
| `response_format` | object | 输出格式 | `{"type": "json_object"}` |
| `seed` | integer | 确定性种子 | 固定值用于可复现性 |

**Token计费参考（2025 Q4）**

| 模型 | 输入价格 | 输出价格 | 上下文窗口 | 适合场景 |
|------|---------|---------|-----------|---------|
| GPT-4o | $2.50/1M | $10.00/1M | 128K | 通用任务 |
| GPT-4o-mini | $0.15/1M | $0.60/1M | 128K | 高频低复杂度 |
| o1 | $15.00/1M | $60.00/1M | 200K | 复杂推理 |
| o3-mini | $1.10/1M | $4.40/1M | 200K | 性价比推理 |
| GPT-4.1 | $2.00/1M | $8.00/1M | 1M | 长文档处理 |

⚠️ **常见陷阱**

1. **Token计算**：中文1个字≈1.5-2个token，预估时需要考虑
2. **速率限制**：免费/低等级API key有严格的RPM/TPM限制
3. **超时处理**：长文本生成需要设置合理的timeout
4. **JSON模式**：使用 `response_format={"type": "json_object"}` 时，prompt中必须明确提到JSON

---

### B.1.2 Anthropic API (Claude)

**基础信息**

| 项目 | 说明 |
|------|------|
| Base URL | `https://api.anthropic.com/v1` |
| 认证方式 | `x-api-key` Header + `anthropic-version` Header |
| SDK | `pip install anthropic` |
| 支持模型 | Claude Opus 4, Claude Sonnet 4, Claude Haiku 3.5 |
| API版本 | `2023-06-01` |

**Messages API — 最小示例**

```python
import anthropic

client = anthropic.Anthropic(api_key="sk-ant-...")

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="你是一个有帮助的助手。",
    messages=[
        {"role": "user", "content": "什么是RAG？"}
    ],
)

print(message.content[0].text)
```

**Claude独特功能**

```python
# 扩展思考（Extended Thinking）- 复杂推理场景
message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # 思考token预算
    },
    messages=[
        {"role": "user", "content": "请分析量子计算对密码学的影响"}
    ]
)

# 读取思考过程（调试用）
for block in message.content:
    if block.type == "thinking":
        print(f"[思考] {block.thinking}")
    elif block.type == "text":
        print(f"[回答] {block.text}")
```

**工具调用**

```python
tools = [
    {
        "name": "get_weather",
        "description": "获取城市天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名"}
            },
            "required": ["city"]
        }
    }
]

# 第一次调用 - 获取工具请求
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    tools=tools,
    messages=[{"role": "user", "content": "北京天气？"}]
)

# 提取工具调用
tool_use = next(b for b in response.content if b.type == "tool_use")
print(f"调用: {tool_use.name}({tool_use.input})")

# 第二次调用 - 返回工具结果
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    tools=tools,
    messages=[
        {"role": "user", "content": "北京天气？"},
        {"role": "assistant", "content": response.content},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": tool_use.id, "content": "晴天，25°C"}
        ]}
    ]
)
```

**Token计费参考**

| 模型 | 输入价格 | 输出价格 | 上下文窗口 | 适合场景 |
|------|---------|---------|-----------|---------|
| Claude Opus 4 | $15.00/1M | $75.00/1M | 200K | 最强能力 |
| Claude Sonnet 4 | $3.00/1M | $15.00/1M | 200K | 最佳性价比 |
| Claude Haiku 3.5 | $0.80/1M | $4.00/1M | 200K | 高速低延迟 |

⚠️ **常见陷阱**

1. **API Header差异**：Anthropic用 `x-api-key` 而非 `Authorization: Bearer`
2. **system位置**：system prompt是顶层参数，不在messages数组中
3. **content格式**：assistant消息中tool_use和text可能同时存在，需要遍历content数组
4. **缓存提示**：使用 `cache_control: {"type": "ephemeral"}` 可以降低重复prompt的成本

---

### B.1.3 本地模型推理

**Ollama — 最简单的本地推理方案**

```bash
# 安装并运行
curl -fsSL https://ollama.com/install.sh | sh
ollama run llama3.1:8b
ollama run qwen2.5:14b

# OpenAI兼容API
# Base URL: http://localhost:11434/v1
```

```python
# 使用OpenAI SDK连接Ollama
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"  # 任意值
)

response = client.chat.completions.create(
    model="qwen2.5:14b",
    messages=[{"role": "user", "content": "你好"}]
)
```

**vLLM — 高性能推理服务**

```bash
# 启动推理服务
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-14B-Instruct \
    --tensor-parallel-size 2 \
    --max-model-len 8192 \
    --port 8000
```

```python
# 完全兼容OpenAI API
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="not-needed")
```

**本地模型推荐**

| 模型 | 参数量 | 显存需求 | 能力水平 | 推荐场景 |
|------|-------|---------|---------|---------|
| Qwen2.5-7B-Instruct | 7B | 8GB | 中等 | 通用对话 |
| Qwen2.5-14B-Instruct | 14B | 16GB | 良好 | 复杂任务 |
| Llama-3.1-8B | 8B | 8GB | 中等 | 英文场景 |
| DeepSeek-Coder-V2-Lite | 16B | 20GB | 代码强 | 编程辅助 |
| Mistral-Nemo-12B | 12B | 12GB | 良好 | 多语言 |

---

## B.2 向量数据库

### B.2.1 选择指南

| 数据库 | 类型 | 许可证 | 最大规模 | 延迟 | 适合场景 |
|--------|------|--------|---------|------|---------|
| **Pinecone** | 托管 | 商业 | 10亿+ | < 50ms | 快速上手，无需运维 |
| **Weaviate** | 自托管/托管 | BSD-3 | 10亿+ | < 100ms | 全功能，混合搜索 |
| **Milvus** | 自托管 | Apache 2.0 | 100亿+ | < 100ms | 超大规模 |
| **Chroma** | 嵌入式 | Apache 2.0 | 100万+ | < 10ms | 本地开发/原型 |
| **Qdrant** | 自托管/托管 | Apache 2.0 | 10亿+ | < 50ms | 高性能过滤 |

### B.2.2 Chroma — 嵌入式首选

```python
import chromadb
from chromadb.utils import embedding_functions

# 初始化（嵌入式，无需服务器）
client = chromadb.PersistentClient(path="./chroma_db")

# OpenAI嵌入函数
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key="sk-...",
    model_name="text-embedding-3-small"
)

# 创建集合
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=openai_ef,
    metadata={"hnsw:space": "cosine"}
)

# 添加文档
collection.add(
    documents=["RAG是检索增强生成的缩写", "Agent是自主的AI系统"],
    metadatas=[{"source": "wiki"}, {"source": "wiki"}],
    ids=["doc1", "doc2"]
)

# 查询
results = collection.query(
    query_texts=["什么是RAG？"],
    n_results=3,
    where={"source": "wiki"}  # 元数据过滤
)
```

### B.2.3 Pinecone — 托管服务首选

```python
from pinecone import Pinecone

pc = Pinecone(api_key="your-key")

# 创建索引
pc.create_index(
    name="agent-docs",
    dimension=1536,  # text-embedding-3-small维度
    metric="cosine",
    spec={"serverless": {"cloud": "aws", "region": "us-east-1"}}
)

# 连接
index = pc.Index("agent-docs")

# 插入向量
index.upsert(
    vectors=[
        {"id": "v1", "values": [0.1, 0.2, ...], "metadata": {"source": "doc1"}},
        {"id": "v2", "values": [0.3, 0.4, ...], "metadata": {"source": "doc2"}},
    ]
)

# 查询
results = index.query(
    vector=[0.1, 0.2, ...],
    top_k=5,
    include_metadata=True,
    filter={"source": {"$eq": "doc1"}}
)
```

**Pinecone Serverless计费**

| 项目 | 价格 |
|------|------|
| 索引存储 | $0.14/GB/月 |
| 读取 | $2.00/百万次查询 |
| 写入 | $1.00/百万次更新 |
| 命名空间 | 前100个免费 |

### B.2.4 Milvus — 超大规模首选

```python
from pymilvus import MilvusClient, DataType

# 连接
client = MilvusClient(uri="http://localhost:19530")

# 创建集合
client.create_collection(
    collection_name="documents",
    dimension=1536,
    metric_type="COSINE",
    id_type="string",  # 支持自定义ID
)

# 插入数据
client.insert(
    collection_name="documents",
    data=[
        {"id": "doc1", "vector": [0.1, ...], "text": "RAG技术介绍", "source": "wiki"},
        {"id": "doc2", "vector": [0.3, ...], "text": "Agent架构设计", "source": "wiki"},
    ]
)

# 搜索
results = client.search(
    collection_name="documents",
    data=[[0.1, ...]],  # 查询向量
    limit=5,
    output_fields=["text", "source"],
    filter='source == "wiki"'
)
```

**Milvus部署资源建议**

| 规模 | CPU | 内存 | 存储 | 推荐配置 |
|------|-----|------|------|---------|
| 开发 | 4核 | 8GB | 50GB SSD | 单机Docker |
| 生产（小） | 8核 | 32GB | 200GB SSD | 3节点集群 |
| 生产（大） | 16核 | 64GB | 1TB SSD | 5+节点集群 |
| 超大规模 | 32核+ | 128GB+ | 10TB+ | K8s集群 |

### B.2.5 Qdrant — 高性能过滤首选

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient(host="localhost", port=6333)

# 创建集合
client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# 插入
client.upsert(
    collection_name="docs",
    points=[
        PointStruct(id=1, vector=[0.1, ...], payload={"text": "RAG介绍"}),
    ]
)

# 搜索（带复杂过滤）
results = client.search(
    collection_name="docs",
    query_vector=[0.1, ...],
    query_filter={
        "must": [
            {"key": "category", "match": {"value": "tech"}},
            {"key": "date", "range": {"gte": "2025-01-01"}}
        ]
    },
    limit=10
)
```

---

## B.3 嵌入模型

### B.3.1 嵌入模型对比

| 模型 | 维度 | 最大输入 | 速度 | 质量 | 价格 | 推荐场景 |
|------|------|---------|------|------|------|---------|
| `text-embedding-3-small` | 1536 | 8191 tokens | 快 | 良好 | $0.02/1M tokens | 通用 |
| `text-embedding-3-large` | 3072 | 8191 tokens | 中 | 优秀 | $0.13/1M tokens | 高质量 |
| `text-embedding-ada-002` | 1536 | 8191 tokens | 快 | 一般 | $0.10/1M tokens | 兼容旧系统 |
| `bge-large-zh-v1.5` | 1024 | 512 tokens | 快 | 优秀(中文) | 免费(本地) | 中文场景 |
| `bge-m3` | 1024 | 8192 tokens | 中 | 优秀(多语言) | 免费(本地) | 多语言 |
| `m3e-base` | 768 | 512 tokens | 快 | 良好(中文) | 免费(本地) | 轻量中文 |
| `nomic-embed-text` | 768 | 8192 tokens | 快 | 良好 | 免费(本地) | 通用本地 |
| `cohere-embed-v3` | 1024 | 512 tokens | 快 | 优秀 | $0.10/1M tokens | 多语言 |

### B.3.2 OpenAI嵌入 — 快速使用

```python
from openai import OpenAI

client = OpenAI(api_key="sk-...")

# 基础嵌入
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="这是一段需要嵌入的文本",
    dimensions=1536  # 可降维以节省存储
)

embedding = response.data[0].embedding
print(f"维度: {len(embedding)}")

# 批量嵌入（降低API调用次数）
texts = ["文本1", "文本2", "文本3", ...]  # 最多2048条
response = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts
)
```

### B.3.3 本地嵌入 — 使用sentence-transformers

```python
from sentence_transformers import SentenceTransformer

# 加载模型（首次会自动下载）
model = SentenceTransformer('BAAI/bge-large-zh-v1.5')

# 单条嵌入
embedding = model.encode("RAG是检索增强生成")

# 批量嵌入
texts = ["文本1", "文本2", "文本3"]
embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)

# 查看维度
print(f"维度: {embeddings.shape[1]}")  # 1024
```

💡 **嵌入降维技巧**

```python
# OpenAI支持直接降维
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="文本",
    dimensions=512  # 从1536降到512，节省2/3存储
)

# 本地模型使用PCA降维
from sklearn.decomposition import PCA
import numpy as np

embeddings = model.encode(texts)
pca = PCA(n_components=256)
reduced = pca.fit_transform(embeddings)
```

---

## B.4 搜索引擎API

### B.4.1 Tavily — AI优化的搜索API

```python
import tavily

# 安装: pip install tavily-python

client = tavily.TavilyClient(api_key="tvly-...")

# 基础搜索
result = client.search("RAG技术最新进展", max_results=5)

# AI Agent专用搜索
result = client.search(
    query="RAG技术最新进展",
    search_depth="advanced",  # basic | advanced
    include_answer=True,       # AI生成摘要
    include_raw_content=True,  # 原始网页内容
    max_results=5
)

# 提取结果
for r in result["results"]:
    print(f"标题: {r['title']}")
    print(f"URL: {r['url']}")
    print(f"内容: {r['content'][:200]}...")
```

**Tavily计费**

| 计划 | 月价格 | 搜索次数 | 特点 |
|------|--------|---------|------|
| Free | $0 | 1000次 | 基础搜索 |
| Starter | $40 | 1000次 | 深度搜索 |
| Pro | $100 | 5000次 | API优先支持 |
| Enterprise | 定制 | 定制 | SLA保障 |

### B.4.2 SerpAPI — Google搜索结果

```python
from serpapi import GoogleSearch

params = {
    "api_key": "your-key",
    "engine": "google",
    "q": "RAG技术最新进展",
    "num": 10,
    "gl": "cn",   # 地理位置
    "hl": "zh-cn"  # 语言
}

search = GoogleSearch(params)
results = search.get_dict()

for organic in results.get("organic_results", []):
    print(f"标题: {organic['title']}")
    print(f"链接: {organic['link']}")
    print(f"摘要: {organic.get('snippet', 'N/A')}")
```

### B.4.3 Brave Search API

```python
import requests

headers = {"X-Subscription-Token": "your-key"}
params = {"q": "RAG technology", "count": 5}

response = requests.get(
    "https://api.search.brave.com/res/v1/web/search",
    headers=headers,
    params=params
)

data = response.json()
for web in data.get("web", {}).get("results", []):
    print(f"标题: {web['title']}")
    print(f"URL: {web['url']}")
```

**搜索引擎对比**

| API | 月价格 | 搜索质量 | 中文支持 | 速率限制 |
|-----|--------|---------|---------|---------|
| Tavily | $0-100+ | AI优化 | ✅ | 按计划 |
| SerpAPI | $50-500+ | Google原生 | ✅ | 100/月免费 |
| Brave Search | $0-25+ | 良好 | ⚠️ | 2000/月免费 |
| Bing Web Search | $0+ | 良好 | ✅ | 1000/月免费 |

---

## B.5 文件处理工具

### B.5.1 PDF处理

**PyPDF2 — 基础PDF操作**

```python
from pypdf import PdfReader, PdfWriter

# 读取PDF
reader = PdfReader("document.pdf")
print(f"页数: {len(reader.pages)}")

# 提取文本
full_text = ""
for page in reader.pages:
    full_text += page.extract_text() + "\n"

# 提取元数据
meta = reader.metadata
print(f"标题: {meta.title}")
print(f"作者: {meta.author}")
```

**Unstructured — 智能文档解析**

```bash
pip install unstructured[all-docs]
```

```python
from unstructured.partition.auto import partition

# 自动检测文件类型并解析
elements = partition(filename="document.pdf")

for element in elements:
    print(f"类型: {type(element).__name__}")
    print(f"内容: {str(element)[:200]}")
```

**pdfplumber — 表格提取**

```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    for page in pdf.pages:
        # 提取表格
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

### B.5.2 文档转换

**python-docx — Word文档操作**

```python
from docx import Document

# 读取Word文档
doc = Document("report.docx")

# 提取所有段落
for para in doc.paragraphs:
    print(f"[{para.style.name}] {para.text}")

# 提取表格
for table in doc.tables:
    for row in table.rows:
        cells = [cell.text for cell in row.cells]
        print(" | ".join(cells))
```

**pandas — 数据文件处理**

```python
import pandas as pd

# 读取Excel
df = pd.read_excel("data.xlsx", sheet_name="Sheet1")

# 读取CSV
df = pd.read_csv("data.csv", encoding="utf-8")

# 读取JSON
df = pd.read_json("data.json")

# 转换为文本（适合嵌入）
text = df.to_string(index=False)
```

### B.5.3 多媒体处理

**FFmpeg — 音视频处理**

```bash
# 音频转文字（配合Whisper）
ffmpeg -i audio.mp3 -ar 16000 -ac 1 audio_16k.wav

# 提取音频
ffmpeg -i video.mp4 -vn -acodec copy audio.aac

# 视频截图
ffmpeg -i video.mp4 -ss 00:01:30 -frames:v 1 screenshot.jpg
```

**Whisper — 语音转文字**

```python
import whisper

model = whisper.load_model("base")  # tiny, base, small, medium, large
result = model.transcribe("audio.mp3", language="zh")

print(result["text"])
```

**Pillow — 图像处理**

```python
from PIL import Image

# 读取图像
img = Image.open("photo.jpg")
print(f"尺寸: {img.size}")

# 转换格式
img.save("photo.png")

# 压缩
img.save("photo_compressed.jpg", quality=85, optimize=True)

# 获取Base64（用于多模态API）
import base64
import io

buffer = io.BytesIO()
img.save(buffer, format="JPEG")
b64 = base64.b64encode(buffer.getvalue()).decode()
```

---

## B.6 实用工具库

### B.6.1 HTTP客户端

```python
import httpx

# 异步HTTP客户端（推荐用于Agent开发）
async def fetch(url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.text

# 带重试
async def fetch_with_retry(url: str, max_retries: int = 3):
    async with httpx.AsyncClient() as client:
        for attempt in range(max_retries):
            try:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # 指数退避
```

### B.6.2 JSON处理

```python
import json
import orjson  # 高性能JSON库

# 标准JSON
data = json.loads(json_string)
json_string = json.dumps(data, ensure_ascii=False, indent=2)

# orjson（快2-3倍）
data = orjson.loads(json_bytes)
json_bytes = orjson.dumps(data, option=orjson.OPT_INDENT_2)
```

### B.6.3 环境变量管理

```python
# python-dotenv
from dotenv import load_dotenv
import os

load_dotenv()  # 加载.env文件

api_key = os.getenv("OPENAI_API_KEY")
assert api_key, "OPENAI_API_KEY 环境变量未设置"
```

```bash
# .env 文件
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

### B.6.4 日志记录

```python
import logging
import structlog

# 标准logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("my_agent")

# structlog（推荐用于Agent，结构化日志）
structlog.configure(processors=[
    structlog.processors.add_log_level,
    structlog.processors.JSONRenderer()
])
logger = structlog.get_logger()

logger.info("agent_invocation", model="gpt-4o", latency_ms=1200, tokens=500)
```

---

## B.7 成本估算工具

### B.7.1 Token计数

```python
import tiktoken

# OpenAI模型
enc = tiktoken.encoding_for_model("gpt-4o")
token_count = len(enc.encode("这是一段文本"))
print(f"Token数: {token_count}")

# 通用计数（适用于大多数模型）
enc = tiktoken.get_encoding("cl100k_base")
```

### B.7.2 成本估算公式

```
单次请求成本 = (input_tokens × input_price + output_tokens × output_price) / 1,000,000

月度成本估算 = 日均请求量 × 30 × 单次请求成本 × 1.2 (20%余量)
```

**示例**：

假设使用GPT-4o，日均1000次请求，平均每次输入1000 tokens + 输出500 tokens：

```
单次成本 = (1000 × $2.50 + 500 × $10.00) / 1,000,000 = $0.0075
月度成本 = 1000 × 30 × $0.0075 × 1.2 = $270
```

### B.7.3 成本优化速查

| 策略 | 节省幅度 | 实现难度 |
|------|---------|---------|
| 使用GPT-4o-mini替代GPT-4o | 60-80% | ⭐ |
| Prompt缓存（Anthropic） | 90%（缓存命中） | ⭐⭐ |
| 上下文压缩 | 30-50% | ⭐⭐ |
| 语义缓存 | 50-80%（缓存命中） | ⭐⭐⭐ |
| 模型路由（简单→复杂） | 40-60% | ⭐⭐ |
| 本地模型（部分请求） | 80-100%（本地部分） | ⭐⭐⭐⭐ |

---

*附录B完*
