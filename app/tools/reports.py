"""Report tool - generates annual-report style text from data."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.models.bedrock_client import invoke_model
from app.models.prompts import REPORT_PROMPT, REPORT_SYSTEM
from app.tools.confidence import compute_confidence_summary

logger = logging.getLogger(__name__)


def generate_report_text(
    message: str,
    evidence_data: list[dict[str, Any]],
    table_name: str,
    use_bedrock: bool = True,
) -> str:
    """Generate polished annual-report style paragraphs.

    Args:
        message: The user's original question.
        evidence_data: Query results to write about.
        table_name: Source table name.
        use_bedrock: Whether to use Bedrock or return a placeholder.

    Returns:
        Report text paragraph(s).
    """
    confidence_summary = compute_confidence_summary(evidence_data, table_name)

    if not use_bedrock:
        return _fallback_report(evidence_data, table_name, confidence_summary)

    evidence_sample = evidence_data[:30]
    prompt = REPORT_PROMPT.format(
        message=message,
        evidence=json.dumps(evidence_sample, indent=2),
        confidence_summary=confidence_summary,
    )

    try:
        response = invoke_model(
            prompt,
            role="report",
            system_prompt=REPORT_SYSTEM,
        )
        return response
    except Exception as e:
        logger.error(f"Bedrock report generation failed: {e}")
        return _fallback_report(evidence_data, table_name, confidence_summary)


def _fallback_report(
    data: list[dict[str, Any]], table_name: str, confidence_summary: str
) -> str:
    """Generate a placeholder report paragraph when Bedrock is unavailable."""
    row_count = len(data)
    return (
        f"During the reporting period, the {table_name.replace('_', ' ')} dataset captured "
        f"{row_count} records across multiple districts and sites. "
        f"Further analysis of these records provides insights into program performance "
        f"and areas requiring attention.\n\n"
        f"Data quality note: {confidence_summary}"
    )
