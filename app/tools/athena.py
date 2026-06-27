"""Athena query tool - validates and executes SQL queries.

In development mode (when Athena is not configured), falls back to
querying local CSV files with DuckDB-style logic using Python.
"""

from __future__ import annotations

import csv
import logging
import re
import time
from pathlib import Path
from typing import Any

import boto3

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# SQL patterns that are blocked
BLOCKED_PATTERNS = [
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|MERGE|UNLOAD)\b",
    r"\bINTO\b\s+\w+\s*\(",  # INSERT INTO
    r"\bCREATE\s+TABLE\s+AS\b",  # CTAS
]

# Table prefixes/names that are blocked
BLOCKED_TABLE_PATTERNS = [
    r"\bprivate[_.]",
    r"\braw[_.]",
    r"\bcleaned[_.]",
    r"\bquality[_.]",
]


class SQLValidationError(Exception):
    """Raised when SQL fails safety validation."""
    pass


def validate_sql(sql: str, allowed_tables: list[str]) -> str:
    """Validate SQL for safety. Returns cleaned SQL or raises SQLValidationError."""
    sql_upper = sql.upper().strip()

    # Must start with SELECT or WITH
    if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
        raise SQLValidationError("Only SELECT queries are allowed.")

    # Check blocked patterns
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, sql_upper):
            raise SQLValidationError(
                f"Query contains blocked operation. Only SELECT queries are allowed."
            )

    # Check for blocked table references
    sql_lower = sql.lower()
    for pattern in BLOCKED_TABLE_PATTERNS:
        if re.search(pattern, sql_lower):
            raise SQLValidationError(
                "Query references restricted tables (private/raw/cleaned/quality). "
                "Only reporting tables are accessible."
            )

    # Verify only allowed tables are referenced
    # Extract table names from FROM and JOIN clauses
    table_refs = re.findall(r'\bFROM\s+(\w+(?:\.\w+)?)|\bJOIN\s+(\w+(?:\.\w+)?)', sql_upper)
    referenced_tables = set()
    for match in table_refs:
        for name in match:
            if name:
                # Strip database/schema prefix if present (e.g., "database.table" -> "table")
                parts = name.lower().split(".")
                referenced_tables.add(parts[-1])

    # Extract CTE aliases defined in WITH clauses (they are not real tables)
    cte_aliases = set()
    cte_matches = re.findall(r'\b(\w+)\s+AS\s*\(', sql_upper)
    for alias in cte_matches:
        cte_aliases.add(alias.lower())

    # Remove CTE aliases from referenced tables before checking
    referenced_tables -= cte_aliases

    allowed_set = {t.lower() for t in allowed_tables}
    unauthorized = referenced_tables - allowed_set
    if unauthorized:
        raise SQLValidationError(
            f"Query references unauthorized tables: {unauthorized}. "
            f"Allowed tables: {allowed_set}"
        )

    # Ensure LIMIT is present
    if "LIMIT" not in sql_upper:
        settings = get_settings()
        sql = sql.rstrip().rstrip(";") + f"\nLIMIT {settings.max_query_rows}"

    return sql


def execute_athena_query(sql: str) -> list[dict[str, Any]]:
    """Execute a validated SQL query against Athena.

    Returns list of row dicts.
    """
    settings = get_settings()
    client = boto3.client("athena", region_name=settings.aws_region)

    response = client.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": settings.athena_database},
        ResultConfiguration={"OutputLocation": settings.athena_output_s3},
    )

    query_id = response["QueryExecutionId"]

    # Poll for completion
    for _ in range(60):
        result = client.get_query_execution(QueryExecutionId=query_id)
        state = result["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED",):
            break
        if state in ("FAILED", "CANCELLED"):
            reason = result["QueryExecution"]["Status"].get("StateChangeReason", "Unknown")
            raise RuntimeError(f"Athena query {state}: {reason}")
        time.sleep(1)
    else:
        raise RuntimeError("Athena query timed out after 60 seconds.")

    # Fetch results
    paginator = client.get_paginator("get_query_results")
    rows: list[dict[str, Any]] = []
    headers: list[str] = []

    for page in paginator.paginate(QueryExecutionId=query_id):
        result_set = page["ResultSet"]
        if not headers:
            headers = [
                col["VarCharValue"]
                for col in result_set["Rows"][0]["Data"]
            ]
            data_rows = result_set["Rows"][1:]
        else:
            data_rows = result_set["Rows"]

        for row in data_rows:
            values = [col.get("VarCharValue", "") for col in row["Data"]]
            rows.append(dict(zip(headers, values)))

    return rows


def execute_local_query(sql: str) -> list[dict[str, Any]]:
    """Fallback: execute a simple query against local CSV files.

    This is a simplified query engine for development/testing.
    Supports basic SELECT with WHERE, GROUP BY, ORDER BY, LIMIT.
    For production, use Athena.
    """
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    # Extract table name from FROM clause
    match = re.search(r'\bFROM\s+([\w.]+)', sql, re.IGNORECASE)
    if not match:
        raise SQLValidationError("Could not determine table name from query.")

    table_ref = match.group(1).lower()
    # Strip database/schema prefix
    table_name = table_ref.split(".")[-1]
    csv_path = data_dir / f"{table_name}.csv"

    if not csv_path.exists():
        raise SQLValidationError(f"Table '{table_name}' not found locally.")

    # Load CSV
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Apply simple WHERE filtering
    where_match = re.search(r'\bWHERE\s+(.+?)(?:\bGROUP\b|\bORDER\b|\bLIMIT\b|$)', sql, re.IGNORECASE | re.DOTALL)
    if where_match:
        where_clause = where_match.group(1).strip()
        rows = _apply_simple_where(rows, where_clause)

    # Apply GROUP BY with COUNT
    group_match = re.search(r'\bGROUP\s+BY\s+([\w,\s]+?)(?:\bORDER\b|\bLIMIT\b|\bHAVING\b|$)', sql, re.IGNORECASE)
    select_match = re.search(r'SELECT\s+(.+?)\s+FROM', sql, re.IGNORECASE | re.DOTALL)

    if group_match and select_match:
        group_cols = [c.strip() for c in group_match.group(1).split(",")]
        select_clause = select_match.group(1)
        rows = _apply_group_by(rows, group_cols, select_clause)

    # Apply ORDER BY
    order_match = re.search(r'\bORDER\s+BY\s+([\w\s,]+?)(?:\bLIMIT\b|$)', sql, re.IGNORECASE)
    if order_match:
        order_clause = order_match.group(1).strip()
        rows = _apply_order_by(rows, order_clause)

    # Apply LIMIT
    limit_match = re.search(r'\bLIMIT\s+(\d+)', sql, re.IGNORECASE)
    if limit_match:
        limit = int(limit_match.group(1))
        rows = rows[:limit]

    return rows


def _apply_simple_where(rows: list[dict], clause: str) -> list[dict]:
    """Apply basic WHERE filtering (supports = and LIKE)."""
    # Handle simple equality: column = 'value'
    eq_match = re.match(r"(\w+)\s*=\s*'([^']*)'", clause)
    if eq_match:
        col, val = eq_match.group(1), eq_match.group(2)
        return [r for r in rows if r.get(col, "").lower() == val.lower()]

    # Handle LIKE: column LIKE '%value%'
    like_match = re.match(r"(\w+)\s+LIKE\s+'%([^']*?)%'", clause, re.IGNORECASE)
    if like_match:
        col, val = like_match.group(1), like_match.group(2)
        return [r for r in rows if val.lower() in r.get(col, "").lower()]

    return rows


def _apply_group_by(rows: list[dict], group_cols: list[str], select_clause: str) -> list[dict]:
    """Apply GROUP BY with COUNT aggregation."""
    groups: dict[tuple, list[dict]] = {}
    for row in rows:
        key = tuple(row.get(c, "") for c in group_cols)
        groups.setdefault(key, []).append(row)

    # Detect COUNT in select
    count_alias = "count"
    count_match = re.search(r'COUNT\s*\(\s*\*?\s*\)\s+(?:AS\s+)?(\w+)', select_clause, re.IGNORECASE)
    if count_match:
        count_alias = count_match.group(1)
    elif "COUNT" in select_clause.upper():
        count_alias = "count"

    result = []
    for key, group_rows in groups.items():
        row_dict = dict(zip(group_cols, key))
        row_dict[count_alias] = str(len(group_rows))
        result.append(row_dict)

    return result


def _apply_order_by(rows: list[dict], clause: str) -> list[dict]:
    """Apply ORDER BY sorting."""
    parts = clause.split(",")
    col = parts[0].strip().split()[0]
    desc = "DESC" in clause.upper()

    def sort_key(r):
        val = r.get(col, "")
        try:
            return float(val)
        except (ValueError, TypeError):
            return val

    return sorted(rows, key=sort_key, reverse=desc)


def run_query(sql: str) -> list[dict[str, Any]]:
    """Validate and run a query, using Athena in production or local CSV fallback."""
    settings = get_settings()
    validated_sql = validate_sql(sql, settings.allowed_tables_list)

    if settings.app_env == "production" and settings.athena_output_s3:
        try:
            return execute_athena_query(validated_sql)
        except Exception as e:
            logger.error(f"Athena query failed: {e}")
            raise
    else:
        logger.info("Using local CSV fallback for query execution.")
        return execute_local_query(validated_sql)
