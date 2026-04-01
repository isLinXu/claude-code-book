# 第12章：RAG增强Agent

> **LLM 的知识有保质期，而且永远不会更新。要让 Agent 真正拥有"活的知识"，它需要的不是一个更大的模型，而是一个更聪明的检索系统。**

---

## 12.1 概述

### 12.1.1 LLM 的知识困境

大语言模型（LLM）有一个根本性的局限：**它的知识在训练完成的那一刻就被冻结了**。无论 GPT-4o、Claude 3.5 还是 Gemini，它们都无法回答训练截止日期之后发生的事件，也无法访问你公司的内部文档、私有数据库或实时业务数据。

更关键的问题在于**幻觉（Hallucination）**。当 LLM 遇到知识边界时，它不会坦诚地说"我不知道"，而是会"自信地编造"。在企业场景中，一个给出错误技术方案或财务数据的 Agent，其危害远比直接回答"不知道"要大得多。

```
┌──────────────────────────────────────────────────────────────┐
│                    LLM 知识的三重困境                           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ 知识过期     │  │ 私有数据缺失 │  │ 幻觉问题            │   │
│  │             │  │             │  │                     │   │
│  │ 训练数据    │  │ 企业内部    │  │ "自信地编造"        │   │
│  │ 截止在      │  │ 文档不在    │  │ 看似合理实则        │   │
│  │ 2025年X月  │  │ 训练集中    │  │ 错误的答案          │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│         ▲                ▲                    ▲               │
│         │                │                    │               │
│         └────────────────┼────────────────────┘               │
│                          ▼                                    │
│              ┌──────────────────────┐                         │
│              │   RAG: 检索增强生成    │                         │
│              │   (Retrieval          │                         │
│              │    Augmented           │                         │
│              │    Generation)         │                         │
│              │                       │                         │
│              │  让 LLM 基于检索到的   │                         │
│              │  真实文档来回答问题     │                         │
│              └──────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### 12.1.2 什么是 RAG

RAG（Retrieval-Augmented Generation，检索增强生成）的核心思想极其优雅：

1. **检索（Retrieval）**：当用户提问时，先从一个大型文档库中检索出与问题最相关的文档片段
2. **增强（Augmentation）**：将这些文档片段作为上下文，注入到 LLM 的提示词中
3. **生成（Generation）**：LLM 基于这些真实的上下文信息来生成回答

```python
# RAG 的核心流程（伪代码）
def rag_answer(user_question: str) -> str:
    # Step 1: 检索相关文档
    relevant_docs = vector_store.search(
        query=embed(user_question),
        top_k=5
    )
    
    # Step 2: 构建增强提示
    context = "\n\n".join(doc.content for doc in relevant_docs)
    prompt = f"""
    基于以下参考资料回答用户问题。
    如果参考资料中没有相关信息，请直接回答"我不知道"。
    
    参考资料：
    {context}
    
    用户问题：{user_question}
    """
    
    # Step 3: LLM 生成回答
    answer = llm.generate(prompt)
    return answer
```

### 12.1.3 为什么 Agent 需要 RAG

单纯的 RAG 系统回答问题是被动的——用户问什么就答什么。但 **RAG 增强 Agent** 则赋予了系统主动性和多步推理能力：

| 特性 | 传统 RAG | RAG 增强 Agent |
|------|---------|---------------|
| 交互模式 | 单轮问答 | 多轮对话 |
| 推理能力 | 直接检索+回答 | 规划→检索→分析→综合 |
| 工具使用 | 仅检索 | 检索 + 计算 + API调用 |
| 自我反思 | 无 | 可评估回答质量并重试 |
| 多源融合 | 单一知识库 | 跨知识库、数据库、Web |
| 主动学习 | 无 | 可主动更新知识库 |

一个 RAG 增强 Agent 不仅能回答"你的退货政策是什么？"，还能回答"帮我对比三家供应商的价格，并给出采购建议"。后者需要多次检索、数据计算和综合推理。

### 12.1.4 RAG 的发展历程

RAG 技术自 2020 年由 Meta（Facebook AI Research）提出以来，已经经历了多代演进：

```
RAG 技术演进时间线
═══════════════════════════════════════════════════════

2020  RAG 论文发表
      │  Meta 提出标准 RAG 范式
      │  (Lewis et al., "Retrieval-Augmented Generation")
      │
2021  朴素 RAG (Naive RAG)
      │  Document → Split → Embed → Store → Retrieve → Generate
      │  简单粗暴，效果有限
      │
2022  高级 RAG (Advanced RAG)
      │  引入：重排序(Reranking)、查询重写(Query Rewriting)
      │  混合检索(Hybrid Search)、多跳检索(Multi-hop)
      │
2023  模块化 RAG (Modular RAG)
      │  RAG 组件可插拔替换
      │  LangChain/LlamaIndex 生态繁荣
      │
2024  Agent化 RAG
      │  RAG + Agent 推理能力
      │  自适应检索、Self-RAG、CRAG
      │
2025  GraphRAG + Agentic RAG
      │  知识图谱与 RAG 深度融合
      │  多 Agent 协作检索、自动知识库管理
═══════════════════════════════════════════════════════
```

---

## 12.2 RAG 架构深入

### 12.2.1 完整架构总览

一个生产级 RAG 系统包含多个协作组件，每个组件都有多种实现选择：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RAG 系统完整架构                               │
│                                                                     │
│  ┌──── 索引阶段 (Indexing) ────────────────────────────────────┐    │
│  │                                                              │    │
│  │  文档源        文档处理           向量化           存储       │    │
│  │  ┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │    │
│  │  │PDF   │───▶│ Loader   │───▶│ Splitter │───▶│ Embedding│  │    │
│  │  │HTML  │    │          │    │          │    │          │  │    │
│  │  │Word  │    └──────────┘    └──────────┘    └────┬─────┘  │    │
│  │  │Markdown│                                         │        │    │
│  │  │Database│                                         ▼        │    │
│  │  │API    │                                   ┌──────────┐    │    │
│  │  └──────┘                                   │ Vector   │    │    │
│  │                                             │ Store    │    │    │
│  │  ┌──────┐                                   │          │    │    │
│  │  │ Meta │───────────────────────────────────▶│ Metadata │    │    │
│  │  │ data │                                   │ Index    │    │    │
│  │  └──────┘                                   └──────────┘    │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──── 查询阶段 (Querying) ─────────────────────────────────────┐    │
│  │                                                              │    │
│  │  用户查询                                                   │    │
│  │    │                                                        │    │
│  │    ▼                                                        │    │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐               │    │
│  │  │ Query    │───▶│ Retriever│───▶│Reranker  │───▶ Top-K 文档 │    │
│  │  │ Rewrite  │    │          │    │          │               │    │
│  │  └──────────┘    │ 稠密检索  │    │  交叉编码 │               │    │
│  │                  │ 稀疏检索  │    │  精排    │               │    │
│  │                  │ 混合检索  │    └──────────┘               │    │
│  │                  └──────────┘                                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──── 生成阶段 (Generation) ────────────────────────────────────┐   │
│  │                                                              │    │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐               │    │
│  │  │ Context  │───▶│   LLM    │───▶│ Response │               │    │
│  │  │ Assembly │    │ Generate │    │ & Cite   │               │    │
│  │  └──────────┘    └──────────┘    └──────────┘               │    │
│  │       │                ▲                                       │    │
│  │       │                │                                       │    │
│  │       └── 反馈循环 ────┘ (Self-RAG: 自我评估 + 补充检索)       │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.2.2 Document Loader（文档加载器）

文档加载器负责将各种格式的文档统一转换为纯文本或结构化文本：

```python
from pathlib import Path
from typing import AsyncIterator
import json

class Document:
    """统一文档表示"""
    def __init__(
        self,
        content: str,
        metadata: dict,
        source: str,
        doc_id: str | None = None
    ):
        self.content = content
        self.metadata = metadata  # 标题、作者、日期、标签等
        self.source = source
        self.doc_id = doc_id
    
    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "metadata": self.metadata,
            "source": self.source,
            "doc_id": self.doc_id
        }


class DocumentLoader:
    """统一文档加载器"""
    
    def __init__(self):
        self._loaders = {
            ".pdf": self._load_pdf,
            ".md": self._load_markdown,
            ".txt": self._load_text,
            ".html": self._load_html,
            ".docx": self._load_docx,
            ".json": self._load_json,
        }
    
    def load(self, path: str) -> Document:
        """加载单个文档"""
        suffix = Path(path).suffix.lower()
        loader = self._loaders.get(suffix)
        if loader is None:
            raise ValueError(f"Unsupported format: {suffix}")
        return loader(path)
    
    async def load_directory(
        self,
        directory: str,
        recursive: bool = True
    ) -> AsyncIterator[Document]:
        """批量加载目录中的文档"""
        dir_path = Path(directory)
        pattern = "**/*" if recursive else "*"
        
        for file_path in dir_path.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in self._loaders:
                try:
                    doc = self.load(str(file_path))
                    yield doc
                except Exception as e:
                    print(f"Failed to load {file_path}: {e}")
    
    def _load_pdf(self, path: str) -> Document:
        """加载 PDF 文档"""
        import pdfplumber
        
        text_parts = []
        metadata = {}
        
        with pdfplumber.open(path) as pdf:
            metadata = {
                "title": pdf.metadata.get("Title", ""),
                "author": pdf.metadata.get("Author", ""),
                "pages": len(pdf.pages),
                "format": "pdf"
            }
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        
        return Document(
            content="\n\n".join(text_parts),
            metadata=metadata,
            source=path,
            doc_id=f"pdf_{Path(path).stem}"
        )
    
    def _load_markdown(self, path: str) -> Document:
        """加载 Markdown 文档"""
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # 提取 Front Matter（如果有）
        metadata = {"format": "markdown"}
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                try:
                    metadata.update(json.loads(parts[1]))
                except json.JSONDecodeError:
                    # YAML 格式的 front matter
                    import yaml
                    try:
                        metadata.update(yaml.safe_load(parts[1]) or {})
                    except:
                        pass
                content = parts[2].strip()
        
        return Document(
            content=content,
            metadata=metadata,
            source=path,
            doc_id=f"md_{Path(path).stem}"
        )
    
    def _load_text(self, path: str) -> Document:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return Document(
            content=content,
            metadata={"format": "text"},
            source=path,
            doc_id=f"txt_{Path(path).stem}"
        )
    
    def _load_html(self, path: str) -> Document:
        from bs4 import BeautifulSoup
        
        with open(path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        
        # 移除 script 和 style
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        
        return Document(
            content=soup.get_text(separator="\n", strip=True),
            metadata={"format": "html", "title": soup.title.string if soup.title else ""},
            source=path,
            doc_id=f"html_{Path(path).stem}"
        )
    
    def _load_docx(self, path: str) -> Document:
        from docx import Document as DocxDocument
        
        doc = DocxDocument(path)
        content = "\n\n".join(para.text for para in doc.paragraphs if para.text.strip())
        
        return Document(
            content=content,
            metadata={"format": "docx"},
            source=path,
            doc_id=f"docx_{Path(path).stem}"
        )
    
    def _load_json(self, path: str) -> Document:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 递归展平 JSON 为文本
        text_parts = []
        def flatten(obj, prefix=""):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    flatten(v, f"{prefix}{k}.")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    flatten(v, f"{prefix}[{i}].")
            else:
                text_parts.append(f"{prefix.rstrip('.')}: {obj}")
        
        flatten(data)
        
        return Document(
            content="\n".join(text_parts),
            metadata={"format": "json"},
            source=path,
            doc_id=f"json_{Path(path).stem}"
        )
```

### 12.2.3 Text Splitter（文本分割器）

文本分割是 RAG 中最关键也最容易被忽视的环节。分块策略直接影响检索质量。

```python
from dataclasses import dataclass
from typing import List
import re

@dataclass
class Chunk:
    """文档块"""
    content: str
    chunk_id: str
    metadata: dict
    start_index: int
    end_index: int


class BaseSplitter:
    """分块器基类"""
    def split(self, text: str, metadata: dict = None) -> List[Chunk]:
        raise NotImplementedError
    
    def split_documents(self, documents: List[Document]) -> List[Chunk]:
        chunks = []
        for doc in documents:
            chunks.extend(self.split(doc.content, doc.metadata))
        return chunks


class FixedSizeSplitter(BaseSplitter):
    """固定大小分块器 — 最简单的方案"""
    
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def split(self, text: str, metadata: dict = None) -> List[Chunk]:
        if not text:
            return []
        
        metadata = metadata or {}
        chunks = []
        start = 0
        chunk_idx = 0
        
        while start < len(text):
            end = start + self.chunk_size
            chunk_text = text[start:end]
            
            chunks.append(Chunk(
                content=chunk_text,
                chunk_id=f"chunk_{chunk_idx}",
                metadata={**metadata, "chunk_index": chunk_idx, "splitter": "fixed"},
                start_index=start,
                end_index=end
            ))
            
            start += self.chunk_size - self.chunk_overlap
            chunk_idx += 1
        
        return chunks


class RecursiveCharacterSplitter(BaseSplitter):
    """递归字符分块器 — LangChain 的默认方案
    
    优先级：段落 → 句子 → 单词 → 字符
    尽量在自然边界处分割，保持语义完整性
    """
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separators: List[str] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or [
            "\n\n",  # 段落
            "\n",    # 换行
            "。",    # 中文句号
            "！",    # 中文感叹号
            "？",    # 中文问号
            "；",    # 中文分号
            ". ",    # 英文句号
            "? ",    # 英文问号
            "! ",    # 英文感叹号
            "; ",    # 英文分号
            ", ",    # 英文逗号
            "，",    # 中文逗号
            " ",     # 空格
            "",      # 字符级
        ]
    
    def split(self, text: str, metadata: dict = None) -> List[Chunk]:
        metadata = metadata or {}
        final_chunks = []
        self._recursive_split(text, self.separators, self.chunk_size, final_chunks)
        
        # 添加 overlap 和元数据
        result = []
        for i, chunk_text in enumerate(final_chunks):
            result.append(Chunk(
                content=chunk_text,
                chunk_id=f"chunk_{i}",
                metadata={**metadata, "chunk_index": i, "splitter": "recursive"},
                start_index=text.find(chunk_text) if chunk_text in text else 0,
                end_index=text.find(chunk_text) + len(chunk_text) if chunk_text in text else 0
            ))
        
        return result
    
    def _recursive_split(self, text, separators, chunk_size, chunks):
        """递归分割"""
        if len(text) <= chunk_size:
            if text.strip():
                chunks.append(text.strip())
            return
        
        # 找到合适的分隔符
        for sep in separators:
            if sep == "":
                # 字符级分割
                for i in range(0, len(text), chunk_size):
                    chunks.append(text[i:i + chunk_size].strip())
                return
            
            if sep in text:
                parts = text.split(sep)
                current_chunk = ""
                
                for part in parts:
                    if len(current_chunk) + len(sep) + len(part) <= chunk_size:
                        current_chunk = current_chunk + sep + part if current_chunk else part
                    else:
                        if current_chunk.strip():
                            chunks.append(current_chunk.strip())
                        current_chunk = part
                
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                return
        
        # 没找到分隔符，强制分割
        chunks.append(text[:chunk_size])
        if len(text) > chunk_size:
            self._recursive_split(text[chunk_size:], separators, chunk_size, chunks)


class SemanticSplitter(BaseSplitter):
    """语义分块器 — 基于 Embedding 相似度分割
    
    思路：如果相邻两个句子的 embedding 相似度骤降，
    说明它们属于不同的语义段落，应该在此处分割。
    """
    
    def __init__(self, embedding_fn, max_chunk_size: int = 1500, 
                 similarity_threshold: float = 0.3, buffer_size: int = 3):
        self.embedding_fn = embedding_fn
        self.max_chunk_size = max_chunk_size
        self.similarity_threshold = similarity_threshold
        self.buffer_size = buffer_size
    
    def split(self, text: str, metadata: dict = None) -> List[Chunk]:
        import numpy as np
        
        metadata = metadata or {}
        
        # Step 1: 将文本拆分为句子
        sentences = re.split(r'(?<=[。！？.!?])\s*', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) <= 1:
            return [Chunk(content=text, chunk_id="chunk_0",
                         metadata=metadata, start_index=0, end_index=len(text))]
        
        # Step 2: 计算每个句子的 embedding
        embeddings = self.embedding_fn(sentences)
        
        # Step 3: 计算相邻句子的余弦相似度
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = np.dot(embeddings[i], embeddings[i+1]) / (
                np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[i+1]) + 1e-8
            )
            similarities.append(sim)
        
        # Step 4: 找到相似度骤降的分割点
        split_points = [0]  # 文档开头始终是一个分割点
        for i, sim in enumerate(similarities):
            if sim < self.similarity_threshold:
                split_points.append(i + 1)
        split_points.append(len(sentences))  # 文档结尾
        
        # Step 5: 组装 chunks
        chunks = []
        for i in range(len(split_points) - 1):
            start = split_points[i]
            end = split_points[i + 1]
            chunk_text = " ".join(sentences[start:end])
            
            # 如果 chunk 太大，用递归分割进一步切分
            if len(chunk_text) > self.max_chunk_size:
                sub_splitter = RecursiveCharacterSplitter(
                    chunk_size=self.max_chunk_size,
                    chunk_overlap=200
                )
                sub_chunks = sub_splitter.split(chunk_text, metadata)
                chunks.extend(sub_chunks)
            else:
                chunks.append(Chunk(
                    content=chunk_text,
                    chunk_id=f"chunk_{len(chunks)}",
                    metadata={**metadata, "splitter": "semantic",
                             "sentences": f"{start}-{end}"},
                    start_index=0,  # 简化处理
                    end_index=len(chunk_text)
                ))
        
        return chunks
```

**分块策略对比：**

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 固定大小 | 简单、可控 | 切断语义、效率低 | 日志文件、结构化数据 |
| 递归分割 | 保持语义边界、通用性强 | 仍可能切断长段落 | 通用文档 |
| 语义分割 | 最佳语义完整性 | 计算成本高 | 学术论文、技术文档 |
| 按标题分割 | 结构清晰 | 依赖文档格式 | Markdown、HTML |

### 12.2.4 Embedding（嵌入模型）

嵌入模型将文本转换为高维向量，是 RAG 系统的核心组件：

```python
from abc import ABC, abstractmethod
from typing import List
import numpy as np


class EmbeddingModel(ABC):
    """嵌入模型抽象接口"""
    
    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """将单条文本转为向量"""
        pass
    
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量嵌入"""
        pass
    
    @property
    @abstractmethod
    def dimension(self) -> int:
        """向量维度"""
        pass


class OpenAIEmbedding(EmbeddingModel):
    """OpenAI 嵌入模型"""
    
    def __init__(self, model: str = "text-embedding-3-small", 
                 api_key: str = None, dimensions: int = 1536):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self._dimensions = dimensions
    
    def embed_text(self, text: str) -> List[float]:
        response = self.client.embeddings.create(
            input=text,
            model=self.model,
            dimensions=self._dimensions
        )
        return response.data[0].embedding
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        # OpenAI 支持批量，但限制 2048 条
        all_embeddings = []
        batch_size = 2048
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                input=batch,
                model=self.model,
                dimensions=self._dimensions
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
        
        return all_embeddings
    
    @property
    def dimension(self) -> int:
        return self._dimensions


class LocalEmbedding(EmbeddingModel):
    """本地嵌入模型（使用 sentence-transformers）"""
    
    def __init__(self, model_name: str = "BAAI/bge-large-zh-v1.5"):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name)
        self._dimension = self.model.get_sentence_embedding_dimension()
    
    def embed_text(self, text: str) -> List[float]:
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return [e.tolist() for e in embeddings]
    
    @property
    def dimension(self) -> int:
        return self._dimension


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """余弦相似度计算"""
    a_vec = np.array(a)
    b_vec = np.array(b)
    return float(np.dot(a_vec, b_vec) / 
                 (np.linalg.norm(a_vec) * np.linalg.norm(b_vec) + 1e-8))
```

**主流嵌入模型对比：**

| 模型 | 维度 | 中文支持 | 特点 |
|------|------|---------|------|
| OpenAI text-embedding-3-small | 1536 | ✅ | 性价比高，API调用 |
| OpenAI text-embedding-3-large | 3072 | ✅ | 最高质量，成本较高 |
| BGE-large-zh-v1.5 | 1024 | ✅✅ | 中文最优开源 |
| Cohere embed-v3 | 1024 | ✅ | 多语言，内建重排 |
| GTE-Qwen2 | 1536 | ✅✅ | 阿里开源，长文本支持好 |

### 12.2.5 Vector Store（向量存储）

向量数据库存储文档的向量表示，支持高效的相似度检索：

```python
from abc import ABC, abstractmethod
from typing import List, Optional
from dataclasses import dataclass
import json
import os

@dataclass
class SearchResult:
    """检索结果"""
    content: str
    score: float
    metadata: dict
    chunk_id: str
    source: str


class VectorStore(ABC):
    """向量存储抽象接口"""
    
    @abstractmethod
    def add_documents(self, chunks: List[Chunk], embeddings: List[List[float]]) -> None:
        """添加文档"""
        pass
    
    @abstractmethod
    def search(self, query_embedding: List[float], top_k: int = 5,
               filters: dict = None) -> List[SearchResult]:
        """相似度搜索"""
        pass
    
    @abstractmethod
    def delete(self, doc_ids: List[str]) -> None:
        """删除文档"""
        pass


class ChromaDBStore(VectorStore):
    """ChromaDB 向量存储 — 轻量级，适合开发和小规模部署"""
    
    def __init__(self, collection_name: str = "rag_documents",
                 persist_directory: str = "./chroma_db"):
        import chromadb
        from chromadb.config import Settings
        
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=persist_directory
        ))
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
    
    def add_documents(self, chunks: List[Chunk], embeddings: List[List[float]]) -> None:
        if not chunks:
            return
        
        ids = [c.chunk_id for c in chunks]
        documents = [c.content for c in chunks]
        metadatas = [
            {**c.metadata, "source": c.metadata.get("source", "")}
            for c in chunks
        ]
        
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
    
    def search(self, query_embedding: List[float], top_k: int = 5,
               filters: dict = None) -> List[SearchResult]:
        where = None
        if filters:
            where = filters
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"]
        )
        
        search_results = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                search_results.append(SearchResult(
                    content=doc,
                    score=1 - results["distances"][0][i],  # 距离转相似度
                    metadata=results["metadatas"][0][i],
                    chunk_id=results["ids"][0][i],
                    source=results["metadatas"][0][i].get("source", "")
                ))
        
        return search_results
    
    def delete(self, doc_ids: List[str]) -> None:
        self.collection.delete(ids=doc_ids)


class InMemoryVectorStore(VectorStore):
    """内存向量存储 — 仅用于测试和演示"""
    
    def __init__(self):
        self._documents: List[dict] = []
    
    def add_documents(self, chunks: List[Chunk], embeddings: List[List[float]]) -> None:
        for chunk, embedding in zip(chunks, embeddings):
            self._documents.append({
                "content": chunk.content,
                "embedding": embedding,
                "metadata": chunk.metadata,
                "chunk_id": chunk.chunk_id,
                "source": chunk.metadata.get("source", "")
            })
    
    def search(self, query_embedding: List[float], top_k: int = 5,
               filters: dict = None) -> List[SearchResult]:
        import numpy as np
        
        query_vec = np.array(query_embedding)
        
        scored = []
        for doc in self._documents:
            # 过滤
            if filters:
                match = True
                for k, v in filters.items():
                    if doc["metadata"].get(k) != v:
                        match = False
                        break
                if not match:
                    continue
            
            doc_vec = np.array(doc["embedding"])
            score = float(np.dot(query_vec, doc_vec) / 
                         (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec) + 1e-8))
            scored.append({
                "content": doc["content"],
                "score": score,
                "metadata": doc["metadata"],
                "chunk_id": doc["chunk_id"],
                "source": doc["source"]
            })
        
        scored.sort(key=lambda x: x["score"], reverse=True)
        top_results = scored[:top_k]
        
        return [SearchResult(**r) for r in top_results]
    
    def delete(self, doc_ids: List[str]) -> None:
        id_set = set(doc_ids)
        self._documents = [d for d in self._documents if d["chunk_id"] not in id_set]
```

---

## 12.3 文档处理管线

### 12.3.1 完整的索引构建流水线

```python
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class IndexingConfig:
    """索引配置"""
    chunk_size: int = 1000
    chunk_overlap: int = 200
    splitter_type: str = "recursive"  # "fixed", "recursive", "semantic"
    embedding_model: str = "BAAI/bge-large-zh-v1.5"
    batch_size: int = 32
    similarity_threshold: float = 0.3  # 语义分割阈值


@dataclass 
class IndexingStats:
    """索引统计"""
    total_documents: int = 0
    total_chunks: int = 0
    failed_documents: int = 0
    total_time_seconds: float = 0.0
    errors: list = field(default_factory=list)


class RAGIndexer:
    """RAG 索引构建器"""
    
    def __init__(
        self,
        config: IndexingConfig,
        embedding_model: EmbeddingModel,
        vector_store: VectorStore
    ):
        self.config = config
        self.embedding_model = embedding_model
        self.vector_store = vector_store
        self.loader = DocumentLoader()
        self._stats = IndexingStats()
    
    def _create_splitter(self) -> BaseSplitter:
        if self.config.splitter_type == "fixed":
            return FixedSizeSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap
            )
        elif self.config.splitter_type == "recursive":
            return RecursiveCharacterSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap
            )
        elif self.config.splitter_type == "semantic":
            return SemanticSplitter(
                embedding_fn=self.embedding_model.embed_text,
                similarity_threshold=self.config.similarity_threshold
            )
        else:
            raise ValueError(f"Unknown splitter: {self.config.splitter_type}")
    
    def index_documents(self, document_paths: list[str]) -> IndexingStats:
        """索引一批文档"""
        start_time = datetime.now()
        splitter = self._create_splitter()
        
        all_chunks = []
        
        for path in document_paths:
            try:
                doc = self.loader.load(path)
                chunks = splitter.split(doc.content, doc.metadata)
                all_chunks.extend(chunks)
                self._stats.total_documents += 1
            except Exception as e:
                self._stats.failed_documents += 1
                self._stats.errors.append(f"{path}: {str(e)}")
        
        # 批量嵌入
        if all_chunks:
            self._batch_embed_and_store(all_chunks)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        self._stats.total_time_seconds = elapsed
        
        print(f"索引完成: {self._stats.total_documents} 文档 → "
              f"{self._stats.total_chunks} 块, "
              f"耗时 {elapsed:.2f}s")
        
        if self._stats.errors:
            print(f"失败: {self._stats.failed_documents} 个文档")
            for err in self._stats.errors:
                print(f"  ⚠ {err}")
        
        return self._stats
    
    def _batch_embed_and_store(self, chunks: list[Chunk]):
        """批量嵌入并存储"""
        batch_size = self.config.batch_size
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c.content for c in batch]
            
            print(f"  嵌入批次 {i//batch_size + 1}/{(len(chunks)-1)//batch_size + 1} "
                  f"({len(batch)} 块)...")
            
            embeddings = self.embedding_model.embed_batch(texts)
            self.vector_store.add_documents(batch, embeddings)
            self._stats.total_chunks += len(batch)
    
    async def index_directory(self, directory: str, recursive: bool = True) -> IndexingStats:
        """异步索引整个目录"""
        paths = []
        dir_path = Path(directory)
        pattern = "**/*" if recursive else "*"
        
        for file_path in dir_path.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in self.loader._loaders:
                paths.append(str(file_path))
        
        print(f"发现 {len(paths)} 个文档待索引")
        return self.index_documents(paths)


# 使用示例
if __name__ == "__main__":
    config = IndexingConfig(
        chunk_size=1000,
        chunk_overlap=200,
        splitter_type="recursive",
        embedding_model="BAAI/bge-large-zh-v1.5"
    )
    
    embedding_model = LocalEmbedding("BAAI/bge-large-zh-v1.5")
    vector_store = ChromaDBStore("knowledge_base", "./chroma_db")
    
    indexer = RAGIndexer(config, embedding_model, vector_store)
    stats = indexer.index_documents(["./docs/policy.pdf", "./docs/faq.md"])
```

### 12.3.2 分块策略的深入探讨

分块策略的选择对最终检索效果有决定性影响。这里总结一些实践中的关键经验：

**分块大小的黄金法则**：

```
分块大小与检索质量的关系
═══════════════════════════════════════════
  太小 (100-200 字符)
  ├── ✅ 精准匹配好
  ├── ❌ 缺乏上下文
  ├── ❌ 语义不完整
  └── ❌ 噪声多

  适中 (500-1500 字符)  ← 推荐区间
  ├── ✅ 语义完整
  ├── ✅ 上下文充分
  ├── ✅ 检索效率好
  └── ✅ 嵌入质量高

  太大 (2000+ 字符)
  ├── ✅ 上下文丰富
  ├── ❌ 稀释关键信息
  ├── ❌ 嵌入质量下降
  └── ❌ Token 消耗大
═══════════════════════════════════════════
```

**重要实践技巧**：

1. **父子块策略（Parent-Child Chunking）**：用小块做检索（高精度），返回对应的大块作为上下文（高完整性）
2. **上下文增强**：每个块附加上下文（标题、章节号、前一段摘要），帮助理解
3. **元数据附加**：添加文档层级元数据（作者、日期、部门），支持过滤检索

```python
class ParentChildSplitter:
    """父子块分割器
    
    检索时用小块提高精度，返回时附带父块提供完整上下文
    """
    
    def __init__(self, child_size: int = 200, parent_size: int = 1000, 
                 child_overlap: int = 50):
        self.child_splitter = RecursiveCharacterSplitter(
            chunk_size=child_size, chunk_overlap=child_overlap
        )
        self.parent_splitter = RecursiveCharacterSplitter(
            chunk_size=parent_size, chunk_overlap=200
        )
    
    def split(self, text: str, metadata: dict = None) -> List[dict]:
        """返回包含父子关系的块"""
        metadata = metadata or {}
        
        # 先分父块
        parent_chunks = self.parent_splitter.split(text, metadata)
        
        result = []
        for parent in parent_chunks:
            # 再对每个父块分子块
            children = self.child_splitter.split(parent.content, parent.metadata)
            
            for child in children:
                result.append({
                    "child": child,
                    "parent": parent,
                    "type": "parent_child"
                })
        
        return result
```

---

## 12.4 检索策略

### 12.4.1 稠密检索（Dense Retrieval）

稠密检索是 RAG 的默认方案——通过 embedding 的语义相似度来查找相关文档：

```python
class DenseRetriever:
    """稠密检索器"""
    
    def __init__(self, embedding_model: EmbeddingModel, 
                 vector_store: VectorStore, top_k: int = 5):
        self.embedding_model = embedding_model
        self.vector_store = vector_store
        self.top_k = top_k
    
    def retrieve(self, query: str, top_k: int = None, 
                 filters: dict = None) -> List[SearchResult]:
        """检索相关文档"""
        k = top_k or self.top_k
        
        # 将查询转为向量
        query_embedding = self.embedding_model.embed_text(query)
        
        # 在向量数据库中搜索
        results = self.vector_store.search(
            query_embedding, top_k=k, filters=filters
        )
        
        return results
```

**稠密检索的优势与局限：**

- ✅ 能理解语义（"手机"和"智能手机"能匹配）
- ✅ 跨语言检索（如果嵌入模型支持）
- ❌ 对专有名词、产品编号等精确匹配不够好
- ❌ 长尾查询的效果可能不理想

### 12.4.2 稀疏检索（BM25）

BM25 是经典的信息检索算法，基于词频统计：

```python
import math
from collections import Counter, defaultdict
from typing import List, Tuple
import re


class BM25Retriever:
    """BM25 稀疏检索器
    
    基于词频和逆文档频率的经典检索算法，
    对精确匹配和关键词搜索特别有效
    """
    
    def __init__(self, k1: float = 1.5, b: float = 0.75, epsilon: float = 0.25):
        self.k1 = k1       # 词频饱和参数
        self.b = b         # 文档长度归一化
        self.epsilon = epsilon
        self.corpus = []   # 原始文档
        self.tokenized_corpus = []  # 分词后的文档
        self.doc_freqs = defaultdict(int)  # 文档频率
        self.avg_doc_len = 0
        self.idf = {}      # 逆文档频率
    
    def _tokenize(self, text: str) -> List[str]:
        """简单分词（中文按字，英文按词）"""
        # 中英文混合分词
        tokens = []
        # 提取英文单词
        en_words = re.findall(r'[a-zA-Z0-9]+', text.lower())
        tokens.extend(en_words)
        # 提取中文字符（简化处理，实际应使用 jieba 等分词器）
        cn_chars = re.findall(r'[\u4e00-\u9fff]{2,}', text)
        tokens.extend(cn_chars)
        return tokens
    
    def fit(self, documents: List[dict]):
        """构建索引
        
        Args:
            documents: [{"content": str, "metadata": dict, "chunk_id": str}, ...]
        """
        self.corpus = documents
        doc_lens = []
        N = len(documents)
        
        for doc in documents:
            tokens = self._tokenize(doc["content"])
            self.tokenized_corpus.append(tokens)
            doc_lens.append(len(tokens))
            
            # 统计文档频率
            unique_terms = set(tokens)
            for term in unique_terms:
                self.doc_freqs[term] += 1
        
        self.avg_doc_len = sum(doc_lens) / N if N > 0 else 0
        
        # 计算 IDF
        for term, df in self.doc_freqs.items():
            idf = math.log((N - df + 0.5) / (df + 0.5) + 1)
            self.idf[term] = max(idf, self.epsilon)
    
    def retrieve(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """BM25 检索"""
        query_tokens = self._tokenize(query)
        query_freq = Counter(query_tokens)
        
        scores = []
        for i, doc_tokens in enumerate(self.tokenized_corpus):
            score = 0.0
            doc_len = len(doc_tokens)
            doc_freq = Counter(doc_tokens)
            
            for term, qf in query_freq.items():
                if term not in self.idf:
                    continue
                
                tf = doc_freq.get(term, 0)
                idf = self.idf[term]
                
                # BM25 评分公式
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_doc_len)
                score += idf * (numerator / denominator)
            
            scores.append((i, score))
        
        # 排序取 Top-K
        scores.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        for idx, score in scores[:top_k]:
            doc = self.corpus[idx]
            results.append(SearchResult(
                content=doc["content"],
                score=score,
                metadata=doc.get("metadata", {}),
                chunk_id=doc.get("chunk_id", ""),
                source=doc.get("metadata", {}).get("source", "")
            ))
        
        return results


# 使用示例
bm25 = BM25Retriever(k1=1.5, b=0.75)
bm25.fit([
    {"content": "Python 是一种广泛使用的编程语言", "chunk_id": "c1", "metadata": {}},
    {"content": "Java 是企业级开发的主流语言", "chunk_id": "c2", "metadata": {}},
    {"content": "Go 语言以高并发著称", "chunk_id": "c3", "metadata": {}},
])
results = bm25.retrieve("Python 编程", top_k=2)
```

### 12.4.3 混合检索（Hybrid Search）

混合检索结合稠密检索和稀疏检索的优势：

```python
class HybridRetriever:
    """混合检索器
    
    结合稠密检索（语义理解）和 BM25（关键词匹配），
    通过加权融合两种检索结果
    """
    
    def __init__(
        self,
        dense_retriever: DenseRetriever,
        bm25_retriever: BM25Retriever,
        alpha: float = 0.7  # 稠密检索权重
    ):
        self.dense_retriever = dense_retriever
        self.bm25_retriever = bm25_retriever
        self.alpha = alpha  # alpha 控制稠密/稀疏的权重
    
    def retrieve(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """混合检索"""
        # 并行执行两种检索
        dense_results = self.dense_retriever.retrieve(query, top_k=top_k * 2)
        sparse_results = self.bm25_retriever.retrieve(query, top_k=top_k * 2)
        
        # 归一化分数
        dense_scores = self._normalize_scores(dense_results)
        sparse_scores = self._normalize_scores(sparse_results)
        
        # 加权融合
        fused = {}
        
        for result in dense_results:
            cid = result.chunk_id
            fused[cid] = {
                "result": result,
                "dense_score": dense_scores.get(cid, 0),
                "sparse_score": 0
            }
        
        for result in sparse_results:
            cid = result.chunk_id
            if cid in fused:
                fused[cid]["sparse_score"] = sparse_scores.get(cid, 0)
            else:
                fused[cid] = {
                    "result": result,
                    "dense_score": 0,
                    "sparse_score": sparse_scores.get(cid, 0)
                }
        
        # 计算融合分数
        for cid, data in fused.items():
            data["final_score"] = (
                self.alpha * data["dense_score"] +
                (1 - self.alpha) * data["sparse_score"]
            )
        
        # 排序
        sorted_results = sorted(
            fused.values(),
            key=lambda x: x["final_score"],
            reverse=True
        )[:top_k]
        
        return [
            SearchResult(
                content=item["result"].content,
                score=item["final_score"],
                metadata=item["result"].metadata,
                chunk_id=item["result"].chunk_id,
                source=item["result"].source
            )
            for item in sorted_results
        ]
    
    def _normalize_scores(self, results: List[SearchResult]) -> dict:
        """Min-Max 归一化"""
        if not results:
            return {}
        
        scores = [r.score for r in results]
        min_score = min(scores)
        max_score = max(scores)
        range_score = max_score - min_score
        
        if range_score < 1e-8:
            return {r.chunk_id: 1.0 for r in results}
        
        return {
            r.chunk_id: (r.score - min_score) / range_score
            for r in results
        }
```

**混合检索的参数调优建议：**

| 场景 | alpha（稠密权重） | 说明 |
|------|------------------|------|
| 通用问答 | 0.7 | 语义理解更重要 |
| 技术文档搜索 | 0.5 | 关键词匹配很重要 |
| 产品/错误码查询 | 0.3 | 精确匹配是关键 |
| 法律/合规文档 | 0.6 | 语义和精确都需要 |

### 12.4.4 重排序（Reranking）

重排序是 RAG 系统的"杀手锏"——先用快速检索获取候选集，再用精确的交叉编码器精排：

```python
class CrossEncoderReranker:
    """交叉编码器重排序
    
    与双编码器（embedding 检索）不同，交叉编码器同时处理 query 和 document，
    能捕捉更细粒度的相关性信号，但计算成本更高
    """
    
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        from sentence_transformers import CrossEncoder
        self.model = CrossEncoder(model_name)
    
    def rerank(
        self, query: str, documents: List[SearchResult], top_k: int = 5
    ) -> List[SearchResult]:
        """对检索结果重排序"""
        if not documents:
            return []
        
        pairs = [(query, doc.content) for doc in documents]
        scores = self.model.predict(pairs)
        
        # 按新分数排序
        reranked = []
        for doc, score in zip(documents, scores):
            reranked.append(SearchResult(
                content=doc.content,
                score=float(score),
                metadata=doc.metadata,
                chunk_id=doc.chunk_id,
                source=doc.source
            ))
        
        reranked.sort(key=lambda x: x.score, reverse=True)
        return reranked[:top_k]


# 完整的检索管道
class RetrievalPipeline:
    """检索管道：混合检索 + 重排序"""
    
    def __init__(
        self,
        hybrid_retriever: HybridRetriever,
        reranker: CrossEncoderReranker,
        initial_top_k: int = 20,
        final_top_k: int = 5
    ):
        self.retriever = hybrid_retriever
        self.reranker = reranker
        self.initial_top_k = initial_top_k
        self.final_top_k = final_top_k
    
    def retrieve(self, query: str) -> List[SearchResult]:
        """完整检索流程"""
        # Stage 1: 混合检索，获取候选集
        candidates = self.retriever.retrieve(query, top_k=self.initial_top_k)
        
        # Stage 2: 交叉编码器重排序
        final_results = self.reranker.rerank(
            query, candidates, top_k=self.final_top_k
        )
        
        return final_results
```

---

## 12.5 知识库维护

### 12.5.1 增量更新

生产环境的知识库不是一成不变的——文档会被新增、修改和删除。增量更新是保持知识库时效性的关键：

```python
from dataclasses import dataclass
from datetime import datetime
import hashlib


@dataclass
class DocumentVersion:
    """文档版本记录"""
    doc_id: str
    source_path: str
    content_hash: str
    indexed_at: datetime
    metadata: dict
    is_deleted: bool = False


class KnowledgeBaseManager:
    """知识库管理器
    
    负责知识库的增量更新、版本管理和过期清理
    """
    
    def __init__(self, vector_store: VectorStore, 
                 embedding_model: EmbeddingModel,
                 version_store_path: str = "./kb_versions.json"):
        self.vector_store = vector_store
        self.embedding_model = embedding_model
        self.version_store_path = version_store_path
        self._versions: dict[str, DocumentVersion] = {}
        self._load_versions()
    
    def _load_versions(self):
        """加载版本记录"""
        if os.path.exists(self.version_store_path):
            with open(self.version_store_path, "r") as f:
                data = json.load(f)
                for doc_id, v in data.items():
                    self._versions[doc_id] = DocumentVersion(
                        doc_id=v["doc_id"],
                        source_path=v["source_path"],
                        content_hash=v["content_hash"],
                        indexed_at=datetime.fromisoformat(v["indexed_at"]),
                        metadata=v["metadata"],
                        is_deleted=v.get("is_deleted", False)
                    )
    
    def _save_versions(self):
        """保存版本记录"""
        data = {}
        for doc_id, v in self._versions.items():
            data[doc_id] = {
                "doc_id": v.doc_id,
                "source_path": v.source_path,
                "content_hash": v.content_hash,
                "indexed_at": v.indexed_at.isoformat(),
                "metadata": v.metadata,
                "is_deleted": v.is_deleted
            }
        with open(self.version_store_path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def _compute_hash(content: str) -> str:
        """计算文档内容哈希"""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    
    def check_updates(self, documents: List[Document]) -> dict:
        """检查哪些文档需要更新
        
        Returns:
            {
                "new": [需要新索引的文档],
                "modified": [需要重新索引的文档],
                "unchanged": [无变化的文档],
                "deleted": [已删除但未清理的文档]
            }
        """
        current_sources = {doc.source for doc in documents}
        result = {"new": [], "modified": [], "unchanged": [], "deleted": []}
        
        # 检查现有文档
        for doc in documents:
            doc_id = doc.doc_id or f"doc_{self._compute_hash(doc.content)}"
            content_hash = self._compute_hash(doc.content)
            
            if doc_id not in self._versions:
                result["new"].append(doc)
            else:
                version = self._versions[doc_id]
                if version.content_hash != content_hash:
                    result["modified"].append(doc)
                else:
                    result["unchanged"].append(doc)
        
        # 检查已删除的文档
        for doc_id, version in self._versions.items():
            if version.source_path not in current_sources and not version.is_deleted:
                result["deleted"].append(version)
        
        return result
    
    def incremental_update(self, documents: List[Document]) -> dict:
        """增量更新知识库"""
        update_info = self.check_updates(documents)
        
        splitter = RecursiveCharacterSplitter(chunk_size=1000, chunk_overlap=200)
        
        # 处理新增文档
        for doc in update_info["new"]:
            chunks = splitter.split(doc.content, doc.metadata)
            embeddings = self.embedding_model.embed_batch([c.content for c in chunks])
            self.vector_store.add_documents(chunks, embeddings)
            
            doc_id = doc.doc_id or f"doc_{self._compute_hash(doc.content)}"
            self._versions[doc_id] = DocumentVersion(
                doc_id=doc_id,
                source_path=doc.source,
                content_hash=self._compute_hash(doc.content),
                indexed_at=datetime.now(),
                metadata=doc.metadata
            )
            print(f"  ✅ 新增: {doc.source} ({len(chunks)} 块)")
        
        # 处理修改文档：先删后增
        for doc in update_info["modified"]:
            doc_id = doc.doc_id or f"doc_{self._compute_hash(doc.content)}"
            # 删除旧版本的所有块
            old_chunk_ids = [f"chunk_{i}" for i in range(100)]  # 简化处理
            self.vector_store.delete(old_chunk_ids)
            
            # 重新索引
            chunks = splitter.split(doc.content, doc.metadata)
            embeddings = self.embedding_model.embed_batch([c.content for c in chunks])
            self.vector_store.add_documents(chunks, embeddings)
            
            self._versions[doc_id] = DocumentVersion(
                doc_id=doc_id,
                source_path=doc.source,
                content_hash=self._compute_hash(doc.content),
                indexed_at=datetime.now(),
                metadata=doc.metadata
            )
            print(f"  🔄 更新: {doc.source} ({len(chunks)} 块)")
        
        # 处理已删除文档
        for version in update_info["deleted"]:
            self.vector_store.delete([f"{version.doc_id}_*"])
            version.is_deleted = True
            print(f"  🗑️ 删除: {version.source_path}")
        
        self._save_versions()
        
        return {
            "new_count": len(update_info["new"]),
            "modified_count": len(update_info["modified"]),
            "deleted_count": len(update_info["deleted"]),
            "unchanged_count": len(update_info["unchanged"])
        }
```

### 12.5.2 过期与清理策略

```python
class KnowledgeBaseCleaner:
    """知识库清理器"""
    
    def __init__(self, vector_store: VectorStore,
                 version_store_path: str = "./kb_versions.json"):
        self.vector_store = vector_store
        self.version_store_path = version_store_path
    
    def clean_expired(self, max_age_days: int = 180) -> dict:
        """清理过期文档
        
        Args:
            max_age_days: 文档最大保留天数
        """
        cutoff = datetime.now().timestamp() - max_age_days * 86400
        expired = []
        
        # 扫描版本记录
        if os.path.exists(self.version_store_path):
            with open(self.version_store_path, "r") as f:
                versions = json.load(f)
            
            for doc_id, info in versions.items():
                indexed_at = datetime.fromisoformat(info["indexed_at"]).timestamp()
                if indexed_at < cutoff:
                    expired.append(doc_id)
        
        # 删除过期文档
        for doc_id in expired:
            self.vector_store.delete([doc_id])
            print(f"  清理过期文档: {doc_id}")
        
        return {
            "cleaned_count": len(expired),
            "max_age_days": max_age_days
        }
    
    def deduplicate(self, similarity_threshold: float = 0.98) -> dict:
        """去重：删除高度相似的文档块"""
        # 获取所有文档
        all_docs = self.vector_store.get_all()  # 假设 VectorStore 有此方法
        
        duplicates = []
        seen = set()
        
        for doc in all_docs:
            if doc.chunk_id in seen:
                continue
            
            # 检查是否与已有文档高度相似
            for other in all_docs:
                if other.chunk_id == doc.chunk_id or other.chunk_id in seen:
                    continue
                
                if doc.score >= similarity_threshold:  # 需要比较逻辑
                    duplicates.append(other.chunk_id)
                    seen.add(other.chunk_id)
        
        if duplicates:
            self.vector_store.delete(duplicates)
        
        return {"duplicate_count": len(duplicates)}
```

---

## 12.6 GraphRAG

### 12.6.1 从向量到图：知识的新维度

传统的 RAG 基于向量相似度检索，能回答"与 X 相关的内容是什么"，但难以回答需要多跳推理的问题，比如"A 公司的 CEO 的母校位于哪个城市？"。这类问题需要沿着实体关系链进行推理——这正是知识图谱的强项。

**GraphRAG = 向量检索 + 图遍历**，将两种知识表示方式的优势互补：

```
传统 RAG vs GraphRAG
═══════════════════════════════════════════════════════

传统 RAG (基于向量)
  Query: "张三在哪里工作？"
  ──▶ 向量检索 ──▶ 找到包含"张三"的文档片段
  ✅ 简单事实查询
  ❌ 多跳推理困难
  ❌ 关系查询弱

GraphRAG (向量 + 图)
  Query: "张三的直属领导的母校是哪所大学？"
  ──▶ 实体识别: 张三(人), 直属领导(关系), 母校(属性)
  ──▶ 图遍历: 张三 →[直属]→ 李四 →[母校]→ 清华大学
  ──▶ 向量检索补充: 清华大学相关的上下文
  ✅ 多跳推理
  ✅ 关系查询
  ✅ 结构化知识
═══════════════════════════════════════════════════════
```

### 12.6.2 知识图谱构建

```python
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Tuple
import networkx as nx


@dataclass
class Entity:
    """知识实体"""
    name: str
    entity_type: str  # 人、组织、地点、产品、概念...
    properties: Dict = field(default_factory=dict)
    description: str = ""


@dataclass
class Relation:
    """实体关系"""
    source: str       # 源实体名称
    target: str       # 目标实体名称
    relation_type: str  # 关系类型：任职、位于、生产、属于...
    properties: Dict = field(default_factory=dict)


class KnowledgeGraph:
    """轻量级知识图谱"""
    
    def __init__(self):
        self.graph = nx.DiGraph()
        self.entities: Dict[str, Entity] = {}
        self.relations: List[Relation] = []
    
    def add_entity(self, entity: Entity):
        """添加实体"""
        self.entities[entity.name] = entity
        self.graph.add_node(
            entity.name,
            type=entity.entity_type,
            description=entity.description,
            **entity.properties
        )
    
    def add_relation(self, relation: Relation):
        """添加关系"""
        self.relations.append(relation)
        
        # 如果实体不存在，自动创建
        if relation.source not in self.entities:
            self.add_entity(Entity(name=relation.source, entity_type="unknown"))
        if relation.target not in self.entities:
            self.add_entity(Entity(name=relation.target, entity_type="unknown"))
        
        self.graph.add_edge(
            relation.source,
            relation.target,
            type=relation.relation_type,
            **relation.properties
        )
    
    def get_neighbors(self, entity_name: str, relation_type: str = None) -> List[Tuple[str, str]]:
        """获取相邻实体
        
        Returns:
            [(邻居实体名, 关系类型), ...]
        """
        neighbors = []
        for _, target, data in self.graph.out_edges(entity_name, data=True):
            if relation_type is None or data.get("type") == relation_type:
                neighbors.append((target, data.get("type", "")))
        return neighbors
    
    def multi_hop_search(
        self, start_entity: str, max_hops: int = 3
    ) -> List[List[Tuple[str, str, str]]]:
        """多跳图遍历
        
        Returns:
            [[(源, 关系, 目标), ...], ...]  所有可达路径
        """
        paths = []
        visited = {start_entity}
        
        def dfs(current: str, path: list, depth: int):
            if depth >= max_hops:
                if path:
                    paths.append(path[:])
                return
            
            for _, target, data in self.graph.out_edges(current, data=True):
                if target not in visited or depth < max_hops - 1:
                    edge = (current, data.get("type", ""), target)
                    path.append(edge)
                    dfs(target, path, depth + 1)
                    path.pop()
        
        dfs(start_entity, [], 0)
        return paths
    
    def get_subgraph(self, entity_name: str, radius: int = 2) -> 'KnowledgeGraph':
        """获取以某实体为中心的子图"""
        sub_nodes = set()
        sub_nodes.add(entity_name)
        
        # BFS 扩展
        current_level = {entity_name}
        for _ in range(radius):
            next_level = set()
            for node in current_level:
                for _, target in self.graph.out_edges(node):
                    next_level.add(target)
                for source, _ in self.graph.in_edges(node):
                    next_level.add(source)
            sub_nodes.update(next_level)
            current_level = next_level
        
        # 构建子图
        sub_kg = KnowledgeGraph()
        for node in sub_nodes:
            if node in self.entities:
                sub_kg.add_entity(self.entities[node])
        
        for rel in self.relations:
            if rel.source in sub_nodes and rel.target in sub_nodes:
                sub_kg.add_relation(rel)
        
        return sub_kg
    
    def to_context_text(self, entity_name: str, radius: int = 2) -> str:
        """将子图转为文本上下文（供 LLM 使用）"""
        sub_kg = self.get_subgraph(entity_name, radius)
        
        lines = [f"与「{entity_name}」相关的知识图谱信息：\n"]
        
        for rel in sub_kg.relations:
            source_desc = sub_kg.entities.get(rel.source, Entity(rel.source, ""))
            target_desc = sub_kg.entities.get(rel.target, Entity(rel.target, ""))
            lines.append(
                f"- {source_desc.name}({source_desc.entity_type}) "
                f"--[{rel.relation_type}]--> "
                f"{target_desc.name}({target_desc.entity_type})"
            )
        
        return "\n".join(lines)


class SimpleEntityExtractor:
    """简单的基于规则的实体关系抽取器
    
    生产环境应使用 LLM 或专门的 NER 模型
    """
    
    def __init__(self):
        self.entity_patterns = {
            "person": r'[\u4e00-\u9fff]{2,4}(?=是|在|任职|毕业于)',
            "organization": r'[\u4e00-\u9fff]{2,10}(?=公司|集团|大学|研究院|部门)',
            "location": r'[\u4e00-\u9fff]{2,6}(?=市|省|区|县|镇)',
        }
    
    def extract(self, text: str) -> Tuple[List[Entity], List[Relation]]:
        """从文本中抽取实体和关系"""
        import re
        
        entities = []
        relations = []
        
        # 提取实体
        entity_names = set()
        for etype, pattern in self.entity_patterns.items():
            matches = re.findall(pattern, text)
            for match in matches:
                if match not in entity_names:
                    entities.append(Entity(name=match, entity_type=etype))
                    entity_names.add(match)
        
        # 简单关系抽取（基于模板）
        relation_patterns = [
            (r'([\u4e00-\u9fff]{2,4})在([\u4e00-\u9fff]+)(公司|集团)', "任职于"),
            (r'([\u4e00-\u9fff]{2,4})毕业于([\u4e00-\u9fff]+)(大学|学院)', "就读于"),
            (r'([\u4e00-\u9fff]+)(公司|集团)位于([\u4e00-\u9fff]+)', "位于"),
        ]
        
        for pattern, rel_type in relation_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                source = match[0]
                target = "".join(match[1:])
                relations.append(Relation(source=source, target=target, relation_type=rel_type))
        
        return entities, relations
```

### 12.6.3 GraphRAG 检索

```python
class GraphRAGRetriever:
    """GraphRAG 混合检索器
    
    结合知识图谱的关系遍历和向量语义检索
    """
    
    def __init__(
        self,
        knowledge_graph: KnowledgeGraph,
        entity_extractor,
        dense_retriever: DenseRetriever,
        graph_weight: float = 0.4,
        vector_weight: float = 0.6
    ):
        self.kg = knowledge_graph
        self.extractor = entity_extractor
        self.dense_retriever = dense_retriever
        self.graph_weight = graph_weight
        self.vector_weight = vector_weight
    
    def retrieve(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """GraphRAG 检索"""
        import numpy as np
        
        # Step 1: 从查询中识别实体
        entities, _ = self.extractor.extract(query)
        
        # Step 2: 知识图谱遍历
        graph_context = ""
        graph_results = []
        
        for entity in entities:
            if entity.name in self.kg.entities:
                # 获取实体周围的子图
                context_text = self.kg.to_context_text(entity.name, radius=2)
                graph_context += context_text + "\n"
                graph_results.append(SearchResult(
                    content=context_text,
                    score=0.8,  # 图检索的基础分数
                    metadata={"source": "knowledge_graph", "entity": entity.name},
                    chunk_id=f"graph_{entity.name}",
                    source="knowledge_graph"
                ))
        
        # Step 3: 向量检索
        vector_results = self.dense_retriever.retrieve(query, top_k=top_k * 2)
        
        # Step 4: 融合结果
        all_results = []
        
        # 添加图检索结果
        for result in graph_results:
            all_results.append(SearchResult(
                content=result.content,
                score=result.score * self.graph_weight,
                metadata=result.metadata,
                chunk_id=result.chunk_id,
                source=result.source
            ))
        
        # 添加向量检索结果
        for result in vector_results:
            all_results.append(SearchResult(
                content=result.content,
                score=result.score * self.vector_weight,
                metadata=result.metadata,
                chunk_id=result.chunk_id,
                source=result.source
            ))
        
        # 排序
        all_results.sort(key=lambda x: x.score, reverse=True)
        
        return all_results[:top_k]
```

---

## 12.7 代码示例：完整的 RAG Agent 实现

### 12.7.1 基于 LangChain 和 ChromaDB 的完整实现

```python
"""
完整的 RAG Agent 实现
使用 LangChain + ChromaDB + OpenAI

功能：
- 文档加载与分块
- 向量存储与检索
- 混合检索 + 重排序
- 多轮对话
- 引用溯源
"""

import os
from typing import List, Dict, Optional
from dataclasses import dataclass

from langchain_community.document_loaders import (
    PyPDFLoader, TextLoader, UnstructuredMarkdownLoader,
    WebBaseLoader, DirectoryLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OpenAIEmbeddings, HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


# ═══════════════════════════════════════════════════
# 第一步：配置
# ═══════════════════════════════════════════════════

@dataclass
class RAGAgentConfig:
    """RAG Agent 配置"""
    # LLM 配置
    llm_model: str = "gpt-4o"
    llm_temperature: float = 0.1
    
    # Embedding 配置
    embedding_model: str = "text-embedding-3-small"
    use_local_embedding: bool = False
    local_embedding_model: str = "BAAI/bge-large-zh-v1.5"
    
    # 分块配置
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    # 检索配置
    retrieval_top_k: int = 5
    rerank_top_k: int = 3
    use_hybrid_search: bool = True
    
    # 向量数据库
    persist_directory: str = "./chroma_db"
    collection_name: str = "knowledge_base"


# ═══════════════════════════════════════════════════
# 第二步：文档索引
# ═══════════════════════════════════════════════════

class RAGDocumentIndexer:
    """文档索引器"""
    
    def __init__(self, config: RAGAgentConfig):
        self.config = config
        self._setup_components()
    
    def _setup_components(self):
        """初始化组件"""
        # Embedding 模型
        if self.config.use_local_embedding:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.config.local_embedding_model
            )
        else:
            self.embeddings = OpenAIEmbeddings(
                model=self.config.embedding_model
            )
        
        # 文本分割器
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
            separators=["\n\n", "\n", "。", ".", " ", ""],
            length_function=len
        )
    
    def index_directory(self, directory: str) -> Chroma:
        """索引整个目录"""
        loader = DirectoryLoader(
            directory,
            glob="**/*.{pdf,md,txt,html}",
            loader_cls={
                ".pdf": PyPDFLoader,
                ".md": UnstructuredMarkdownLoader,
                ".txt": TextLoader,
            },
            silent_errors=True
        )
        
        documents = loader.load()
        print(f"加载了 {len(documents)} 个文档")
        
        # 分块
        splits = self.text_splitter.split_documents(documents)
        print(f"分割为 {len(splits)} 个文档块")
        
        # 构建向量索引
        vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=self.embeddings,
            persist_directory=self.config.persist_directory,
            collection_name=self.config.collection_name
        )
        
        print("索引构建完成！")
        return vectorstore
    
    def index_url(self, url: str) -> Chroma:
        """索引网页"""
        loader = WebBaseLoader(url)
        documents = loader.load()
        
        splits = self.text_splitter.split_documents(documents)
        
        vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=self.embeddings,
            persist_directory=self.config.persist_directory,
            collection_name=self.config.collection_name
        )
        
        return vectorstore


# ═══════════════════════════════════════════════════
# 第三步：RAG Agent 核心
# ═══════════════════════════════════════════════════

class RAGAgent:
    """RAG 增强 Agent
    
    集成检索增强生成、多轮对话、引用溯源的完整 Agent
    """
    
    def __init__(self, config: RAGAgentConfig, vectorstore: Chroma):
        self.config = config
        self.vectorstore = vectorstore
        self._setup_llm()
        self._setup_retriever()
        self._setup_chain()
        self._conversation_history: List[dict] = []
    
    def _setup_llm(self):
        """初始化 LLM"""
        self.llm = ChatOpenAI(
            model=self.config.llm_model,
            temperature=self.config.llm_temperature
        )
    
    def _setup_retriever(self):
        """初始化检索器"""
        self.retriever = self.vectorstore.as_retriever(
            search_type="mmr",  # 最大边际相关性，避免重复
            search_kwargs={
                "k": self.config.retrieval_top_k,
                "fetch_k": self.config.retrieval_top_k * 3,
                "lambda_mult": 0.7
            }
        )
    
    def _setup_chain(self):
        """构建 RAG Chain"""
        
        # 系统提示
        system_prompt = """你是一个专业的知识问答助手。请基于提供的参考资料来回答用户问题。

规则：
1. 只使用参考资料中的信息来回答
2. 如果参考资料中没有相关信息，请明确告知用户
3. 在回答中标注引用来源 [来源X]
4. 回答应结构清晰、信息准确
5. 对于不确定的信息，请说明不确定的原因

参考资料：
{context}

对话历史：
{history}"""

        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{question}")
        ])
        
        # 构建处理链
        def format_docs(docs):
            """格式化检索到的文档"""
            formatted = []
            for i, doc in enumerate(docs, 1):
                source = doc.metadata.get("source", "未知来源")
                page = doc.metadata.get("page", "")
                page_info = f" 第{page}页" if page else ""
                formatted.append(
                    f"[来源{i}] {source}{page_info}\n"
                    f"{doc.page_content}"
                )
            return "\n\n---\n\n".join(formatted)
        
        def format_history(history):
            """格式化对话历史"""
            if not history:
                return "（无对话历史）"
            lines = []
            for msg in history[-6:]:  # 保留最近 3 轮
                role = "用户" if msg["role"] == "user" else "助手"
                lines.append(f"{role}: {msg['content']}")
            return "\n".join(lines)
        
        # RAG Chain
        self.rag_chain = (
            {
                "context": self.retriever | format_docs,
                "question": RunnablePassthrough(),
                "history": RunnablePassthrough()
            }
            | self.prompt
            | self.llm
            | StrOutputParser()
        )
    
    def ask(self, question: str) -> dict:
        """提问
        
        Returns:
            {
                "answer": str,
                "sources": list[dict],
                "history": list[dict]
            }
        """
        # 格式化历史
        history_text = self._format_history()
        
        # 检索相关文档
        docs = self.retriever.invoke(question)
        
        # 生成回答
        answer = self.rag_chain.invoke(question)
        
        # 提取来源
        sources = []
        for i, doc in enumerate(docs[:self.config.rerank_top_k], 1):
            sources.append({
                "index": i,
                "source": doc.metadata.get("source", "未知"),
                "content_preview": doc.page_content[:200] + "...",
                "score": doc.metadata.get("score", 0)
            })
        
        # 更新对话历史
        self._conversation_history.append({"role": "user", "content": question})
        self._conversation_history.append({"role": "assistant", "content": answer})
        
        return {
            "answer": answer,
            "sources": sources,
            "history": self._conversation_history.copy()
        }
    
    def _format_history(self) -> str:
        if not self._conversation_history:
            return "（无对话历史）"
        lines = []
        for msg in self._conversation_history[-6:]:
            role = "用户" if msg["role"] == "user" else "助手"
            lines.append(f"{role}: {msg['content'][:200]}")
        return "\n".join(lines)
    
    def clear_history(self):
        """清空对话历史"""
        self._conversation_history = []
    
    def conversation_mode(self):
        """进入多轮对话模式"""
        print("=" * 60)
        print("RAG Agent 多轮对话模式")
        print("输入 'quit' 退出, 'clear' 清空历史, 'source' 查看来源")
        print("=" * 60)
        
        while True:
            question = input("\n👤 你: ").strip()
            
            if question.lower() == "quit":
                break
            elif question.lower() == "clear":
                self.clear_history()
                print("✅ 对话历史已清空")
                continue
            
            result = self.ask(question)
            
            print(f"\n🤖 助手: {result['answer']}")
            
            if result['sources']:
                print("\n📚 参考来源:")
                for s in result['sources']:
                    print(f"  [{s['index']}] {s['source']}")


# ═══════════════════════════════════════════════════
# 第四步：运行
# ═══════════════════════════════════════════════════

def main():
    """主函数"""
    # 配置
    config = RAGAgentConfig(
        llm_model="gpt-4o",
        embedding_model="text-embedding-3-small",
        chunk_size=1000,
        chunk_overlap=200,
        retrieval_top_k=5,
        persist_directory="./chroma_db",
        collection_name="knowledge_base"
    )
    
    # 索引文档
    indexer = RAGDocumentIndexer(config)
    vectorstore = indexer.index_directory("./knowledge_docs")
    
    # 创建 Agent
    agent = RAGAgent(config, vectorstore)
    
    # 对话
    agent.conversation_mode()


if __name__ == "__main__":
    main()
```

---

## 12.8 最佳实践与常见陷阱

### 12.8.1 最佳实践清单

```
╔══════════════════════════════════════════════════════════════╗
║                   RAG 最佳实践清单                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  📄 文档处理                                                 ║
║  ├── ✅ 清洗文档：移除页眉页脚水印噪音                        ║
║  ├── ✅ 保留元数据：来源、作者、日期、章节                    ║
║  ├── ✅ 使用递归分割，在自然边界处分块                        ║
║  ├── ✅ 分块大小 500-1500 字符（中文约 200-500 字）          ║
║  ├── ✅ overlap 设为 chunk_size 的 10-20%                    ║
║  └── ✅ 考虑父子块策略，小块检索大块返回                      ║
║                                                              ║
║  🔍 检索策略                                                 ║
║  ├── ✅ 混合检索（稠密 + BM25）优于单一检索                   ║
║  ├── ✅ 使用 MMR 替代纯相似度排序，增加多样性                 ║
║  ├── ✅ 重排序能显著提升 Top-K 精度                          ║
║  ├── ✅ 查询重写/扩展能改善召回率                             ║
║  └── ✅ metadata filtering 减少搜索空间                      ║
║                                                              ║
║  🤖 生成与交互                                               ║
║  ├── ✅ 明确告知 LLM "只基于参考资料回答"                    ║
║  ├── ✅ 要求标注引用来源，可溯源                              ║
║  ├── ✅ 保留对话历史，支持多轮追问                            ║
║  ├── ✅ 设置 temperature=0.1，降低幻觉                       ║
║  └── ✅ 限制回答长度，聚焦核心信息                            ║
║                                                              ║
║  🏗️ 架构与运维                                               ║
║  ├── ✅ 实现增量索引，避免全量重建                            ║
║  ├── ✅ 监控检索延迟和 LLM Token 消耗                         ║
║  ├── ✅ 记录每次检索的分数，便于调试                          ║
║  ├── ✅ A/B 测试不同分块策略和检索参数                        ║
║  └── ✅ 定期评估检索质量（使用 RAGAS 等框架）                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### 12.8.2 常见陷阱与解决方案

| 陷阱 | 症状 | 解决方案 |
|------|------|---------|
| **分块太大** | 检索结果不精准，包含大量无关信息 | 减小 chunk_size，使用语义分割 |
| **分块太小** | 缺乏上下文，回答不完整 | 增大 chunk_size，使用父子块策略 |
| **只用稠密检索** | 产品编号、专有名词搜不到 | 加入 BM25 混合检索 |
| **不设 overlap** | 关键信息正好被切断 | 设置 10-20% 的 overlap |
| **忽略元数据** | 无法按部门/日期/类型过滤 | 始终保存和利用 metadata |
| **幻觉问题** | Agent 编造不存在的答案 | 强化 Prompt 约束 + 引用溯源 |
| **全量重建索引** | 文档更新代价高昂 | 实现增量更新机制 |
| **不考虑查询质量** | 用户查询模糊导致检索差 | 加入查询重写/查询扩展 |

### 12.8.3 查询重写与扩展

用户原始查询往往不够精准，查询重写能显著提升检索效果：

```python
class QueryRewriter:
    """查询重写器 — 用 LLM 优化用户查询"""
    
    def __init__(self, llm):
        self.llm = llm
    
    def rewrite(self, original_query: str, conversation_history: list = None) -> str:
        """重写查询，使其更适合检索"""
        history_context = ""
        if conversation_history:
            last_qa = conversation_history[-2:] if len(conversation_history) >= 2 else conversation_history
            history_context = "\n".join(
                f"{'用户' if m['role']=='user' else '助手'}: {m['content']}"
                for m in last_qa
            )
        
        prompt = f"""请将用户的查询重写为一个更适合信息检索的查询。

规则：
1. 补全指代和省略（如果用户说"它的价格"，请替换为具体对象）
2. 移除无关的寒暄词语
3. 保持核心语义不变
4. 添加可能有用的同义词或相关术语

对话历史：
{history_context if history_context else '（无）'}

原始查询：{original_query}

重写后的查询："""
        
        response = self.llm.invoke(prompt)
        return response.content.strip()
    
    def expand(self, query: str, n_variations: int = 3) -> list[str]:
        """生成查询变体，提高召回率"""
        prompt = f"""为以下查询生成 {n_variations} 个语义等价但表达不同的变体。

原始查询：{query}

变体列表（每行一个）："""
        
        response = self.llm.invoke(prompt)
        variations = [line.strip() for line in response.content.strip().split("\n") if line.strip()]
        return variations[:n_variations]


class MultiQueryRetriever:
    """多查询检索器 — 用多个变体查询提高召回"""
    
    def __init__(self, retriever, query_rewriter: QueryRewriter):
        self.retriever = retriever
        self.rewriter = query_rewriter
    
    def retrieve(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """使用多个查询变体检索"""
        # 生成查询变体
        variations = self.rewriter.expand(query, n_variations=3)
        all_queries = [query] + variations
        
        # 对每个变体执行检索
        all_results = {}
        for q in all_queries:
            results = self.retriever.retrieve(q, top_k=top_k * 2)
            for r in results:
                cid = r.chunk_id
                if cid not in all_results or r.score > all_results[cid].score:
                    all_results[cid] = r
        
        # 去重并取 Top-K
        unique_results = list(all_results.values())
        unique_results.sort(key=lambda x: x.score, reverse=True)
        return unique_results[:top_k]
```

---

## 12.9 小结与延伸阅读

### 12.9.1 核心要点回顾

本章我们深入探讨了 RAG 增强 Agent 的完整技术栈：

1. **RAG 的核心价值**：通过检索外部知识来弥补 LLM 的知识过期、私有数据缺失和幻觉问题
2. **六步管线**：Document Loading → Text Splitting → Embedding → Vector Store → Retrieval → Generation
3. **分块是关键**：分块策略直接影响检索质量，递归分割+父子块是推荐方案
4. **混合检索优于单一检索**：稠密检索（语义）+ BM25（关键词）的组合效果最好
5. **重排序是杀手锏**：交叉编码器能显著提升 Top-K 精度
6. **知识库需要维护**：增量更新、版本管理、过期清理是生产环境的必备能力
7. **GraphRAG 拓展了 RAG 的能力边界**：知识图谱赋予了多跳推理和关系查询能力

### 12.9.2 RAG 评估框架

评估 RAG 系统的质量需要专门的指标：

| 指标 | 类型 | 含义 |
|------|------|------|
| **Faithfulness** | 忠实度 | 回答是否基于检索到的上下文 |
| **Answer Relevancy** | 答案相关性 | 回答与问题的相关程度 |
| **Context Precision** | 上下文精确率 | 检索到的文档中相关文档的占比 |
| **Context Recall** | 上下文召回率 | 相关文档被检索到的比例 |
| **Hit Rate** | 命中率 | 正确答案出现在 Top-K 中的比例 |
| **MRR** | 平均倒数排名 | 正确答案排名的倒数均值 |

推荐使用 [RAGAS](https://github.com/explodinggradients/ragas) 框架进行自动化评估。

### 12.9.3 延伸阅读

1. **论文**
   - Lewis et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" — RAG 开山之作
   - Gao et al. (2024). "Retrieval-Augmented Generation for Large Language Models: A Survey" — RAG 全面综述
   - Es et al. (2024). "Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection" — 自我反思式 RAG
   - Edge et al. (2024). "From Local to Global: A Graph RAG Approach to Query-Focused Summarization" — Microsoft 的 GraphRAG

2. **工具与框架**
   - [LangChain](https://python.langchain.com/) — 最流行的 LLM 应用框架
   - [LlamaIndex](https://www.llamaindex.ai/) — 专注 RAG 的数据框架
   - [ChromaDB](https://www.trychroma.com/) — 轻量级向量数据库
   - [RAGAS](https://github.com/explodinggradients/ragas) — RAG 评估框架
   - [Haystack](https://haystack.deepset.ai/) — 端到端 NLP 框架

3. **进阶主题**
   - **Agentic RAG**：让 Agent 自主决定何时检索、检索什么、是否需要补充检索
   - **CRAG (Corrective RAG)**：检索后自我评估，不满足则触发纠正策略
   - **自适应 RAG**：根据查询复杂度动态选择检索策略
   - **多模态 RAG**：支持图片、表格、公式的检索与理解
   - **实时 RAG**：结合 Web 搜索的实时知识检索
