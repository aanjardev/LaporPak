from datetime import UTC, datetime
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.service_requests import ServiceRequestCreate, ServiceRequestStatus
from app.services.exceptions import DuplicateOperationError, ReportPersistenceError
from app.services.service_requests import ServiceRequestService

REQUEST_ID = UUID("33333333-3333-4333-8333-333333333333")
UNIT_ID = UUID("22222222-2222-4222-8222-222222222222")
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


class CreateRepository:
    def __init__(self):
        self.existing = None
        self.inserted = None

    def acquire_lock(self, _key):
        return None

    def by_key(self, _key):
        return self.existing

    def citizen(self, _phone):
        return {"id": UUID("44444444-4444-4444-8444-444444444444")}

    def request_type(self, _request_type):
        return {"id": UUID("55555555-5555-4555-8555-555555555555")}

    def insert_request(self, values):
        self.inserted = {
            **request_row(),
            **values,
        }
        return self.inserted

    def history(self, _values):
        return None

    def detail(self, _request_id, _unit_ids):
        return {**request_row(), **self.existing}


def test_request_idempotency_is_bound_to_village():
    repository = CreateRepository()
    service = ServiceRequestService(Session(), repository)
    payload = ServiceRequestCreate(
        sender_phone_number="+6281234567890",
        applicant_name="Warga Uji",
        domicile_address="RT 03",
        domicile_duration="2 tahun",
        purpose="Administrasi",
    )
    key = UUID("66666666-6666-4666-8666-666666666666")

    service.create(payload, key, UNIT_ID)
    repository.existing = {
        "id": REQUEST_ID,
        "idempotency_payload_hash": repository.inserted[
            "idempotency_payload_hash"
        ],
    }

    with pytest.raises(DuplicateOperationError):
        service.create(
            payload,
            key,
            UUID("77777777-7777-4777-8777-777777777777"),
        )
