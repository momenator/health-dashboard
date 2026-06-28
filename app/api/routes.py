"""API routes for the health chatbot backend."""

import re
import shutil
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.router import handle_chat
from app.schemas import ChatRequest, ChatResponse, PublicContextResponse, UploadSanitizationResponse
from app.tools.pii import convert_xlsx_to_csv, sanitize_uploaded_csv
from app.tools.public_context import fetch_public_context
from app.tools.schema import get_catalog_info, get_table_schemas

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Main chat endpoint.

    Accepts a user message, classifies intent, queries data,
    and returns a structured response.
    """
    try:
        response = handle_chat(
            message=request.message,
            conversation_id=request.conversation_id,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-data", response_model=UploadSanitizationResponse)
async def upload_data(file: UploadFile = File(...)) -> UploadSanitizationResponse:
    """Upload a CSV/XLSX and publish only a sanitized copy for downstream analysis.

    Raw uploads are stored outside the reporting directory. The query/chat stack
    only sees the sanitized CSV written to ``settings.data_dir``.
    """
    settings = get_settings()
    filename = file.filename or "uploaded.csv"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="Only CSV and XLSX uploads are supported.")

    table_name = _table_name_from_filename(filename)
    raw_dir = Path(settings.upload_raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"{table_name}{suffix}"

    try:
        with raw_path.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        sanitized_path = Path(settings.data_dir) / f"{table_name}.csv"
        sanitizer_input_path = raw_path
        converted_path: Path | None = None
        if suffix == ".xlsx":
            converted_path = raw_dir / f"{table_name}.converted.csv"
            convert_xlsx_to_csv(raw_path, converted_path)
            sanitizer_input_path = converted_path

        report = sanitize_uploaded_csv(
            sanitizer_input_path,
            sanitized_path,
            original_filename=filename,
            script_path=settings.pii_sanitizer_script,
        )
        if converted_path and converted_path.exists():
            converted_path.unlink()
        get_table_schemas.cache_clear()
    except Exception as e:
        quarantine_dir = Path(settings.upload_quarantine_dir)
        quarantine_dir.mkdir(parents=True, exist_ok=True)
        if raw_path.exists():
            raw_path.replace(quarantine_dir / raw_path.name)
        if "converted_path" in locals() and converted_path and converted_path.exists():
            converted_path.replace(quarantine_dir / converted_path.name)
        raise HTTPException(status_code=422, detail=f"PII sanitization failed: {e}") from e

    return UploadSanitizationResponse(
        table_name=table_name,
        original_filename=report.original_filename,
        sanitized_filename=report.sanitized_filename,
        row_count=report.row_count,
        original_columns=report.original_columns,
        retained_columns=report.retained_columns,
        removed_columns=report.removed_columns,
        pseudonymized_columns=report.pseudonymized_columns,
        redacted_cells=report.redacted_cells,
        external_script_used=report.external_script_used,
        message="Upload accepted. Only the sanitized dataset is available to downstream analysis.",
    )


@router.get("/external-context", response_model=PublicContextResponse)
async def external_context(
    project_id: str | None = None,
    region: str | None = None,
    changes: str | None = None,
    limit: int = 6,
) -> PublicContextResponse:
    """Return public news/context signals for uploaded M&E datasets and reports."""
    try:
        return fetch_public_context(
            project_id=project_id,
            region=region,
            changes=changes,
            limit=max(1, min(limit, 10)),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Public context lookup failed: {e}") from e


@router.get("/schema")
async def get_schema() -> dict:
    """Return available table schemas for debugging/frontend use."""
    schemas = get_table_schemas()
    catalog = get_catalog_info()
    return {
        "tables": schemas,
        "catalog": catalog,
    }


@router.get("/tables")
async def list_tables() -> dict:
    """List available reporting tables."""
    catalog = get_catalog_info()
    return {"tables": catalog}


def _table_name_from_filename(filename: str) -> str:
    stem = Path(filename).stem.lower()
    table_name = re.sub(r"[^a-z0-9_]+", "_", stem).strip("_")
    if not table_name:
        table_name = "uploaded_dataset"
    if not table_name.startswith("uploaded_"):
        table_name = f"uploaded_{table_name}"
    return table_name[:80]
