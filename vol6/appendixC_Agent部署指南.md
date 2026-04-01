# 附录C：Agent部署指南

> **"部署不是终点，而是起点。"**
> 将Agent从开发环境安全、高效、经济地推向生产环境，是每个Agent工程师的必修课。

---

## C.1 部署概览

Agent应用的部署与传统Web应用有显著差异。LLM调用的不确定性、工具执行的安全风险、长时间运行的工作流、以及不可预测的资源消耗，都对部署架构提出了独特的要求。

### C.1.1 部署模式对比

| 模式 | 适用规模 | 延迟 | 可用性 | 运维复杂度 | 成本结构 |
|------|---------|------|--------|-----------|---------|
| **单容器** | < 1K QPS | < 100ms | 99% | 低 | 固定月费 |
| **K8s集群** | 1K-100K QPS | < 50ms | 99.9% | 高 | 弹性+固定 |
| **Serverless** | 弹性负载 | 100-500ms | 99.5% | 低 | 按调用计费 |
| **边缘部署** | 离线/低延迟 | < 10ms | 99%+ | 中 | 一次性投入 |

### C.1.2 部署前检查清单

在将Agent推向生产环境之前，请确认以下事项：

- [ ] **API密钥安全**：所有密钥通过环境变量或密钥管理服务注入，不得硬编码
- [ ] **错误处理**：所有LLM调用、工具执行、数据库操作都有超时和重试机制
- [ ] **日志记录**：结构化日志，包含请求ID、耗时、token用量等关键指标
- [ ] **速率限制**：防止API滥用和成本失控
- [ ] **内容过滤**：输入输出内容安全过滤
- [ ] **健康检查**：`/health` 端点返回服务状态
- [ ] **优雅关闭**：处理完进行中的请求后再关闭
- [ ] **配置外部化**：环境区分（dev/staging/prod）通过配置切换

---

## C.2 Docker容器化部署

### C.2.1 Dockerfile最佳实践

**多阶段构建 — Python Agent应用**

```dockerfile
# ==================== 阶段1：依赖安装 ====================
FROM python:3.12-slim AS builder

WORKDIR /build

# 先复制依赖文件，利用Docker层缓存
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ==================== 阶段2：运行时 ====================
FROM python:3.12-slim AS runtime

# 安全：创建非root用户
RUN groupadd -r agent && useradd -r -g agent -d /app agent

WORKDIR /app

# 从builder阶段复制已安装的依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY --chown=agent:agent . .

# 安全：设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app:${PATH}"

# 切换到非root用户
USER agent

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**多阶段构建 — Rust Agent应用（如edict）**

```dockerfile
# ==================== 阶段1：编译 ====================
FROM rust:1.83-slim AS builder

WORKDIR /build

# 依赖缓存
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release && rm -rf src

# 真正编译
COPY . .
RUN cargo build --release

# ==================== 阶段2：运行时 ====================
FROM debian:bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/agent-server /app/agent-server
COPY --from=builder /build/config /app/config

RUN groupadd -r agent && useradd -r -g agent agent
USER agent

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD ["/app/agent-server", "--health-check"]

EXPOSE 8080

CMD ["/app/agent-server", "--config", "/app/config/production.toml"]
```

### C.2.2 Docker Compose — 完整开发/部署环境

```yaml
# docker-compose.yml
version: "3.8"

services:
  # Agent应用
  agent:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://agent:password@postgres:5432/agent_db
      - REDIS_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LOG_LEVEL=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2.0"
        reservations:
          memory: 512M

  # PostgreSQL - 持久化存储
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agent_db
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agent"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis - 缓存和会话
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # 向量数据库（Chroma嵌入式）或独立Milvus
  # 如果用Chroma嵌入式，无需单独容器

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - agent
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### C.2.3 镜像优化技巧

| 技巧 | 效果 | 示例 |
|------|------|------|
| 多阶段构建 | 镜像体积减少50-80% | 如上Dockerfile |
| `.dockerignore` | 减少构建上下文 | 忽略`.git`, `venv`, `__pycache__` |
| Alpine基础镜像 | 减少基础层大小 | `python:3.12-alpine` |
| 层缓存优化 | 加速重复构建 | 先COPY依赖文件 |
| 合并RUN指令 | 减少层数 | `RUN apt-get update && apt-get install -y ...` |
| `--no-cache-dir` | 避免pip缓存 | `pip install --no-cache-dir` |

```dockerfile
# .dockerignore
.git
.github
__pycache__
*.pyc
.env
.venv
venv
node_modules
*.md
tests/
docs/
.mypy_cache
.pytest_cache
```

---

## C.3 Kubernetes编排

### C.3.1 基础部署配置

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-server
  labels:
    app: agent-server
    version: v1.2.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # 零停机
  selector:
    matchLabels:
      app: agent-server
  template:
    metadata:
      labels:
        app: agent-server
    spec:
      # 安全：非root用户
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      
      containers:
      - name: agent-server
        image: registry.example.com/agent-server:v1.2.0
        ports:
        - containerPort: 8000
          name: http
        
        # 环境变量
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: database-url
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: openai-api-key
        - name: LOG_LEVEL
          value: "info"
        
        # 资源限制
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        
        # 健康检查
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        
        # 优雅关闭
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 10"]
      
      # 终止宽限期（与优雅关闭配合）
      terminationGracePeriodSeconds: 30
```

### C.3.2 Service与Ingress

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-service
spec:
  selector:
    app: agent-server
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-ingress
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - agent.example.com
    secretName: agent-tls
  rules:
  - host: agent.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agent-service
            port:
              number: 80
```

### C.3.3 HPA自动伸缩

Agent应用的负载通常波动较大（取决于用户使用频率），HPA是必不可少的：

```yaml
# hpa.yaml - 基于CPU和自定义指标的伸缩
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-server
  minReplicas: 2
  maxReplicas: 20
  metrics:
  # CPU使用率
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  # 自定义指标：每秒请求数
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "50"
  # 自定义指标：LLM Token队列长度
  - type: Pods
    pods:
      metric:
        name: llm_token_queue_depth
      target:
        type: AverageValue
        averageValue: "10000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100  # 每次最多翻倍
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # 缩容更保守
      policies:
      - type: Percent
        value: 25  # 每次最多缩减25%
        periodSeconds: 60
```

💡 **Agent专属伸缩策略**：

- **LLM Token队列**是比QPS更好的伸缩指标——因为每个请求的token消耗差异很大
- **扩容要快**（60秒稳定窗口），**缩容要慢**（300秒），避免频繁伸缩
- **预留缓冲**：最小副本数至少为2，避免单点故障

### C.3.4 GPU调度（本地模型场景）

```yaml
# GPU节点配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-server
spec:
  template:
    spec:
      containers:
      - name: embedding-server
        image: registry.example.com/embedding:v1.0.0
        resources:
          limits:
            nvidia.com/gpu: 1  # 请求1块GPU
            memory: "8Gi"
      # GPU节点选择器
      nodeSelector:
        gpu-type: nvidia-a10g
      tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
```

### C.3.5 密钥管理

```yaml
# Secret创建（生产环境请使用External Secrets Operator）
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
type: Opaque
stringData:
  database-url: postgresql://agent:xxx@postgres:5432/agent_db
  openai-api-key: sk-...
  anthropic-api-key: sk-ant-...
  jwt-secret: $(openssl rand -hex 32)
```

```bash
# 使用kubectl创建
kubectl create secret generic agent-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=openai-api-key="sk-..." \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## C.4 Serverless部署

### C.4.1 AWS Lambda + API Gateway

⚠️ **限制**：Lambda有15分钟超时、10GB内存限制，不适合长时间运行的Agent工作流。

```python
# lambda_handler.py
import json
import httpx
import os

# 在Lambda外初始化客户端（冷启动优化）
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
BASE_URL = "https://api.openai.com/v1"

# HTTP客户端复用（避免每次请求创建）
http_client = httpx.Client(timeout=60.0)

def handler(event, context):
    """Lambda入口函数"""
    try:
        # 解析请求
        body = json.loads(event.get("body", "{}"))
        message = body.get("message", "")
        
        if not message:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "message is required"})
            }
        
        # 调用LLM
        response = http_client.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": message}],
                "max_tokens": 500,
            },
            timeout=30.0,
        )
        result = response.json()
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "response": result["choices"][0]["message"]["content"],
                "tokens": result["usage"]
            })
        }
        
    except httpx.TimeoutException:
        return {"statusCode": 504, "body": json.dumps({"error": "LLM timeout"})}
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
```

```yaml
# serverless.yml
service: agent-api

frameworkVersion: "3"

provider:
  name: aws
  runtime: python3.12
  region: ap-east-1
  timeout: 60  # 秒（最大900）
  memorySize: 512  # MB（最大10240）
  environment:
    OPENAI_API_KEY: ${param:openai_api_key}

functions:
  chat:
    handler: lambda_handler.handler
    events:
      - http:
          path: chat
          method: post
          cors: true
    provisionedConcurrency: 5  # 预留并发，减少冷启动

plugins:
  - serverless-python-requirements

package:
  individually: false
  patterns:
    - "!tests/**"
    - "!docs/**"
```

### C.4.2 Vercel部署（Python）

```python
# api/chat.py
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import httpx
import os

app = FastAPI()

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message", "")
    
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": message}],
                "stream": True,
            },
            timeout=60.0,
        ) as response:
            async def generate():
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        yield line + "\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream"
            )
```

```json
// vercel.json
{
  "builds": [
    {
      "src": "api/**/*.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ]
}
```

### C.4.3 Cloudflare Workers（边缘计算）

```javascript
// wrangler.toml
name = "agent-edge"
main = "src/index.js"
compatibility_date = "2025-01-01"

[vars]
ENVIRONMENT = "production"

# 密钥通过 wrangler secret put OPENAI_API_KEY 设置
```

```javascript
// src/index.js
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    
    if (pathname === "/api/chat" && request.method === "POST") {
      const { message } = await request.json();
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: message }],
          max_tokens: 500,
        }),
      });
      
      return new Response(response.body, {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response("Agent Edge API", { status: 404 });
  },
};
```

---

## C.5 边缘部署与离线推理

### C.5.1 本地模型部署架构

```
┌──────────────────────────────────────────────────┐
│                   边缘设备                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Agent      │  │ 嵌入模型   │  │ LLM推理    │  │
│  │ 应用层     │→ │ (ONNX)    │→ │ (llama.cpp) │  │
│  └────────────┘  └────────────┘  └────────────┘  │
│         ↓                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ 本地向量数据库 (Chroma / FAISS)            │  │
│  └────────────────────────────────────────────┘  │
│         ↓                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ GPU / NPU 加速层                           │  │
│  │ (CUDA / Metal / OpenVINO)                  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
         ↕ (可选：云端同步)
┌──────────────────────────────────────────────────┐
│  云端：模型更新、知识库同步、日志上报              │
└──────────────────────────────────────────────────┘
```

### C.5.2 模型量化部署

**GGUF格式 — llama.cpp**

```bash
# 下载量化模型
ollama pull qwen2.5:7b-q4_K_M  # 4-bit量化

# 使用llama.cpp直接部署
./server -m qwen2.5-7b-q4_k_m.gguf \
    --port 8080 \
    --host 0.0.0.0 \
    --n-gpu-layers 99 \  # 全部层放GPU
    --ctx-size 4096 \     # 上下文长度
    --threads 8           # CPU线程数
```

**量化等级对比**

| 量化等级 | 模型大小（7B参数） | 显存需求 | 质量损失 | 速度 |
|---------|------------------|---------|---------|------|
| FP16（无量化） | ~14GB | 16GB | 0% | 1x |
| Q8_0 | ~7.5GB | 8GB | <1% | 1.5x |
| Q5_K_M | ~5.2GB | 6GB | 1-2% | 1.8x |
| Q4_K_M | ~4.4GB | 5GB | 2-3% | 2.0x |
| Q3_K_M | ~3.5GB | 4GB | 3-5% | 2.2x |
| Q2_K | ~2.9GB | 3.5GB | 5-10% | 2.5x |

🎯 **推荐**：Q4_K_M 是质量和速度的最佳平衡点，7B模型约需5GB显存。

### C.5.3 ONNX Runtime — 嵌入模型加速

```python
import onnxruntime as ort
import numpy as np

# 创建推理会话
session = ort.InferenceSession(
    "bge-large-zh-v1.5.onnx",
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"]  # GPU优先
)

def embed(texts: list[str]) -> np.ndarray:
    """批量嵌入"""
    # Tokenization（简化示例）
    inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="np")
    
    # ONNX推理
    outputs = session.run(
        None,
        {"input_ids": inputs["input_ids"], "attention_mask": inputs["attention_mask"]}
    )
    
    return outputs[0]  # (batch_size, hidden_dim)
```

---

## C.6 性能调优

### C.6.1 LLM调用优化

**请求批处理**

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def process_batch(messages_list: list[list[dict]]) -> list[str]:
    """并发处理多个请求，带信号量控制"""
    semaphore = asyncio.Semaphore(10)  # 最多10个并发
    
    async def single_call(messages):
        async with semaphore:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=500,
            )
            return response.choices[0].message.content
    
    results = await asyncio.gather(
        *[single_call(msgs) for msgs in messages_list],
        return_exceptions=True
    )
    return results
```

**连接池配置**

```python
import httpx

# 复用HTTP连接，避免每次请求的TCP握手开销
client = httpx.AsyncClient(
    timeout=60.0,
    limits=httpx.Limits(
        max_connections=100,        # 最大连接数
        max_keepalive_connections=20,  # 最大保持连接
        keepalive_expiry=300,       # 保持连接超时（秒）
    ),
    http2=True,  # 启用HTTP/2（如果服务端支持）
)
```

### C.6.2 缓存策略

**语义缓存 — 避免重复LLM调用**

```python
import hashlib
import json
from typing import Optional

class SemanticCache:
    """基于向量相似度的LLM响应缓存"""
    
    def __init__(self, similarity_threshold: float = 0.95):
        self.cache = {}  # {embedding: response}
        self.threshold = similarity_threshold
    
    def _get_cache_key(self, prompt: str, model: str, params: dict) -> str:
        """生成缓存键"""
        data = {
            "prompt": prompt,
            "model": model,
            "temperature": params.get("temperature", 0),
            "max_tokens": params.get("max_tokens", 1000),
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    
    def get(self, prompt: str, model: str, params: dict) -> Optional[str]:
        """查询缓存"""
        key = self._get_cache_key(prompt, model, params)
        return self.cache.get(key)
    
    def set(self, prompt: str, model: str, params: dict, response: str):
        """写入缓存"""
        key = self._get_cache_key(prompt, model, params)
        self.cache[key] = response
```

**Redis缓存 — 高性能分布式缓存**

```python
import redis
import json

redis_client = redis.Redis(host="localhost", port=6379, db=0)

def cache_llm_response(
    prompt: str,
    response: str,
    ttl: int = 3600  # 1小时
):
    """缓存LLM响应"""
    key = f"llm:cache:{hashlib.md5(prompt.encode()).hexdigest()}"
    redis_client.setex(key, ttl, json.dumps(response))

def get_cached_response(prompt: str) -> Optional[str]:
    """获取缓存的LLM响应"""
    key = f"llm:cache:{hashlib.md5(prompt.encode()).hexdigest()}"
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    return None
```

### C.6.3 异步并发模式

```python
# 工具调用并发执行
import asyncio

async def execute_tools_concurrently(tools: list[dict]) -> list[dict]:
    """并发执行多个无依赖的工具调用"""
    
    async def run_tool(tool_call: dict) -> dict:
        try:
            result = await call_tool(
                tool_call["name"],
                tool_call["arguments"]
            )
            return {"tool_call_id": tool_call["id"], "result": result}
        except Exception as e:
            return {"tool_call_id": tool_call["id"], "error": str(e)}
    
    # 并发执行所有工具（假设工具之间无依赖）
    results = await asyncio.gather(*[run_tool(t) for t in tools])
    return list(results)
```

### C.6.4 流式输出优化

```python
from fastapi.responses import StreamingResponse
import json

async def stream_chat(message: str):
    """流式输出，减少首字延迟"""
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": message}],
                "stream": True,
            },
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60.0,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    data = json.loads(line[6:])
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
            yield "data: [DONE]\n\n"

# FastAPI路由
@app.post("/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    return StreamingResponse(
        stream_chat(body["message"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
        }
    )
```

---

## C.7 成本优化

### C.7.1 模型路由策略

```python
class ModelRouter:
    """根据任务复杂度自动选择模型"""
    
    def __init__(self):
        self.routes = {
            "simple": {"model": "gpt-4o-mini", "max_tokens": 500},
            "medium": {"model": "gpt-4o", "max_tokens": 1000},
            "complex": {"model": "gpt-4o", "max_tokens": 4000},
            "reasoning": {"model": "o3-mini", "max_tokens": 4000},
        }
    
    def classify_complexity(self, prompt: str, conversation_length: int) -> str:
        """启发式分类"""
        if conversation_length > 10:
            return "complex"
        if any(kw in prompt for kw in ["分析", "比较", "推导", "证明"]):
            return "reasoning"
        if len(prompt) > 500:
            return "medium"
        return "simple"
    
    def get_model_config(self, prompt: str, history: list = None) -> dict:
        """获取最优模型配置"""
        length = len(history) if history else 0
        complexity = self.classify_complexity(prompt, length)
        return self.routes[complexity]
```

**预期节省**：合理使用模型路由可以节省 **40-60%** 的API成本。

### C.7.2 Token用量控制

```python
# 上下文窗口管理
class ContextManager:
    def __init__(self, max_tokens: int = 120000, reserve_for_response: int = 4000):
        self.max_tokens = max_tokens
        self.reserve = reserve_for_response
        self.available = max_tokens - reserve_for_response
    
    def trim_messages(self, messages: list[dict]) -> list[dict]:
        """裁剪消息历史以适配上下文窗口"""
        token_count = sum(estimate_tokens(msg["content"]) for msg in messages)
        
        if token_count <= self.available:
            return messages
        
        # 保留system prompt
        system = [m for m in messages if m["role"] == "system"]
        non_system = [m for m in messages if m["role"] != "system"]
        
        # 从最旧的消息开始移除
        trimmed = []
        used = sum(estimate_tokens(m["content"]) for m in system)
        
        for msg in reversed(non_system):
            msg_tokens = estimate_tokens(msg["content"])
            if used + msg_tokens <= self.available:
                trimmed.insert(0, msg)
                used += msg_tokens
        
        return system + trimmed

def estimate_tokens(text: str) -> int:
    """粗略估算token数：中文约1.5token/字，英文约0.25token/word"""
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars
    return int(chinese_chars * 1.5 + other_chars * 0.25)
```

### C.7.3 按需伸缩成本模型

| 策略 | 固定月费 | 弹性费用 | 月总成本（估算） | 节省 |
|------|---------|---------|----------------|------|
| 恒定3副本 | $300 | $500 | **$800** | 基准 |
| HPA 2-10副本 | $200 | $300 | **$500** | 37% |
| Serverless | $0 | $400 | **$400** | 50% |
| 混合（本地+云端） | $100（本地硬件） | $200 | **$300** | 62% |

💡 **推荐**：大多数场景下，K8s HPA + 模型路由是最优选择，兼顾性能和成本。

---

## C.8 监控与告警

### C.8.1 核心监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| **请求延迟 (P50/P99)** | 端到端延迟 | P99 > 10s |
| **LLM API延迟** | 外部LLM调用延迟 | > 30s |
| **Token用量/小时** | LLM Token消耗速率 | > 预算的120% |
| **错误率** | 5xx错误占比 | > 1% |
| **工具调用成功率** | 工具执行成功率 | < 95% |
| **队列深度** | 待处理请求队列 | > 1000 |
| **缓存命中率** | 语义缓存命中 | < 30%（过低） |

### C.8.2 Prometheus指标埋点

```python
from prometheus_client import Counter, Histogram, Gauge

# 指标定义
REQUEST_COUNT = Counter(
    "agent_requests_total",
    "Total agent requests",
    ["model", "status"]
)

REQUEST_LATENCY = Histogram(
    "agent_request_duration_seconds",
    "Request latency",
    ["model"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

TOKEN_USAGE = Counter(
    "agent_tokens_total",
    "Token usage",
    ["model", "type"]  # type: input/output
)

ACTIVE_WORKFLOWS = Gauge(
    "agent_active_workflows",
    "Currently active workflow count"
)

# 使用示例
@app.post("/chat")
async def chat(request: Request):
    model = "gpt-4o"
    REQUEST_COUNT.labels(model=model, status="started").inc()
    ACTIVE_WORKFLOWS.inc()
    
    with REQUEST_LATENCY.labels(model=model).time():
        try:
            result = await call_llm(...)
            REQUEST_COUNT.labels(model=model, status="success").inc()
            TOKEN_USAGE.labels(model=model, type="input").inc(input_tokens)
            TOKEN_USAGE.labels(model=model, type="output").inc(output_tokens)
            return result
        except Exception:
            REQUEST_COUNT.labels(model=model, status="error").inc()
            raise
        finally:
            ACTIVE_WORKFLOWS.dec()
```

### C.8.3 Grafana Dashboard配置要点

推荐的Dashboard面板：

1. **概览面板**：QPS、错误率、P50/P99延迟
2. **LLM成本面板**：Token用量趋势、费用估算、模型分布
3. **工具调用面板**：各工具调用次数、成功率、延迟
4. **资源面板**：CPU/内存/GPU利用率、副本数
5. **业务面板**：用户满意度、对话轮数、任务完成率

---

*附录C完*
