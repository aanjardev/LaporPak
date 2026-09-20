from datetime import datetime
from types import SimpleNamespace
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.villages import router
from app.core.errors import register_error_handlers
from app.core.security import (
    AdminRole,
    AuthenticatedCaller,
    CallerType,
    authenticate_caller,
)
from app.db.dashboard_repository import DashboardRepository
from app.db.session import get_db_session
from app.db.tables import reports
from app.schemas.dashboard import VillageDashboardResponse
from app.services.dashboard import build_dashboard

VILLAGE_A = UUID("11111111-1111-4111-8111-111111111111")
VILLAGE_B = UUID("22222222-2222-4222-8222-222222222222")
NOW = datetime(2026, 9, 20, 14, 30, tzinfo=ZoneInfo("Asia/Jakarta"))


class FakeRepository:
    def created_counts(self, village_id, start, end):
        assert village_id == VILLAGE_A
        assert end == NOW
        self.start = start
        return 2, 1

    def daily_counts(self, table, village_id, start, end):
        if table.name == "reports":
            return [SimpleNamespace(date=NOW.date(), count=2)]
        return [SimpleNamespace(date=NOW.date(), count=1)]

    def status_counts(self, table, village_id):
        if table.name == "reports":
            return {"pending_verification": 2, "resolved": 4}
        return {"pending_review": 1, "completed": 3}

    def knowledge_counts(self, village_id):
        # One document may be both draft and failed; ready remains independent.
        return {"active": 4, "ready": 1, "draft": 2, "failed": 2, "processing": 1}

    def attention_counts(self, village_id):
        # The overlapping ASK document is represented once in this SQL aggregate.
        return {"reports": 2, "requests": 1, "knowledge": 3}

    def attention(self, village_id):
        return [
            {
                "kind": "knowledge",
                "id": UUID("33333333-3333-4333-8333-333333333333"),
                "label": "Sumber ASK",
                "status": "failed",
                "created_at": NOW,
            }
        ]


@pytest.mark.parametrize("days", [7, 30, 90])
def test_dashboard_period_zero_fill_canonical_statuses_and_ask_overlap(days):
    result = build_dashboard(
        FakeRepository(), {"id": VILLAGE_A, "name": "Desa A"}, days, NOW
    )

    assert result.period.days == days
    assert len(result.daily) == days
    assert result.daily[0].date.isoformat() == result.period.start_date.isoformat()
    assert result.daily[-1].date == NOW.date()
    assert result.daily[0].reports == 0
    assert result.daily[-1].reports == 2
    assert result.kpis.reports_created == sum(item.reports for item in result.daily)
    assert result.kpis.requests_created == sum(item.requests for item in result.daily)
    assert result.kpis.needs_attention == 6
    assert result.attention_counts.knowledge == 3
    assert result.knowledge.draft == 2
    assert result.knowledge.failed == 2
    assert set(result.report_status_counts.model_dump()) == {
        "pending_verification",
        "verified",
        "in_progress",
        "forwarded",
        "resolved",
        "rejected",
    }
    assert result.report_status_counts.verified == 0
    assert set(result.request_status_counts.model_dump()) == {
        "pending_review",
        "approved",
        "rejected",
        "completed",
    }
    assert result.request_status_counts.approved == 0


class MappingResult:
    def __init__(self, row=None):
        self.row = row

    def mappings(self):
        return self

    def one_or_none(self):
        return self.row


class VillageSession:
    def __init__(self, row=None, error=None):
        self.row = row
        self.error = error
        self.rolled_back = False

    def execute(self, statement):
        if self.error:
            raise self.error
        return MappingResult(self.row)

    def rollback(self):
        self.rolled_back = True


def caller(role=AdminRole.VILLAGE_ADMIN, units=(VILLAGE_A,)):
    return AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier="test-admin",
        role=role,
        unit_ids=units,
        operational_unit_ids=units,
    )


def app_client(monkeypatch, *, auth=None, session=None, dashboard=None):
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_db_session] = lambda: session or VillageSession()
    if auth is not None:
        app.dependency_overrides[authenticate_caller] = lambda: auth
    if dashboard is not None:
        monkeypatch.setattr("app.api.routes.villages.build_dashboard", dashboard)
    return TestClient(app, raise_server_exceptions=False)


def dashboard_fixture(*_args, **_kwargs):
    return VillageDashboardResponse.model_validate(
        {
            "village": {"id": VILLAGE_A, "name": "Desa A"},
            "period": {
                "days": 30,
                "start_date": "2026-08-22",
                "end_date": "2026-09-20",
                "timezone": "Asia/Jakarta",
            },
            "generated_at": NOW,
            "kpis": {
                "reports_created": 0,
                "requests_created": 0,
                "needs_attention": 0,
                "ask_ready": 0,
            },
            "attention_counts": {"reports": 0, "requests": 0, "knowledge": 0},
            "report_status_counts": {
                "pending_verification": 0,
                "verified": 0,
                "in_progress": 0,
                "forwarded": 0,
                "resolved": 0,
                "rejected": 0,
            },
            "request_status_counts": {
                "pending_review": 0,
                "approved": 0,
                "rejected": 0,
                "completed": 0,
            },
            "knowledge": {
                "active": 0,
                "ready": 0,
                "draft": 0,
                "failed": 0,
                "processing": 0,
            },
            "daily": [],
            "attention": [],
        }
    )


def test_dashboard_success_is_private_and_contains_no_pii_or_storage(monkeypatch):
    village = {
        "id": VILLAGE_A,
        "name": "Desa A",
        "is_active": True,
        "activation_status": "approved",
    }
    client = app_client(
        monkeypatch,
        auth=caller(),
        session=VillageSession(village),
        dashboard=dashboard_fixture,
    )

    response = client.get(f"/api/v1/villages/{VILLAGE_A}/dashboard")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    payload = response.json()
    serialized = response.text.lower()
    assert payload["village"] == {"id": str(VILLAGE_A), "name": "Desa A"}
    assert "citizen" not in serialized
    assert "storage_path" not in serialized
    assert "address" not in serialized


def test_dashboard_401_uses_standard_envelope(monkeypatch):
    client = app_client(monkeypatch, session=VillageSession())
    response = client.get(f"/api/v1/villages/{VILLAGE_A}/dashboard")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_dashboard_rejects_system_admin_with_403(monkeypatch):
    response = app_client(
        monkeypatch, auth=caller(AdminRole.SYSTEM_ADMIN, ()), session=VillageSession()
    ).get(f"/api/v1/villages/{VILLAGE_A}/dashboard")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_dashboard_hides_other_village_with_404(monkeypatch):
    response = app_client(
        monkeypatch, auth=caller(units=(VILLAGE_A,)), session=VillageSession()
    ).get(f"/api/v1/villages/{VILLAGE_B}/dashboard")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "VILLAGE_NOT_FOUND"


def test_dashboard_inactive_village_is_403(monkeypatch):
    village = {
        "id": VILLAGE_A,
        "name": "Desa A",
        "is_active": False,
        "activation_status": "pending_review",
    }
    response = app_client(
        monkeypatch, auth=caller(), session=VillageSession(village)
    ).get(f"/api/v1/villages/{VILLAGE_A}/dashboard")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "VILLAGE_INACTIVE"


def test_dashboard_invalid_days_is_422(monkeypatch):
    response = app_client(monkeypatch, auth=caller(), session=VillageSession()).get(
        f"/api/v1/villages/{VILLAGE_A}/dashboard?days=14"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_dashboard_database_failure_is_503(monkeypatch):
    session = VillageSession(error=SQLAlchemyError("database detail"))
    response = app_client(monkeypatch, auth=caller(), session=session).get(
        f"/api/v1/villages/{VILLAGE_A}/dashboard"
    )
    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "DATABASE_UNAVAILABLE",
            "message": "Village dashboard is temporarily unavailable",
            "details": None,
        }
    }
    assert "database detail" not in response.text
    assert session.rolled_back


class RepositoryResult:
    def __init__(self, *, scalar=0, rows=None, mapping=None):
        self.scalar = scalar
        self.rows = rows or []
        self.mapping = mapping

    def scalar_one(self):
        return self.scalar

    def all(self):
        return self.rows

    def mappings(self):
        return self

    def one(self):
        return self.mapping


class RepositorySession:
    def __init__(self):
        self.statements = []
        self.results = [
            RepositoryResult(scalar=0),
            RepositoryResult(scalar=0),
            RepositoryResult(rows=[]),
            RepositoryResult(rows=[]),
            RepositoryResult(
                mapping={
                    "active": 0,
                    "ready": 0,
                    "draft": 0,
                    "failed": 0,
                    "processing": 0,
                }
            ),
            RepositoryResult(mapping={"reports": 0, "requests": 0, "knowledge": 0}),
            RepositoryResult(rows=[]),
        ]

    def execute(self, statement):
        self.statements.append(statement)
        return self.results.pop(0)


def test_every_dashboard_aggregate_is_scoped_to_one_village():
    session = RepositorySession()
    repository = DashboardRepository(session)
    repository.created_counts(VILLAGE_A, NOW, NOW)
    repository.daily_counts(reports, VILLAGE_A, NOW, NOW)
    repository.status_counts(reports, VILLAGE_A)
    repository.knowledge_counts(VILLAGE_A)
    repository.attention_counts(VILLAGE_A)
    repository.attention(VILLAGE_A)

    assert len(session.statements) == 7
    for statement in session.statements:
        compiled = statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"render_postcompile": True},
        )
        assert VILLAGE_A in compiled.params.values()
        assert VILLAGE_B not in compiled.params.values()

    attention_sql = str(session.statements[-2].compile(dialect=postgresql.dialect()))
    assert "review_status" in attention_sql
    assert "processing_status" in attention_sql
    assert " OR " in attention_sql
