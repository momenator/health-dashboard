"""LLM client wrapper - supports OpenAI and Amazon Bedrock.

Uses OpenAI by default (set OPENAI_API_KEY). Falls back to Bedrock if
ENABLE_BEDROCK=true and no OpenAI key is set.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_openai_client = None
_bedrock_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI

        settings = get_settings()
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client


def _get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        import boto3
        from botocore.config import Config as BotoConfig

        settings = get_settings()
        boto_config = BotoConfig(
            region_name=settings.aws_region,
            retries={"max_attempts": 3, "mode": "adaptive"},
        )
        session_kwargs: dict[str, Any] = {}
        if settings.aws_access_key_id:
            session_kwargs["aws_access_key_id"] = settings.aws_access_key_id
        if settings.aws_secret_access_key:
            session_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            session_kwargs["aws_session_token"] = settings.aws_session_token
        session = boto3.Session(**session_kwargs)
        _bedrock_client = session.client("bedrock-runtime", config=boto_config)
    return _bedrock_client


def _use_openai() -> bool:
    """Determine whether to use OpenAI based on config."""
    settings = get_settings()
    return bool(settings.openai_api_key)


def invoke_model(
    prompt: str,
    role: str = "answer",
    system_prompt: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.3,
) -> str:
    """Invoke an LLM (OpenAI or Bedrock) with a unified interface.

    Args:
        prompt: The user message / prompt content.
        role: One of router, query, answer, chart, recommendation, report.
        system_prompt: Optional system prompt for additional instructions.
        max_tokens: Maximum tokens in response.
        temperature: Sampling temperature.

    Returns:
        The model's text response.
    """
    settings = get_settings()

    if _use_openai():
        return _invoke_openai(prompt, role, system_prompt, max_tokens, temperature)

    if not settings.enable_bedrock:
        logger.warning("No LLM backend configured. Set OPENAI_API_KEY or ENABLE_BEDROCK=true.")
        return ""

    return _invoke_bedrock(prompt, role, system_prompt, max_tokens, temperature)


def _invoke_openai(
    prompt: str,
    role: str,
    system_prompt: str | None,
    max_tokens: int,
    temperature: float,
) -> str:
    """Call OpenAI Chat Completions API."""
    settings = get_settings()
    client = _get_openai_client()
    model = settings.openai_model_id

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"OpenAI invocation failed for role={role}, model={model}: {e}")
        raise


def _invoke_bedrock(
    prompt: str,
    role: str,
    system_prompt: str | None,
    max_tokens: int,
    temperature: float,
) -> str:
    """Call Amazon Bedrock Converse API."""
    settings = get_settings()
    model_id = settings.get_model_id(role)
    client = _get_bedrock_client()

    messages = [{"role": "user", "content": [{"text": prompt}]}]

    kwargs: dict[str, Any] = {
        "modelId": model_id,
        "messages": messages,
        "inferenceConfig": {
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    }

    if system_prompt:
        kwargs["system"] = [{"text": system_prompt}]

    try:
        response = client.converse(**kwargs)
        return response["output"]["message"]["content"][0]["text"]
    except Exception as e:
        logger.error(f"Bedrock invocation failed for role={role}, model={model_id}: {e}")
        raise
