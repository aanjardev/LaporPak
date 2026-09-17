from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import settings
from app.main import app
from app.services.dependencies import get_report_service
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    ReportPersistenceError,
)
from app.services.reports import IdempotentReportResult


class FakeCreateReportService:
    def __init__(self, *, replayed=False, error=None):
        self.replayed = replayed
        self.error = error
        self.calls = []

    def create_idempotent_report(self, *, payload, idempotency_key):
        self.calls.append((payload, idempotency_key))
        if self.error is not None:
            raise self.error
        return IdempotentReportResult(
            report={
                "id": UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
                "ticket_number": "LP-2026-0001",
                "status": "pending_verification",
                "created_at": datetime(2026, 9, 16, 14, tzinfo=UTC),
            },
            replayed=self.replayed,
        )


def valid_payload():
    return {
        "sender_phone_number": "+6281234567890",
        "conversation_id": "fa5d95ae-514f-4ce0-a3c2-735d8558948b",
        "category": "infrastructure",
        "description": "Jalan di RT 03 rusak parah.",
        "location": {
            "text": "RT 03 dekat masjid",
            "latitude": -7.123,
            "longitude": 112.123,
        },
        "urgency": "high",
        "original_text": "Pak jalan di RT 03 rusak parah.",
        "source": "whatsapp",
        "ai_analysis": {
            "confidence": 0.94,
            "summary": "Kerusakan jalan di RT 03 dekat masjid.",
        },
    }


@pytest.fixture
def auth_tokens(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))
    monkeypatch.setattr(settings, "dashboard_api_key", SecretStr("admin-token"))


def request_headers(token="openclaw-token", include_idempotency=True):
    headers = {"Authorization": f"Bearer {token}"}
    if include_idempotency:
        headers["Idempotency-Key"] = "ef51f99f-a47d-4a31-a3db-e520838997f5"
    return headers


def client_with_service(service):
    app.dependency_overrides[get_report_service] = lambda: service
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def test_create_report_returns_201_for_new_operation(auth_tokens):
    service = FakeCreateReportService()
    client = client_with_service(service)

    response = client.post(
        "/api/v1/reports",
        headers=request_headers(),
        json=valid_payload(),
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": "72af1a52-7016-48c7-aacc-6c35417be819",
        "ticket_number": "LP-2026-0001",
        "status": "pending_verification",
        "created_at": "2026-09-16T14:00:00Z",
    }
    assert service.calls[0][1] == UUID(
        "ef51f99f-a47d-4a31-a3db-e520838997f5"
    )


def test_create_report_returns_200_for_idempotent_replay(auth_tokens):
    service = FakeCreateReportService(replayed=True)
    client = client_with_service(service)

    response = client.post(
        "/api/v1/reports",
        headers=request_headers(),
        json=valid_payload(),
    )

    assert response.status_code == 200
    assert response.json()["ticket_number"] == "LP-2026-0001"


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (InvalidSenderIdentityError(), 422, "VALIDATION_ERROR"),
        (CategoryNotFoundError("infrastructure"), 422, "VALIDATION_ERROR"),
        (DuplicateOperationError(), 409, "DUPLICATE_OPERATION"),
        (ReportPersistenceError("report creation"), 503, "DATABASE_UNAVAILABLE"),
    ],
)
def test_create_report_maps_service_errors(
    auth_tokens,
    error,
    status_code,
    code,
):
    client = client_with_service(FakeCreateReportService(error=error))

    response = client.post(
        "/api/v1/reports",
        headers=request_headers(),
        json=valid_payload(),
    )

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code


def test_create_report_requires_openclaw_token_and_idempotency_key(auth_tokens):
    service = FakeCreateReportService()
    client = client_with_service(service)

    no_token = client.post(
        "/api/v1/reports",
        headers={
            "Idempotency-Key": "ef51f99f-a47d-4a31-a3db-e520838997f5"
        },
        json=valid_payload(),
    )
    admin_token = client.post(
        "/api/v1/reports",
        headers=request_headers(token="admin-token"),
        json=valid_payload(),
    )
    no_idempotency_key = client.post(
        "/api/v1/reports",
        headers=request_headers(include_idempotency=False),
        json=valid_payload(),
    )

    assert no_token.status_code == 401
    assert admin_token.status_code == 403
    assert no_idempotency_key.status_code == 422
    assert no_idempotency_key.json()["error"]["code"] == "VALIDATION_ERROR"
    assert service.calls == []


def test_create_report_rejects_invalid_key_and_non_whatsapp_source(auth_tokens):
    service = FakeCreateReportService()
    client = client_with_service(service)

    invalid_key = client.post(
        "/api/v1/reports",
        headers={
            "Authorization": "Bearer openclaw-token",
            "Idempotency-Key": "not-a-uuid",
        },
        json=valid_payload(),
    )
    dashboard_payload = valid_payload()
    dashboard_payload["source"] = "dashboard"
    invalid_source = client.post(
        "/api/v1/reports",
        headers=request_headers(),
        json=dashboard_payload,
    )

    assert invalid_key.status_code == 422
    assert invalid_source.status_code == 400
    assert invalid_source.json()["error"]["code"] == "INVALID_REQUEST"
    assert service.calls == []
