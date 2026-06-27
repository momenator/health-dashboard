"""Prediction tool - stub for future risk scoring capabilities."""

from __future__ import annotations


PREDICTION_NOT_AVAILABLE_MESSAGE = (
    "Prediction and risk scoring capabilities are not yet available in this version. "
    "Future updates will support:\n"
    "- Lost-to-follow-up risk scoring for TB patients\n"
    "- Ambulance delay risk prediction\n"
    "- Community health coverage gap identification\n\n"
    "For now, I can help with data lookups, charts, explanations, "
    "recommendations, and report writing based on the available reporting data."
)


def predict(message: str) -> str:
    """Stub prediction handler.

    Returns a graceful message indicating the feature is not yet available.
    """
    return PREDICTION_NOT_AVAILABLE_MESSAGE
