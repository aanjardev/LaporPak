from contextlib import AbstractContextManager
from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.schemas.referrals import (
    ReferralApproval,
    ReferralCancel,
    ReferralCreate,
    ReferralPackageInput,
    ReferralTaskUpdate,
)
from app.services.referrals import (
    DeliveryUnknownError,
    ReferralConflictError,
    ReferralNotFoundError,
    ReferralService,
    RetryableDeliveryError,
    _dispatch_block_reason,
    _failure_state,
    _lookup_mock_delivery,
    _mock_receipt,
    _requires_reconciliation_lookup,
    _store_mock_delivery,
    canonical_hash,
)

REPORT_ID = UUID("20000000-0000-4000-8000-000000000001")
REFERRAL_ID = UUID("30000000-0000-4000-8000-000000000001")
PACKAGE_ID = UUID("40000000-0000-4000-8000-000000000001")
CHANNEL_ID = UUID("50000000-0000-4000-8000-000000000001")
TASK_ID = UUID("90000000-0000-4000-8000-000000000001")
UNIT_A = UUID("00000000-0000-4000-8000-0000000000a1")
UNIT_B = UUID("00000000-0000-4000-8000-0000000000b1")
NOW = datetime(2026, 9, 21, 12, tzinfo=UTC)


class Transaction(AbstractContextManager):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class Session:
    def begin(self):
        return Transaction()


class Repository:
    def __init__(self):
        self.report = {
            "id": REPORT_ID,
            "administrative_unit_id": UNIT_A,
            "category": "infrastructure",
            "status": "in_progress",
        }
        self.channel = {
            "id": CHANNEL_ID,
            "target_unit_id": UUID("00000000-0000-4000-8000-0000000000c1"),
            "target_name": "INSTANSI_UJI_REFERRAL",
            "display_name": "Kanal Mock",
            "mode": "mock",
            "synthetic": True,
            "approved_for_production": False,
            "authority_source": {"synthetic": True},
        }
        self.referral = None
        self.packages = {}
        self.jobs = []
        self.events = []
        self.task = {
            "id": TASK_ID,
            "referral_id": REFERRAL_ID,
            "task_type": "reconcile_delivery",
            "status": "open",
            "assigned_to": None,
            "next_action": "Periksa bukti penerima.",
            "due_at": None,
            "blocked_reason": "Timeout ambigu",
            "created_at": NOW,
            "updated_at": NOW,
        }

    def get_scoped_report(self, report_id, unit_ids, lock=False):
        return self.report if report_id == REPORT_ID and UNIT_A in unit_ids else None

    def list_routing_options(self, source_unit_id, category):
        if source_unit_id == UNIT_A and category == "infrastructure":
            return [self.channel]
        return []

    def get_channel_for_report(self, channel_id, source_unit_id, category):
        options = self.list_routing_options(source_unit_id, category)
        return options[0] if options and channel_id == CHANNEL_ID else None

    def package_attachments(self, report_id, attachment_ids):
        return [
            {
                "id": attachment_id,
                "file_name": "evidence.jpg",
                "mime_type": "image/jpeg",
                "metadata": {"sha256": "f" * 64},
            }
            for attachment_id in attachment_ids
        ]

    def find_by_request_key(self, source_unit_id, request_key):
        for package in self.packages.values():
            if package["request_key"] == request_key:
                return {
                    **self.referral,
                    "request_payload_hash": package["request_payload_hash"],
                }
        return None

    def lock_referral_for_report_channel(self, report_id, channel_id):
        return self.referral

    def insert_referral(self, values):
        self.referral = {
            **values,
            "id": REFERRAL_ID,
            "registration_status": "unverified",
            "handling_status": "unassigned",
            "external_reference": None,
            "evidence_reference": None,
            "updated_at": NOW,
        }
        return self.referral

    def update_referral(self, referral_id, values):
        self.referral.update(values)
        self.referral["updated_at"] = NOW
        return self.referral

    def insert_package(self, values):
        package = {
            **values,
            "id": PACKAGE_ID,
            "approved_at": None,
            "approval_revoked_at": None,
        }
        self.packages[values["package_version"]] = package
        return package

    def get_package(self, referral_id, version):
        return self.packages.get(version)

    def revoke_package_approval(self, package_id):
        for package in self.packages.values():
            if package["id"] == package_id:
                package["approval_revoked_at"] = NOW

    def approve_package(self, package_id, actor, reason):
        package = next(p for p in self.packages.values() if p["id"] == package_id)
        package.update(approved_by=actor, approval_reason=reason, approved_at=NOW)
        return package

    def get_scoped_referral(self, referral_id, unit_ids, lock=False):
        if not self.referral or referral_id != REFERRAL_ID or UNIT_A not in unit_ids:
            return None
        return {
            **self.referral,
            "target_name": self.channel["target_name"],
            "channel_name": self.channel["display_name"],
            "channel_mode": "mock",
            "channel_synthetic": True,
            "approved_for_production": False,
            "channel_config": {"scenario": "accepted"},
        }

    def insert_event(self, values):
        self.events.append(values)
        return values

    def find_job_by_operation(self, operation_key):
        return next(
            (job for job in self.jobs if job["operation_key"] == operation_key), None
        )

    def find_latest_job(self, referral_id):
        return self.jobs[-1] if self.jobs else None

    def insert_job(self, values):
        job = {
            **values,
            "id": UUID("60000000-0000-4000-8000-000000000001"),
            "status": "pending",
        }
        self.jobs.append(job)
        return job

    def cancel_queued_jobs(self, referral_id):
        for job in self.jobs:
            if job["referral_id"] == referral_id and job["status"] == "pending":
                job["status"] = "cancelled"

    def get_scoped_task(self, task_id, unit_ids, lock=False):
        return self.task if task_id == TASK_ID and UNIT_A in unit_ids else None

    def update_task(self, task_id, values):
        assert task_id == TASK_ID
        self.task.update(values)
        self.task["updated_at"] = NOW
        return self.task


def payload(request_key, summary="Jalan rusak"):
    return ReferralCreate(
        channel_id=CHANNEL_ID,
        request_key=request_key,
        package=ReferralPackageInput(
            summary=summary,
            chronology="Kerusakan terlihat sejak kemarin.",
            requested_action="Mohon pemeriksaan.",
        ),
    )


def test_full_draft_approval_and_idempotent_dispatch_flow():
    repository = Repository()
    service = ReferralService(Session(), repository)
    request_key = UUID("70000000-0000-4000-8000-000000000001")
    operation_key = UUID("80000000-0000-4000-8000-000000000001")

    draft = service.create_draft(REPORT_ID, payload(request_key), "admin-a", (UNIT_A,))
    approved = service.approve(
        REFERRAL_ID,
        ReferralApproval(
            package_version=1,
            package_hash=draft.package_hash,
            reason="Paket sudah diperiksa.",
        ),
        "admin-a",
        (UNIT_A,),
    )
    dispatched = service.dispatch(REFERRAL_ID, operation_key, "admin-a", (UNIT_A,))
    replayed = service.dispatch(REFERRAL_ID, operation_key, "admin-a", (UNIT_A,))

    assert draft.dispatch_status == "awaiting_approval"
    assert draft.package_snapshot is not None
    assert draft.package_snapshot.summary == "Jalan rusak"
    assert draft.package_snapshot.attachment_count == 0
    assert draft.package_snapshot.share_citizen_identity is False
    assert approved.dispatch_status == "approved"
    assert dispatched.job_status == "pending"
    assert dispatched.replayed is False
    assert replayed.replayed is True
    assert len(repository.jobs) == 1


def test_list_tasks_is_scoped_and_hides_assignment_identifier():
    class TaskRepository(Repository):
        def list_tasks_for_report(self, report_id, unit_ids):
            assert report_id == REPORT_ID
            assert unit_ids == (UNIT_A,)
            return [{
                "id": UUID("90000000-0000-4000-8000-000000000001"),
                "referral_id": REFERRAL_ID,
                "task_type": "reconcile_delivery",
                "status": "open",
                "assigned_to": "supabase:private-actor",
                "next_action": "Periksa bukti penerima.",
                "due_at": None,
                "blocked_reason": "Timeout ambigu",
                "created_at": NOW,
                "updated_at": NOW,
            }]

    tasks = ReferralService(Session(), TaskRepository()).list_tasks(
        REPORT_ID, (UNIT_A,), "supabase:other-actor"
    )

    assert tasks[0].next_action == "Periksa bukti penerima."
    assert tasks[0].assigned is True
    assert tasks[0].assigned_to_me is False
    assert not hasattr(tasks[0], "assigned_to")


def test_task_can_only_be_completed_by_operator_who_claimed_it():
    repository = Repository()
    service = ReferralService(Session(), repository)
    actor = "supabase:admin-a"

    claimed = service.update_task(
        TASK_ID, ReferralTaskUpdate(action="claim"), actor, (UNIT_A,)
    )
    assert claimed.assigned_to_me is True

    with pytest.raises(ReferralConflictError):
        service.update_task(
            TASK_ID,
            ReferralTaskUpdate(action="complete", reason="Sudah diperiksa"),
            "supabase:admin-b",
            (UNIT_A,),
        )

    completed = service.update_task(
        TASK_ID,
        ReferralTaskUpdate(action="complete", reason="Bukti telah diperiksa"),
        actor,
        (UNIT_A,),
    )
    assert completed.status == "completed"
    assert completed.blocked_reason is None
    assert [event["event_type"] for event in repository.events] == [
        "task_claim",
        "task_complete",
    ]


def test_task_update_is_scoped_to_village():
    service = ReferralService(Session(), Repository())

    with pytest.raises(ReferralNotFoundError):
        service.update_task(
            TASK_ID,
            ReferralTaskUpdate(action="claim"),
            "supabase:admin-b",
            (UNIT_B,),
        )


def test_village_b_cannot_observe_or_create_village_a_referral():
    service = ReferralService(Session(), Repository())
    with pytest.raises(ReferralNotFoundError):
        service.routing_options(REPORT_ID, (UNIT_B,))
    with pytest.raises(ReferralNotFoundError):
        service.create_draft(
            REPORT_ID,
            payload(UUID("70000000-0000-4000-8000-000000000002")),
            "admin-b",
            (UNIT_B,),
        )


def test_package_cannot_reference_an_attachment_from_another_report():
    repository = Repository()
    repository.package_attachments = lambda report_id, attachment_ids: []
    request = payload(UUID("70000000-0000-4000-8000-000000000007"))
    request.package.attachment_ids = [
        UUID("a0000000-0000-4000-8000-000000000001")
    ]

    with pytest.raises(ReferralConflictError, match="outside this report"):
        ReferralService(Session(), repository).create_draft(
            REPORT_ID, request, "admin-a", (UNIT_A,)
        )


def test_package_change_invalidates_old_approval_version():
    repository = Repository()
    service = ReferralService(Session(), repository)
    first = service.create_draft(
        REPORT_ID,
        payload(UUID("70000000-0000-4000-8000-000000000003")),
        "admin-a",
        (UNIT_A,),
    )
    service.approve(
        REFERRAL_ID,
        ReferralApproval(
            package_version=1,
            package_hash=first.package_hash,
            reason="Versi awal.",
        ),
        "admin-a",
        (UNIT_A,),
    )
    second = service.create_draft(
        REPORT_ID,
        payload(
            UUID("70000000-0000-4000-8000-000000000004"),
            summary="Jalan rusak parah",
        ),
        "admin-a",
        (UNIT_A,),
    )

    assert second.active_package_version == 2
    assert repository.packages[1]["approval_revoked_at"] == NOW
    with pytest.raises(ReferralConflictError):
        service.approve(
            REFERRAL_ID,
            ReferralApproval(
                package_version=1,
                package_hash=first.package_hash,
                reason="Versi lama.",
            ),
            "admin-a",
            (UNIT_A,),
        )


def test_dispatch_without_approval_and_second_operation_are_rejected():
    repository = Repository()
    service = ReferralService(Session(), repository)
    draft = service.create_draft(
        REPORT_ID,
        payload(UUID("70000000-0000-4000-8000-000000000005")),
        "admin-a",
        (UNIT_A,),
    )
    with pytest.raises(ReferralConflictError):
        service.dispatch(
            REFERRAL_ID,
            UUID("80000000-0000-4000-8000-000000000002"),
            "admin-a",
            (UNIT_A,),
        )
    service.approve(
        REFERRAL_ID,
        ReferralApproval(
            package_version=1,
            package_hash=draft.package_hash,
            reason="Siap.",
        ),
        "admin-a",
        (UNIT_A,),
    )
    service.dispatch(
        REFERRAL_ID,
        UUID("80000000-0000-4000-8000-000000000003"),
        "admin-a",
        (UNIT_A,),
    )
    with pytest.raises(ReferralConflictError):
        service.dispatch(
            REFERRAL_ID,
            UUID("80000000-0000-4000-8000-000000000004"),
            "admin-a",
            (UNIT_A,),
        )


def test_mock_receipt_is_explicitly_simulated_and_deterministic():
    operation_key = UUID("80000000-0000-4000-8000-000000000005")
    receipt = _mock_receipt(operation_key, CHANNEL_ID, "a" * 64, "accepted")

    assert receipt["external_reference"].startswith("MOCK-")
    assert receipt["registration_outcome"] == "registered"
    assert receipt["handling_outcome"] == "accepted"
    transport_only = _mock_receipt(
        operation_key, CHANNEL_ID, "a" * 64, "transport_only"
    )
    assert transport_only["registration_outcome"] == "unverified"
    assert transport_only["handling_outcome"] == "unassigned"
    assert canonical_hash({"b": 2, "a": 1}) == canonical_hash({"a": 1, "b": 2})


def test_timeout_after_accept_is_recovered_from_persistent_mock_ledger(monkeypatch):
    ledger = {}

    class LedgerSession(Session):
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

    class LedgerRepository:
        def __init__(self, session):
            self.session = session

        def get_mock_receipt(self, operation_key):
            return ledger.get(operation_key)

        def insert_mock_receipt(self, values):
            ledger[values["operation_key"]] = values
            return values

    monkeypatch.setattr("app.services.referrals.SessionLocal", LedgerSession)
    monkeypatch.setattr("app.services.referrals.ReferralRepository", LedgerRepository)
    context = {
        "operation_key": UUID("80000000-0000-4000-8000-000000000006"),
        "channel_id": CHANNEL_ID,
        "package_hash": "a" * 64,
        "channel_mode": "mock",
        "channel_synthetic": True,
        "approved_for_production": False,
        "channel_capabilities": {"lookup": True},
        "channel_config": {"scenario": "timeout_after_accept"},
    }

    with pytest.raises(DeliveryUnknownError):
        _store_mock_delivery(context)
    recovered = _lookup_mock_delivery(context)
    replayed = _store_mock_delivery(context)

    assert recovered.external_reference == replayed.external_reference
    assert recovered.handling_outcome == "accepted"
    assert len(ledger) == 1


@pytest.mark.parametrize("scenario", ["throttled", "timeout_before_accept"])
def test_retryable_mock_failures_do_not_create_fake_receipts(scenario):
    context = {
        "operation_key": UUID("80000000-0000-4000-8000-000000000007"),
        "channel_id": CHANNEL_ID,
        "package_hash": "a" * 64,
        "channel_mode": "mock",
        "channel_synthetic": True,
        "approved_for_production": False,
        "channel_config": {"scenario": scenario},
    }
    with pytest.raises(RetryableDeliveryError):
        _store_mock_delivery(context)


def test_mock_worker_rejects_live_or_production_approved_channel():
    base = {
        "operation_key": UUID("80000000-0000-4000-8000-000000000008"),
        "channel_id": CHANNEL_ID,
        "package_hash": "a" * 64,
        "channel_synthetic": True,
        "approved_for_production": False,
        "channel_config": {"scenario": "accepted"},
    }
    with pytest.raises(PermissionError):
        _store_mock_delivery({**base, "channel_mode": "live"})
    with pytest.raises(PermissionError):
        _store_mock_delivery(
            {**base, "channel_mode": "mock", "approved_for_production": True}
        )


def test_provider_without_lookup_remains_delivery_unknown():
    with pytest.raises(DeliveryUnknownError, match="does not support"):
        _lookup_mock_delivery({"channel_capabilities": {"lookup": False}})


def test_worker_rechecks_approval_version_and_channel_kill_switch():
    valid = {
        "approved_at": NOW,
        "approval_revoked_at": None,
        "active_package_version": 2,
        "package_version": 2,
        "channel_is_active": True,
    }
    assert _dispatch_block_reason(valid) is None
    assert _dispatch_block_reason({**valid, "approval_revoked_at": NOW}) == (
        "approval_invalid"
    )
    assert _dispatch_block_reason({**valid, "package_version": 1}) == (
        "package_version_changed"
    )
    assert _dispatch_block_reason({**valid, "channel_is_active": False}) == (
        "channel_disabled"
    )


def test_recovered_worker_lease_requires_lookup_instead_of_blind_resend():
    assert _requires_reconciliation_lookup(
        {"last_error": "reconcile:worker_lease_expired"}
    )
    assert not _requires_reconciliation_lookup({"last_error": "retry:throttled"})


def test_retry_limit_becomes_failed_with_an_operator_task():
    assert _failure_state("retry", 1, 3) == ("queued", "pending")
    assert _failure_state("retry", 3, 3) == ("failed", "failed")
    assert _failure_state("delivery_unknown", 1, 3) == (
        "delivery_unknown",
        "failed",
    )


def test_cancellation_before_side_effect_cancels_queued_job():
    repository = Repository()
    service = ReferralService(Session(), repository)
    draft = service.create_draft(
        REPORT_ID,
        payload(UUID("70000000-0000-4000-8000-000000000006")),
        "admin-a",
        (UNIT_A,),
    )
    service.approve(
        REFERRAL_ID,
        ReferralApproval(
            package_version=1,
            package_hash=draft.package_hash,
            reason="Siap.",
        ),
        "admin-a",
        (UNIT_A,),
    )
    service.dispatch(
        REFERRAL_ID,
        UUID("80000000-0000-4000-8000-000000000009"),
        "admin-a",
        (UNIT_A,),
    )

    cancelled = service.cancel(
        REFERRAL_ID,
        ReferralCancel(reason="Tujuan perlu ditinjau ulang."),
        "admin-a",
        (UNIT_A,),
    )

    assert cancelled.dispatch_status == "cancelled"
    assert repository.jobs[0]["status"] == "cancelled"
