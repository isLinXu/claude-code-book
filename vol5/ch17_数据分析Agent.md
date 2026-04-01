# 第17章：数据分析 Agent

> "数据分析 Agent 让每个人都成为数据分析师——你只需要提出问题，Agent 负责理解意图、查询数据、验证结果、生成洞察。"

## 17.1 概述：从"写 SQL"到"说人话"

传统数据分析流程中，业务人员需要将问题翻译成 SQL、Python 脚本或 Excel 公式，再由数据工程师执行、验证、可视化。这个流程的核心瓶颈在于**意图翻译**——业务需求与数据实现之间的鸿沟。

数据分析 Agent 的核心价值就是消除这道鸿沟。用户只需用自然语言描述需求，Agent 自动完成查询构建、数据获取、清洗转换、分析计算和可视化展示。

### 17.1.1 数据分析 Agent 的能力边界

```
自然语言查询 → 数据清洗 → 统计分析 → 可视化 → 自动报告 → 异常检测
     │            │           │           │          │           │
   Text-to-SQL   自动化     描述性/     图表自动    结构化     规则+统计
   语义理解      缺失处理   推断性分析   生成       文档输出   双重检测
```

- **自然语言 SQL 查询**：用户说"上个月销售额最高的前10个城市"，Agent 生成并执行 SQL
- **数据清洗与预处理**：自动识别缺失值、异常值、重复数据，智能填充或剔除
- **统计分析与可视化**：描述性统计、相关性分析、趋势分析，自动选择最佳图表类型
- **报告自动生成**：将分析结果转化为结构化的 Markdown/PDF/HTML 报告
- **异常检测**：基于统计规则和机器学习模型的实时异常识别

### 17.1.2 数据分析 Agent 的技术栈

| 层次 | 技术组件 | 说明 |
|------|---------|------|
| 意图理解 | LLM + Schema 感知 Prompt | 将自然语言映射为数据库操作 |
| 查询生成 | Text-to-SQL 引擎 | 支持单表/多表/嵌套查询 |
| 数据处理 | Pandas / PySpark | 清洗、转换、聚合 |
| 统计分析 | SciPy / Statsmodels | 假设检验、回归分析 |
| 可视化 | Matplotlib / Plotly | 自动图表生成 |
| 报告生成 | Jinja2 模板引擎 | 结构化文档输出 |

## 17.2 自然语言 SQL 查询引擎

### 17.2.1 Schema 感知的 Prompt 工程

Text-to-SQL 的核心挑战在于让 LLM 理解数据库的表结构、字段含义和业务语义。下面我们从 Schema 定义开始，逐步构建完整的 Text-to-SQL 引擎。

```python
"""
数据分析 Agent - 自然语言 SQL 查询引擎
支持多表关联、聚合函数、时间窗口查询
"""

from typing import Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import re


class QueryComplexity(Enum):
    SIMPLE = "simple"        # 单表简单查询
    AGGREGATE = "aggregate"  # 聚合查询
    JOIN = "join"            # 多表关联
    NESTED = "nested"        # 嵌套子查询
    WINDOW = "window"        # 窗口函数
    COMPLEX = "complex"      # 复合查询


@dataclass
class ColumnSchema:
    """数据库列元信息"""
    name: str
    data_type: str
    description: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_table: Optional[str] = None
    examples: list = field(default_factory=list)
    nullable: bool = True


@dataclass
class TableSchema:
    """数据库表元信息"""
    name: str
    description: str
    columns: list = field(default_factory=list)
    row_count: int = 0
    relationships: list = field(default_factory=list)

    def to_prompt_text(self) -> str:
        """生成用于 Prompt 的表结构描述"""
        lines = [f"表名: {self.name} ({self.description})"]
        lines.append(f"行数: {self.row_count}")
        lines.append("字段:")
        for col in self.columns:
            pk_mark = " [PK]" if col.is_primary_key else ""
            fk_mark = f" [FK -> {col.foreign_table}]" if col.is_foreign_key else ""
            null_mark = " (可空)" if col.nullable else ""
            lines.append(
                f"  - {col.name} ({col.data_type}){pk_mark}{fk_mark}{null_mark}: "
                f"{col.description}"
            )
            if col.examples:
                lines.append(f"    示例值: {', '.join(str(e) for e in col.examples[:3])}")
        return "\n".join(lines)


@dataclass
class DatabaseSchema:
    """数据库完整 Schema"""
    tables: dict = field(default_factory=dict)

    def add_table(self, table: TableSchema):
        self.tables[table.name] = table

    def get_relevant_tables(self, query: str) -> list:
        """根据查询意图找到相关表（简化版，生产环境可用向量检索）"""
        relevant = []
        query_lower = query.lower()
        for table in self.tables.values():
            keywords = f"{table.name} {table.description} ".lower()
            for col in table.columns:
                keywords += f"{col.name} {col.description} "
            overlap = sum(1 for w in query_lower.split() if w in keywords)
            if overlap > 0:
                relevant.append((table, overlap))
        relevant.sort(key=lambda x: x[1], reverse=True)
        return [t for t, _ in relevant]

    def build_schema_prompt(self, query: str) -> str:
        """构建 Schema 感知的 Prompt"""
        relevant_tables = self.get_relevant_tables(query)
        schema_text = "\n\n".join(t.to_prompt_text() for t in relevant_tables)

        return f"""你是一个专业的 SQL 分析师。根据用户的自然语言问题，生成准确的 SQL 查询。

## 数据库 Schema

{schema_text}

## 重要规则

1. 只使用上述表和字段，不要编造不存在的表或列
2. 使用标准 SQL 语法（兼容 PostgreSQL / MySQL）
3. 处理时间范围查询时，注意时区问题
4. 聚合查询必须包含 GROUP BY
5. 注意 NULL 值处理

## 用户问题

{query}

## 请生成 SQL 查询

请以 JSON 格式返回:
```json
{{
    "sql": "生成的 SQL 语句",
    "explanation": "查询逻辑说明",
    "complexity": "simple|aggregate|join|nested|window|complex",
    "tables_used": ["使用的表名"],
    "assumptions": ["做出的假设"]
}}
```"""


# ==================== 示例：构建电商数据库 Schema ====================

def build_ecommerce_schema() -> DatabaseSchema:
    """构建电商数据库 Schema 示例"""
    db = DatabaseSchema()

    users = TableSchema(
        name="users",
        description="用户信息表",
        row_count=1_200_000,
        columns=[
            ColumnSchema("user_id", "BIGINT", "用户唯一标识", is_primary_key=True),
            ColumnSchema("username", "VARCHAR(50)", "用户名", examples=["张三", "shopper_01"]),
            ColumnSchema("email", "VARCHAR(100)", "邮箱地址", examples=["user@example.com"]),
            ColumnSchema("city", "VARCHAR(50)", "所在城市", examples=["北京", "上海", "深圳"]),
            ColumnSchema("province", "VARCHAR(30)", "所在省份"),
            ColumnSchema("register_date", "DATE", "注册日期"),
            ColumnSchema("vip_level", "INT", "VIP 等级 1-5", examples=[1, 3, 5]),
        ]
    )

    products = TableSchema(
        name="products",
        description="商品信息表",
        row_count=85_000,
        columns=[
            ColumnSchema("product_id", "BIGINT", "商品唯一标识", is_primary_key=True),
            ColumnSchema("name", "VARCHAR(200)", "商品名称", examples=["iPhone 15", "机械键盘"]),
            ColumnSchema("category", "VARCHAR(50)", "商品类目", examples=["电子产品", "服装"]),
            ColumnSchema("sub_category", "VARCHAR(50)", "子类目"),
            ColumnSchema("price", "DECIMAL(10,2)", "售价"),
            ColumnSchema("cost_price", "DECIMAL(10,2)", "成本价"),
            ColumnSchema("stock", "INT", "库存数量"),
            ColumnSchema("brand", "VARCHAR(50)", "品牌"),
            ColumnSchema("status", "VARCHAR(20)", "上架状态", examples=["on_sale"]),
        ]
    )

    orders = TableSchema(
        name="orders",
        description="订单主表",
        row_count=5_600_000,
        columns=[
            ColumnSchema("order_id", "BIGINT", "订单唯一标识", is_primary_key=True),
            ColumnSchema("user_id", "BIGINT", "用户 ID", is_foreign_key=True, foreign_table="users"),
            ColumnSchema("order_date", "TIMESTAMP", "下单时间"),
            ColumnSchema("total_amount", "DECIMAL(12,2)", "订单总金额"),
            ColumnSchema("discount_amount", "DECIMAL(10,2)", "优惠金额"),
            ColumnSchema("final_amount", "DECIMAL(12,2)", "实付金额"),
            ColumnSchema("status", "VARCHAR(20)", "订单状态",
                        examples=["pending", "paid", "shipped", "completed"]),
            ColumnSchema("shipping_city", "VARCHAR(50)", "收货城市"),
            ColumnSchema("payment_method", "VARCHAR(30)", "支付方式",
                        examples=["alipay", "wechat", "credit_card"]),
        ]
    )

    order_items = TableSchema(
        name="order_items",
        description="订单明细表",
        row_count=15_200_000,
        columns=[
            ColumnSchema("item_id", "BIGINT", "明细唯一标识", is_primary_key=True),
            ColumnSchema("order_id", "BIGINT", "订单 ID", is_foreign_key=True, foreign_table="orders"),
            ColumnSchema("product_id", "BIGINT", "商品 ID", is_foreign_key=True, foreign_table="products"),
            ColumnSchema("quantity", "INT", "购买数量"),
            ColumnSchema("unit_price", "DECIMAL(10,2)", "成交单价"),
            ColumnSchema("subtotal", "DECIMAL(12,2)", "小计金额"),
        ]
    )

    for table in [users, products, orders, order_items]:
        db.add_table(table)
    return db
```

### 17.2.2 SQL 安全检查与验证

在将 LLM 生成的 SQL 交给数据库执行之前，必须经过严格的安全检查。Text-to-SQL 场景尤其危险——LLM 可能生成包含 `DROP TABLE`、`DELETE` 等破坏性操作的语句。

```python
"""
SQL 安全检查器 - 防止危险操作
"""

class SQLSafetyChecker:
    """SQL 安全检查器"""

    FORBIDDEN_KEYWORDS = [
        "DROP", "DELETE", "TRUNCATE", "ALTER", "GRANT", "REVOKE",
        "CREATE", "INSERT", "UPDATE", "REPLACE", "EXEC", "EXECUTE"
    ]
    ALLOWED_PREFIXES = ["SELECT", "WITH", "EXPLAIN"]

    @classmethod
    def check(cls, sql: str) -> tuple[bool, str]:
        """检查 SQL 安全性，返回 (is_safe, reason)"""
        sql_upper = sql.strip().upper()
        if not any(sql_upper.startswith(p) for p in cls.ALLOWED_PREFIXES):
            return False, f"查询必须以 {cls.ALLOWED_PREFIXES} 开头"
        for keyword in cls.FORBIDDEN_KEYWORDS:
            if re.search(rf'\b{keyword}\b', sql_upper):
                return False, f"禁止使用 {keyword} 操作"
        if re.search(r'\bCALL\b|\bEXEC\b', sql_upper):
            return False, "禁止调用存储过程"
        return True, "安全检查通过"


class SQLValidator:
    """SQL 语法验证器"""

    @staticmethod
    def validate_basic(sql: str) -> list[str]:
        """基础语法验证，返回错误列表"""
        errors = []
        sql_clean = sql.strip().rstrip(";")

        # 括号匹配
        if sql_clean.count("(") != sql_clean.count(")"):
            errors.append("括号不匹配")

        # 引号匹配
        single_quotes = sql_clean.count("'") - sql_clean.count("\\'")
        if single_quotes % 2 != 0:
            errors.append("单引号不匹配")

        # GROUP BY 一致性检查
        aggregate_funcs = re.findall(
            r'\b(SUM|AVG|COUNT|MIN|MAX|STDDEV)\s*\(', sql_clean, re.IGNORECASE)
        has_group_by = bool(re.search(r'\bGROUP\s+BY\b', sql_clean, re.IGNORECASE))

        if aggregate_funcs and not has_group_by:
            select_part = re.search(r'SELECT\s+(.*?)\s+FROM', sql_clean, re.IGNORECASE)
            if select_part:
                cols = [c.strip() for c in select_part.group(1).split(",")]
                non_agg = [c for c in cols
                          if not re.search(r'(SUM|AVG|COUNT|MIN|MAX)\s*\(', c, re.IGNORECASE)
                          and c.strip() != "*"]
                if non_agg:
                    errors.append(f"聚合查询存在非聚合字段 {non_agg}，请添加 GROUP BY")
        return errors
```

### 17.2.3 NL-to-SQL Agent 完整实现

```python
"""
NLToSQL Agent - 将自然语言转换为可执行的 SQL
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class NLToSQLAgent:
    """自然语言转 SQL 的 Agent"""

    def __init__(self, db_schema: DatabaseSchema, llm_client=None):
        self.db_schema = db_schema
        self.llm_client = llm_client
        self.safety_checker = SQLSafetyChecker()
        self.validator = SQLValidator()
        self.query_history: list[dict] = []

    def _call_llm(self, prompt: str) -> str:
        """调用 LLM（生产环境替换为实际 API）"""
        if self.llm_client:
            return self.llm_client.chat(prompt)
        # 模拟返回 - 实际使用时替换为 API 调用
        return json.dumps({
            "sql": "SELECT city, COUNT(*) as order_count, "
                   "SUM(final_amount) as total_sales "
                   "FROM orders WHERE order_date >= '2025-03-01' "
                   "GROUP BY city ORDER BY total_sales DESC LIMIT 10",
            "explanation": "查询上个月销售额最高的前10个城市",
            "complexity": "aggregate",
            "tables_used": ["orders"],
            "assumptions": ["上个月指2025年3月", "使用 final_amount 计算销售额"]
        }, ensure_ascii=False)

    def generate_query(self, user_query: str) -> dict:
        """生成 SQL 查询的完整流程"""
        # 1. 构建 Schema 感知 Prompt
        prompt = self.db_schema.build_schema_prompt(user_query)

        # 2. 调用 LLM 生成 SQL
        response = self._call_llm(prompt)

        # 3. 解析 JSON 响应
        try:
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            result = json.loads(json_match.group(1)) if json_match else json.loads(response)
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"LLM 返回格式错误: {e}"}

        # 4. 安全检查
        is_safe, reason = self.safety_checker.check(result["sql"])
        if not is_safe:
            return {"success": False, "error": f"安全检查未通过: {reason}"}

        # 5. 语法验证
        errors = self.validator.validate_basic(result["sql"])
        if errors:
            return {"success": False, "error": f"语法验证失败: {'; '.join(errors)}"}

        # 6. 记录查询历史
        self.query_history.append({
            "user_query": user_query,
            "generated_sql": result["sql"],
            "explanation": result.get("explanation", ""),
            "complexity": result.get("complexity", "unknown"),
            "timestamp": datetime.now().isoformat()
        })

        return {
            "success": True,
            "sql": result["sql"],
            "explanation": result.get("explanation", ""),
            "complexity": result.get("complexity", "simple"),
            "tables_used": result.get("tables_used", []),
            "assumptions": result.get("assumptions", [])
        }

    def explain_results(self, sql: str, results: list[dict], user_query: str) -> str:
        """用自然语言解释查询结果"""
        prompt = f"""你是数据分析师。用简洁中文解释以下查询结果。

用户问题: {user_query}
SQL: {sql}
结果（前20条）: {json.dumps(results[:20], ensure_ascii=False, default=str)}

请用 2-3 句话总结关键发现。"""
        return self._call_llm(prompt)
```

## 17.3 数据清洗与预处理

### 17.3.1 智能数据清洗框架

数据清洗是数据分析中最耗时也最容易出错的环节。一个智能的数据清洗 Agent 需要能够自动检测数据质量问题、选择合适的处理策略、并记录每一步操作以便追溯。

```python
"""
智能数据清洗 Agent - 自动检测并处理数据质量问题
"""

import pandas as pd
import numpy as np
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class DataQualityReport:
    """数据质量报告"""
    total_rows: int = 0
    total_columns: int = 0
    missing_values: dict = field(default_factory=dict)
    missing_percentage: dict = field(default_factory=dict)
    duplicate_rows: int = 0
    duplicate_percentage: float = 0.0
    data_types: dict = field(default_factory=dict)
    outliers: dict = field(default_factory=dict)
    quality_score: float = 0.0

    def to_markdown(self) -> str:
        """生成 Markdown 格式的质量报告"""
        lines = [
            "## 数据质量报告\n",
            f"- **总行数**: {self.total_rows:,}",
            f"- **总列数**: {self.total_columns}",
            f"- **重复行数**: {self.duplicate_rows:,} ({self.duplicate_percentage:.1f}%)",
            f"- **质量评分**: {self.quality_score:.1f}/100\n",
            "### 缺失值统计\n",
            "| 列名 | 缺失数量 | 缺失比例 | 建议处理方式 |",
            "|------|---------|---------|-------------|"
        ]
        for col, pct in self.missing_percentage.items():
            if pct > 0:
                suggestion = ("填充中位数" if pct < 0.1 else
                             "填充众数" if pct < 0.3 else "删除或单独分析")
                lines.append(
                    f"| {col} | {self.missing_values[col]:,} "
                    f"| {pct:.1%} | {suggestion} |")

        if self.outliers:
            lines.append("\n### 异常值检测\n")
            for col, info in self.outliers.items():
                lines.append(
                    f"- **{col}**: {info['count']} 个异常值 "
                    f"(方法: {info['method']})")
        return "\n".join(lines)


class DataCleaner:
    """智能数据清洗器 - 支持自动策略选择"""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.report = DataQualityReport(
            total_rows=len(df), total_columns=len(df.columns))
        self.cleaning_log: list[str] = []

    def analyze(self) -> DataQualityReport:
        """分析数据质量，生成完整报告"""
        df = self.df
        self.report.data_types = {col: str(dtype) for col, dtype in df.dtypes.items()}

        # 缺失值分析
        for col in df.columns:
            missing = df[col].isna().sum()
            self.report.missing_values[col] = missing
            self.report.missing_percentage[col] = missing / len(df) if len(df) > 0 else 0

        # 重复行分析
        self.report.duplicate_rows = df.duplicated().sum()
        self.report.duplicate_percentage = (
            self.report.duplicate_rows / len(df) if len(df) > 0 else 0)

        # 异常值分析（IQR 方法）
        for col in df.select_dtypes(include=[np.number]).columns:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            outlier_count = ((df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)).sum()
            if outlier_count > 0:
                self.report.outliers[col] = {
                    "count": int(outlier_count), "method": "IQR (1.5倍)",
                    "lower_bound": float(Q1 - 1.5 * IQR),
                    "upper_bound": float(Q3 + 1.5 * IQR)
                }

        # 质量评分计算
        missing_penalty = sum(min(p * 100, 20) for p in self.report.missing_percentage.values())
        dup_penalty = min(self.report.duplicate_percentage * 50, 15)
        outlier_penalty = min(
            sum(v["count"] / max(self.report.total_rows, 1)
                for v in self.report.outliers.values()) * 100, 15)
        self.report.quality_score = max(0, 100 - missing_penalty - dup_penalty - outlier_penalty)
        return self.report

    def handle_missing(self, strategy: str = "auto") -> pd.DataFrame:
        """处理缺失值 - 支持 auto/median/mode/ffill/drop_rows/drop_column"""
        for col in self.df.columns:
            missing_pct = self.df[col].isna().sum() / len(self.df)
            if missing_pct == 0:
                continue

            s = (strategy if strategy != "auto"
                 else self._auto_strategy(self.df[col], missing_pct))

            if s == "drop_column" and missing_pct > 0.5:
                self.df = self.df.drop(columns=[col])
                self.cleaning_log.append(f"删除列 '{col}': 缺失率 {missing_pct:.1%} 过高")
            elif s == "drop_rows":
                before = len(self.df)
                self.df = self.df.dropna(subset=[col])
                self.cleaning_log.append(f"删除 '{col}' 缺失行: {before - len(self.df)} 行")
            elif s == "fill_median" and pd.api.types.is_numeric_dtype(self.df[col]):
                val = self.df[col].median()
                self.df[col] = self.df[col].fillna(val)
                self.cleaning_log.append(f"填充 '{col}' 缺失值: 中位数 = {val}")
            elif s == "fill_mode":
                val = (self.df[col].mode().iloc[0]
                       if not self.df[col].mode().empty else "未知")
                self.df[col] = self.df[col].fillna(val)
                self.cleaning_log.append(f"填充 '{col}' 缺失值: 众数 = {val}")
            elif s == "fill_ffill":
                self.df[col] = self.df[col].ffill().bfill()
                self.cleaning_log.append(f"前向填充 '{col}' 缺失值")
        return self.df

    def _auto_strategy(self, series: pd.Series, missing_pct: float) -> str:
        """根据数据特征自动选择填充策略"""
        if missing_pct > 0.5:
            return "drop_column"
        if pd.api.types.is_numeric_dtype(series):
            return "fill_median"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "fill_ffill"
        return "fill_mode"

    def remove_duplicates(self, subset: Optional[list] = None) -> pd.DataFrame:
        """删除重复行"""
        before = len(self.df)
        self.df = self.df.drop_duplicates(subset=subset)
        removed = before - len(self.df)
        if removed > 0:
            self.cleaning_log.append(f"删除重复行: {removed} 行")
        return self.df

    def handle_outliers(self, method: str = "clip",
                        columns: Optional[list] = None) -> pd.DataFrame:
        """处理异常值 - clip（截断）或 remove（移除）"""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        if columns:
            numeric_cols = [c for c in numeric_cols if c in columns]

        for col in numeric_cols:
            Q1, Q3 = self.df[col].quantile(0.25), self.df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
            mask = (self.df[col] < lower) | (self.df[col] > upper)
            count = mask.sum()
            if count == 0:
                continue
            if method == "clip":
                self.df[col] = self.df[col].clip(lower, upper)
                self.cleaning_log.append(
                    f"截断 '{col}' 异常值: {count} 个值限制在 [{lower:.2f}, {upper:.2f}]")
            elif method == "remove":
                self.df = self.df[~mask]
                self.cleaning_log.append(f"移除 '{col}' 异常行: {count} 行")
        return self.df

    def get_cleaning_summary(self) -> str:
        """获取清洗摘要日志"""
        if not self.cleaning_log:
            return "无需清洗操作。"
        lines = ["## 数据清洗日志\n"]
        for i, log in enumerate(self.cleaning_log, 1):
            lines.append(f"{i}. {log}")
        if self.report.total_rows != len(self.df):
            lines.append(
                f"\n**数据量变化**: {self.report.total_rows:,} → {len(self.df):,}")
        return "\n".join(lines)
```

## 17.4 统计分析与可视化

### 17.4.1 智能统计分析引擎

统计分析引擎是数据分析 Agent 的大脑。它需要根据用户的数据特征和查询意图，自动选择最合适的分析方法。

```python
"""
统计分析引擎 - 自动选择分析方法和可视化图表
"""

from dataclasses import dataclass
from enum import Enum


class AnalysisType(Enum):
    DESCRIPTIVE = "descriptive"
    TREND = "trend"
    COMPARISON = "comparison"
    CORRELATION = "correlation"
    DISTRIBUTION = "distribution"


@dataclass
class AnalysisResult:
    """分析结果统一封装"""
    analysis_type: AnalysisType
    chart_type: str
    chart_config: dict
    summary: str
    key_findings: list[str]
    statistics: dict


class StatisticalAnalyzer:
    """统计分析器"""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def descriptive_analysis(self, columns: Optional[list] = None) -> AnalysisResult:
        """描述性统计分析 - 均值、中位数、标准差、偏度等"""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        if columns:
            numeric_cols = [c for c in numeric_cols if c in columns]

        stats = {}
        for col in numeric_cols:
            series = self.df[col].dropna()
            stats[col] = {
                "mean": float(series.mean()),
                "median": float(series.median()),
                "std": float(series.std()),
                "min": float(series.min()),
                "max": float(series.max()),
                "skewness": float(series.skew()),
                "cv": float(series.std() / series.mean()) if series.mean() != 0 else None
            }

        key_findings = []
        for col, s in stats.items():
            if s["cv"] and s["cv"] > 1:
                key_findings.append(f"'{col}' 数据离散度极高 (CV={s['cv']:.2f})")
            elif s["cv"] and s["cv"] < 0.1:
                key_findings.append(f"'{col}' 数据分布非常均匀 (CV={s['cv']:.2f})")
            if s["skewness"] > 1:
                key_findings.append(f"'{col}' 呈右偏分布 (偏度={s['skewness']:.2f})")
            elif s["skewness"] < -1:
                key_findings.append(f"'{col}' 呈左偏分布 (偏度={s['skewness']:.2f})")

        return AnalysisResult(
            analysis_type=AnalysisType.DESCRIPTIVE, chart_type="box",
            chart_config={"type": "box", "title": "数值字段分布概览"},
            summary=f"对 {len(numeric_cols)} 个数值字段进行了描述性统计分析。",
            key_findings=key_findings or ["各字段分布较为正常"],
            statistics=stats
        )

    def trend_analysis(self, date_col: str, value_col: str,
                       freq: str = "D") -> AnalysisResult:
        """趋势分析 - 按时间聚合并检测变化趋势"""
        df = self.df.copy()
        df[date_col] = pd.to_datetime(df[date_col])

        if freq == "D":
            grouped = df.groupby(df[date_col].dt.date)[value_col].agg(["sum", "mean"])
        elif freq == "M":
            grouped = df.groupby(df[date_col].dt.to_period("M"))[value_col].agg(["sum", "mean"])
        else:
            grouped = df.groupby(df[date_col].dt.date)[value_col].agg(["sum", "mean"])

        grouped = grouped.reset_index()
        grouped.columns = ["period", "total", "average"]

        if len(grouped) >= 2:
            first = grouped["total"].iloc[:len(grouped)//2].mean()
            second = grouped["total"].iloc[len(grouped)//2:].mean()
            change_pct = (second - first) / first * 100 if first != 0 else 0
            trend = ("呈上升趋势 (+{:.1f}%)".format(change_pct) if change_pct > 10 else
                     "呈下降趋势 ({:.1f}%)".format(change_pct) if change_pct < -10 else
                     "基本平稳 ({:+.1f}%)".format(change_pct))
        else:
            trend = "数据不足"

        peak_idx = grouped["total"].idxmax()
        valley_idx = grouped["total"].idxmin()

        return AnalysisResult(
            analysis_type=AnalysisType.TREND, chart_type="line",
            chart_config={"type": "line", "title": f"{value_col} 趋势"},
            summary=f"{value_col} 在分析周期内{trend}。",
            key_findings=[
                trend,
                f"峰值: {grouped.loc[peak_idx, 'period']} "
                f"= {grouped.loc[peak_idx, 'total']:,.0f}",
                f"谷值: {grouped.loc[valley_idx, 'period']} "
                f"= {grouped.loc[valley_idx, 'total']:,.0f}"
            ],
            statistics={"trend": trend, "change_pct": change_pct}
        )

    def correlation_analysis(self, columns: Optional[list] = None) -> AnalysisResult:
        """相关性分析 - 找出强相关特征对"""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        if columns:
            numeric_cols = [c for c in numeric_cols if c in columns]
        corr_matrix = self.df[numeric_cols].corr()

        strong = []
        cols_list = list(numeric_cols)
        for i in range(len(cols_list)):
            for j in range(i + 1, len(cols_list)):
                val = corr_matrix.iloc[i, j]
                if abs(val) > 0.7:
                    strong.append({
                        "col1": cols_list[i], "col2": cols_list[j],
                        "correlation": round(val, 3),
                        "type": "强正相关" if val > 0 else "强负相关"
                    })
        strong.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        findings = [f"发现 {len(strong)} 对强相关特征 (|r| > 0.7)"]
        for c in strong[:5]:
            findings.append(f"  {c['col1']} ↔ {c['col2']}: r={c['correlation']:.3f}")

        return AnalysisResult(
            analysis_type=AnalysisType.CORRELATION, chart_type="heatmap",
            chart_config={"type": "heatmap", "title": "特征相关性热力图"},
            summary=f"分析了 {len(numeric_cols)} 个数值特征的相关性。",
            key_findings=findings or ["未发现强相关特征"],
            statistics={"strong_count": len(strong)}
        )
```

### 17.4.2 自动可视化生成

图表类型的选择往往需要丰富的数据可视化经验。自动可视化引擎通过分析数据特征（时间序列、类别对比、数值分布等）自动选择最佳图表类型。

```python
"""
自动可视化引擎 - 根据数据特征自动选择最佳图表类型
"""

import matplotlib
matplotlib.use("Agg")  # 非交互式后端
import matplotlib.pyplot as plt
import numpy as np
import re
import os
import tempfile
from typing import Optional

# 中文字体设置
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


class AutoVisualizer:
    """自动可视化引擎"""

    # 图表类型决策矩阵
    CHART_DECISION = {
        ("numeric", "time"): "line",
        ("numeric", "category"): "bar",
        ("category", "category"): "bar",
        ("numeric", "numeric"): "scatter",
        ("distribution", None): "histogram",
        ("proportion", None): "pie",
    }

    def __init__(self, style: str = "seaborn-v0_8-whitegrid"):
        self.style = style

    def _infer_type(self, data) -> str:
        """推断数据类型: time / numeric / category"""
        sample = data[:min(20, len(data))]
        time_n = sum(1 for v in sample
                     if isinstance(v, (np.datetime64, pd.Timestamp))
                     or (isinstance(v, str) and re.match(r'\d{4}[-/]\d{2}[-/]\d{2}', v)))
        if time_n > len(sample) * 0.5:
            return "time"
        num_n = sum(1 for v in sample if isinstance(v, (int, float, np.number)))
        return "numeric" if num_n > len(sample) * 0.7 else "category"

    def _best_chart(self, x_data, y_data, intent: Optional[str] = None) -> str:
        """自动选择图表类型"""
        if intent:
            return intent
        xt = self._infer_type(x_data)
        yt = self._infer_type(y_data) if y_data else None
        return self.CHART_DECISION.get((xt, yt), "bar")

    def plot(self, x_data: list, y_data: Optional[list] = None,
             title: str = "", x_label: str = "", y_label: str = "",
             chart_type: Optional[str] = None, figsize: tuple = (10, 6),
             save_path: Optional[str] = None) -> str:
        """生成图表并保存，返回保存路径"""
        ct = chart_type or self._best_chart(x_data, y_data)
        plt.style.use(self.style)
        fig, ax = plt.subplots(figsize=figsize)

        if ct == "line" and y_data is not None:
            ax.plot(x_data, y_data, linewidth=2, color="#4A90D9")
            ax.fill_between(range(len(x_data)), y_data, alpha=0.1, color="#4A90D9")
            step = max(1, len(x_data) // 10)
            ax.set_xticks(range(0, len(x_data), step))
            ax.set_xticklabels([str(x_data[i]) for i in range(0, len(x_data), step)],
                               rotation=45, ha='right')

        elif ct == "bar" and y_data is not None:
            colors = plt.cm.Set2(np.linspace(0, 1, len(x_data)))
            bars = ax.bar(range(len(x_data)), y_data, color=colors, edgecolor='white')
            ax.set_xticks(range(len(x_data)))
            ax.set_xticklabels([str(x) for x in x_data], rotation=45, ha='right')
            for bar, val in zip(bars, y_data):
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                       f'{val:,.0f}', ha='center', va='bottom', fontsize=8)

        elif ct == "scatter" and y_data is not None:
            ax.scatter(x_data, y_data, alpha=0.5, s=30, c="#4A90D9")
            if len(x_data) > 2:
                z = np.polyfit([float(x) for x in x_data], y_data, 1)
                xr = np.linspace(min(float(x) for x in x_data),
                                 max(float(x) for x in x_data), 100)
                ax.plot(xr, np.poly1d(z)(xr), "--", color="red", alpha=0.7)

        elif ct == "pie" and y_data is not None:
            if len(x_data) > 8:
                x_data, y_data = x_data[:8] + ["其他"], y_data[:8] + [sum(y_data[8:])]
            ax.pie(y_data, labels=x_data, autopct='%1.1f%%',
                   colors=plt.cm.Set3(np.linspace(0, 1, len(x_data))), startangle=90)

        elif ct == "histogram":
            bins = min(30, max(10, len(set(x_data)) // 10))
            ax.hist(x_data, bins=bins, color="#4A90D9", edgecolor="white", alpha=0.8)

        ax.set_title(title, fontsize=14, fontweight='bold', pad=15)
        ax.set_xlabel(x_label, fontsize=11)
        ax.set_ylabel(y_label, fontsize=11)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        if save_path is None:
            save_path = os.path.join(tempfile.gettempdir(),
                                    f"chart_{abs(hash(title)) % 10000}.png")
        fig.savefig(save_path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close(fig)
        return save_path
```

## 17.5 报告自动生成

### 17.5.1 结构化分析报告引擎

分析的最终目的是产出可供决策参考的报告。报告生成引擎将统计分析结果封装为结构化的 Markdown 或 HTML 文档，支持执行摘要、数据概览、分析章节和建议行动项。

```python
"""
分析报告自动生成引擎
将数据分析结果转化为结构化的 Markdown/HTML 报告
"""

from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ReportSection:
    """报告章节"""
    title: str
    content: str
    chart_paths: list = field(default_factory=list)
    level: int = 2


class AnalysisReportGenerator:
    """分析报告生成器"""

    def __init__(self, title: str, author: str = "数据分析 Agent"):
        self.title = title
        self.author = author
        self.sections: list[ReportSection] = []
        self.generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def add_executive_summary(self, data_source: str, analysis_period: str,
                               key_findings: list[str], quality_score: float):
        """添加执行摘要"""
        content = (f"本报告基于 **{data_source}**，"
                   f"对 **{analysis_period}** 的数据进行了全面分析。\n\n"
                   f"**数据质量评分**: {quality_score:.1f}/100\n\n"
                   "### 关键发现\n\n")
        for f in key_findings:
            content += f"- {f}\n"
        self.sections.append(ReportSection(title="执行摘要", content=content))

    def add_data_overview(self, total_rows: int, total_columns: int,
                           column_types: dict, quality_md: str):
        """添加数据概览"""
        content = (f"### 基本信息\n"
                   f"- 数据量: **{total_rows:,}** 行\n"
                   f"- 字段数: **{total_columns}** 列\n\n"
                   "### 字段类型分布\n\n| 类型 | 字段数 |\n|------|--------|\n")
        groups = {}
        for col, dtype in column_types.items():
            groups.setdefault(dtype, []).append(col)
        for dtype, cols in groups.items():
            content += f"| {dtype} | {len(cols)} |\n"
        content += f"\n{quality_md}"
        self.sections.append(ReportSection(title="数据概览", content=content))

    def add_analysis_section(self, title: str, result: AnalysisResult,
                              chart_path: Optional[str] = None):
        """添加分析章节"""
        content = f"### {result.summary}\n\n### 关键发现\n\n"
        for f in result.key_findings:
            content += f"- {f}\n"
        if result.statistics:
            content += "\n### 统计指标\n\n"
            for k, v in result.statistics.items():
                if isinstance(v, dict) and "mean" in v:
                    content += (f"| 指标 | {k} |\n|------|------|\n"
                                f"| 均值 | {v['mean']:.2f} |\n"
                                f"| 中位数 | {v['median']:.2f} |\n"
                                f"| 标准差 | {v['std']:.2f} |\n\n")
        self.sections.append(ReportSection(
            title=title, content=content,
            chart_paths=[chart_path] if chart_path else []))

    def add_recommendations(self, recommendations: list[str]):
        """添加建议章节"""
        content = ""
        for i, rec in enumerate(recommendations, 1):
            content += f"### 建议 {i}\n\n{rec}\n\n"
        self.sections.append(ReportSection(title="建议与行动项", content=content))

    def to_markdown(self) -> str:
        """生成 Markdown 格式报告"""
        lines = [f"# {self.title}\n",
                 f"> 生成时间: {self.generated_at} | 生成工具: 数据分析 Agent\n",
                 "---\n"]
        for section in self.sections:
            prefix = "#" * (section.level + 1)
            lines.append(f"\n{prefix} {section.title}\n{section.content}")
            for p in section.chart_paths:
                lines.append(f"\n![{section.title}]({p})\n")
        lines.append("\n---\n*本报告由数据分析 Agent 自动生成*\n")
        return "\n".join(lines)

    def to_html(self) -> str:
        """生成 HTML 格式报告"""
        md = self.to_markdown()
        html = md
        for pat, repl in [
            (r'^# (.*$)', r'<h1>\1</h1>'),
            (r'^## (.*$)', r'<h2>\1</h2>'),
            (r'^### (.*$)', r'<h3>\1</h3>'),
            (r'\*\*(.*?)\*\*', r'<strong>\1</strong>'),
            (r'- (.*$)', r'<li>\1</li>'),
            (r'^> (.*)$', r'<blockquote>\1</blockquote>'),
            (r'^---$', r'<hr>'),
        ]:
            html = re.sub(pat, repl, html, flags=re.MULTILINE)

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{self.title}</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; max-width: 900px;
               margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.8; }}
        h1 {{ color: #1a1a2e; border-bottom: 3px solid #4A90D9; padding-bottom: 10px; }}
        h2 {{ color: #16213e; margin-top: 30px; }}
        h3 {{ color: #0f3460; }}
        blockquote {{ border-left: 4px solid #4A90D9; padding: 10px 20px;
                    background: #f0f4f8; margin: 15px 0; }}
        img {{ max-width: 100%; border-radius: 8px; }}
        strong {{ color: #e94560; }}
        hr {{ border: none; border-top: 2px solid #eee; margin: 30px 0; }}
    </style>
</head>
<body>{html}</body></html>"""
```

## 17.6 异常检测系统

### 17.6.1 多层异常检测框架

异常检测是数据分析的高阶能力。一个好的异常检测系统需要同时支持统计规则（Z-Score、IQR）和趋势分析，并能够自动判断异常严重性。

```python
"""
异常检测系统 - 结合统计规则与趋势分析
"""

from dataclasses import dataclass
from typing import Optional
import numpy as np
from datetime import datetime


@dataclass
class Anomaly:
    """异常记录"""
    timestamp: str
    metric_name: str
    value: float
    expected_range: tuple
    severity: str        # "low" / "medium" / "high" / "critical"
    description: str
    suggestion: str = ""


class AnomalyDetector:
    """多层异常检测器"""

    def __init__(self, sensitivity: float = 2.0):
        """
        Args:
            sensitivity: Z-Score 灵敏度阈值，值越小越敏感
        """
        self.sensitivity = sensitivity
        self.baseline: dict[str, dict] = {}

    def fit_baseline(self, data: dict[str, list[float]]):
        """从历史数据建立基线统计"""
        for metric, values in data.items():
            arr = np.array(values, dtype=float)
            self.baseline[metric] = {
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)) or 1e-9,
                "median": float(np.median(arr)),
                "q1": float(np.percentile(arr, 25)),
                "q3": float(np.percentile(arr, 75)),
                "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)) or 1e-9,
                "p5": float(np.percentile(arr, 5)),
                "p95": float(np.percentile(arr, 95)),
            }

    def detect_zscore(self, metric: str, value: float) -> Optional[Anomaly]:
        """Z-Score 异常检测"""
        if metric not in self.baseline:
            return None
        bl = self.baseline[metric]
        z = abs(value - bl["mean"]) / bl["std"]

        if z > self.sensitivity:
            sev = ("critical" if z > 4 else "high" if z > 3 else
                   "medium" if z > 2.5 else "low")
            return Anomaly(
                timestamp=datetime.now().isoformat(), metric_name=metric,
                value=value, expected_range=(
                    bl["mean"] - self.sensitivity * bl["std"],
                    bl["mean"] + self.sensitivity * bl["std"]),
                severity=sev,
                description=f"{metric} 值 {value:.2f} 偏离基线 {z:.1f} 个标准差",
                suggestion="建议检查数据源和采集流程，确认是否为真实异常"
            )
        return None

    def detect_iqr(self, metric: str, value: float) -> Optional[Anomaly]:
        """IQR 异常检测（对非正态分布更鲁棒）"""
        if metric not in self.baseline:
            return None
        bl = self.baseline[metric]
        lower, upper = bl["q1"] - 1.5 * bl["iqr"], bl["q3"] + 1.5 * bl["iqr"]

        if value < lower or value > upper:
            sev = "high" if value < bl["p5"] or value > bl["p95"] else "medium"
            return Anomaly(
                timestamp=datetime.now().isoformat(), metric_name=metric,
                value=value, expected_range=(lower, upper),
                severity=sev,
                description=f"{metric} 值 {value:.2f} 超出 IQR 范围",
                suggestion="该值超出正常四分位范围，建议人工确认"
            )
        return None

    def detect_trend_change(self, metric: str, recent: list[float],
                             window: int = 7) -> Optional[Anomaly]:
        """趋势突变检测 - 对比前后窗口的均值变化"""
        if len(recent) < window * 2:
            return None

        old_avg = np.mean(recent[-window*2:-window])
        new_avg = np.mean(recent[-window:])
        if old_avg == 0:
            return None

        ratio = (new_avg - old_avg) / abs(old_avg)
        if abs(ratio) > 0.3:
            direction = "上升" if ratio > 0 else "下降"
            sev = ("critical" if abs(ratio) > 0.5 else
                   "high" if abs(ratio) > 0.4 else "medium")
            return Anomaly(
                timestamp=datetime.now().isoformat(), metric_name=metric,
                value=new_avg, expected_range=(old_avg * 0.7, old_avg * 1.3),
                severity=sev,
                description=f"{metric} 近期均值{direction} {abs(ratio):.1%}",
                suggestion="指标出现显著趋势变化，建议排查原因"
            )
        return None

    def batch_detect(self, metric: str, values: list[float]) -> list[Anomaly]:
        """批量检测 - 综合使用多种检测方法"""
        anomalies = []
        for i, value in enumerate(values):
            a = self.detect_zscore(metric, value)
            if not a:
                a = self.detect_iqr(metric, value)
            if a:
                anomalies.append(a)
            if i >= 13:
                ta = self.detect_trend_change(metric, values[:i+1])
                if ta:
                    anomalies.append(ta)
        return anomalies

    def generate_report(self, anomalies: list[Anomaly]) -> str:
        """生成异常检测报告"""
        if not anomalies:
            return "## 异常检测报告\n\n未发现异常。\n"

        lines = ["## 异常检测报告\n", f"**检测到 {len(anomalies)} 个异常点**\n",
                 "| 严重性 | 数量 |\n|--------|------|"]
        counts = {}
        for a in anomalies:
            counts[a.severity] = counts.get(a.severity, 0) + 1
        for s in ["critical", "high", "medium", "low"]:
            if s in counts:
                lines.append(f"| {s} | {counts[s]} |")

        lines.append("\n### 异常详情\n")
        for i, a in enumerate(anomalies, 1):
            lines.append(f"#### 异常 {i}: {a.metric_name}")
            lines.append(f"- **严重性**: {a.severity} | **值**: {a.value:.2f}")
            lines.append(f"- **描述**: {a.description}")
            lines.append(f"- **建议**: {a.suggestion}\n")
        return "\n".join(lines)
```

## 17.7 完整集成：数据分析 Agent

### 17.7.1 统一入口

```python
"""
数据分析 Agent - 完整集成版
将 SQL 引擎、数据清洗、统计分析、可视化和报告生成整合为一体
"""

class DataAnalysisAgent:
    """
    数据分析 Agent 核心入口

    使用示例:
        db = build_ecommerce_schema()
        agent = DataAnalysisAgent(db_schema=db)
        result = agent.analyze("分析上个月各城市的销售趋势")
    """

    def __init__(self, db_schema: Optional[DatabaseSchema] = None, llm_client=None):
        self.sql_agent = NLToSQLAgent(db_schema or DatabaseSchema(), llm_client)

    def analyze_from_file(self, csv_path: str, query: str) -> dict:
        """文件分析模式 - 读取 CSV 并生成完整报告"""
        df = pd.read_csv(csv_path)

        # 数据质量分析
        cleaner = DataCleaner(df)
        quality = cleaner.analyze()

        # 数据清洗
        cleaner.handle_missing(strategy="auto")
        cleaner.remove_duplicates()
        cleaner.handle_outliers(method="clip")

        # 统计分析
        analyzer = StatisticalAnalyzer(cleaner.df)
        desc = analyzer.descriptive_analysis()
        corr = analyzer.correlation_analysis()

        # 趋势分析（自动检测日期列）
        trend = None
        for col in cleaner.df.columns:
            try:
                pd.to_datetime(cleaner.df[col])
                nums = cleaner.df.select_dtypes(include=[np.number]).columns
                if len(nums) > 0:
                    trend = analyzer.trend_analysis(col, nums[0])
                    break
            except (ValueError, TypeError):
                continue

        # 生成报告
        gen = AnalysisReportGenerator(title=f"分析报告: {query}")
        findings = desc.key_findings[:5] + (trend.key_findings if trend else []) + corr.key_findings[:3]
        gen.add_executive_summary(csv_path, "全量数据", findings[:8], quality.quality_score)
        gen.add_data_overview(len(df), len(df.columns), quality.data_types, quality.to_markdown())
        gen.add_analysis_section("描述性统计", desc)
        if trend:
            gen.add_analysis_section("趋势分析", trend)
        gen.add_analysis_section("相关性分析", corr)
        gen.add_recommendations([
            "定期监控数据质量，重点关注缺失率较高的字段",
            "对强相关特征进行因果分析以发现业务洞察",
            "引入更多外部特征以丰富分析维度"
        ])

        return {
            "query": query,
            "quality_score": quality.quality_score,
            "cleaning_log": cleaner.cleaning_log,
            "report_markdown": gen.to_markdown(),
            "report_html": gen.to_html()
        }

    def analyze_from_db(self, query: str, executor=None) -> dict:
        """数据库查询模式 - NL-to-SQL + 结果分析"""
        # 生成 SQL
        sql_result = self.sql_agent.generate_query(query)
        if not sql_result["success"]:
            return {"success": False, "error": sql_result["error"]}

        # 执行 SQL（需要外部传入 executor）
        if executor:
            try:
                columns, rows = executor(sql_result["sql"])
                df = pd.DataFrame(rows, columns=columns)
            except Exception as e:
                return {"success": False, "error": f"SQL 执行失败: {e}"}
        else:
            return {"success": False, "error": "未提供数据库执行器"}

        # 对查询结果进行分析
        analyzer = StatisticalAnalyzer(df)
        desc = analyzer.descriptive_analysis()

        return {
            "success": True,
            "sql": sql_result["sql"],
            "explanation": sql_result["explanation"],
            "statistics": desc.statistics,
            "findings": desc.key_findings
        }
```

### 17.7.2 端到端示例

```python
"""
端到端使用示例
"""

# 示例 1: 文件分析
if __name__ == "__main__":
    # 创建模拟数据
    import pandas as pd
    import numpy as np

    np.random.seed(42)
    dates = pd.date_range("2025-01-01", periods=90, freq="D")
    mock_df = pd.DataFrame({
        "date": dates,
        "city": np.random.choice(["北京", "上海", "深圳", "广州", "杭州"], 90),
        "sales": np.random.lognormal(10, 0.5, 90),
        "orders": np.random.randint(50, 500, 90),
        "customers": np.random.randint(20, 200, 90),
        "refund_rate": np.random.uniform(0, 0.1, 90)
    })

    # 保存临时 CSV
    csv_path = "/tmp/mock_sales.csv"
    mock_df.to_csv(csv_path, index=False)

    # 创建 Agent 并分析
    agent = DataAnalysisAgent()
    result = agent.analyze_from_file(csv_path, "分析各城市的销售趋势和异常情况")

    print("=== 质量评分 ===")
    print(f"{result['quality_score']:.1f}/100")

    print("\n=== 清洗日志 ===")
    for log in result['cleaning_log']:
        print(f"  {log}")

    print("\n=== 报告预览（前500字）===")
    print(result['report_markdown'][:500] + "...")

    # 示例 2: 数据库查询
    db = build_ecommerce_schema()
    sql_agent = NLToSQLAgent(db)

    queries = [
        "上个月销售额最高的前10个城市",
        "各商品类目的订单数量和平均客单价",
        "VIP 等级与消费金额的关系"
    ]

    for q in queries:
        print(f"\n### 问题: {q}")
        r = sql_agent.generate_query(q)
        if r["success"]:
            print(f"SQL: {r['sql']}")
            print(f"说明: {r['explanation']}")
        else:
            print(f"错误: {r['error']}")
```

## 17.8 生产级考量

### 17.8.1 性能优化

| 优化点 | 策略 | 预期效果 |
|--------|------|---------|
| Schema 检索 | 向量相似度 + 关键词混合 | 减少 50% Prompt Token |
| SQL 缓存 | 语义相似度匹配的查询缓存 | 重复查询 0 延迟 |
| 数据处理 | 分块读取 + 增量计算 | 支持亿级数据 |
| 可视化 | 采样渲染 + 懒加载 | 大数据集不卡顿 |

### 17.8.2 安全与权限

- **SQL 白名单**：只允许 SELECT/WITH/EXPLAIN，禁止任何写操作
- **行级权限**：根据用户角色过滤可访问的数据行
- **查询超时**：设置最大执行时间，防止资源耗尽
- **结果脱敏**：敏感字段（手机号、身份证等）自动脱敏

### 17.8.3 评测指标

```
准确率 = 生成的正确 SQL 数 / 总查询数
召回率 = 成功处理的查询数 / 总查询数
延迟 = P95 查询响应时间
用户满意度 = 用户确认结果准确的比例
```

## 本章小结

本章从自然语言 SQL 查询出发，逐步构建了完整的数据分析 Agent 体系：

1. **Schema 感知的 Text-to-SQL**：通过结构化 Prompt 让 LLM 理解数据库语义
2. **智能数据清洗**：自动检测缺失值、异常值、重复数据，智能选择处理策略
3. **统计分析引擎**：描述性统计、趋势分析、相关性分析，自动选择分析方法
4. **自动可视化**：根据数据特征自动匹配最佳图表类型
5. **报告自动生成**：将分析结果转化为结构化的 Markdown/HTML 报告
6. **异常检测系统**：Z-Score、IQR、趋势突变三重检测机制

核心思想：**将数据分析从"技能"降维为"对话"**。用户不需要会 SQL、Python 或统计学，只需要会用自然语言提问。
