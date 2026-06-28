"""Tests for model invocation."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import model_client


@dataclass
class FakeSettings:
    enable_openai: bool


def test_openai_used_when_enabled(monkeypatch):
    monkeypatch.setattr(
        model_client,
        "get_settings",
        lambda: FakeSettings(enable_openai=True),
    )
    monkeypatch.setattr(
        model_client.openai_client,
        "invoke_model",
        lambda *args, **kwargs: "from openai",
    )

    assert model_client.invoke_model("hello") == "from openai"


def test_disabled_provider_returns_empty_string(monkeypatch):
    monkeypatch.setattr(
        model_client,
        "get_settings",
        lambda: FakeSettings(enable_openai=False),
    )

    assert model_client.invoke_model("hello") == ""
