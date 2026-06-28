"""Tests for public context lookup."""

from fastapi.testclient import TestClient

from app.main import app
from app.tools import public_context


client = TestClient(app)


def test_external_context_endpoint_uses_public_article_candidates(monkeypatch):
    class FakeSettings:
        enable_groq_context = False
        groq_api_key = None

    monkeypatch.setattr(public_context, "get_settings", lambda: FakeSettings())
    monkeypatch.setattr(
        public_context,
        "_fetch_gdelt",
        lambda **kwargs: [
            {
                "title": "Cyclone disrupts roads in southern Madagascar",
                "url": "https://example.org/cyclone-road-disruption",
                "domain": "example.org",
                "seendate": "20260615093000",
                "sourcecountry": "Madagascar",
            }
        ],
    )

    response = client.get(
        "/external-context",
        params={
            "project_id": "mchp",
            "region": "South",
            "changes": "Antenatal visits declined after outreach disruption.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["generated_by"] == "heuristic"
    assert payload["items"]
    assert payload["items"][0]["category"] == "cyclone"
    assert "possible explanations" in payload["note"].lower()


def test_external_context_endpoint_falls_back_when_public_feed_fails(monkeypatch):
    class FakeSettings:
        enable_groq_context = False
        groq_api_key = None

    monkeypatch.setattr(public_context, "get_settings", lambda: FakeSettings())

    def fail_fetch(**kwargs):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(public_context, "_fetch_gdelt", fail_fetch)

    response = client.get("/external-context", params={"project_id": "mchp", "region": "South"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "Curated Madagascar context fallback"
    assert payload["items"]
