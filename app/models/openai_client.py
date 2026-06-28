"""OpenAI Responses API client wrapper for multi-role model invocation."""

from __future__ import annotations

import logging
from typing import Any

from openai import OpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when ENABLE_OPENAI=true.")
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def invoke_model(
    prompt: str,
    role: str = "answer",
    system_prompt: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.3,
) -> str:
    """Invoke an OpenAI model through the Responses API."""
    settings = get_settings()
    if not settings.enable_openai:
        logger.warning("OpenAI is disabled. Returning empty response.")
        return ""

    model_id = settings.get_openai_model_id(role)
    client = _get_client()

    kwargs: dict[str, Any] = {
        "model": model_id,
        "input": prompt,
        "max_output_tokens": max_tokens,
        "store": False,
    }
    if system_prompt:
        kwargs["instructions"] = system_prompt
    # Some current reasoning models reject temperature. Keep sampling defaults
    # provider-side rather than failing model calls.

    try:
        response = client.responses.create(**kwargs)
    except Exception as e:
        logger.error(f"OpenAI invocation failed for role={role}, model={model_id}: {e}")
        raise

    text = getattr(response, "output_text", None)
    if text:
        return text

    return _extract_response_text(response)


def _extract_response_text(response: Any) -> str:
    """Extract text from the Responses API object if output_text is unavailable."""
    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                parts.append(text)
    if parts:
        return "\n".join(parts)
    raise ValueError("OpenAI response did not contain text output.")
