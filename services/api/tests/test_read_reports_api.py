from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core import security
from app.core.config import settings
from app.core.errors import APIError
from app.main import app
from app.schemas.reports import (
    ReportCitizen,
    ReportDetail,
    ReportListItem,
    ReportListResponse,
    ReportLocation,
    ReportStatusHistory,
)
from app.services.dependencies import get_report_service
from app.services.exceptions import ReportNotFoundError, ReportPersistenceError

REPORT_ID = UUID("72af1a52-7016-48c7-aacc-6c35417be819")
CREATED_AT = datetime(2026, 9, 16, 14, tzinfo=UTC)


def list_item() -> ReportListItem:
    return ReportListItem(
        id=REPORT_ID,
        ticket_number="LP-2026-0001",
        category="infrastructure",
        description="Jalan rusak.",
        location=ReportLocation(text="RT 03"),
        urgency="high",
        status="pending_verification",
        created_at=CREATED_AT,
    )


def report_detail() -> ReportDetail:
    item = list_item()
    return ReportDetail(
        **item.model_dump(),
        citizen=ReportCitizen(
            id=UUID("5c242fc6-77a8-4fa7-a12f-a67bbc75839b"),
            display_name="Warga",
        ),
        summary="Kerusakan jalan di RT 03.",
        responsible_unit=None,
        ai_recommendation={},
        attachments=[],
        status_history=[
            ReportStatusHistory(
                old_status=None,
                new_status="pending_verification",
                actor_type="system",
                actor_identifier=None,
                notes="Report created",
                created_at=CREATED_AT,
            )
        ],
        verified_at=None,
        resolved_at=None,
        updated_at=CREATED_AT,
    )


class FakeReadReportService:
    def __init__(self, *, error=None):
        self.error = error
        self.list_calls = []
        self.detail_calls = []

    def list_reports(self, **parameters):
        self.list_calls.append(parameters)
        if self.error is not None:
            raise self.error
        return ReportListResponse(
            items=[list_item()],
            page=parameters["page"],
            page_size=parameters["page_size"],
            total=1,
        )

    def get_report_detail(self, report_id):
        self.detail_calls.append(report_id)
        if self.error is not None:
            raise self.error
        return report_detail()


@pytest.fixture
def auth_tokens(monkeypatch):
    monkeypatch.setattr(settings, "openclaw_api_key", SecretStr("openclaw-token"))
    def verify(token):
        if token != "admin-token":
            raise APIError(status_code=401, code="UNAUTHORIZED", message="Invalid token")
        return UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    monkeypatch.setattr(security, "verify_supabase_access_token", verify)


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def client_with_service(service):
    app.dependency_overrides[get_report_service] = lambda: service
    return TestClient(app)


def admin_headers(token="admin-token"):
    return {"Authorization": f"Bearer {token}"}


def test_list_reports_returns_contract_shape_and_passes_filters(auth_tokens):
    service = FakeReadReportService()
    client = client_with_service(service)

    response = client.get(
        "/api/v1/reports",
        headers=admin_headers(),
        params={
            "page": 2,
            "page_size": 10,
            "status": "pending_verification",
            "urgency": "high",
            "category": "infrastructure",
            "search": "LP-2026",
        },
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["ticket_number"] == "LP-2026-0001"
    assert response.json()["page"] == 2
    assert service.list_calls[0]["status"].value == "pending_verification"
    assert service.list_calls[0]["urgency"].value == "high"
    assert service.list_calls[0]["category"].value == "infrastructure"
    assert service.list_calls[0]["search"] == "LP-2026"


def test_list_reports_validates_pagination_and_filters(auth_tokens):
    service = FakeReadReportService()
    client = client_with_service(service)

    bad_page = client.get(
        "/api/v1/reports?page=0&page_size=101",
        headers=admin_headers(),
    )
    bad_status = client.get(
        "/api/v1/reports?status=unknown",
        headers=admin_headers(),
    )

    assert bad_page.status_code == 422
    assert bad_status.status_code == 422
    assert service.list_calls == []


def test_detail_returns_ai_metadata_attachments_and_history(auth_tokens):
    service = FakeReadReportService()
    client = client_with_service(service)

    response = client.get(
        f"/api/v1/reports/{REPORT_ID}",
        headers=admin_headers(),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["citizen"]["display_name"] == "Warga"
    assert body["ai_recommendation"] == {}
    assert body["attachments"] == []
    assert body["status_history"][0]["new_status"] == "pending_verification"


def test_read_endpoints_require_admin_token(auth_tokens):
    service = FakeReadReportService()
    client = client_with_service(service)

    missing = client.get("/api/v1/reports")
    openclaw = client.get(
        "/api/v1/reports",
        headers=admin_headers("openclaw-token"),
    )

    assert missing.status_code == 401
    assert openclaw.status_code == 401
    assert service.list_calls == []


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (ReportNotFoundError(REPORT_ID), 404, "REPORT_NOT_FOUND"),
        (ReportPersistenceError("report detail"), 503, "DATABASE_UNAVAILABLE"),
    ],
)
def test_detail_maps_not_found_and_database_errors(
    auth_tokens,
    error,
    status_code,
    code,
):
    client = client_with_service(FakeReadReportService(error=error))

    response = client.get(
        f"/api/v1/reports/{REPORT_ID}",
        headers=admin_headers(),
    )

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code


def test_list_maps_database_error(auth_tokens):
    service = FakeReadReportService(
        error=ReportPersistenceError("report list")
    )
    client = client_with_service(service)

    response = client.get("/api/v1/reports", headers=admin_headers())

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "DATABASE_UNAVAILABLE"
