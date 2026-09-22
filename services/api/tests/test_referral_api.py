from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core import security
from app.core.config import settings
from app.core.errors import APIError
from app.main import app
from app.schemas.referrals import ReferralProgress
from app.services.dependencies import get_referral_service

REPORT_ID = UUID("20000000-0000-4000-8000-000000000001")
REFERRAL_ID = UUID("30000000-0000-4000-8000-000000000001")
CHANNEL_ID = UUID("50000000-0000-4000-8000-000000000001")
UNIT_ID = UUID("00000000-0000-4000-8000-0000000000a1")


class FakeService:
    def __init__(self):
        self.calls = []

    def approve(self, referral_id, payload, actor, unit_ids):
        self.calls.append((referral_id, payload, actor, unit_ids))
        return ReferralProgress(
            id=REFERRAL_ID,
            report_id=REPORT_ID,
            source_unit_id=UNIT_ID,
            channel_id=CHANNEL_ID,
            target_name="INSTANSI_UJI_REFERRAL",
            channel_name="Kanal Mock",
            active_package_version=1,
            package_hash="a" * 64,
            dispatch_status="approved",
            registration_status="unverified",
            handling_status="unassigned",
            external_reference=None,
            evidence_reference=None,
            is_simulated=True,
            updated_at=datetime(2026, 9, 21, 12, tzinfo=UTC),
        )

    def list_tasks(self, report_id, unit_ids):
        self.calls.append(("tasks", report_id, unit_ids))
        return []


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "allow_legacy_admin_fallback", True)
    monkeypatch.setattr(settings, "dashboard_admin_unit_id", UNIT_ID)
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))

    def verify(token):
        if token != "admin-token":
            raise APIError(status_code=401, code="UNAUTHORIZED", message="Invalid token")
        return UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    monkeypatch.setattr(security, "verify_supabase_access_token", verify)
    service = FakeService()
    app.dependency_overrides[get_referral_service] = lambda: service
    yield TestClient(app), service
    app.dependency_overrides.clear()


def test_approval_requires_admin_and_uses_server_scope(client):
    http, service = client
    body = {"package_version": 1, "package_hash": "a" * 64, "reason": "Disetujui"}

    agent = http.post(
        f"/api/v1/referrals/{REFERRAL_ID}/approve",
        headers={"X-OpenClaw-API-Key": "openclaw-token"},
        json=body,
    )
    admin = http.post(
        f"/api/v1/referrals/{REFERRAL_ID}/approve",
        headers={"Authorization": "Bearer admin-token"},
        json=body,
    )

    assert agent.status_code == 401
    assert admin.status_code == 200
    assert service.calls[0][3] == (UNIT_ID,)
    assert service.calls[0][2].startswith("supabase:")


def test_tasks_use_server_scope(client):
    http, service = client
    response = http.get(
        f"/api/v1/reports/{REPORT_ID}/tasks",
        headers={"Authorization": "Bearer admin-token"},
    )

    assert response.status_code == 200
    assert response.json() == []
    assert service.calls == [("tasks", REPORT_ID, (UNIT_ID,))]


def test_draft_rejects_client_supplied_scope_actor_and_approval(client):
    http, service = client
    response = http.post(
        f"/api/v1/reports/{REPORT_ID}/referrals",
        headers={"Authorization": "Bearer admin-token"},
        json={
            "channel_id": str(CHANNEL_ID),
            "request_key": "70000000-0000-4000-8000-000000000001",
            "tenant_id": str(UNIT_ID),
            "actor": "forged",
            "approved": True,
            "package": {
                "summary": "Ringkasan",
                "chronology": "Kronologi",
                "requested_action": "Periksa",
            },
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert service.calls == []
