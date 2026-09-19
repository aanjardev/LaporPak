from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.routes import service_requests as routes
from app.core.security import AdminRole, AuthenticatedCaller, CallerType, require_admin
from app.db.session import get_db_session
from app.main import app
from app.schemas.service_requests import (
    ServiceRequestDetail,
    ServiceRequestList,
    ServiceRequestStatusUpdateResponse,
    ServiceRequestSummary,
)
from app.services.exceptions import ReportNotFoundError

REQUEST_ID = UUID("33333333-3333-4333-8333-333333333333")
UNIT_ID = UUID("22222222-2222-4222-8222-222222222222")
ADMIN_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
NOW = datetime(2026, 9, 19, tzinfo=UTC)


def caller(role: AdminRole) -> AuthenticatedCaller:
    return AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier="supabase:internal-auth-uuid",
        admin_account_id=ADMIN_ID,
        role=role,
        unit_ids=(UNIT_ID,) if role is AdminRole.VILLAGE_ADMIN else (),
    )


def summary() -> ServiceRequestSummary:
    return ServiceRequestSummary(
        id=REQUEST_ID,
        ticket_number="REQ-2026-0001",
        request_type="residency_letter",
        applicant_name="Warga Uji",
        status="pending_review",
        administrative_unit_id=UNIT_ID,
        created_at=NOW,
        updated_at=NOW,
    )


def detail(can_transition: bool) -> ServiceRequestDetail:
    return ServiceRequestDetail(
        **summary().model_dump(),
        domicile_address="RT 03",
        domicile_duration="2 tahun",
        purpose="Administrasi",
        allowed_transitions=["approved", "rejected"] if can_transition else [],
        status_history=[
            {
                "old_status": None,
                "new_status": "pending_review",
                "actor_type": "system",
                "actor_display_name": None,
                "reason": "Request created",
                "created_at": NOW,
            }
        ],
    )


class FakeService:
    def __init__(self, _session):
        self.detail_calls = []
        self.update_calls = []

    def list(self, page, page_size, unit_ids):
        return ServiceRequestList(
            items=[summary()], page=page, page_size=page_size, total=1
        )

    def detail(self, request_id, unit_ids, *, can_transition):
        self.detail_calls.append((request_id, unit_ids, can_transition))
        return detail(can_transition)

    def update(self, request_id, status, reason, actor, unit_ids):
        self.update_calls.append((request_id, status, reason, actor, unit_ids))
        return ServiceRequestStatusUpdateResponse(
            id=request_id,
            ticket_number="REQ-2026-0001",
            status=status,
            updated_at=NOW,
        )


@pytest.fixture(autouse=True)
def clean_overrides(monkeypatch):
    service = FakeService(None)
    monkeypatch.setattr(routes, "ServiceRequestService", lambda _session: service)
    app.dependency_overrides[get_db_session] = lambda: object()
    yield service
    app.dependency_overrides.clear()


def client_for(role: AdminRole) -> TestClient:
    app.dependency_overrides[require_admin] = lambda: caller(role)
    return TestClient(app)


def test_list_is_minimal_and_detail_history_hides_internal_identifier(clean_overrides):
    client = client_for(AdminRole.VILLAGE_ADMIN)

    listed = client.get("/api/v1/service-requests").json()["items"][0]
    response = client.get(f"/api/v1/service-requests/{REQUEST_ID}")

    assert set(listed) == set(ServiceRequestSummary.model_fields)
    assert not {"domicile_address", "domicile_duration", "purpose"} & set(listed)
    assert response.status_code == 200
    assert response.json()["allowed_transitions"] == ["approved", "rejected"]
    assert "actor_identifier" not in response.text
    assert "supabase:" not in response.text


def test_system_admin_can_read_but_cannot_decide(clean_overrides):
    client = client_for(AdminRole.SYSTEM_ADMIN)

    detail_response = client.get(f"/api/v1/service-requests/{REQUEST_ID}")
    patch_response = client.patch(
        f"/api/v1/service-requests/{REQUEST_ID}/status",
        json={"status": "approved", "reason": "Lengkap"},
    )

    assert detail_response.status_code == 200
    assert detail_response.json()["allowed_transitions"] == []
    assert patch_response.status_code == 403
    assert patch_response.json()["error"]["code"] == "FORBIDDEN"
    assert clean_overrides.update_calls == []


def test_village_admin_patch_returns_compact_response(clean_overrides):
    client = client_for(AdminRole.VILLAGE_ADMIN)

    response = client.patch(
        f"/api/v1/service-requests/{REQUEST_ID}/status",
        json={"status": "approved", "reason": "  Data lengkap  "},
    )

    assert response.status_code == 200
    assert set(response.json()) == {
        "id",
        "ticket_number",
        "status",
        "updated_at",
    }
    assert clean_overrides.update_calls[0][2] == "Data lengkap"


def test_out_of_scope_detail_uses_safe_not_found_code(clean_overrides, monkeypatch):
    class MissingService(FakeService):
        def detail(self, request_id, unit_ids, *, can_transition):
            raise ReportNotFoundError(request_id)

    monkeypatch.setattr(routes, "ServiceRequestService", MissingService)
    response = client_for(AdminRole.VILLAGE_ADMIN).get(
        f"/api/v1/service-requests/{REQUEST_ID}"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SERVICE_REQUEST_NOT_FOUND"


def test_invalid_or_blank_decision_is_rejected_before_service(clean_overrides):
    client = client_for(AdminRole.VILLAGE_ADMIN)
    blank = client.patch(
        f"/api/v1/service-requests/{REQUEST_ID}/status",
        json={"status": "approved", "reason": "   "},
    )
    invalid = client.patch(
        f"/api/v1/service-requests/{REQUEST_ID}/status",
        json={"status": "unknown", "reason": "Alasan"},
    )

    assert blank.status_code == 422
    assert invalid.status_code == 422
    assert clean_overrides.update_calls == []
