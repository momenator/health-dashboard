"""Model invocation wrapper."""

from __future__ import annotations

from app.core.config import get_settings
from app.models import openai_client


def invoke_model(
    prompt: str,
    role: str = "answer",
    system_prompt: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.3,
) -> str:
    """Invoke OpenAI when model calling is enabled."""
    settings = get_settings()
    if settings.enable_openai:
        return openai_client.invoke_model(
            prompt,
            role=role,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    return ""
