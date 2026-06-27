"""FastAPI application entry point for the AI4Good Health Chatbot."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    description="AI-powered health program chatbot backend using Amazon Bedrock and Athena",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict:
    """Health check endpoint."""
    return {
        "status": "ok",
        "environment": settings.app_env,
        "bedrock_enabled": settings.enable_bedrock,
    }


app.include_router(api_router)
