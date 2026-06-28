"""API routes for the health chatbot backend."""

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.config import get_settings
from app.router import handle_chat
from app.schemas import ChatRequest, ChatResponse
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
