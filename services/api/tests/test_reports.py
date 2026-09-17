from datetime import UTC, datetime
from uuid import UUID

from fastapi.testclient import TestClient

from app.api.routes import reports as report_routes
from app.core.config import settings
from app.main import app
from app.schemas.reports import CreateReportResponse
from app.services.reports import normalize_phone_number

client = TestClient(app)
IDEMPOTENCY_KEY = "0f6cb078-95d7-45f1-a6cf-5df4df2cf3f1"


def report_payload():
    return {
        "sender_phone_number": "+62 812-3456-7890",
        "category": "infrastructure",
        "description": "Jalan di RT 03 rusak parah.",
        "location": {
            "text": "RT 03 dekat masjid",
            "latitude": None,
            "longitude": None,
        },
        "urgency": "high",
        "original_text": "Pak, jalan di RT 03 dekat masjid rusak parah.",
        "source": "whatsapp",
        "ai_analysis": {
            "confidence": 0.94,
            "summary": "Kerusakan jalan di RT 03 dekat masjid.",
        },
    }


def created_report():
    return CreateReportResponse(
        id=UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
        ticket_number="LP-2026-0001",
        status="pending_verification",
        created_at=datetime(2026, 9, 17, tzinfo=UTC),
    )


def test_normalizes_indonesian_phone_number():
    assert normalize_phone_number("0812-3456-7890") == "+6281234567890"


def test_create_report_returns_201(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", "test-secret")
    monkeypatch.setattr(
        report_routes,
        "create_report",
        lambda _payload, _key: (created_report(), False),
    )

    response = client.post(
        "/api/v1/reports",
        json=report_payload(),
        headers={
            "Idempotency-Key": IDEMPOTENCY_KEY,
            "X-OpenClaw-API-Key": "test-secret",
        },
    )

    assert response.status_code == 201
    assert response.json()["ticket_number"] == "LP-2026-0001"


def test_idempotent_replay_returns_200(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", "test-secret")
    monkeypatch.setattr(
        report_routes,
        "create_report",
        lambda _payload, _key: (created_report(), True),
    )

    response = client.post(
        "/api/v1/reports",
        json=report_payload(),
        headers={
            "Idempotency-Key": IDEMPOTENCY_KEY,
            "X-OpenClaw-API-Key": "test-secret",
        },
    )

    assert response.status_code == 200


def test_rejects_invalid_openclaw_key(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", "test-secret")

    response = client.post(
        "/api/v1/reports",
        json=report_payload(),
        headers={
            "Idempotency-Key": IDEMPOTENCY_KEY,
            "X-OpenClaw-API-Key": "wrong-secret",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_rejects_incomplete_location(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", "test-secret")
    payload = report_payload()
    payload["location"] = {"text": None, "latitude": -7.1, "longitude": None}

    response = client.post(
        "/api/v1/reports",
        json=payload,
        headers={
            "Idempotency-Key": IDEMPOTENCY_KEY,
            "X-OpenClaw-API-Key": "test-secret",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
