# 附录D：术语表

> **"术语是知识的基本单位。"**
> 本术语表收录了Agent编程领域的核心专业术语，按字母顺序排列，提供中英文对照和简要释义。

---

## 使用说明

- 每个术语包含：**英文名称**、**中文释义**、**简要解释**、**相关术语**
- 英文术语按字母顺序排列
- 中文拼音索引用于快速定位
- 🔖 标记表示该术语在本书中首次出现的章节

---

## A

### A/B Testing（A/B测试）
对照实验方法，将流量随机分配到两个或多个版本以比较效果。在Agent开发中常用于比较不同prompt或模型版本的效果。
- **相关术语**：Evaluation, Red Teaming
- **参见**：卷四 第12章

### Absorbing State（吸收状态）
在马尔可夫决策过程（MDP）中，一旦到达就不会离开的状态。在Agent规划中，吸收状态通常代表任务的完成或失败。
- **相关术语**：MDP, Planning

### Action Space（动作空间）
Agent可以执行的所有动作的集合。在LLM Agent中，动作空间通常包括文本生成、工具调用、环境交互等。
- **相关术语**：State Space, Policy, MDP

### Active Learning（主动学习）
机器学习范式，模型主动选择最有价值的样本进行标注。在Agent中可用于优先选择需要人类反馈的案例。
- **相关术语**：RLHF, Human-in-the-Loop

### Agent（智能体）
能够感知环境、做出决策并执行动作以实现目标的自主系统。本书的核心概念。
- **相关术语**：Autonomous Agent, Multi-Agent System
- **参见**：卷一 第1章

### Agent Architecture（Agent架构）
Agent系统的整体设计方案，定义了感知、推理、规划、执行等组件的组织方式和交互模式。常见架构包括ReAct、Plan-and-Execute、Reflexion等。
- **相关术语**：ReAct, Plan-and-Execute, Cognitive Architecture
- **参见**：卷二 第3章

### Agentic Workflow（Agent工作流）
由Agent自主执行的多步骤流程，可能包含工具调用、条件分支、循环等复杂逻辑。
- **相关术语**：Workflow, DAG, Pipeline
- **参见**：卷三 第6章

### Alignment（对齐）
使AI系统的行为与人类价值观和意图一致的技术和过程。包括RLHF、Constitutional AI等方法。
- **相关术语**：RLHF, Constitutional AI, Safety, Guardrails
- **参见**：卷五 第14章

### Anthropic
AI安全公司，创建了Claude系列模型和Constitutional AI方法。
- **相关术语**：Claude, Constitutional AI, RLHF

### Auto-regressive Model（自回归模型）
一种生成模型，每次生成一个token，并将之前生成的所有token作为上下文。GPT系列和Claude都是自回归模型。
- **相关术语**：GPT, Claude, Token, Next-token Prediction

### Autonomous Agent（自主Agent）
能够在最小人工干预下持续运作的Agent系统。与简单的"一次请求-一次响应"模式不同，自主Agent可以持续感知、决策和行动。
- **相关术语**：Agent, Multi-Agent System

---

## B

### Batch Processing（批处理）
将多个请求合并为一个批次统一处理，以提高吞吐量和效率。在LLM推理中，批处理可以显著提升GPU利用率。
- **相关术语**：Throughput, Inference Optimization

### Beam Search（束搜索）
一种解码策略，在每个步骤保留最有可能的k个候选序列，而不是只保留最好的一个。在Agent中较少使用，因为Agent通常使用采样（temperature > 0）以获得多样性。
- **相关术语**：Decoding Strategy, Sampling, Temperature

### Blackboard Architecture（黑板架构）
一种多Agent协作模式，所有Agent通过共享的"黑板"（共享工作空间）进行通信和协作。
- **相关术语**：Multi-Agent System, Shared Memory

### Boltzmann Distribution（玻尔兹曼分布）
在温度参数控制下的概率分布。LLM的采样温度本质上就是玻尔兹曼分布中的温度参数。
- **相关术语**：Temperature, Sampling, Top-p

### Budget Token（预算Token）
在扩展思考（如Claude的Extended Thinking）中，分配给模型进行内部推理的最大token数量。
- **相关术语**：Extended Thinking, Chain-of-Thought, Token
- **参见**：卷二 第4章

### Byte-Pair Encoding (BPE)（字节对编码）
一种子词分词方法，通过迭代合并最频繁出现的字符对来构建词表。OpenAI的GPT系列使用BPE。
- **相关术语**：Tokenization, Token, Vocabulary

---

## C

### Chain-of-Thought (CoT)（思维链）
一种prompt技术，要求模型在给出最终答案之前展示其推理过程。研究表明CoT可以显著提升模型在复杂推理任务上的表现。
- **相关术语**：Zero-shot CoT, Few-shot CoT, Tree-of-Thought
- **参见**：卷二 第4章

### Chunking（分块）
将长文档分割成较小的片段（chunks），以便进行向量化存储和检索。分块策略直接影响RAG系统的检索质量。
- **相关术语**：RAG, Embedding, Retrieval, Splitting
- **参见**：卷三 第7章

### Claude
Anthropic公司开发的大语言模型系列，包括Claude Opus、Sonnet和Haiku等版本。
- **相关术语**：Anthropic, Constitutional AI

### Cognitive Architecture（认知架构）
对Agent内部信息处理流程的抽象建模，类比人类认知系统的感知、记忆、推理、决策过程。
- **相关术语**：Agent Architecture, Memory, Planning

### Completion（补全）
LLM的基本功能之一，给定一段文本前缀，模型生成后续文本。
- **相关术语**：Prompt, Generation, Next-token Prediction

### Constitutional AI (CAI)（宪法AI）
Anthropic提出的AI对齐方法，让AI根据一组预定义的原则（"宪法"）来评判和修正自己的行为。
- **相关术语**：Alignment, RLHF, Safety, Anthropic

### Context Window（上下文窗口）
LLM在一次推理中能处理的最大token数量。上下文窗口决定了模型能"看到"多少输入信息。
- **相关术语**：Token, Context Length, Long Context
- **参见**：卷一 第2章

### Conversation History（对话历史）
在多轮对话中保存的所有之前轮次的对话记录。对话历史的管理（截断、摘要、压缩）是Agent系统的重要挑战。
- **相关术语**：Memory, Session, Context Window

### Cost Token（成本Token）
衡量LLM API使用费用的单位，通常按输入token和输出token分别计价。
- **相关术语**：Token, API Pricing

### CrewAI
一个角色驱动的多Agent协作框架，Agent通过角色定义和任务分配来协作完成复杂任务。
- **相关术语**：Multi-Agent System, AutoGen, Agent Framework
- **参见**：附录A

---

## D

### DAG (Directed Acyclic Graph)（有向无环图）
一种数据结构，节点通过有向边连接且不存在环路。在Agent工作流中，DAG常用于表示步骤之间的依赖关系。
- **相关术语**：Workflow, Graph, LangGraph
- **参见**：卷三 第6章

### Decoding Strategy（解码策略）
LLM从概率分布中选择最终输出token的方法。常见策略包括贪心搜索、采样、束搜索、Top-k、Top-p等。
- **相关术语**：Sampling, Temperature, Top-k, Top-p, Beam Search

### Deduplication（去重）
从检索结果或知识库中移除重复内容的过程。对提升RAG系统的信息密度很重要。
- **相关术语**：RAG, Retrieval, Chunking

### Deep Learning（深度学习）
基于多层神经网络的机器学习方法。现代LLM和Agent系统都建立在深度学习技术之上。
- **相关术语**：Neural Network, Transformer, LLM

### Dependency Injection（依赖注入）
一种软件设计模式，将组件的依赖关系通过外部注入而非内部创建。在Agent框架中常用于管理LLM Provider、工具、存储等组件。
- **相关术语**：Inversion of Control, Plugin Architecture

### Distillation（蒸馏）
将大型模型的知识转移到小型模型的技术。常用于部署场景，以较小的模型实现接近大模型的效果。
- **相关术语**：Quantization, Pruning, Model Compression
- **参见**：卷五 第16章

### Docker
容器化平台，将应用及其依赖打包为可移植的容器镜像。Agent应用的标准化部署方式。
- **相关术语**：Container, Kubernetes, Deployment
- **参见**：附录C

---

## E

### Embedding（嵌入/向量表示）
将文本、图像等数据转换为稠密数值向量的过程。嵌入向量捕获了数据的语义信息，是RAG系统的核心组件。
- **相关术语**：Vector, Dense Representation, Semantic Search, RAG
- **参见**：卷三 第7章

### Emergent Ability（涌现能力）
当模型规模达到一定阈值后，突然出现的新能力。例如，大型LLM展现出的推理、代码生成、数学计算等能力在小模型中不存在。
- **相关术语**：Scaling Law, Foundation Model

### Evaluation（评估）
衡量Agent系统性能和质量的系统性方法。包括定量指标（准确率、延迟、成本）和定性评估（用户体验、安全性）。
- **相关术语**：Benchmark, Metrics, Red Teaming
- **参见**：卷四 第12章

### Extended Thinking（扩展思考）
Anthropic Claude模型的一种推理模式，模型在给出最终答案前进行更深入的内部推理，适合复杂推理任务。
- **相关术语**：Chain-of-Thought, Budget Token, Claude

---

## F

### Few-shot Learning（少样本学习）
在prompt中提供少量示例来引导模型理解任务格式和期望输出。Few-shot可以显著提升模型在特定任务上的表现。
- **相关术语**：Zero-shot, In-context Learning, Prompt Engineering
- **参见**：卷二 第4章

### Fine-tuning（微调）
在预训练模型的基础上，使用特定任务的数据进行额外训练以适应目标任务的技术。
- **相关术语**：Pre-training, Transfer Learning, LoRA, RLHF

### Foundation Model（基础模型）
在大规模数据上预训练的大型模型，可以作为多种下游任务的基础。GPT、Claude、Llama等都是基础模型。
- **相关术语**：Pre-training, LLM, Transfer Learning, Emergent Ability

### Function Calling（函数调用）
LLM根据用户请求和可用工具的描述，输出结构化的函数调用请求。也称为Tool Use。
- **相关术语**：Tool Use, Tool, Agent

---

## G

### Generation（生成）
LLM根据输入（prompt）产生输出的过程。是Agent系统的核心能力之一。
- **相关术语**：Completion, Sampling, Decoding Strategy

### GPT (Generative Pre-trained Transformer)
OpenAI开发的基于Transformer架构的生成式预训练模型系列，包括GPT-3.5、GPT-4、GPT-4o等。
- **相关术语**：OpenAI, Transformer, Foundation Model

### GPU (Graphics Processing Unit)
图形处理单元，因其并行计算能力而广泛用于LLM的训练和推理。
- **相关术语**：TPU, NPU, CUDA, Inference

### Gradient Descent（梯度下降）
一种优化算法，通过沿着损失函数梯度的反方向更新模型参数来最小化损失。
- **相关术语**：Backpropagation, Learning Rate, Loss Function

### Graph Database（图数据库）
使用图结构（节点、边、属性）来存储和查询数据的数据库系统。Neo4j是最知名的图数据库。
- **相关术语**：Knowledge Graph, Vector Database

### Guardrails（护栏）
限制Agent行为边界的安全机制，确保Agent的输出和行为在预定义的安全范围内。
- **相关术语**：Safety, Alignment, Content Filter, Red Teaming
- **参见**：卷五 第14章

### Grounding（接地/基于事实）
确保Agent的输出基于可验证的事实，而非"幻觉"。RAG是提升接地性的一种关键技术。
- **相关术语**：Hallucination, RAG, Factuality

---

## H

### Hallucination（幻觉）
LLM生成看似合理但实际上不符合事实或无法验证的内容。这是LLM面临的核心挑战之一。
- **相关术语**：Grounding, RAG, Factuality, Confidence Score

### HPA (Horizontal Pod Autoscaler)
Kubernetes的水平Pod自动伸缩器，根据指标（CPU、内存、自定义指标）自动调整Pod副本数。
- **相关术语**：Kubernetes, Auto-scaling, Deployment
- **参见**：附录C

### Human-in-the-Loop (HITL)（人在回路）
在自动化流程中引入人工审批或干预的机制。在Agent系统中常用于关键决策的安全把关。
- **相关术语**：Active Learning, Approval Workflow, Safety

---

## I

### In-context Learning (ICL)（上下文学习）
通过在prompt中提供示例或指令来引导模型行为，无需更新模型参数。Few-shot和Zero-shot都是上下文学习的形式。
- **相关术语**：Few-shot, Zero-shot, Prompt Engineering

### Inference（推理）
使用训练好的模型对新数据进行预测或生成的过程。在LLM领域，推理通常指API调用时的模型计算。
- **相关术语** : Training, Serving, Latency, Throughput

### Instruction Following（指令遵循）
LLM理解和执行用户指令的能力。这是评估模型质量的重要维度之一。
- **相关术语**：Prompt, System Prompt, Alignment

### Instruction Tuning（指令微调）
使用"指令-回答"对数据进行微调，使模型能够更好地理解和遵循用户指令。
- **相关术语**：Fine-tuning, RLHF, SFT (Supervised Fine-Tuning)

---

## J

### JSON Mode（JSON模式）
LLM的一种输出模式，确保输出为合法的JSON格式。在Agent的工具调用和结构化输出中广泛使用。
- **相关术语** : Structured Output, Function Calling, Schema

### JWT (JSON Web Token)
一种用于身份认证和信息传递的标准。在Agent API中常用于认证。
- **相关术语** : Authentication, API Key, OAuth

---

## K

### Knowledge Base (KB)（知识库）
存储结构化或非结构化知识的系统。在RAG中，知识库是Agent检索外部信息的主要来源。
- **相关术语** : RAG, Vector Store, Document Store

### Knowledge Cutoff（知识截止日期）
LLM训练数据的截止时间，模型不具备此日期之后的知识。
- **相关术语** : Training Data, Hallucination, Grounding

### Knowledge Distillation（知识蒸馏）
见 Distillation。

### Knowledge Graph（知识图谱）
以图结构表示实体及其关系的知识表示方法。可以增强Agent的知识推理能力。
- **相关术语** : Graph Database, Knowledge Base, Triple

### Kubernetes (K8s)
开源容器编排平台，用于自动化部署、扩展和管理容器化应用。
- **相关术语** : Docker, Container, HPA, Deployment
- **参见** : 附录C

---

## L

### LangChain
最广泛使用的LLM应用开发框架，提供模块化的组件来构建Agent和LLM应用。
- **相关术语** : LangGraph, LCEL, Agent Framework
- **参见** : 附录A

### LangGraph
基于图结构的Agent工作流编排框架，支持状态管理和人机协作。
- **相关术语** : LangChain, DAG, StateGraph
- **参见** : 附录A

### LCEL (LangChain Expression Language)
LangChain的声明式链式调用语法，用于构建和组合LLM处理管道。
- **相关术语** : LangChain, Chain, Pipeline

### LLM (Large Language Model)（大语言模型）
在海量文本数据上预训练的大型神经网络模型，具备自然语言理解和生成能力。
- **相关术语** : GPT, Claude, Foundation Model, Transformer

### LoRA (Low-Rank Adaptation)
一种参数高效的微调方法，通过低秩矩阵来近似全量微调的效果，大幅减少训练成本。
- **相关术语** : Fine-tuning, QLoRA, Parameter-efficient Fine-tuning

### Loss Function（损失函数）
衡量模型预测与真实值之间差异的函数。训练过程即是最小化损失函数。
- **相关术语** : Gradient Descent, Training, Optimization

---

## M

### MCP (Model Context Protocol)
模型上下文协议，一种标准化的协议，用于将外部工具和数据源连接到LLM Agent。
- **相关术语** : Tool Use, Plugin, API

### MDP (Markov Decision Process)（马尔可夫决策过程）
描述Agent决策过程的数学框架，定义了状态、动作、转移概率和奖励函数。
- **相关术语** : Policy, Value Function, Reinforcement Learning

### Memory（记忆）
Agent存储和检索过去信息的能力。包括短期记忆（上下文窗口）、长期记忆（向量存储）和工作记忆。
- **相关术语** : Context Window, Vector Store, RAG, Episodic Memory
- **参见** : 卷三 第8章

### Metrics（指标）
用于衡量系统性能的量化数据。Agent系统的常见指标包括延迟、吞吐量、准确率、成本等。
- **相关术语** : Evaluation, Monitoring, KPI

### Model Context Protocol
见 MCP。

### Multi-Agent System (MAS)（多Agent系统）
由多个Agent协作完成任务的系统。Agent之间通过消息传递、共享状态等方式进行协调。
- **相关术语** : Agent, Collaboration, Orchestration, AutoGen, CrewAI
- **参见** : 卷四 第10章

---

## N

### NeRF (Neural Radiance Fields)
神经辐射场，一种用神经网络表示3D场景的方法。在多模态Agent中有应用潜力。
- **相关术语** : 3D Understanding, Multimodal

### Next-token Prediction（下一个token预测）
自回归语言模型的核心训练目标：给定前面的所有token，预测下一个最可能的token。
- **相关术语** : Auto-regressive Model, Training, Language Modeling

### NPU (Neural Processing Unit)
神经处理单元，专门为神经网络推理设计的硬件加速器。
- **相关术语** : GPU, TPU, Edge Deployment

---

## O

### Observation（观察）
Agent从环境中获取的信息。在ReAct框架中，观察是工具执行后的返回结果。
- **相关术语** : ReAct, Tool Use, State, Perception
- **参见** : 卷二 第3章

### OpenAI
AI研究和部署公司，创建了GPT系列模型、DALL-E、Whisper等产品。
- **相关术语** : GPT, API, Embedding

### Orchestration（编排）
协调和管理多个Agent、工具或工作流步骤的过程。
- **相关术语** : Workflow, Multi-Agent System, DAG

### Overfitting（过拟合）
模型在训练数据上表现很好，但在未见数据上表现差。在Agent的few-shot示例选择中需要避免。
- **相关术语** : Generalization, Regularization, Training

---

## P

### Parameter-Efficient Fine-Tuning (PEFT)（参数高效微调）
只更新模型的一小部分参数即可实现微调效果的方法。LoRA、Prefix Tuning等属于PEFT方法。
- **相关术语** : LoRA, Fine-tuning, QLoRA

### Perception（感知）
Agent从外部环境获取信息的模块。在LLM Agent中，"感知"通常指接收用户输入或读取外部数据。
- **相关术语** : Observation, Input, Multimodal

### Plan-and-Execute（规划与执行）
一种Agent架构模式，先制定完整的执行计划，然后逐步执行计划中的每个步骤。
- **相关术语** : ReAct, Planning, Task Decomposition
- **参见** : 卷二 第3章

### Planning（规划）
Agent制定行动方案的过程。在复杂任务中，规划是Agent智能行为的关键组成部分。
- **相关术语** : Plan-and-Execute, Task Decomposition, MDP

### Plug-in（插件）
可热插拔的功能扩展模块。Agent的工具系统本质上就是一种插件架构。
- **相关术语** : Tool, Extension, MCP

### Prompt（提示）
发送给LLM的输入文本，用于引导模型生成期望的输出。
- **相关术语** : System Prompt, User Prompt, Prompt Engineering
- **参见** : 卷二 第4章

### Prompt Engineering（提示工程）
设计和优化prompt以引导LLM产生更好输出的技术和方法论。
- **相关术语** : Prompt, Chain-of-Thought, Few-shot, In-context Learning
- **参见** : 卷二 第4章

### Prompt Injection（提示注入）
一种攻击方式，攻击者通过精心设计的输入来绕过Agent的安全限制或使其执行非预期操作。
- **相关术语** : Security, Guardrails, Red Teaming, Jailbreak

---

## Q

### QLoRA (Quantized LoRA)
结合量化和LoRA的微调方法，在量化模型上进行低秩适配，进一步降低微调的硬件需求。
- **相关术语** : LoRA, Quantization, Fine-tuning, PEFT

### Quantization（量化）
降低模型数值精度的技术（如FP16→INT8→INT4），以减少模型大小和推理资源消耗。
- **相关术语** : Distillation, Pruning, Model Compression, GGUF
- **参见** : 卷五 第16章

### Query（查询）
在RAG系统中，用户的问题经过处理后用于检索相关文档的向量查询。
- **相关术语** : RAG, Retrieval, Embedding, Search

---

## R

### RAG (Retrieval-Augmented Generation)（检索增强生成）
将外部知识检索与LLM生成相结合的技术范式。Agent先从知识库中检索相关信息，再基于检索结果生成回答。
- **相关术语** : Retrieval, Knowledge Base, Embedding, Vector Store
- **参见** : 卷三 第7章

### Rate Limiting（速率限制）
限制API调用频率的机制，用于防止滥用和控制成本。
- **相关术语** : Throttling, API Quota, Cost Control

### ReAct (Reasoning + Acting)（推理+行动）
一种Agent架构模式，Agent交替进行推理（Reasoning）和行动（Acting），在推理中决定下一步行动，在行动中获取观察结果。
- **相关术语** : Observation, Action, Thought, Agent Architecture
- **参见** : 卷二 第3章

### Reasoning（推理）
Agent进行逻辑推导和决策的过程。推理能力是Agent智能水平的核心体现。
- **相关术语** : ReAct, Chain-of-Thought, Planning, Extended Thinking

### Redis
高性能内存键值数据库，常用于Agent系统的缓存、会话存储和消息队列。
- **相关术语** : Cache, Session, Message Queue

### Red Teaming（红队测试）
模拟攻击者对AI系统进行对抗性测试，以发现安全漏洞和弱点。
- **相关术语** : Security, Prompt Injection, Evaluation, Safety
- **参见** : 卷五 第14章

### Refine（精炼/迭代改进）
RAG中的一种检索策略，对初始检索结果进行多轮优化和补充检索。
- **相关术语** : RAG, Iterative Retrieval, Self-RAG

### Reflexion（反思）
一种Agent架构模式，Agent通过反思自身的行为和结果来改进未来的决策。
- **相关术语** : Self-reflection, Self-correction, ReAct

### Reinforcement Learning (RL)（强化学习）
Agent通过与环境交互并获得奖励信号来学习最优策略的机器学习范式。
- **相关术语** : RLHF, PPO, Reward Model, MDP

### RLHF (Reinforcement Learning from Human Feedback)（基于人类反馈的强化学习）
使用人类偏好数据训练奖励模型，再用强化学习来优化LLM的对齐效果。GPT-4和Claude都使用了RLHF。
- **相关术语** : Alignment, Reward Model, PPO, Constitutional AI

### Role-playing（角色扮演）
在prompt中为LLM设定特定角色（如专家、助手、评审员），以引导其以特定风格和知识范围进行回应。
- **相关术语** : Prompt Engineering, System Prompt, Persona

---

## S

### Sampling（采样）
从概率分布中随机选择输出的过程。与贪心搜索不同，采样可以产生多样性输出。
- **相关术语** : Temperature, Top-k, Top-p, Decoding Strategy

### Scaling Law（缩放定律）
描述模型性能如何随着参数量、数据量和计算量增长而提升的统计规律。
- **相关术语** : Emergent Ability, Foundation Model, Parameters

### Semantic Search（语义搜索）
基于文本语义相似度而非关键词匹配进行搜索的方法。向量搜索是语义搜索的核心技术。
- **相关术语** : Embedding, Vector Search, RAG, Cosine Similarity

### Semantic Kernel
微软推出的企业级AI编排框架，与Azure生态深度集成。
- **相关术语** : Microsoft, Plugin, Enterprise AI
- **参见** : 附录A

### Serverless（无服务器）
一种云计算模式，开发者无需管理服务器，按实际使用量计费。
- **相关术语** : AWS Lambda, Function-as-a-Service, Deployment
- **参见** : 附录C

### Session（会话）
一次完整的用户与Agent交互过程。会话管理包括对话历史、用户状态、上下文等。
- **相关术语** : Conversation History, State, Context Window

### Short-term Memory（短期记忆）
Agent在当前会话中可以访问的信息，通常受限于上下文窗口大小。
- **相关术语** : Long-term Memory, Context Window, Memory

### Splitting（分割）
见 Chunking。

### State Graph（状态图）
在LangGraph中，用图结构表示的状态转换过程，支持循环、条件分支和检查点。
- **相关术语** : LangGraph, DAG, Checkpoint, State

### Streaming（流式输出）
LLM逐个token生成并实时返回结果的方式，大幅减少用户等待首字输出的时间。
- **相关术语** : Server-Sent Events, Real-time, Latency

### Structured Output（结构化输出）
LLM以预定义的结构化格式（如JSON、XML）输出内容，便于程序解析和处理。
- **相关术语** : JSON Mode, Function Calling, Schema

### System Prompt（系统提示）
设置LLM基本行为和角色的指令，通常放在对话的最开始，对所有后续交互生效。
- **相关术语** : Prompt, Role-playing, Instructions

---

## T

### Task Decomposition（任务分解）
将复杂任务拆解为更小、可管理的子任务的过程。是Agent处理复杂问题的关键能力。
- **相关术语** : Planning, Multi-Agent System, Divide and Conquer

### Temperature（温度）
控制LLM输出随机性的参数。温度越高，输出越随机和多样；温度越低，输出越确定和保守。
- **相关术语** : Sampling, Top-k, Top-p, Decoding Strategy

### Token
LLM处理文本的基本单位。一个中文汉字约1.5-2个token，一个英文单词约0.25-1个token。
- **相关术语** : Tokenization, Context Window, BPE
- **参见** : 卷一 第2章

### Tokenization（分词）
将文本分割为token序列的过程。常见的分词方法包括BPE、WordPiece、SentencePiece等。
- **相关术语** : Token, BPE, Vocabulary

### Tool Use（工具使用）
LLM通过调用外部工具（API、函数、脚本等）来扩展自身能力的方式。也称为Function Calling。
- **相关术语** : Function Calling, Tool, Agent, Plugin
- **参见** : 卷三 第5章

### Top-k Sampling（Top-k采样）
从概率最高的k个候选token中进行采样。k=1等价于贪心搜索。
- **相关术语** : Sampling, Top-p, Temperature

### Top-p Sampling / Nucleus Sampling（核采样）
从累积概率达到p的最小候选集中进行采样。相比Top-k，核采样会自动调整候选集大小。
- **相关术语** : Sampling, Top-k, Temperature

### Transformer
一种基于自注意力机制的神经网络架构，是现代LLM（GPT、Claude、Llama等）的基础架构。
- **相关术语** : Attention, Self-Attention, GPT, Encoder-Decoder

### TPU (Tensor Processing Unit)
Google开发的专用AI加速芯片。
- **相关术语** : GPU, NPU, Inference, Training

---

## U

### User Proxy（用户代理）
在AutoGen等多Agent框架中，代表用户与Agent交互的角色。可以配置为自动执行或需要人工确认。
- **相关术语** : Human-in-the-Loop, AutoGen, Approval Workflow

---

## V

### Value Function（价值函数）
在强化学习中，评估某个状态或状态-动作对长期期望回报的函数。
- **相关术语** : Policy, MDP, Reward Model, Reinforcement Learning

### Vector Database（向量数据库）
专门用于存储和检索高维向量数据的数据库系统。RAG系统的核心基础设施。
- **相关术语** : RAG, Embedding, Chroma, Milvus, Pinecone
- **参见** : 卷三 第7章，附录B

### Vector Store（向量存储）
向量数据库中存储嵌入向量的逻辑集合。一个向量数据库可以包含多个向量存储。
- **相关术语** : Vector Database, Embedding, Collection

### Vision-Language Model (VLM)（视觉语言模型）
能够同时理解图像和文本的多模态模型。GPT-4o、Claude 3等支持视觉输入。
- **相关术语** : Multimodal, Image Understanding, Vision

---

## W

### Weights（权重）
神经网络中连接不同层之间的可学习参数。模型训练的本质就是调整权重。
- **相关术语** : Parameters, Training, Fine-tuning

### Workflow（工作流）
一系列有序执行的步骤，可能包含条件分支、循环和并行处理。Agent工作流是Agent执行复杂任务的核心机制。
- **相关术语** : Pipeline, DAG, Orchestration, Agentic Workflow
- **参见** : 卷三 第6章

---

## Z

### Zero-shot（零样本）
不给模型提供任何示例，直接让其完成任务。零样本能力是评估模型通用性的重要指标。
- **相关术语** : Few-shot, In-context Learning, Prompt Engineering

---

## 中文拼音索引

| 拼音 | 术语 |
|------|------|
| A | Agent（智能体）, Alignment（对齐）, Auto-regressive Model（自回归模型） |
| B | Batch Processing（批处理）, Beam Search（束搜索）, BPE（字节对编码） |
| C | Chain-of-Thought（思维链）, Chunking（分块）, Claude, Context Window（上下文窗口）, Constitutional AI（宪法AI） |
| D | DAG（有向无环图）, Decoding Strategy（解码策略）, Distillation（蒸馏）, Docker |
| E | Embedding（嵌入）, Emergent Ability（涌现能力）, Evaluation（评估）, Extended Thinking（扩展思考） |
| F | Few-shot Learning（少样本学习）, Fine-tuning（微调）, Foundation Model（基础模型）, Function Calling（函数调用） |
| G | GPT, GPU, Gradient Descent（梯度下降）, Guardrails（护栏）, Grounding（接地） |
| H | Hallucination（幻觉）, HPA（水平Pod自动伸缩器）, Human-in-the-Loop（人在回路） |
| I | In-context Learning（上下文学习）, Inference（推理） |
| J | JSON Mode（JSON模式）, JWT |
| K | Knowledge Base（知识库）, Knowledge Graph（知识图谱）, Kubernetes |
| L | LangChain, LangGraph, LLM（大语言模型）, LoRA |
| M | MCP（模型上下文协议）, MDP（马尔可夫决策过程）, Memory（记忆）, Multi-Agent System（多Agent系统） |
| N | Next-token Prediction（下一个token预测）, NPU |
| O | Observation（观察）, OpenAI, Orchestration（编排） |
| P | Parameter-Efficient Fine-Tuning（参数高效微调）, Perception（感知）, Plan-and-Execute（规划与执行）, Planning（规划）, Prompt（提示）, Prompt Engineering（提示工程）, Prompt Injection（提示注入） |
| Q | QLoRA, Quantization（量化）, Query（查询） |
| R | RAG（检索增强生成）, Rate Limiting（速率限制）, ReAct（推理+行动）, Reasoning（推理）, Redis, Red Teaming（红队测试）, Reflexion（反思）, RLHF（基于人类反馈的强化学习） |
| S | Sampling（采样）, Scaling Law（缩放定律）, Semantic Search（语义搜索）, Serverless（无服务器）, Session（会话）, Splitting（分割）, Streaming（流式输出）, Structured Output（结构化输出）, System Prompt（系统提示） |
| T | Task Decomposition（任务分解）, Temperature（温度）, Token, Tokenization（分词）, Tool Use（工具使用）, Top-k Sampling, Top-p Sampling, Transformer, TPU |
| V | Value Function（价值函数）, Vector Database（向量数据库）, Vision-Language Model（视觉语言模型） |
| W | Weights（权重）, Workflow（工作流） |
| Z | Zero-shot（零样本） |

---

*附录D完*
