from uuid import UUID

import pytest
from sqlalchemy.dialects import postgresql

from app.db import session as session_module
from app.db.repositories import ReportRepository
from app.db.tables import (
    administrative_units,
    citizens,
    report_attachments,
    report_categories,
    report_status_history,
    reports,
)


class FakeResult:
    def mappings(self):
        return self

    def one_or_none(self):
        return None

    def one(self):
        return {}

    def all(self):
        return []

    def scalar_one(self):
        return 0


class RecordingSession:
    def __init__(self):
        self.statements = []
        self.commit_called = False

    def execute(self, statement):
        self.statements.append(statement)
        return FakeResult()

    def commit(self):
        self.commit_called = True
        raise AssertionError("Repository must not commit")


class LifecycleSession:
    def __init__(self):
        self.rollback_called = False
        self.close_called = False
        self.commit_called = False

    def rollback(self):
        self.rollback_called = True

    def close(self):
        self.close_called = True

    def commit(self):
        self.commit_called = True


def compile_statement(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_db_session_closes_without_implicit_commit(monkeypatch):
    session = LifecycleSession()
    monkeypatch.setattr(session_module, "SessionLocal", lambda: session)
    dependency = session_module.get_db_session()

    assert next(dependency) is session
    with pytest.raises(StopIteration):
        next(dependency)

    assert session.close_called is True
    assert session.rollback_called is False
    assert session.commit_called is False


def test_db_session_rolls_back_and_closes_on_exception(monkeypatch):
    session = LifecycleSession()
    monkeypatch.setattr(session_module, "SessionLocal", lambda: session)
    dependency = session_module.get_db_session()
    next(dependency)

    with pytest.raises(RuntimeError, match="database operation failed"):
        dependency.throw(RuntimeError("database operation failed"))

    assert session.rollback_called is True
    assert session.close_called is True
    assert session.commit_called is False


def test_report_table_mappings_match_migrations():
    assert citizens.schema == "public"
    assert administrative_units.schema == "public"
    assert report_categories.schema == "public"
    assert reports.schema == "public"
    assert report_attachments.schema == "public"
    assert report_status_history.schema == "public"

    assert {
        "id",
        "ticket_number",
        "citizen_id",
        "category_id",
        "status",
        "description",
        "location_text",
        "latitude",
        "longitude",
        "idempotency_key",
        "idempotency_payload_hash",
    } <= set(reports.c.keys())
    assert reports.c.citizen_id.nullable is False
    assert reports.c.category_id.nullable is False
    assert reports.c.ticket_number.unique is True
    assert reports.c.idempotency_key.unique is True


def test_repository_queries_use_canonical_identity_and_ordering():
    session = RecordingSession()
    repository = ReportRepository(session)
    report_id = UUID("72af1a52-7016-48c7-aacc-6c35417be819")
    idempotency_key = UUID("ef51f99f-a47d-4a31-a3db-e520838997f5")

    repository.find_citizen_by_phone("+6281234567890")
    repository.resolve_active_category("infrastructure")
    repository.find_report_by_idempotency_key(idempotency_key)
    repository.list_status_history(report_id)

    citizen_query = compile_statement(session.statements[0])
    category_query = compile_statement(session.statements[1])
    idempotency_query = compile_statement(session.statements[2])
    history_query = compile_statement(session.statements[3])

    assert "public.citizens.phone_number" in citizen_query
    assert "public.report_categories.code" in category_query
    assert "public.report_categories.is_active IS true" in category_query
    assert "public.reports.idempotency_key" in idempotency_query
    assert "ORDER BY public.report_status_history.created_at ASC" in history_query
    assert "public.report_status_history.id ASC" in history_query
    assert session.commit_called is False


def test_insert_report_leaves_ticket_generation_to_database():
    session = RecordingSession()
    repository = ReportRepository(session)

    repository.insert_report(
        {
            "citizen_id": UUID("5c242fc6-77a8-4fa7-a12f-a67bbc75839b"),
            "category_id": UUID("600dc7e0-1cd8-4249-aa22-80a1ad65ee42"),
            "description": "Jalan rusak.",
            "location_text": "RT 03",
            "idempotency_key": UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
            "idempotency_payload_hash": "payload-hash",
        }
    )

    insert_query = compile_statement(session.statements[0])
    assert "ticket_number" not in insert_query.split("VALUES", maxsplit=1)[0]
    assert session.commit_called is False
