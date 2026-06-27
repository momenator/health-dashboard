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
