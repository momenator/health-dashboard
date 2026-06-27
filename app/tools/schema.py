"""Schema tool - loads table schemas from local CSVs or Glue catalog."""

from __future__ import annotations

import csv
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_table_schemas() -> dict[str, list[str]]:
    """Load column names for each allowed reporting table from local CSV files.

    Returns:
        Dict mapping table_name -> list of column names.
    """
    settings = get_settings()
    data_dir = Path(settings.data_dir)
    schemas: dict[str, list[str]] = {}

    for table_name in settings.allowed_tables_list:
        csv_path = data_dir / f"{table_name}.csv"
        if csv_path.exists():
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                headers = next(reader, None)
                if headers:
                    schemas[table_name] = headers
        else:
            logger.warning(f"CSV file not found for table: {table_name} at {csv_path}")

    return schemas


def get_schema_description() -> str:
    """Get a formatted string of all table schemas for use in prompts."""
    schemas = get_table_schemas()
    lines = []
    for table_name, columns in schemas.items():
        lines.append(f"Table: {table_name}")
        lines.append(f"  Columns: {', '.join(columns)}")
        lines.append("")
    return "\n".join(lines)


def get_catalog_info() -> list[dict[str, Any]]:
    """Load the reporting_catalog.csv as structured data."""
    settings = get_settings()
    catalog_path = Path(settings.data_dir) / "reporting_catalog.csv"
    if not catalog_path.exists():
        return []

    with open(catalog_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def explain_table(table_name: str) -> str | None:
    """Get a human-readable explanation of a table from the catalog."""
    catalog = get_catalog_info()
    for entry in catalog:
        if entry.get("table_name") == table_name:
            return (
                f"Table '{table_name}' is in the '{entry.get('domain', 'unknown')}' domain. "
                f"Grain: {entry.get('grain', 'unknown')}. "
                f"Contains approximately {entry.get('row_count', 'unknown')} rows. "
                f"Description: {entry.get('description', 'No description available')}."
            )
    return None


def explain_column(column_name: str) -> str:
    """Provide a generic explanation for known column types."""
    confidence_columns = {
        "data_confidence_score": "A numeric score (0-1) indicating how reliable this record's data is.",
        "data_confidence_marker": "A categorical marker (high/medium/low) summarizing confidence level.",
        "data_quality_issue_count": "The number of data quality issues detected in this record.",
        "data_quality_highest_severity": "The highest severity of any data quality issue (none/low/medium/high/critical).",
    }
    metadata_columns = {
        "domain": "The health program domain this record belongs to (e.g., tuberculosis, emergency, maternal_child_health).",
        "grain": "The level of detail or unit of observation for this record.",
        "record_id": "A unique anonymized identifier for this record.",
        "source_row_id": "Internal reference to the original data row (for traceability, not for analysis).",
        "source_file": "The source file this record was derived from.",
        "source_sheet": "The worksheet within the source file.",
        "source_row_number": "The row number in the source worksheet.",
        "year": "The calendar year this record pertains to.",
    }

    if column_name in confidence_columns:
        return confidence_columns[column_name]
    if column_name in metadata_columns:
        return metadata_columns[column_name]
    return f"Column '{column_name}' - check the table schema for context."
