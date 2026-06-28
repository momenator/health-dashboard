"""Recommendation tool - generates evidence-based operational recommendations."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.models.model_client import invoke_model
from app.models.prompts import RECOMMENDATION_PROMPT, RECOMMENDATION_SYSTEM
from app.tools.confidence import compute_confidence_summary
from app.tools.schema import get_dataset_catalog_context

logger = logging.getLogger(__name__)


def generate_recommendations(
    message: str,
    evidence_data: list[dict[str, Any]],
    table_name: str,
    use_model: bool = True,
) -> str:
    """Generate operational recommendations based on data evidence.

    Args:
        message: The user's original question.
        evidence_data: Query results used as evidence.
        table_name: The table the data came from.
        use_model: Whether to use the configured model or return a placeholder.

    Returns:
        Recommendation text.
    """
    confidence_summary = compute_confidence_summary(evidence_data, table_name)

    if not use_model:
        return _fallback_recommendation(evidence_data, table_name, confidence_summary)

    # Prepare evidence for prompt (limit size)
    evidence_sample = evidence_data[:30]
    prompt = RECOMMENDATION_PROMPT.format(
        message=message,
        dataset_catalog=get_dataset_catalog_context(),
        table_name=table_name,
        row_count=len(evidence_data),
        evidence=json.dumps(evidence_sample, indent=2),
        confidence_summary=confidence_summary,
    )

    try:
        response = invoke_model(
            prompt,
            role="recommendation",
            system_prompt=RECOMMENDATION_SYSTEM,
            max_tokens=3072,
        )
        return response
    except Exception as e:
        logger.error(f"Model recommendation failed: {e}")
        return _fallback_recommendation(evidence_data, table_name, confidence_summary)


def _fallback_recommendation(
    data: list[dict[str, Any]], table_name: str, confidence_summary: str
) -> str:
    """Generate a simple fallback recommendation when the model is unavailable."""
    row_count = len(data)
    return (
        f"Based on {row_count} records from {table_name}, here are operational considerations:\n\n"
        f"1. Review districts/sites with the highest activity volumes for resource allocation.\n"
        f"2. Investigate records with low confidence scores before using them in official reports.\n"
        f"3. Monitor trends over time to identify areas needing intervention.\n\n"
        f"Note: {confidence_summary}\n\n"
        f"These recommendations are operational, not medical diagnoses. "
        f"Confidence markers should be reviewed before official decisions."
    )
