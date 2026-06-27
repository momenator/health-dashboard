"""Chart tool - converts query results to chart-ready JSON."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.models.bedrock_client import invoke_model
from app.models.prompts import CHART_PROMPT, CHART_SYSTEM
from app.schemas import ChartPayload

logger = logging.getLogger(__name__)


def generate_chart(
    message: str,
    query_results: list[dict[str, Any]],
    use_bedrock: bool = True,
) -> ChartPayload | None:
    """Generate a chart configuration from query results.

    Uses Bedrock to determine chart type and configuration,
    or falls back to heuristic chart selection.
    """
    if not query_results:
        return None

    if use_bedrock:
        try:
            return _chart_via_bedrock(message, query_results)
        except Exception as e:
            logger.warning(f"Bedrock chart generation failed, using heuristic: {e}")

    return _chart_heuristic(message, query_results)


def _chart_via_bedrock(message: str, results: list[dict[str, Any]]) -> ChartPayload | None:
    """Use Bedrock to generate chart configuration."""
    # Limit results for the prompt
    sample = results[:50]
    prompt = CHART_PROMPT.format(message=message, results=json.dumps(sample, indent=2))

    response = invoke_model(prompt, role="chart", system_prompt=CHART_SYSTEM)

    # Parse JSON from response
    try:
        # Try to extract JSON from the response
        json_str = response.strip()
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        chart_data = json.loads(json_str)
        return ChartPayload(**chart_data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse chart JSON from Bedrock: {e}")
        return _chart_heuristic(message, results)


def _chart_heuristic(message: str, results: list[dict[str, Any]]) -> ChartPayload | None:
    """Fallback heuristic chart generation."""
    if not results:
        return None

    columns = list(results[0].keys())

    # Filter out metadata/confidence columns for axis selection
    skip_cols = {
        "data_confidence_score", "data_confidence_marker",
        "data_quality_issue_count", "data_quality_highest_severity",
        "record_id", "source_row_id", "source_file", "source_sheet",
        "source_row_number", "domain", "grain",
    }
    data_cols = [c for c in columns if c not in skip_cols]

    if len(data_cols) < 2:
        return ChartPayload(
            type="table",
            title="Results",
            xKey=None,
            yKey=None,
            data=results[:20],
        )

    # Detect numeric column for Y axis
    y_col = None
    for col in data_cols:
        try:
            float(results[0].get(col, ""))
            y_col = col
            break
        except (ValueError, TypeError):
            continue

    # X axis is first non-numeric data column
    x_col = None
    for col in data_cols:
        if col != y_col:
            x_col = col
            break

    if not x_col or not y_col:
        return ChartPayload(type="table", title="Results", xKey=None, yKey=None, data=results[:20])

    # Determine chart type
    chart_type = "bar"
    message_lower = message.lower()
    if any(w in message_lower for w in ["trend", "time", "over time", "timeline", "evolution"]):
        chart_type = "line"
    elif any(w in message_lower for w in ["proportion", "percentage", "share", "pie"]):
        if len(results) <= 8:
            chart_type = "pie"

    # Clean data for chart
    chart_data = []
    for row in results[:50]:
        chart_data.append({x_col: row.get(x_col, ""), y_col: row.get(y_col, "")})

    title_parts = y_col.replace("_", " ").title()
    x_parts = x_col.replace("_", " ").title()
    title = f"{title_parts} by {x_parts}"

    return ChartPayload(
        type=chart_type,
        title=title,
        xKey=x_col,
        yKey=y_col,
        data=chart_data,
    )
