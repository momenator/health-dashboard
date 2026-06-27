"""API routes for the health chatbot backend."""

from fastapi import APIRouter, HTTPException

from app.router import handle_chat
from app.schemas import ChatRequest, ChatResponse
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
