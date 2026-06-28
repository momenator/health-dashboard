"""API routes for the health chatbot backend."""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.config import get_settings
from app.router import handle_chat
from app.schemas import ChatRequest, ChatResponse
from app.tools.schema import get_catalog_info, get_table_schemas

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
    """Generate a structured report for frontend rendering.

    Request body:
    {
        "report_type": "internal" | "donor" | "portfolio_review",
        "period": "annual_2026" | "h2_2026" | "q4_2026",
        "scope": "portfolio" | "individual",
        "project": null | "mchp_patient_support" | "ambulance_trips" | "tb_patient_journey" | "community_workers" | "sensitization_activities",
        "include_data_quality": true,
        "include_source_coverage": false
    }

    Returns structured JSON with KPIs, narratives, insights, and dashboard data
    for the frontend to render as a professional report.
    """
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
