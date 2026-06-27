"""Confidence tool - generates quality caveats from confidence columns."""

from __future__ import annotations

from typing import Any


def compute_confidence_summary(rows: list[dict[str, Any]], table_name: str) -> str:
    """Analyze confidence columns in query results and produce a caveat string.

    Args:
        rows: Query result rows.
        table_name: The source table name.

    Returns:
        A human-readable confidence summary / caveat.
    """
    if not rows:
        return "No data returned — confidence assessment not applicable."

    total = len(rows)
    high = 0
    medium = 0
    low = 0
    issues_total = 0
    critical_count = 0

    for row in rows:
        marker = str(row.get("data_confidence_marker", "")).lower()
        if marker == "high":
            high += 1
        elif marker == "medium":
            medium += 1
        elif marker == "low":
            low += 1

        try:
            issues_total += int(row.get("data_quality_issue_count", 0))
        except (ValueError, TypeError):
            pass

        severity = str(row.get("data_quality_highest_severity", "")).lower()
        if severity in ("high", "critical"):
            critical_count += 1

    # Build summary
    parts = [f"This answer uses {table_name}."]

    if high == total:
        parts.append("All records have high confidence.")
    elif low == 0:
        parts.append(f"The result includes {high} high and {medium} medium confidence rows.")
    else:
        parts.append(
            f"The result includes {high} high, {medium} medium, and {low} low confidence rows."
        )
        parts.append("For official reporting, review low-confidence records.")

    if critical_count > 0:
        parts.append(
            f"{critical_count} record(s) have high/critical severity quality issues."
        )

    if issues_total > 0:
        parts.append(f"Total data quality issues across results: {issues_total}.")

    return " ".join(parts)


def should_add_caveat(rows: list[dict[str, Any]]) -> bool:
    """Determine if a confidence caveat should be included in the response."""
    for row in rows:
        marker = str(row.get("data_confidence_marker", "")).lower()
        if marker in ("low", "medium"):
            return True
        severity = str(row.get("data_quality_highest_severity", "")).lower()
        if severity in ("high", "critical"):
            return True
    return False
