"""Intent router - classifies user questions and dispatches to appropriate tools."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.config import get_settings
from app.models.bedrock_client import invoke_model
from app.models.prompts import (
    ANSWER_PROMPT,
    ANSWER_SYSTEM,
    PRIVATE_DATA_REFUSAL,
    QUERY_PROMPT,
    QUERY_SYSTEM,
    ROUTER_PROMPT,
    ROUTER_SYSTEM,
)
from app.schemas import (
    ChatResponse,
    ChartPayload,
    EvidenceItem,
    Intent,
    RouterResult,
)
from app.tools.athena import SQLValidationError, run_query, validate_sql
from app.tools.charts import generate_chart
from app.tools.confidence import compute_confidence_summary, should_add_caveat
from app.tools.predictions import predict
from app.tools.recommendations import generate_recommendations
from app.tools.reports import generate_report_text
from app.tools.schema import explain_column, explain_table, get_catalog_info, get_schema_description

logger = logging.getLogger(__name__)

# Private data keywords that trigger refusal
PRIVATE_DATA_KEYWORDS = [
    "name", "names", "phone", "telephone", "mobile",
    "cin", "photo", "photograph", "photographs", "commcare", "identifier",
    "address", "email", "contact details",
]


def classify_intent(message: str) -> RouterResult:
    """Classify user intent using Bedrock or rule-based fallback."""
    settings = get_settings()

    # First check for private data requests
    if _is_private_data_request(message):
        return RouterResult(intent="clarification", entities={"private_data_request": True})

    # Check prediction intent early (always returns stub, no need for Bedrock)
    msg_lower = message.lower()
    pred_words = ["predict", "forecast", "risk score", "likelihood", "will happen"]
    if any(w in msg_lower for w in pred_words):
        return RouterResult(intent="prediction", entities=_extract_entities_rules(msg_lower))

    if settings.enable_bedrock:
        try:
            return _classify_with_bedrock(message)
        except Exception as e:
            logger.warning(f"Bedrock routing failed, using rules: {e}")

    return _classify_with_rules(message)


def _is_private_data_request(message: str) -> bool:
    """Check if the message is requesting private/identifying data."""
    msg_lower = message.lower()
    # Must mention both a request action and a private data type
    request_words = ["give", "show", "list", "what are", "provide", "get", "find", "tell me"]
    has_request = any(w in msg_lower for w in request_words)
    has_private = any(
        re.search(rf'\b{re.escape(kw)}', msg_lower) for kw in PRIVATE_DATA_KEYWORDS
        if kw not in ("name",)  # "name" alone is too broad
    )
    # Special case for "name" - must be in patient/person context
    if not has_private and "name" in msg_lower:
        person_context = any(w in msg_lower for w in ["patient", "person", "people", "worker", "individual"])
        has_private = person_context

    return has_request and has_private


def _classify_with_bedrock(message: str) -> RouterResult:
    """Use Bedrock to classify intent."""
    prompt = ROUTER_PROMPT.format(message=message)
    response = invoke_model(prompt, role="router", system_prompt=ROUTER_SYSTEM, temperature=0.1)

    # Parse JSON response
    try:
        # Strip any markdown code block markers
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        result = json.loads(clean)
        return RouterResult(
            intent=result.get("intent", "data_lookup"),
            entities=result.get("entities", {}),
            confidence=result.get("confidence", 0.8),
        )
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"Failed to parse router response: {e}")
        return _classify_with_rules(message)


def _classify_with_rules(message: str) -> RouterResult:
    """Rule-based intent classification fallback."""
    msg_lower = message.lower()

    # Report intent (check before chart because "paragraph" contains "graph")
    report_words = ["annual report", "report paragraph", "write a report", "write about", "report", "paragraph"]
    if any(w in msg_lower for w in report_words):
        return RouterResult(intent="report_text", entities=_extract_entities_rules(msg_lower))

    # Chart intent
    chart_words = ["chart", "plot", "visualize", "visualization", "bar chart", "pie chart", "line chart"]
    # "graph" alone but not as part of "paragraph"
    if any(w in msg_lower for w in chart_words):
        return RouterResult(intent="chart", entities=_extract_entities_rules(msg_lower))
    if "graph" in msg_lower and "paragraph" not in msg_lower:
        return RouterResult(intent="chart", entities=_extract_entities_rules(msg_lower))

    # Explanation intent
    explain_words = ["explain", "what does", "what is", "what are", "meaning", "definition", "methodology", "how is"]
    if any(w in msg_lower for w in explain_words):
        return RouterResult(intent="explanation", entities=_extract_entities_rules(msg_lower))

    # Recommendation intent
    rec_words = ["recommend", "suggestion", "improve", "should we", "what should", "advice", "prioritize"]
    if any(w in msg_lower for w in rec_words):
        return RouterResult(intent="recommendation", entities=_extract_entities_rules(msg_lower))

    # Report intent (additional patterns)
    report_words_extra = ["summarize", "summary", "write about"]
    if any(w in msg_lower for w in report_words_extra):
        return RouterResult(intent="report_text", entities=_extract_entities_rules(msg_lower))

    # Prediction intent
    pred_words = ["predict", "forecast", "risk score", "likelihood", "will happen"]
    if any(w in msg_lower for w in pred_words):
        return RouterResult(intent="prediction", entities=_extract_entities_rules(msg_lower))

    # Default: data lookup
    return RouterResult(intent="data_lookup", entities=_extract_entities_rules(msg_lower))


def _extract_entities_rules(msg_lower: str) -> dict[str, Any]:
    """Simple rule-based entity extraction."""
    entities: dict[str, Any] = {"tables": [], "metrics": [], "dimensions": [], "filters": {}}

    # Table detection
    table_keywords = {
        "tb": "tb_patient_journey",
        "tuberculosis": "tb_patient_journey",
        "screening": "tb_patient_journey",
        "ambulance": "ambulance_trips",
        "trip": "ambulance_trips",
        "cause": "ambulance_causes",
        "community": "community_workers",
        "worker": "community_workers",
        "chw": "community_workers",
        "mchp": "mchp_patient_support",
        "maternal": "mchp_patient_support",
        "patient support": "mchp_patient_support",
        "sensitization": "sensitization_activities",
        "awareness": "sensitization_activities",
    }
    for keyword, table in table_keywords.items():
        if keyword in msg_lower and table not in entities["tables"]:
            entities["tables"].append(table)

    # Dimension detection
    dimension_keywords = ["district", "site", "year", "outcome", "cause", "type"]
    for dim in dimension_keywords:
        if dim in msg_lower:
            entities["dimensions"].append(dim)

    return entities


def handle_chat(message: str, conversation_id: str | None = None) -> ChatResponse:
    """Main chat handler - routes intent and produces response."""
    settings = get_settings()
    use_bedrock = settings.enable_bedrock

    # Classify intent
    router_result = classify_intent(message)
    intent = router_result.intent
    entities = router_result.entities

    # Handle private data refusal
    if entities.get("private_data_request"):
        return ChatResponse(
            type="error",
            answer=PRIVATE_DATA_REFUSAL,
            suggested_followups=[
                "How many TB screenings are in the dataset?",
                "Show ambulance trips by district.",
                "What tables are available?",
            ],
        )

    # Route to appropriate handler
    try:
        if intent == "data_lookup":
            return _handle_data_lookup(message, entities, use_bedrock)
        elif intent == "chart":
            return _handle_chart(message, entities, use_bedrock)
        elif intent == "explanation":
            return _handle_explanation(message, entities)
        elif intent == "recommendation":
            return _handle_recommendation(message, entities, use_bedrock)
        elif intent == "report_text":
            return _handle_report(message, entities, use_bedrock)
        elif intent == "prediction":
            return _handle_prediction(message)
        elif intent == "clarification":
            return _handle_clarification(message)
        else:
            return _handle_data_lookup(message, entities, use_bedrock)
    except SQLValidationError as e:
        return ChatResponse(type="error", answer=f"Query validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Chat handler error: {e}", exc_info=True)
        return ChatResponse(
            type="error",
            answer="I encountered an error processing your question. Please try rephrasing or ask a simpler question.",
            suggested_followups=[
                "How many records are in each table?",
                "What tables are available?",
            ],
        )


def _generate_sql(message: str, entities: dict, use_bedrock: bool) -> str:
    """Generate SQL using Bedrock or fallback heuristics."""
    settings = get_settings()

    if use_bedrock:
        schema_desc = get_schema_description()
        prompt = QUERY_PROMPT.format(message=message, entities=json.dumps(entities))
        system = QUERY_SYSTEM.format(
            database=settings.athena_database,
            table_schemas=schema_desc,
            max_rows=settings.max_query_rows,
        )
        sql = invoke_model(prompt, role="query", system_prompt=system, temperature=0.1)
        # Clean potential markdown code blocks
        sql = sql.strip()
        if sql.startswith("```"):
            sql = sql.split("```")[1]
            if sql.startswith("sql"):
                sql = sql[3:]
        return sql.strip()

    # Rule-based fallback
    return _generate_sql_fallback(message, entities)


def _generate_sql_fallback(message: str, entities: dict) -> str:
    """Generate simple SQL from entities when Bedrock is unavailable."""
    tables = entities.get("tables", [])
    dimensions = entities.get("dimensions", [])

    if not tables:
        # Default to reporting_catalog for general questions
        return "SELECT table_name, row_count, domain, grain FROM reporting_catalog"

    table = tables[0]

    if dimensions:
        dim = dimensions[0]
        return f"SELECT {dim}, COUNT(*) AS count FROM {table} GROUP BY {dim} ORDER BY count DESC LIMIT 20"

    # Default: count rows
    return f"SELECT COUNT(*) AS total_count FROM {table}"


def _handle_data_lookup(message: str, entities: dict, use_bedrock: bool) -> ChatResponse:
    """Handle data_lookup intent."""
    sql = _generate_sql(message, entities, use_bedrock)
    settings = get_settings()
    validated_sql = validate_sql(sql, settings.allowed_tables_list)
    results = run_query(validated_sql)

    table_name = entities.get("tables", ["reporting data"])[0] if entities.get("tables") else "reporting data"

    # Generate answer
    if use_bedrock:
        confidence_summary = compute_confidence_summary(results, table_name)
        prompt = ANSWER_PROMPT.format(
            message=message,
            results=json.dumps(results[:30], indent=2),
            confidence_summary=confidence_summary,
        )
        answer = invoke_model(prompt, role="answer", system_prompt=ANSWER_SYSTEM)
    else:
        answer = _format_results_simple(results, message)

    # Build evidence
    evidence = []
    if results:
        evidence.append(EvidenceItem(table=table_name, metric="query_results", value=len(results)))

    # Quality note
    quality_note = None
    if results and should_add_caveat(results):
        quality_note = compute_confidence_summary(results, table_name)

    return ChatResponse(
        type="answer",
        answer=answer,
        evidence=evidence,
        quality_note=quality_note,
        suggested_followups=_suggest_followups(entities, "data_lookup"),
    )


def _handle_chart(message: str, entities: dict, use_bedrock: bool) -> ChatResponse:
    """Handle chart intent."""
    sql = _generate_sql(message, entities, use_bedrock)
    settings = get_settings()
    validated_sql = validate_sql(sql, settings.allowed_tables_list)
    results = run_query(validated_sql)

    table_name = entities.get("tables", ["reporting data"])[0] if entities.get("tables") else "reporting data"

    chart = generate_chart(message, results, use_bedrock)

    answer = f"Here are the results visualized from {table_name.replace('_', ' ')}."
    if not chart:
        answer = "I couldn't generate a chart from the available data. Here are the raw results."
        chart = ChartPayload(type="table", title="Results", xKey=None, yKey=None, data=results[:20])

    evidence = [EvidenceItem(table=table_name, metric="chart_data", value=len(results))]

    quality_note = None
    if results and should_add_caveat(results):
        quality_note = compute_confidence_summary(results, table_name)

    return ChatResponse(
        type="chart",
        answer=answer,
        chart=chart,
        evidence=evidence,
        quality_note=quality_note,
        suggested_followups=_suggest_followups(entities, "chart"),
    )


def _handle_explanation(message: str, entities: dict) -> ChatResponse:
    """Handle explanation intent."""
    msg_lower = message.lower()

    # Check if asking about a specific table
    tables = entities.get("tables", [])
    if tables:
        explanations = []
        for table in tables:
            exp = explain_table(table)
            if exp:
                explanations.append(exp)
        if explanations:
            answer = "\n\n".join(explanations)
            return ChatResponse(type="answer", answer=answer)

    # Check if asking about confidence/quality
    if any(w in msg_lower for w in ["confidence", "quality", "reliability", "trust"]):
        answer = (
            "Data confidence in this system refers to how reliable each record is:\n\n"
            "- **data_confidence_score** (0-1): A numeric reliability score.\n"
            "- **data_confidence_marker** (high/medium/low): A categorical summary.\n"
            "- **data_quality_issue_count**: How many issues were found during data processing.\n"
            "- **data_quality_highest_severity** (none/low/medium/high/critical): "
            "The worst issue severity.\n\n"
            "For official reporting, I recommend filtering to high-confidence records. "
            "Medium-confidence records are usable with caveats. Low-confidence records "
            "should be manually reviewed before use."
        )
        return ChatResponse(
            type="answer",
            answer=answer,
            suggested_followups=[
                "Show me records with low confidence scores.",
                "How many high-confidence records are in each table?",
            ],
        )

    # Check if asking about what's available
    if any(w in msg_lower for w in ["available", "tables", "what data", "what can"]):
        catalog = get_catalog_info()
        if catalog:
            lines = ["Here are the available reporting tables:\n"]
            for entry in catalog:
                lines.append(
                    f"- **{entry['table_name']}** ({entry['domain']}): "
                    f"{entry.get('description', 'N/A')} — ~{entry.get('row_count', '?')} rows"
                )
            answer = "\n".join(lines)
        else:
            answer = "The reporting catalog is not available. Please check the data directory."
        return ChatResponse(type="answer", answer=answer)

    # Generic explanation
    answer = (
        "I can explain table structures, column meanings, confidence markers, and methodology. "
        "Try asking about a specific table (e.g., 'Explain tb_patient_journey') or concept "
        "(e.g., 'What does data confidence mean?')."
    )
    return ChatResponse(
        type="clarification",
        answer=answer,
        suggested_followups=[
            "What tables are available?",
            "Explain what data confidence means.",
            "What is the tb_patient_journey table?",
        ],
    )


def _handle_recommendation(message: str, entities: dict, use_bedrock: bool) -> ChatResponse:
    """Handle recommendation intent."""
    # First get relevant data
    sql = _generate_sql(message, entities, use_bedrock)
    settings = get_settings()
    validated_sql = validate_sql(sql, settings.allowed_tables_list)
    results = run_query(validated_sql)

    table_name = entities.get("tables", ["tb_patient_journey"])[0] if entities.get("tables") else "tb_patient_journey"

    recommendation = generate_recommendations(message, results, table_name, use_bedrock)

    evidence = [EvidenceItem(table=table_name, metric="recommendation_basis", value=len(results))]
    quality_note = (
        "Recommendations are operational, not medical diagnosis. "
        "Confidence markers should be reviewed before official decisions."
    )

    return ChatResponse(
        type="recommendation",
        answer=recommendation,
        evidence=evidence,
        quality_note=quality_note,
        suggested_followups=_suggest_followups(entities, "recommendation"),
    )


def _handle_report(message: str, entities: dict, use_bedrock: bool) -> ChatResponse:
    """Handle report_text intent."""
    sql = _generate_sql(message, entities, use_bedrock)
    settings = get_settings()
    validated_sql = validate_sql(sql, settings.allowed_tables_list)
    results = run_query(validated_sql)

    table_name = entities.get("tables", ["tb_patient_journey"])[0] if entities.get("tables") else "tb_patient_journey"

    report = generate_report_text(message, results, table_name, use_bedrock)

    evidence = [EvidenceItem(table=table_name, metric="report_basis", value=len(results))]
    quality_note = compute_confidence_summary(results, table_name)

    return ChatResponse(
        type="report_text",
        answer=report,
        evidence=evidence,
        quality_note=quality_note,
        suggested_followups=_suggest_followups(entities, "report_text"),
    )


def _handle_prediction(message: str) -> ChatResponse:
    """Handle prediction intent."""
    answer = predict(message)
    return ChatResponse(
        type="answer",
        answer=answer,
        suggested_followups=[
            "Show TB patient outcomes by district.",
            "What is the average ambulance response time?",
            "Give recommendations for improving follow-up.",
        ],
    )


def _handle_clarification(message: str) -> ChatResponse:
    """Handle clarification intent."""
    return ChatResponse(
        type="clarification",
        answer="I'm not sure what you're asking. Could you be more specific? Here are some things I can help with:",
        suggested_followups=[
            "How many TB screenings are in the dataset?",
            "Show ambulance trips by district as a bar chart.",
            "Explain what data confidence means.",
            "Give recommendations for improving follow-up.",
            "Write an annual report paragraph about TB screening.",
        ],
    )


def _format_results_simple(results: list[dict], message: str) -> str:
    """Simple text formatting of query results when Bedrock is unavailable."""
    if not results:
        return "No results found for your query."

    if len(results) == 1 and len(results[0]) <= 3:
        # Single aggregate result
        parts = []
        for key, value in results[0].items():
            parts.append(f"{key.replace('_', ' ').title()}: {value}")
        return " | ".join(parts)

    # Multiple results - format as brief summary
    count = len(results)
    cols = list(results[0].keys())
    first_rows = results[:5]

    lines = [f"Found {count} results. Showing first {min(count, 5)}:\n"]
    for row in first_rows:
        row_parts = [f"{k}: {v}" for k, v in row.items() if k not in (
            "data_confidence_score", "data_confidence_marker",
            "data_quality_issue_count", "data_quality_highest_severity",
            "record_id", "source_row_id", "source_file", "source_sheet", "source_row_number",
        )]
        lines.append("- " + " | ".join(row_parts))

    return "\n".join(lines)


def _suggest_followups(entities: dict, current_intent: str) -> list[str]:
    """Generate contextual follow-up suggestions."""
    followups = []
    tables = entities.get("tables", [])

    if current_intent == "data_lookup":
        followups.append("Show this as a chart.")
        followups.append("Give me recommendations based on this data.")
    elif current_intent == "chart":
        followups.append("Explain what this data means.")
        followups.append("Write a report paragraph about these results.")
    elif current_intent == "recommendation":
        followups.append("Show the underlying data as a chart.")
        followups.append("Write an annual report paragraph about this.")
    elif current_intent == "report_text":
        followups.append("What are the key metrics behind this?")

    if tables and "tb_patient_journey" not in tables:
        followups.append("How does TB screening look by district?")

    return followups[:3]
