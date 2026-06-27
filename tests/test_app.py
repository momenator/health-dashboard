"""Basic integration tests for the chatbot API."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_chat_data_lookup():
    """Test a basic data lookup question."""
    response = client.post("/chat", json={
        "message": "How many TB screenings are in the dataset?",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["type"] in ("answer", "error")
    assert "answer" in data


def test_chat_chart_request():
    """Test a chart request."""
    response = client.post("/chat", json={
        "message": "Show TB screenings by district as a bar chart",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["type"] in ("chart", "answer", "error")


def test_chat_explanation():
    """Test an explanation question."""
    response = client.post("/chat", json={
        "message": "Explain what data confidence means",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "answer"
    assert "confidence" in data["answer"].lower()


def test_chat_private_data_refusal():
    """Test that private data requests are refused."""
    response = client.post("/chat", json={
        "message": "What are the phone numbers of patients?",
    })
    assert response.status_code == 200
    data = response.json()
    assert "can't provide" in data["answer"].lower() or "cannot" in data["answer"].lower()


def test_chat_prediction_stub():
    """Test that prediction returns a graceful stub message."""
    response = client.post("/chat", json={
        "message": "Predict which patients will be lost to follow-up",
    })
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
    })
    assert response.status_code == 422
