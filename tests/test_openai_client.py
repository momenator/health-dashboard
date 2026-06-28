"""Tests for OpenAI model invocation."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import openai_client


@dataclass
class FakeSettings:
    enable_openai: bool = True
    openai_api_key: str = "test-key"

    def get_openai_model_id(self, role: str) -> str:
        return f"fake-{role}-model"


class FakeResponse:
    output_text = "ok from openai"


class FakeResponses:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return FakeResponse()


class FakeOpenAIClient:
    def __init__(self):
        self.responses = FakeResponses()


def test_openai_responses_api_invocation(monkeypatch):
    fake_client = FakeOpenAIClient()
    monkeypatch.setattr(openai_client, "get_settings", lambda: FakeSettings())
    monkeypatch.setattr(openai_client, "_get_client", lambda: fake_client)

    result = openai_client.invoke_model(
        "hello",
        role="router",
        system_prompt="system",
        max_tokens=123,
        temperature=0.2,
    )

    assert result == "ok from openai"
    assert fake_client.responses.calls == [
        {
            "model": "fake-router-model",
            "input": "hello",
            "max_output_tokens": 123,
            "store": False,
            "instructions": "system",
        }
    ]
