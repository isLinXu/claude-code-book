# 第40章：CI/CD与版本管理

## 概述

Agent 系统的 CI/CD（持续集成/持续部署）与传统软件有显著差异——除了代码变更，Prompt 调整、工具配置变更、模型切换都可能影响 Agent 行为。这意味着传统的"代码提交 → 测试 → 部署"流水线需要扩展为"代码+配置+Prompt → 评估 → 金丝雀部署 → 监控回滚"的完整链路。本章将系统讲解 Agent 系统的 CI/CD 实践。

## 40.1 Agent系统的CI/CD特殊性

| 变更类型 | 影响范围 | 回归风险 | 测试方法 |
|---------|---------|---------|---------|
| 代码变更 | 工具逻辑、Agent框架 | 中 | 单元测试 + 集成测试 |
| Prompt变更 | 输出质量、行为模式 | 高 | 自动评估 + 人工抽检 |
| 工具配置 | Agent能力范围 | 高 | 工具可用性测试 |
| 模型变更 | 推理质量、成本 | 极高 | A/B测试 + 金丝雀 |
| 知识库变更 | RAG准确性 | 中 | 检索质量评估 |

## 40.2 Prompt版本管理

### 40.2.1 Prompt版本化存储

```python
import hashlib
import json
from pathlib import Path

class PromptVersionControl:
    """Prompt版本控制"""
    
    def __init__(self, repo_path: str = "prompts/"):
        self.repo_path = Path(repo_path)
        self.repo_path.mkdir(exist_ok=True)
        self._index_path = self.repo_path / "index.json"
        self._load_index()
    
    def _load_index(self):
        if self._index_path.exists():
            with open(self._index_path) as f:
                self.index = json.load(f)
        else:
            self.index = {"prompts": {}}
    
    def save_version(self, name: str, content: str, 
                     author: str = "", message: str = ""):
        """保存Prompt新版本"""
        versions = self.index["prompts"].get(name, {}).get("versions", [])
        new_version = len(versions) + 1
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:12]
        
        version_dir = self.repo_path / name
        version_dir.mkdir(exist_ok=True)
        filepath = version_dir / f"v{new_version}.txt"
        filepath.write_text(content, encoding="utf-8")
        
        meta = {
            "version": new_version,
            "hash": content_hash,
            "author": author,
            "message": message,
            "created_at": datetime.now().isoformat(),
        }
        
        if name not in self.index["prompts"]:
            self.index["prompts"][name] = {"active_version": 0, "versions": []}
        self.index["prompts"][name]["versions"].append(meta)
        self.index["prompts"][name]["active_version"] = new_version
        self._save_index()
        return new_version
    
    def load_version(self, name: str, version: int = None) -> str:
        if version is None:
            version = self.index["prompts"][name]["active_version"]
        filepath = self.repo_path / name / f"v{version}.txt"
        return filepath.read_text(encoding="utf-8")
    
    def diff(self, name: str, v1: int, v2: int) -> str:
        import difflib
        c1 = self.load_version(name, v1)
        c2 = self.load_version(name, v2)
        diff = difflib.unified_diff(c1.splitlines(), c2.splitlines(),
                                     fromfile=f"v{v1}", tofile=f"v{v2}")
        return "\n".join(diff)
    
    def rollback(self, name: str, target_version: int):
        self.index["prompts"][name]["active_version"] = target_version
        self._save_index()
    
    def _save_index(self):
        with open(self._index_path, "w") as f:
            json.dump(self.index, f, indent=2, ensure_ascii=False)
```

### 40.2.2 Prompt变更检测

```python
class PromptChangeDetector:
    def detect_changes(self, pvc: PromptVersionControl, 
                       name: str, new_content: str) -> dict:
        try:
            current = pvc.load_version(name)
        except FileNotFoundError:
            return {"type": "new", "impact": "high"}
        
        if current == new_content:
            return {"type": "none", "impact": "none"}
        
        old_lines, new_lines = current.splitlines(), new_content.splitlines()
        changed_ratio = self._diff_ratio(old_lines, new_lines)
        
        critical = sum(1 for kw in ["禁止", "必须", "格式", "约束"]
                       if kw in new_content and kw not in current)
        
        impact = "high" if changed_ratio > 0.3 or critical > 0 else (
            "medium" if changed_ratio > 0.1 else "low"
        )
        return {"type": "modified", "impact": impact, "critical_changes": critical}
    
    def _diff_ratio(self, old, new):
        import difflib
        m = difflib.SequenceMatcher(None, old, new)
        matching = sum(b.size for b in m.get_matching_blocks())
        total = max(len(old), len(new))
        return 1 - matching / total if total else 0
```

## 40.3 自动化评估Pipeline

### 40.3.1 评估框架

```python
class AgentEvaluationPipeline:
    """Agent自动化评估"""
    
    def __init__(self, agent_factory, evaluator):
        self.agent_factory = agent_factory
        self.evaluator = evaluator
    
    async def run(self, config: dict, test_suite: list[dict]) -> dict:
        agent = self.agent_factory(config)
        results = []
        
        for case in test_suite:
            output = await agent.run(case["input"])
            score = await self.evaluator.evaluate(
                expected=case.get("expected", ""),
                actual=output,
                criteria=case.get("criteria", []),
            )
            results.append({
                "case_id": case["id"],
                "score": score,
                "passed": score >= 0.7,
            })
        
        passed = sum(1 for r in results if r["passed"])
        return {
            "total": len(results),
            "passed": passed,
            "pass_rate": round(passed / len(results) * 100, 1),
            "failed": [r for r in results if not r["passed"]],
        }

# 质量门禁
QUALITY_GATES = {"min_pass_rate": 0.85, "min_avg_score": 0.75, "max_regression": 0.05}
```

### 40.3.2 回归检测

```python
class RegressionDetector:
    async def detect(self, baseline: dict, current: dict) -> dict:
        regressions = []
        
        if current["pass_rate"] < baseline["pass_rate"] * (1 - QUALITY_GATES["max_regression"]):
            regressions.append({
                "type": "pass_rate",
                "baseline": baseline["pass_rate"],
                "current": current["pass_rate"],
            })
        
        return {
            "has_regression": len(regressions) > 0,
            "regressions": regressions,
            "decision": "block" if any(
                r["current"] < QUALITY_GATES["min_pass_rate"] * 100 
                for r in regressions
            ) else "warn",
        }
```

## 40.4 部署策略

### 40.4.1 蓝绿部署

```python
class BlueGreenDeployer:
    def __init__(self, k8s_client):
        self.k8s = k8s_client
    
    async def deploy(self, agent_name: str, new_image: str):
        green = f"{agent_name}-green"
        await self.k8s.create_deployment(name=green, image=new_image, replicas=2)
        
        healthy = await self._wait_healthy(green, timeout=120)
        if not healthy:
            await self.k8s.delete_deployment(green)
            raise RuntimeError("健康检查失败")
        
        await self.k8s.switch_service(service=agent_name, target=green)
        return {"status": "deployed", "active": green}
    
    async def rollback(self, agent_name: str):
        blue = f"{agent_name}-blue"
        await self.k8s.switch_service(service=agent_name, target=blue)
        return {"status": "rolled_back"}
```

### 40.4.2 金丝雀发布

```python
class CanaryDeployer:
    def __init__(self, k8s_client, metrics_client):
        self.k8s = k8s_client
        self.metrics = metrics_client
    
    async def deploy(self, agent_name: str, new_image: str) -> dict:
        stages = [
            {"weight": 0.05, "duration": 300},
            {"weight": 0.20, "duration": 600},
            {"weight": 0.50, "duration": 600},
            {"weight": 1.00, "duration": 0},
        ]
        
        canary = f"{agent_name}-canary"
        stable = f"{agent_name}-stable"
        await self.k8s.create_deployment(name=canary, image=new_image)
        
        for i, stage in enumerate(stages):
            await self.k8s.set_traffic_weights(
                agent_name, {stable: 1 - stage["weight"], canary: stage["weight"]}
            )
            
            if stage["duration"] > 0:
                await asyncio.sleep(stage["duration"])
            
            if not await self._check_metrics(agent_name):
                await self.k8s.set_traffic_weights(agent_name, {stable: 1.0, canary: 0.0})
                await self.k8s.delete_deployment(canary)
                return {"status": "rolled_back", "stage": i}
        
        await self.k8s.update_deployment(stable, image=new_image)
        return {"status": "fully_deployed"}
```

## 40.5 配置版本化

### 40.5.1 配置即代码

```yaml
# agent_config.yaml
agent:
  name: "customer-service"
  version: "2.3.1"

model:
  primary: "gpt-4o"
  fallback: "gpt-4o-mini"
  temperature: 0.1

tools:
  - name: "knowledge_search"
    enabled: true
    config:
      index: "customer_kb"
      top_k: 5

safety:
  max_steps: 15
  budget_daily_usd: 100.0
```

```python
class ConfigManager:
    def load(self, path: str) -> dict:
        with open(path) as f:
            config = yaml.safe_load(f)
        return self._resolve_env(config)
    
    def _resolve_env(self, obj):
        if isinstance(obj, str):
            import re
            return re.sub(r'\$\{(\w+)\}', lambda m: os.environ.get(m.group(1), ""), obj)
        elif isinstance(obj, dict):
            return {k: self._resolve_env(v) for k, v in obj.items()}
        return obj
    
    def validate(self, config: dict) -> list[str]:
        errors = []
        if not config.get("model", {}).get("primary"):
            errors.append("未配置主模型")
        return errors
```

## 40.6 GitOps工作流

```
agent-project/
├── agents/           # Agent代码
├── prompts/          # Prompt版本 (v1.txt, v2.txt, ...)
├── configs/          # 配置 (staging.yaml, production.yaml)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── eval/         # 评估测试用例
├── pipelines/        # CI/CD流水线定义
└── monitoring/       # 监控和告警配置
```

## 40.7 持续监控与自动回滚

```python
class PostDeployMonitor:
    def __init__(self, metrics, alerting):
        self.metrics = metrics
        self.alerting = alerting
    
    async def monitor(self, agent_name: str, deploy_time: str) -> dict:
        checks = []
        
        error_rate = await self.metrics.query(
            f'rate(agent_errors_total{{agent="{agent_name}"}}[5m])'
        )
        checks.append({
            "name": "error_rate", "value": error_rate,
            "status": "pass" if error_rate < 0.05 else "fail",
        })
        
        p95 = await self.metrics.query(
            f'histogram_quantile(0.95, rate(agent_latency_seconds_bucket{{agent="{agent_name}"}}[5m]))'
        )
        checks.append({"name": "p95_latency", "value": p95, "status": "pass" if p95 < 30 else "warn"})
        
        failures = [c for c in checks if c["status"] == "fail"]
        return {
            "overall": "auto_rollback" if len(failures) >= 2 else (
                "investigate" if failures else "healthy"
            ),
            "checks": checks,
        }

class AutoRollbackManager:
    def __init__(self, deployer, monitor):
        self.deployer = deployer
        self.monitor = monitor
    
    async def watch(self, agent_name: str, deploy_time: str):
        for _ in range(6):
            await asyncio.sleep(300)
            report = await self.monitor.monitor(agent_name, deploy_time)
            
            if report["overall"] == "auto_rollback":
                await self.deployer.rollback(agent_name)
                await self.alerting.send(severity="critical",
                    message=f"{agent_name} 自动回滚")
                return {"status": "rolled_back"}
        
        return {"status": "stable"}
```

## 最佳实践

1. **一切变更版本化**：Prompt、配置、测试用例都要版本化
2. **Prompt即代码**：使用Git管理，变更走PR流程
3. **自动化评估**：每次Prompt变更都跑评估
4. **渐进式发布**：金丝雀 5%→20%→50%→100%
5. **自动回滚**：部署后持续监控，异常自动回滚
6. **基线对比**：保留评估基线，每次发布检测回归

## 常见陷阱

1. **只测代码不测Prompt**：Prompt变更无评估直接上线
2. **全量发布**：直接100%流量切换，风险巨大
3. **回滚无数据**：不知道回滚到哪个版本
4. **监控不足**：问题发现太晚
5. **忽略模型变更**：切换LLM不做A/B测试

## 小结

Agent CI/CD 的核心原则：**版本化一切、自动化评估、渐进式发布、持续监控、快速回滚**。通过完善的流水线，将 Agent 从"实验"升级为"生产"。

## 延伸阅读

1. **GitOps**: https://www.gitops.tech/
2. **ArgoCD**: https://argoproj.github.io/cd/
3. **PromptFoo**: https://promptfoo.dev/
4. **书籍**: "Accelerate" (Nicole Forsgren)
