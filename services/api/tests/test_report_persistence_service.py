from contextlib import AbstractContextManager
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.exceptions import (
    CategoryNotFoundError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.reports import ReportPersistenceService


class Transaction(AbstractContextManager):
    def __init__(self, session):
        self.session = session

    def __enter__(self):
        self.session.entered += 1
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.session.exited += 1
        self.session.last_exception_type = exc_type
        return False


class TransactionSession:
    def __init__(self):
        self.entered = 0
        self.exited = 0
        self.last_exception_type = None

    def begin(self):
        return Transaction(self)


class FakeRepository:
    def __init__(self):
        self.category = {"id": "category-id"}
        self.citizen = {"id": "citizen-id"}
        self.report = {
            "id": "report-id",
            "status": "pending_verification",
            "ticket_number": "LP-2026-0001",
        }
        self.inserted_report = None
        self.inserted_history = None
        self.locked_report = {"id": "report-id", "status": "pending_verification"}
        self.updated_report = {
            "id": "report-id",
            "status": "verified",
            "ticket_number": "LP-2026-0001",
        }

    def get_or_create_citizen(self, phone_number):
        self.phone_number = phone_number
        return self.citizen

    def resolve_active_category(self, category_code):
        self.category_code = category_code
        return self.category

    def insert_report(self, values):
        self.inserted_report = values
        return self.report

    def insert_status_history(self, values):
        self.inserted_history = values
        return values

    def lock_report(self, report_id):
        self.report_id = report_id
        return self.locked_report

    def update_report(self, report_id, values):
        self.updated_values = values
        return self.updated_report

    def list_reports(self, *, offset, limit):
        return [self.report], 1

    def get_report_detail(self, report_id):
        return self.report

    def list_attachments(self, report_id):
        return [{"id": "attachment-id"}]

    def list_status_history(self, report_id):
        return [{"id": "history-id"}]


def test_create_report_and_initial_history_share_one_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)

    result = service.create_report(
        citizen_phone_number="+6281234567890",
        category_code="infrastructure",
        report_values={"description": "Jalan rusak."},
        initial_history_values={
            "old_status": None,
            "new_status": "pending_verification",
            "actor_type": "system",
        },
    )

    assert result["ticket_number"] == "LP-2026-0001"
    assert repository.inserted_report["citizen_id"] == "citizen-id"
    assert repository.inserted_report["category_id"] == "category-id"
    assert "ticket_number" not in repository.inserted_report
    assert repository.inserted_history["report_id"] == "report-id"
    assert session.entered == 1
    assert session.exited == 1
    assert session.last_exception_type is None


def test_missing_category_aborts_create_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    repository.category = None
    service = ReportPersistenceService(session, repository)

    with pytest.raises(CategoryNotFoundError):
        service.create_report(
            citizen_phone_number="+6281234567890",
            category_code="unknown",
            report_values={"description": "Jalan rusak."},
            initial_history_values={},
        )

    assert repository.inserted_report is None
    assert session.last_exception_type is CategoryNotFoundError


def test_status_update_locks_report_and_writes_history_atomically():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)
    report_id = UUID("72af1a52-7016-48c7-aacc-6c35417be819")

    result = service.update_report_with_history(
        report_id=report_id,
        report_values={"status": "verified"},
        history_values={"actor_type": "admin", "notes": "Verified"},
    )

    assert result["status"] == "verified"
    assert repository.report_id == report_id
    assert repository.inserted_history["old_status"] == "pending_verification"
    assert repository.inserted_history["new_status"] == "verified"
    assert session.entered == 1
    assert session.exited == 1


def test_status_update_rejects_missing_report_inside_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    repository.locked_report = None
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportNotFoundError):
        service.update_report_with_history(
            report_id=UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
            report_values={"status": "verified"},
            history_values={},
        )

    assert session.last_exception_type is ReportNotFoundError


def test_sqlalchemy_error_is_wrapped_without_fake_success():
    session = TransactionSession()
    repository = FakeRepository()
    repository.insert_report = lambda values: (_ for _ in ()).throw(
        SQLAlchemyError("database unavailable")
    )
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportPersistenceError) as error:
        service.create_report(
            citizen_phone_number="+6281234567890",
            category_code="infrastructure",
            report_values={"description": "Jalan rusak."},
            initial_history_values={},
        )

    assert error.value.operation == "report creation"


def test_detail_aggregates_attachments_and_ordered_history():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)
    report_id = UUID("72af1a52-7016-48c7-aacc-6c35417be819")

    detail = service.get_report_detail(report_id)

    assert detail["attachments"] == [{"id": "attachment-id"}]
    assert detail["status_history"] == [{"id": "history-id"}]
