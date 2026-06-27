"""Basic integration tests for the chatbot API."""

import os

from fastapi.testclient import TestClient

# Ensure API_KEY is set for tests (or unset to disable auth)
os.environ.setdefault("API_KEY", "test-key-for-testing")

from app.main import app

client = TestClient(app)
HEADERS = {"X-API-Key": os.environ.get("API_KEY", "test-key-for-testing")}


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_chat_data_lookup():
    """Test a basic data lookup question."""
    response = client.post("/chat", json={
        "message": "How many TB screenings are in the dataset?",
    }, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["type"] in ("answer", "error")
    assert "answer" in data


def test_chat_chart_request():
    """Test a chart request."""
    response = client.post("/chat", json={
        "message": "Show TB screenings by district as a bar chart",
    }, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["type"] in ("chart", "answer", "error")


def test_chat_explanation():
    """Test an explanation question."""
    response = client.post("/chat", json={
        "message": "Explain what data confidence means",
    }, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "answer"
    assert "confidence" in data["answer"].lower()


def test_chat_private_data_refusal():
    """Test that private data requests are refused."""
    response = client.post("/chat", json={
        "message": "What are the phone numbers of patients?",
    }, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "can't provide" in data["answer"].lower() or "cannot" in data["answer"].lower()


def test_chat_prediction_stub():
    """Test that prediction returns a graceful stub message."""
    response = client.post("/chat", json={
        "message": "Predict which patients will be lost to follow-up",
    }, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "not yet available" in data["answer"].lower() or "future" in data["answer"].lower()


def test_schema_endpoint():
    """Test the schema endpoint."""
    response = client.get("/schema")
    assert response.status_code == 200
    data = response.json()
    assert "tables" in data
    assert "catalog" in data


def test_tables_endpoint():
    """Test the tables listing endpoint."""
    response = client.get("/tables")
    assert response.status_code == 200
    data = response.json()
    assert "tables" in data


def test_chat_empty_message_rejected():
    """Test that empty messages are rejected."""
    response = client.post("/chat", json={
        "message": "",
    }, headers=HEADERS)
    assert response.status_code == 422


def test_chat_unauthorized_without_key():
    """Test that requests without API key are rejected."""
    response = client.post("/chat", json={
        "message": "How many TB screenings?",
    })
    assert response.status_code == 401


def test_chat_unauthorized_wrong_key():
    """Test that requests with wrong API key are rejected."""
    response = client.post("/chat", json={
        "message": "How many TB screenings?",
    }, headers={"X-API-Key": "wrong-key"})
    assert response.status_code == 401
