from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.service_requests import ServiceRequestCreate, ServiceRequestStatus
from app.services.exceptions import DuplicateOperationError, ReportPersistenceError
from app.services.service_requests import (
    ServiceRequestService,
    canonical_request_payload_hash,
)

REQUEST_ID = UUID("33333333-3333-4333-8333-333333333333")
UNIT_ID = UUID("22222222-2222-4222-8222-222222222222")
OTHER_UNIT_ID = UUID("44444444-4444-4444-8444-444444444444")
TYPE_ID = UUID("55555555-5555-4555-8555-555555555555")
IDEMPOTENCY_KEY = UUID("66666666-6666-4666-8666-666666666666")
CITIZEN_ID = UUID("77777777-7777-4777-8777-777777777777")
NOW = datetime(2026, 9, 19, tzinfo=UTC)


def request_row(status="pending_review"):
    return {
        "id": REQUEST_ID,
        "ticket_number": "REQ-2026-0001",
        "request_type": "residency_letter",
        "applicant_name": "Warga Uji",
        "domicile_address": "RT 03",
        "domicile_duration": "2 tahun",
        "purpose": "Administrasi",
        "status": status,
        "administrative_unit_id": UNIT_ID,
        "created_at": NOW,
        "updated_at": NOW,
    }


class Transaction:
    def __init__(self):
        self.error_type = None

    def __enter__(self):
        return self

    def __exit__(self, error_type, _error, _traceback):
        self.error_type = error_type
        return False


class Session:
    def __init__(self):
        self.transaction = Transaction()

    def begin(self):
        return self.transaction


class Repository:
    def __init__(self, *, fail_history=False):
        self.fail_history = fail_history

    def detail(self, _request_id, _unit_ids, lock=False):
        return request_row()

    def update(self, _request_id, status):
        return request_row(status)

    def history(self, _values):
        if self.fail_history:
            raise SQLAlchemyError("history failed")

    def list_history(self, _request_id):
        return [
            {
                "old_status": None,
                "new_status": "pending_review",
                "actor_type": "system",
                "actor_display_name": None,
                "reason": "Request created",
                "created_at": NOW,
            }
        ]


class CreateRepository:
    def __init__(self, *, existing=None, fail_history=False):
        self.existing = existing
        self.fail_history = fail_history
        self.inserted = None
        self.history_values = None

    def acquire_lock(self, _key):
        pass

    def by_key(self, _key):
        return self.existing

    def citizen(self, phone):
        return {"id": CITIZEN_ID, "phone_number": phone}

    def request_type(self, _code):
        return {"id": TYPE_ID}

    def insert_request(self, values):
        self.inserted = values
        return {
            **request_row(),
            **values,
            "status": "pending_review",
            "ticket_number": "REQ-2026-0001",
            "created_at": NOW,
            "updated_at": NOW,
        }

    def history(self, values):
        if self.fail_history:
            raise SQLAlchemyError("history failed")
        self.history_values = values

    def detail(self, _request_id, unit_ids, lock=False):
        if self.existing and self.existing["administrative_unit_id"] in unit_ids:
            return {**request_row(), **self.existing, "request_type": "residency_letter"}
        return None


def request_payload(phone="0812-3456-7890"):
    return ServiceRequestCreate(
        sender_phone_number=phone,
        applicant_name="Warga Uji",
        domicile_address="RT 03",
        domicile_duration="2 tahun",
        purpose="Administrasi",
    )


def test_create_persists_normalized_scoped_request_and_initial_history():
    repository = CreateRepository()
    service = ServiceRequestService(Session(), repository)

    result = service.create(request_payload(), IDEMPOTENCY_KEY, UNIT_ID)

    assert result.replayed is False
    assert repository.inserted["administrative_unit_id"] == UNIT_ID
    assert repository.inserted["citizen_id"] == CITIZEN_ID
    assert repository.history_values["new_status"] == "pending_review"


def test_same_key_and_scoped_payload_replays_without_another_insert():
    payload = request_payload()
    existing = {
        **request_row(),
        "idempotency_payload_hash": canonical_request_payload_hash(
            payload, "+6281234567890", UNIT_ID
        ),
    }
    repository = CreateRepository(existing=existing)

    result = ServiceRequestService(Session(), repository).create(
        payload, IDEMPOTENCY_KEY, UNIT_ID
    )

    assert result.replayed is True
    assert repository.inserted is None


def test_same_key_cannot_replay_across_villages():
    payload = request_payload()
    existing = {
        **request_row(),
        "idempotency_payload_hash": canonical_request_payload_hash(
            payload, "+6281234567890", UNIT_ID
        ),
    }

    with pytest.raises(DuplicateOperationError):
        ServiceRequestService(Session(), CreateRepository(existing=existing)).create(
            payload, IDEMPOTENCY_KEY, OTHER_UNIT_ID
        )


def test_create_history_failure_aborts_atomic_transaction():
    session = Session()

    with pytest.raises(ReportPersistenceError):
        ServiceRequestService(
            session, CreateRepository(fail_history=True)
        ).create(request_payload(), IDEMPOTENCY_KEY, UNIT_ID)

    assert session.transaction.error_type is SQLAlchemyError

def test_detail_exposes_safe_history_and_backend_transitions():
    service = ServiceRequestService(Session(), Repository())
    detail = service.detail(REQUEST_ID, (UNIT_ID,), can_transition=True)

    assert detail.allowed_transitions == ["approved", "rejected"]
    assert detail.status_history[0].actor_display_name is None
    assert "actor_identifier" not in detail.model_dump()


def test_history_failure_aborts_atomic_status_transaction():
    session = Session()
    service = ServiceRequestService(session, Repository(fail_history=True))

    with pytest.raises(ReportPersistenceError):
        service.update(
            REQUEST_ID,
            ServiceRequestStatus.APPROVED,
            "Data lengkap",
            "supabase:internal-auth-uuid",
            (UNIT_ID,),
        )

    assert session.transaction.error_type is SQLAlchemyError


