from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.api.routes import enhanced as enhanced_routes
from app.core.config import settings
from app.db.session import get_db_session
from app.main import app

HEADERS = {
    "X-OpenClaw-API-Key": "test-secret",
    "X-Channel-Account-ID": "whatsapp-demo",
}


@pytest.fixture(autouse=True)
def configure_dependencies(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("test-secret"))
    app.dependency_overrides[get_db_session] = lambda: object()
    yield
    app.dependency_overrides.clear()


def test_detect_emergency_is_deterministic():
    response = TestClient(app).post(
        "/api/v1/detect-emergency",
        json={"text": "Ada kebakaran di pasar"},
        headers=HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["is_emergency"] is True
    assert response.json()["keyword_matched"].lower() == "kebakaran"


def test_similar_report_check_uses_channel_scope(monkeypatch):
    unit_id = UUID("00000000-0000-4000-8000-000000000002")
    received = {}
    monkeypatch.setattr(
        enhanced_routes,
        "resolve_channel_unit",
        lambda session, account: unit_id,
    )

    def fake_find(**kwargs):
        received.update(kwargs)
        return {"similar_found": False, "count": 0, "message": None}

    monkeypatch.setattr(enhanced_routes, "find_similar_reports", fake_find)
    response = TestClient(app).post(
        "/api/v1/check-similar",
        json={"category": "infrastructure", "location_text": "RT 03"},
        headers=HEADERS,
    )

    assert response.status_code == 200
    assert received["unit_id"] == unit_id
    assert received["category"] == "infrastructure"


def test_resolution_confirmation_uses_trusted_scope_and_sender(monkeypatch):
    unit_id = UUID("00000000-0000-4000-8000-000000000002")
    received = {}
    monkeypatch.setattr(
        enhanced_routes,
        "resolve_channel_unit",
        lambda session, account: unit_id,
    )

    def fake_confirm(**kwargs):
        received.update(kwargs)
        return {"ticket_number": kwargs["ticket_number"], "status": "confirmed"}

    monkeypatch.setattr(enhanced_routes, "confirm_resolution", fake_confirm)
    response = TestClient(app).post(
        "/api/v1/confirm-resolution/LP-2026-0001",
        json={
            "confirmed": True,
            "feedback": "Sudah selesai",
            "sender_phone_number": "+6281234567890",
        },
        headers=HEADERS,
    )

    assert response.status_code == 200
    assert received["unit_id"] == unit_id
    assert received["sender_phone_number"] == "+6281234567890"


def test_enhanced_endpoints_require_openclaw_key():
    response = TestClient(app).post(
        "/api/v1/detect-emergency",
        json={"text": "Ada kebakaran"},
    )

    assert response.status_code == 401
