"""API routes for the health chatbot backend."""

import logging
import re
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile

from app.core.config import get_settings
from app.router import handle_chat
from app.schemas import ChatRequest, ChatResponse, UploadSanitizationResponse
from app.tools.pii import convert_xlsx_to_csv, sanitize_uploaded_csv
from app.tools.schema import get_catalog_info, get_table_schemas

logger = logging.getLogger(__name__)

router = APIRouter()


def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> None:
    """Verify the API key from request headers.

    If API_KEY is not set in environment, authentication is disabled (open access).
    """
    settings = get_settings()
    expected_key = settings.api_key
    if not expected_key:
        # No key configured = open access (for development)
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    _: None = Depends(verify_api_key),
) -> ChatResponse:
    """Main chat endpoint.

    Accepts a user message, classifies intent, queries data,
    and returns a structured response.

    Requires X-API-Key header when API_KEY is configured.
    """
    try:
        response = handle_chat(
            message=request.message,
            conversation_id=request.conversation_id,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post("/report/annual")
async def annual_report_endpoint(
    year: str | None = None,
    _: None = Depends(verify_api_key),
) -> dict:
    """Generate an annual PDF report from all CSV data."""
    from app.tools.annual_report import generate_annual_report
    try:
        output_path = generate_annual_report(year=year)
        return {"status": "ok", "path": str(output_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/map-events")
async def map_events_endpoint(year: str = "current") -> dict:
    """Return GeoJSON FeatureCollection of map events.

    Only includes records with verified coordinates.
    Uses GPS from CSVs or locations_master.csv lookup.
    Never invents coordinates.
    """
    from app.tools.map_events import generate_map_events

    try:
        return generate_map_events(year=year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/map-events/refresh")
async def map_events_refresh_endpoint(
    year: str = "current",
    _: None = Depends(verify_api_key),
) -> dict:
    """Re-read CSVs and rebuild map event data.

    Returns fresh GeoJSON metadata and refresh status.
    """
    from app.tools.map_events import generate_map_events

    try:
        result = generate_map_events(year=year)
        return {
            "status": "refreshed",
            "metadata": result["metadata"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/location-news")
async def location_news_endpoint(
    lat: float | None = None,
    lon: float | None = None,
    location: str | None = None,
    district: str | None = None,
    region: str | None = None,
    radius_km: int = 50,
) -> dict:
    """Get location-based news for a map marker.

    Uses web search with fallback hierarchy and Groq for summarization.
    Groq API key is server-side only, never exposed to frontend.
    Results cached for 24 hours.
    """
    from app.tools.location_news import get_location_news

    try:
        return get_location_news(
            lat=lat,
            lon=lon,
            location=location,
            district=district,
            region=region,
            radius_km=radius_km,
        )
    except Exception as e:
        logger.error(f"Location news failed: {e}")
        # Return empty items, never 404
        return {
            "location_context": {
                "location": location,
                "district": district,
                "region": region,
                "lat": lat,
                "lon": lon,
                "radius_km": radius_km,
                "search_level_used": None,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "cache_ttl_hours": 24,
            "items": [],
        }


@router.post("/report/annual/download")
async def annual_report_download_endpoint(
    year: str | None = None,
    _: None = Depends(verify_api_key),
):
    """Generate and download an annual PDF report."""
    from fastapi.responses import FileResponse
    from app.tools.annual_report import generate_annual_report
    try:
        output_path = generate_annual_report(year=year)
        return FileResponse(path=str(output_path), media_type="application/pdf", filename=output_path.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report/generate")
async def generate_structured_report(
    request: dict,
    _: None = Depends(verify_api_key),
) -> dict:
    """Generate a structured report for frontend rendering."""
    from app.tools.report_generator import generate_report
    try:
        result = generate_report(
            report_type=request.get("report_type", "internal"),
            period=request.get("period", "annual_2026"),
            scope=request.get("scope", "portfolio"),
            project=request.get("project"),
            include_data_quality=request.get("include_data_quality", True),
            include_source_coverage=request.get("include_source_coverage", False),
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-data", response_model=UploadSanitizationResponse)
async def upload_data(
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
) -> UploadSanitizationResponse:
    """Upload a CSV/XLSX and publish only a sanitized copy for downstream analysis.

    The upload pipeline:
    1. Accepts CSV or XLSX file
    2. Stores raw file in a secure location (not accessible to queries)
    3. Converts XLSX to CSV if needed
    4. Runs PII sanitization (removes name/phone/CIN/photo columns, redacts PII patterns)
    5. Writes sanitized CSV to the reporting data directory
    6. Returns a report of what was removed/redacted

    The chatbot and report tools can then query the sanitized dataset.
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
        # Save raw upload
        with raw_path.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        sanitized_path = Path(settings.data_dir) / f"{table_name}.csv"
        sanitizer_input_path = raw_path
        converted_path: Path | None = None

        # Convert XLSX to CSV if needed
        if suffix == ".xlsx":
            converted_path = raw_dir / f"{table_name}.converted.csv"
            convert_xlsx_to_csv(raw_path, converted_path)
            sanitizer_input_path = converted_path

        # Run PII sanitization
        report = sanitize_uploaded_csv(
            sanitizer_input_path,
            sanitized_path,
            original_filename=filename,
            script_path=settings.pii_sanitizer_script,
        )

        # Cleanup intermediate file
        if converted_path and converted_path.exists():
            converted_path.unlink()

        # Clear schema cache so new table is discoverable
        get_table_schemas.cache_clear()

    except Exception as e:
        # Quarantine the failed upload
        quarantine_dir = Path(settings.upload_quarantine_dir)
        quarantine_dir.mkdir(parents=True, exist_ok=True)
        if raw_path.exists():
            raw_path.replace(quarantine_dir / raw_path.name)
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {str(e)}")

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


def _table_name_from_filename(filename: str) -> str:
    """Convert a filename to a safe table name."""
    stem = Path(filename).stem.lower()
    table_name = re.sub(r"[^a-z0-9_]+", "_", stem).strip("_")
    if not table_name:
        table_name = "uploaded_dataset"
    if not table_name.startswith("uploaded_"):
        table_name = f"uploaded_{table_name}"
    return table_name[:80]
