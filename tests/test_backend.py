"""Tests for the backend Flask application."""

import pytest

from backend.app.main import app


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.data == b"ok"


def test_relay_endpoint_post(client):
    """Test the relay endpoint with POST method."""
    response = client.post(
        "/api/relay",
        json={"message": "World"},
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["echo"] == "Hello World"
    assert data["from"] == "backend"


def test_relay_endpoint_get(client):
    """Test the relay endpoint with GET method."""
    response = client.get("/api/relay?message=Test")
    assert response.status_code == 200
    data = response.get_json()
    assert data["echo"] == "Hello Test"
    assert data["from"] == "backend"


def test_relay_endpoint_empty_message(client):
    """Test the relay endpoint with empty message."""
    response = client.post("/api/relay", json={})
    assert response.status_code == 200
    data = response.get_json()
    assert data["echo"] == "Hello "
    assert data["from"] == "backend"
