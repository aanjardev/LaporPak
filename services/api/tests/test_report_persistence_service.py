from concurrent.futures import ThreadPoolExecutor
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from threading import Barrier, Lock
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.schemas.enums import ReportCategory, ReportStatus, ReportUrgency
from app.schemas.reports import ReportCreate
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.reports import (
    ReportPersistenceService,
    canonical_payload_hash,
    normalize_phone_number,
)


class Transaction(AbstractContextManager):
    def __init__(self, session):
        self.session = session

    def __enter__(self):
        self.session.entered += 1
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.session.exited += 1
        self.session.last_exception_type = exc_type
        if exc_type is None:
            self.session.committed += 1
        else:
            self.session.rolled_back += 1
        return False


class TransactionSession:
    def __init__(self):
        self.entered = 0
        self.exited = 0
        self.last_exception_type = None
        self.committed = 0
        self.rolled_back = 0

    def begin(self):
        return Transaction(self)


class FakeRepository:
    def __init__(self):
        self.category = {
            "id": UUID("600dc7e0-1cd8-4249-aa22-80a1ad65ee42")
        }
        self.citizen = {
            "id": UUID("5c242fc6-77a8-4fa7-a12f-a67bbc75839b")
        }
        self.report = {
            "id": UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
            "status": "pending_verification",
            "ticket_number": "LP-2026-0001",
            "category": "infrastructure",
            "category_id": self.category["id"],
            "citizen_id": self.citizen["id"],
            "citizen_display_name": None,
            "description": "Jalan rusak.",
            "location_text": "RT 03",
            "latitude": None,
            "longitude": None,
            "urgency": "high",
            "summary": "Kerusakan jalan di RT 03.",
            "responsible_unit_id": None,
            "responsible_unit_name": None,
            "ai_recommendation": {},
            "verified_at": None,
            "resolved_at": None,
            "created_at": datetime(2026, 9, 16, 14, tzinfo=UTC),
            "updated_at": datetime(2026, 9, 16, 14, tzinfo=UTC),
        }
        self.inserted_report = None
        self.inserted_history = None
        self.locked_report = {"id": "report-id", "status": "pending_verification"}
        self.updated_report = None
        self.existing_report = None
        self.lock_key = None

    def acquire_idempotency_lock(self, lock_key):
        self.lock_key = lock_key

    def find_report_by_idempotency_key(self, idempotency_key):
        self.idempotency_key = idempotency_key
        return self.existing_report

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
        self.updated_report = {
            **self.report,
            **values,
            "updated_at": datetime(2026, 9, 16, 15, tzinfo=UTC),
        }
        return self.updated_report

    def list_reports(self, **parameters):
        self.list_parameters = parameters
        return [self.report], 1

    def get_report_detail(self, report_id):
        return self.report

    def list_attachments(self, report_id):
        return [{"id": "attachment-id"}]

    def list_status_history(self, report_id):
        return [
            {
                "id": UUID("8e400a10-5712-46f9-ad6c-d16999a18fc2"),
                "report_id": report_id,
                "old_status": None,
                "new_status": "pending_verification",
                "actor_type": "system",
                "actor_identifier": None,
                "notes": "Report created",
                "created_at": datetime(2026, 9, 16, 14, tzinfo=UTC),
            }
        ]


def valid_payload(**overrides):
    values = {
        "sender_phone_number": "+6281234567890",
        "category": "infrastructure",
        "description": "Jalan rusak.",
        "location": {"text": "RT 03"},
        "urgency": "high",
        "source": "whatsapp",
        "ai_analysis": {
            "confidence": 0.94,
            "summary": "Kerusakan jalan di RT 03.",
        },
    }
    values.update(overrides)
    return ReportCreate.model_validate(values)


def test_create_report_and_initial_history_share_one_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)

    result = service.create_idempotent_report(
        payload=valid_payload(),
        idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
    )

    assert result.report["ticket_number"] == "LP-2026-0001"
    assert result.replayed is False
    assert repository.inserted_report["citizen_id"] == repository.citizen["id"]
    assert repository.inserted_report["category_id"] == repository.category["id"]
    assert "ticket_number" not in repository.inserted_report
    assert repository.inserted_history["report_id"] == repository.report["id"]
    assert repository.inserted_history["new_status"] == "pending_verification"
    assert repository.inserted_history["notes"] == "Report created"
    assert repository.lock_key is not None
    assert session.entered == 1
    assert session.exited == 1
    assert session.last_exception_type is None
    assert session.committed == 1
    assert session.rolled_back == 0


def test_missing_category_aborts_create_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    repository.category = None
    service = ReportPersistenceService(session, repository)

    with pytest.raises(CategoryNotFoundError):
        service.create_idempotent_report(
            payload=valid_payload(category="other"),
            idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
        )

    assert repository.inserted_report is None
    assert session.last_exception_type is CategoryNotFoundError
    assert session.rolled_back == 1


def test_status_update_locks_report_and_writes_history_atomically():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)
    report_id = UUID("72af1a52-7016-48c7-aacc-6c35417be819")

    result = service.update_report_status(
        report_id=report_id,
        new_status=ReportStatus.VERIFIED,
        reason="Verified",
        actor_identifier="admin-desa-demo",
    )

    assert result.status is ReportStatus.VERIFIED
    assert repository.report_id == report_id
    assert repository.inserted_history["old_status"] == "pending_verification"
    assert repository.inserted_history["new_status"] == "verified"
    assert repository.inserted_history["actor_type"] == "admin"
    assert repository.inserted_history["actor_identifier"] == "admin-desa-demo"
    assert repository.inserted_history["notes"] == "Verified"
    assert "verified_at" in repository.updated_values
    assert session.entered == 1
    assert session.exited == 1
    assert session.committed == 1


def test_status_update_rejects_missing_report_inside_transaction():
    session = TransactionSession()
    repository = FakeRepository()
    repository.locked_report = None
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportNotFoundError):
        service.update_report_status(
            report_id=UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
            new_status=ReportStatus.VERIFIED,
            reason="Verified",
            actor_identifier="admin-desa-demo",
        )

    assert session.last_exception_type is ReportNotFoundError
    assert session.rolled_back == 1


@pytest.mark.parametrize(
    ("old_status", "new_status"),
    [
        (ReportStatus.PENDING_VERIFICATION, ReportStatus.VERIFIED),
        (ReportStatus.PENDING_VERIFICATION, ReportStatus.REJECTED),
        (ReportStatus.VERIFIED, ReportStatus.IN_PROGRESS),
        (ReportStatus.IN_PROGRESS, ReportStatus.FORWARDED),
        (ReportStatus.IN_PROGRESS, ReportStatus.RESOLVED),
        (ReportStatus.FORWARDED, ReportStatus.RESOLVED),
    ],
)
def test_all_canonical_status_transitions_are_allowed(old_status, new_status):
    session = TransactionSession()
    repository = FakeRepository()
    repository.locked_report = {
        "id": repository.report["id"],
        "status": old_status.value,
    }
    service = ReportPersistenceService(session, repository)

    result = service.update_report_status(
        report_id=repository.report["id"],
        new_status=new_status,
        reason="Status updated",
        actor_identifier="admin-desa-demo",
    )

    assert result.status is new_status
    if new_status is ReportStatus.RESOLVED:
        assert "resolved_at" in repository.updated_values


@pytest.mark.parametrize(
    ("old_status", "new_status"),
    [
        (ReportStatus.PENDING_VERIFICATION, ReportStatus.RESOLVED),
        (ReportStatus.VERIFIED, ReportStatus.REJECTED),
        (ReportStatus.RESOLVED, ReportStatus.IN_PROGRESS),
        (ReportStatus.REJECTED, ReportStatus.VERIFIED),
    ],
)
def test_invalid_status_transitions_are_rejected_without_update(
    old_status,
    new_status,
):
    session = TransactionSession()
    repository = FakeRepository()
    repository.locked_report = {
        "id": repository.report["id"],
        "status": old_status.value,
    }
    service = ReportPersistenceService(session, repository)

    with pytest.raises(InvalidStatusTransitionError) as error:
        service.update_report_status(
            report_id=repository.report["id"],
            new_status=new_status,
            reason="Invalid change",
            actor_identifier="admin-desa-demo",
        )

    assert error.value.old_status == old_status.value
    assert error.value.new_status == new_status.value
    assert repository.updated_report is None
    assert repository.inserted_history is None


def test_sqlalchemy_error_is_wrapped_without_fake_success():
    session = TransactionSession()
    repository = FakeRepository()
    repository.insert_report = lambda values: (_ for _ in ()).throw(
        SQLAlchemyError("database unavailable")
    )
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportPersistenceError) as error:
        service.create_idempotent_report(
            payload=valid_payload(),
            idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
        )

    assert error.value.operation == "report creation"
    assert session.rolled_back == 1


def test_create_rolls_back_when_initial_history_insert_fails():
    session = TransactionSession()
    repository = FakeRepository()
    repository.insert_status_history = lambda values: (_ for _ in ()).throw(
        SQLAlchemyError("history unavailable")
    )
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportPersistenceError):
        service.create_idempotent_report(
            payload=valid_payload(),
            idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
        )

    assert repository.inserted_report is not None
    assert session.committed == 0
    assert session.rolled_back == 1


def test_status_update_rolls_back_when_history_insert_fails():
    session = TransactionSession()
    repository = FakeRepository()
    repository.insert_status_history = lambda values: (_ for _ in ()).throw(
        SQLAlchemyError("history unavailable")
    )
    service = ReportPersistenceService(session, repository)

    with pytest.raises(ReportPersistenceError):
        service.update_report_status(
            report_id=repository.report["id"],
            new_status=ReportStatus.VERIFIED,
            reason="Verified",
            actor_identifier="admin-desa-demo",
        )

    assert repository.updated_report is not None
    assert session.committed == 0
    assert session.rolled_back == 1


def test_same_idempotency_key_and_payload_replays_existing_report():
    session = TransactionSession()
    repository = FakeRepository()
    payload = valid_payload(sender_phone_number="0812-3456-7890")
    normalized = normalize_phone_number(payload.sender_phone_number)
    repository.existing_report = {
        **repository.report,
        "idempotency_payload_hash": canonical_payload_hash(payload, normalized),
    }
    service = ReportPersistenceService(session, repository)

    result = service.create_idempotent_report(
        payload=payload,
        idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
    )

    assert result.replayed is True
    assert result.report["ticket_number"] == "LP-2026-0001"
    assert repository.inserted_report is None
    assert repository.inserted_history is None
    assert not hasattr(repository, "phone_number")


def test_same_idempotency_key_with_different_payload_is_rejected():
    session = TransactionSession()
    repository = FakeRepository()
    repository.existing_report = {
        **repository.report,
        "idempotency_payload_hash": "different-hash",
    }
    service = ReportPersistenceService(session, repository)

    with pytest.raises(DuplicateOperationError):
        service.create_idempotent_report(
            payload=valid_payload(),
            idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
        )

    assert repository.inserted_report is None
    assert session.last_exception_type is DuplicateOperationError


class ConcurrentStore:
    def __init__(self):
        self.lock = Lock()
        self.report = None
        self.report_inserts = 0
        self.history_inserts = 0


class ConcurrentTransaction(AbstractContextManager):
    def __init__(self, store):
        self.store = store

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.store.lock.release()
        return False


class ConcurrentSession:
    def __init__(self, store):
        self.store = store

    def begin(self):
        return ConcurrentTransaction(self.store)


class ConcurrentRepository:
    def __init__(self, store):
        self.store = store

    def acquire_idempotency_lock(self, lock_key):
        self.store.lock.acquire()

    def find_report_by_idempotency_key(self, idempotency_key):
        return self.store.report

    def get_or_create_citizen(self, phone_number):
        return {"id": UUID("5c242fc6-77a8-4fa7-a12f-a67bbc75839b")}

    def resolve_active_category(self, category_code):
        return {"id": UUID("600dc7e0-1cd8-4249-aa22-80a1ad65ee42")}

    def insert_report(self, values):
        self.store.report_inserts += 1
        self.store.report = {
            **values,
            "id": UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
            "ticket_number": "LP-2026-0001",
            "status": "pending_verification",
            "created_at": datetime(2026, 9, 16, 14, tzinfo=UTC),
        }
        return self.store.report

    def insert_status_history(self, values):
        self.store.history_inserts += 1
        return values


def test_concurrent_same_key_requests_create_only_one_report():
    store = ConcurrentStore()
    barrier = Barrier(2)
    idempotency_key = UUID("ef51f99f-a47d-4a31-a3db-e520838997f5")

    def create_report():
        service = ReportPersistenceService(
            ConcurrentSession(store),
            ConcurrentRepository(store),
        )
        barrier.wait()
        return service.create_idempotent_report(
            payload=valid_payload(),
            idempotency_key=idempotency_key,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _index: create_report(), range(2)))

    assert sorted(result.replayed for result in results) == [False, True]
    assert store.report_inserts == 1
    assert store.history_inserts == 1


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+6281234567890", "+6281234567890"),
        ("6281234567890", "+6281234567890"),
        ("0812-3456-7890", "+6281234567890"),
    ],
)
def test_phone_number_normalization(raw, expected):
    assert normalize_phone_number(raw) == expected


def test_equivalent_phone_formats_produce_same_payload_hash():
    local_payload = valid_payload(sender_phone_number="0812-3456-7890")
    international_payload = valid_payload(
        sender_phone_number="+6281234567890"
    )

    assert canonical_payload_hash(
        local_payload,
        normalize_phone_number(local_payload.sender_phone_number),
    ) == canonical_payload_hash(
        international_payload,
        normalize_phone_number(international_payload.sender_phone_number),
    )


def test_invalid_phone_number_is_rejected_before_transaction():
    session = TransactionSession()
    service = ReportPersistenceService(session, FakeRepository())

    with pytest.raises(InvalidSenderIdentityError):
        service.create_idempotent_report(
            payload=valid_payload(sender_phone_number="not-a-phone"),
            idempotency_key=UUID("ef51f99f-a47d-4a31-a3db-e520838997f5"),
        )

    assert session.entered == 0


def test_detail_aggregates_attachments_and_ordered_history():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)
    report_id = UUID("72af1a52-7016-48c7-aacc-6c35417be819")

    detail = service.get_report_detail(report_id)

    assert detail.attachments == [{"id": "attachment-id"}]
    assert detail.status_history[0].new_status.value == "pending_verification"
    assert detail.citizen.display_name == "Warga"


def test_list_maps_filters_pagination_and_response_shape():
    session = TransactionSession()
    repository = FakeRepository()
    service = ReportPersistenceService(session, repository)

    response = service.list_reports(
        page=2,
        page_size=20,
        status=ReportStatus.PENDING_VERIFICATION,
        urgency=ReportUrgency.HIGH,
        category=ReportCategory.INFRASTRUCTURE,
        search="  LP-2026  ",
    )

    assert response.page == 2
    assert response.page_size == 20
    assert response.total == 1
    assert response.items[0].location.text == "RT 03"
    assert repository.list_parameters == {
        "offset": 20,
        "limit": 20,
        "status": "pending_verification",
        "urgency": "high",
        "category": "infrastructure",
        "search": "LP-2026",
    }
