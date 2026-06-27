"""Amazon Bedrock client wrapper for multi-role model invocation."""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
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
        _client = session.client("bedrock-runtime", config=boto_config)
    return _client


def invoke_model(
    prompt: str,
    role: str = "answer",
    system_prompt: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.3,
) -> str:
    """Invoke a Bedrock model with the given prompt and role.

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

    if not settings.enable_bedrock:
        logger.warning("Bedrock is disabled. Returning empty response.")
        return ""

    model_id = settings.get_model_id(role)
    client = _get_client()

    messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]

    body: dict[str, Any] = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }

    if system_prompt:
        body["system"] = [{"type": "text", "text": system_prompt}]

    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body),
        )
        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"]
    except Exception as e:
        logger.error(f"Bedrock invocation failed for role={role}: {e}")
        raise
