from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core import security
from app.core.config import settings
from app.core.errors import APIError
from app.main import app
from app.schemas.reports import ReportStatusUpdateResponse
from app.services.dependencies import get_report_service
from app.services.exceptions import (
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)

REPORT_ID = UUID("72af1a52-7016-48c7-aacc-6c35417be819")


class FakeStatusService:
    def __init__(self, *, error=None):
        self.error = error
        self.calls = []

    def update_report_status(self, **parameters):
        self.calls.append(parameters)
        if self.error is not None:
            raise self.error
        return ReportStatusUpdateResponse(
            id=REPORT_ID,
            ticket_number="LP-2026-0001",
            status=parameters["new_status"],
            updated_at=datetime(2026, 9, 16, 15, tzinfo=UTC),
        )


@pytest.fixture
def auth_tokens(monkeypatch):
    monkeypatch.setattr(settings, "allow_legacy_admin_fallback", True)
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))

    def verify(token):
        if token != "admin-token":
            raise APIError(
                status_code=401, code="UNAUTHORIZED", message="Invalid token"
            )
        return UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    monkeypatch.setattr(security, "verify_supabase_access_token", verify)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def client_with_service(service):
    app.dependency_overrides[get_report_service] = lambda: service
    return TestClient(app)


def headers(token="admin-token"):
    return {"Authorization": f"Bearer {token}"}


def test_update_status_returns_contract_response_and_admin_actor(auth_tokens):
    service = FakeStatusService()
    client = client_with_service(service)

    response = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        headers=headers(),
        json={"status": "verified", "reason": "Sudah diperiksa."},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(REPORT_ID),
        "ticket_number": "LP-2026-0001",
        "status": "verified",
        "updated_at": "2026-09-16T15:00:00Z",
    }
    call = service.calls[0]
    assert call["new_status"].value == "verified"
    assert call["reason"] == "Sudah diperiksa."
    assert call["actor_identifier"] == "supabase:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def test_update_status_requires_admin_and_valid_request(auth_tokens):
    service = FakeStatusService()
    client = client_with_service(service)

    missing_token = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        json={"status": "verified", "reason": "Sudah diperiksa."},
    )
    openclaw = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        headers=headers("openclaw-token"),
        json={"status": "verified", "reason": "Sudah diperiksa."},
    )
    blank_reason = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        headers=headers(),
        json={"status": "rejected", "reason": "   "},
    )
    unknown_status = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        headers=headers(),
        json={"status": "done", "reason": "Selesai."},
    )

    assert missing_token.status_code == 401
    assert openclaw.status_code == 401
    assert blank_reason.status_code == 422
    assert unknown_status.status_code == 422
    assert service.calls == []


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (ReportNotFoundError(REPORT_ID), 404, "REPORT_NOT_FOUND"),
        (
            InvalidStatusTransitionError("verified", "rejected"),
            409,
            "INVALID_STATUS_TRANSITION",
        ),
        (ReportPersistenceError("status update"), 503, "DATABASE_UNAVAILABLE"),
    ],
)
def test_update_status_maps_service_errors(
    auth_tokens,
    error,
    status_code,
    code,
):
    client = client_with_service(FakeStatusService(error=error))

    response = client.patch(
        f"/api/v1/reports/{REPORT_ID}/status",
        headers=headers(),
        json={"status": "rejected", "reason": "Tidak valid."},
    )

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code
    if code == "INVALID_STATUS_TRANSITION":
        assert response.json()["error"]["details"] == {
            "old_status": "verified",
            "new_status": "rejected",
        }
