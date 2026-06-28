"""Simplified chat handler - single model call with data context."""

from __future__ import annotations

import csv
import json
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.models.bedrock_client import invoke_model
from app.models.prompts import PRIVATE_DATA_REFUSAL
from app.schemas import ChatResponse, ChartPayload, EvidenceItem
from app.tools.athena import SQLValidationError, run_query, validate_sql
from app.tools.charts import generate_chart
from app.tools.predictions import predict
from app.tools.schema import get_schema_description, get_catalog_info

logger = logging.getLogger(__name__)

# In-memory conversation store (for hackathon; use Redis/DynamoDB in production)
_conversations: dict[str, list[dict[str, str]]] = defaultdict(list)
MAX_HISTORY = 10  # Keep last 10 messages per conversation

# Private data keywords that trigger refusal
PRIVATE_DATA_KEYWORDS = [
    "name", "names", "phone", "telephone", "mobile",
    "cin", "photo", "photograph", "photographs", "commcare", "identifier",
    "address", "email", "contact details",
]


def _is_private_data_request(message: str) -> bool:
    """Check if the message is requesting private/identifying data."""
    msg_lower = message.lower()
    request_words = ["give", "show", "list", "what are", "provide", "get", "find", "tell me"]
    has_request = any(w in msg_lower for w in request_words)
    has_private = any(
        re.search(rf'\b{re.escape(kw)}', msg_lower) for kw in PRIVATE_DATA_KEYWORDS
        if kw not in ("name",)
    )
    if not has_private and "name" in msg_lower:
        person_context = any(w in msg_lower for w in ["patient", "person", "people", "worker", "individual"])
        has_private = person_context
    return has_request and has_private


def _is_chart_request(message: str) -> bool:
    """Check if the user wants a visual chart."""
    msg_lower = message.lower()
    chart_words = ["chart", "graph", "plot", "visualize", "visualization", "bar chart",
                   "pie chart", "line chart", "generate graph", "show graph"]
    return any(w in msg_lower for w in chart_words)


def _is_prediction_request(message: str) -> bool:
    """Check if the user wants prediction/forecasting."""
    msg_lower = message.lower()
    pred_words = ["predict", "forecast", "risk score", "likelihood", "will happen"]
    return any(w in msg_lower for w in pred_words)


def _load_data_sample(table_name: str, max_rows: int = 30) -> list[dict]:
    """Load a sample of data from a CSV file."""
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    csv_path = data_dir / f"{table_name}.csv"
    if not csv_path.exists():
        return []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for i, row in enumerate(reader):
            if i >= max_rows:
                break
            # Skip metadata columns from the sample shown to model
            clean_row = {k: v for k, v in row.items() if k not in (
                "record_id", "source_row_id", "source_file", "source_sheet",
                "source_row_number", "domain", "grain",
            )}
            rows.append(clean_row)
        return rows


def _get_data_context() -> str:
    """Build a comprehensive data context string for the model."""
    settings = get_settings()
    data_dir = Path(settings.data_dir)

    context_parts = [
        "You have access to the following health program datasets:\n"
    ]

    catalog = get_catalog_info()
    for entry in catalog:
        table = entry.get("table_name") or entry.get("reporting_table", "")
        rows = entry.get("row_count") or entry.get("rows", "?")
        domain = entry.get("domain", "?")
        context_parts.append(f"- {table}: {rows} rows, domain: {domain}")

    context_parts.append("\nTable schemas:")
    context_parts.append(get_schema_description())

    # Add small data samples for key tables
    for table in ["ambulance_trips", "tb_patient_journey", "community_workers"]:
        sample = _load_data_sample(table, max_rows=5)
        if sample:
            context_parts.append(f"\nSample data from {table} (first 5 rows):")
            context_parts.append(json.dumps(sample[:5], indent=2))

    return "\n".join(context_parts)


SYSTEM_PROMPT = """You are an AI health program analyst chatbot. You help program managers understand their data.

{data_context}

CRITICAL RULES:
- Current date: June 2026. "This year" = 2026.
- ambulance_trips: 146 trips, all from 2026
- ambulance_causes: 248 cause records from 2026 with case_count column
- tb_patient_journey: 4495 records from 2025
- community_workers: 221 workers from 2026  
- sensitization_activities: 71 activities from 2026
- mchp_patient_support: 2151 records from 2025

WHAT YOU CAN DO:
- Answer factual questions about the data (counts, breakdowns, comparisons)
- Provide analysis and insights
- Explain what the data shows and what it means
- Give operational recommendations based on the data
- Write report-style summaries

WHAT YOU CANNOT DO:
- Provide names, phone numbers, CIN, photos, or personal identifiers
- Make medical diagnoses
- Access data that isn't in the tables listed above

RESPONSE STYLE:
- Be specific with numbers. Don't say "many" — give actual counts.
- When analyzing, mention patterns, outliers, and actionable insights.
- Keep responses clear and structured.
- If data doesn't exist for what was asked, say so and suggest what IS available.

DATA QUALITY:
- Each table has data_confidence_marker (high/medium/low) and data_confidence_score columns.
- Mention confidence caveats only when relevant (low-confidence data present).
"""


def handle_chat(message: str, conversation_id: str | None = None) -> ChatResponse:
    """Main chat handler - simplified single-model approach."""
    settings = get_settings()
    conv_id = conversation_id or "default"

    # 1. Private data refusal
    if _is_private_data_request(message):
        return ChatResponse(
            type="error",
            answer=PRIVATE_DATA_REFUSAL,
            suggested_followups=[
                "How many TB screenings are in the dataset?",
                "Show ambulance trips by site.",
                "What tables are available?",
            ],
        )

    # 2. Prediction stub
    if _is_prediction_request(message):
        return ChatResponse(
            type="answer",
            answer=predict(message),
            suggested_followups=[
                "Show TB patient outcomes by district.",
                "What is the average ambulance response time?",
                "Give recommendations for improving follow-up.",
            ],
        )

    # 3. Chart request — need structured output
    if _is_chart_request(message):
        response = _handle_chart(message)
        # Store in conversation
        _conversations[conv_id].append({"role": "user", "content": message})
        _conversations[conv_id].append({"role": "assistant", "content": response.answer})
        _trim_history(conv_id)
        return response

    # 4. General question — single model call with full context + history
    response = _handle_general(message, conv_id)
    # Store in conversation
    _conversations[conv_id].append({"role": "user", "content": message})
    _conversations[conv_id].append({"role": "assistant", "content": response.answer})
    _trim_history(conv_id)
    return response


def _trim_history(conv_id: str):
    """Keep only the last MAX_HISTORY messages."""
    if len(_conversations[conv_id]) > MAX_HISTORY * 2:
        _conversations[conv_id] = _conversations[conv_id][-(MAX_HISTORY * 2):]


def _handle_general(message: str, conv_id: str = "default") -> ChatResponse:
    """Handle any general question with a single model call + conversation history."""
    settings = get_settings()

    if not settings.enable_bedrock:
        return _handle_general_fallback(message)

    data_context = _get_data_context()
    system = SYSTEM_PROMPT.format(data_context=data_context)

    # Build prompt with conversation history for context
    history = _conversations.get(conv_id, [])
    if history:
        history_text = "\n".join(
            f"{'User' if m['role']=='user' else 'Assistant'}: {m['content'][:500]}"
            for m in history[-6:]  # Last 3 exchanges
        )
        full_prompt = f"""Previous conversation:
{history_text}

Current question: {message}

Answer the current question, keeping the conversation context in mind. If the user refers to "those numbers", "the data", "this", etc., use the previous messages to understand what they mean."""
    else:
        full_prompt = message

    try:
        answer = invoke_model(
            full_prompt,
            role="answer",
            system_prompt=system,
            max_tokens=3000,
            temperature=0.3,
        )
        return ChatResponse(
            type="answer",
            answer=answer,
            suggested_followups=_suggest_followups(message),
        )
    except Exception as e:
        logger.error(f"Model call failed: {e}", exc_info=True)
        return ChatResponse(
            type="error",
            answer="I encountered an error processing your question. Please try again.",
            suggested_followups=["How many TB screenings are there?", "What tables are available?"],
        )


def _handle_chart(message: str) -> ChatResponse:
    """Handle chart requests — generates SQL, queries data, builds chart."""
    settings = get_settings()

    if not settings.enable_bedrock:
        return ChatResponse(type="answer", answer="Chart generation requires Bedrock to be enabled.")

    # Generate SQL for the chart data
    schema_desc = get_schema_description()
    sql_prompt = f"""Generate a SQL query to get data for this chart request: "{message}"

Available tables:
{schema_desc}

Context:
- ambulance_trips: 146 rows, year='2026'. Columns include: site, cause, outcome, patient_type, distance_km, event_date
- ambulance_causes: 248 rows, year='2026'. Has case_count column — use SUM(case_count) for totals.
- tb_patient_journey: 4495 rows, year='2025'. Columns include: district, screening_result, final_outcome, category, sex, age
- community_workers: 221 rows, year='2026'. Columns: district, worker_category, current_status
- sensitization_activities: 71 rows, year='2026'. Columns: district, total_participants, referrals_made
- mchp_patient_support: 2151 rows, year='2025'. Columns: site, support_category, clinical_evolution

Rules:
- Generate ONLY a SELECT query with GROUP BY to get chart-friendly data (category + count/sum).
- Do NOT filter by confidence or year unless specifically asked.
- Always include LIMIT 50.
- Respond with ONLY the SQL, no explanation."""

    try:
        sql = invoke_model(sql_prompt, role="query", temperature=0.1, max_tokens=500)
        sql = sql.strip()
        if sql.startswith("```"):
            sql = sql.split("```")[1]
            if sql.startswith("sql"):
                sql = sql[3:]
        sql = sql.strip()

        validated_sql = validate_sql(sql, settings.allowed_tables_list)
        results = run_query(validated_sql)

        if not results:
            return ChatResponse(
                type="answer",
                answer="I couldn't find data to chart. Try asking about ambulance trips, TB screenings, or community workers.",
                suggested_followups=["Show ambulance trips by site", "Show TB outcomes by district"],
            )

        chart = generate_chart(message, results, use_bedrock=True)
        if not chart:
            chart = generate_chart(message, results, use_bedrock=False)

        return ChatResponse(
            type="chart",
            answer=f"Here's the chart based on {len(results)} data points.",
            chart=chart,
            evidence=[EvidenceItem(table="query_results", metric="rows", value=len(results))],
            suggested_followups=_suggest_followups(message),
        )
    except SQLValidationError as e:
        return ChatResponse(type="error", answer=f"Query error: {str(e)}")
    except Exception as e:
        logger.error(f"Chart generation failed: {e}", exc_info=True)
        return ChatResponse(
            type="error",
            answer="I couldn't generate that chart. Try rephrasing, e.g. 'Show ambulance trips by site as a bar chart'.",
            suggested_followups=["Show ambulance trips by site", "Show TB screenings by district"],
        )


def _handle_general_fallback(message: str) -> ChatResponse:
    """Handle questions without Bedrock using simple data queries."""
    msg_lower = message.lower()

    # Try to figure out what table they want
    if any(w in msg_lower for w in ["ambulance", "trip", "call"]):
        table = "ambulance_trips"
    elif any(w in msg_lower for w in ["tb", "tuberculosis", "screening"]):
        table = "tb_patient_journey"
    elif any(w in msg_lower for w in ["community", "worker", "chw"]):
        table = "community_workers"
    elif any(w in msg_lower for w in ["mchp", "maternal", "patient support"]):
        table = "mchp_patient_support"
    elif any(w in msg_lower for w in ["sensitization", "awareness"]):
        table = "sensitization_activities"
    else:
        catalog = get_catalog_info()
        lines = ["Here are the available datasets:\n"]
        for entry in catalog:
            lines.append(f"- {entry.get('table_name', entry.get('reporting_table',''))}: {entry.get('row_count', entry.get('rows','?'))} rows")
        return ChatResponse(type="answer", answer="\n".join(lines))

    # Simple count
    try:
        sql = f"SELECT COUNT(*) as total FROM {table}"
        validated = validate_sql(sql, get_settings().allowed_tables_list)
        results = run_query(validated)
        count = results[0].get("total", "?") if results else "?"
        return ChatResponse(type="answer", answer=f"The {table.replace('_',' ')} table has {count} records.")
    except Exception as e:
        return ChatResponse(type="error", answer=f"Error: {str(e)}")


def _suggest_followups(message: str) -> list[str]:
    """Generate contextual follow-up suggestions."""
    msg_lower = message.lower()
    followups = []

    if "ambulance" in msg_lower:
        followups = ["Show ambulance trips by cause", "What's the average response time?", "Which site has the most trips?"]
    elif "tb" in msg_lower or "screening" in msg_lower:
        followups = ["Show TB outcomes by district", "How many positive screenings?", "Write a report about TB screening"]
    elif "community" in msg_lower or "worker" in msg_lower:
        followups = ["How many workers per district?", "What training have workers completed?"]
    else:
        followups = ["How many ambulance trips in 2026?", "Show TB screenings by district", "Give recommendations for the program"]

    return followups[:3]
