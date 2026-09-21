import asyncio
import hashlib
import json
import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.referral_repositories import ReferralRepository
from app.db.repositories import ReportRepository
from app.db.session import SessionLocal
from app.schemas.referrals import (
    DispatchStatus,
    ReferralApproval,
    ReferralCancel,
    ReferralCreate,
    ReferralDispatchResponse,
    ReferralProgress,
    ReferralWorkerResult,
    RoutingOption,
    RoutingOptionsResponse,
)

logger = logging.getLogger(__name__)


class ReferralError(Exception):
    pass


class ReferralNotFoundError(ReferralError):
    pass


class ReferralConflictError(ReferralError):
    pass


class ReferralUnavailableError(ReferralError):
    pass


class RetryableDeliveryError(Exception):
    pass


class DeliveryUnknownError(Exception):
    pass


@dataclass(frozen=True)
class MockReceipt:
    channel_id: UUID
    is_simulated: bool
    operation_key: UUID
    transport_outcome: str
    external_reference: str | None
    registration_outcome: str
    handling_outcome: str
    evidence_reference: str | None
    occurred_at: datetime
    observed_at: datetime


def canonical_hash(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


def referral_state(row: Mapping[str, Any], package_hash: str, next_action=None):
    return ReferralProgress(
        id=row["id"],
        report_id=row["report_id"],
        source_unit_id=row["source_unit_id"],
        channel_id=row["channel_id"],
        target_name=row["target_name"],
        channel_name=row["channel_name"],
        active_package_version=row["active_package_version"],
        package_hash=package_hash,
        dispatch_status=row["dispatch_status"],
        registration_status=row["registration_status"],
        handling_status=row["handling_status"],
        external_reference=row["external_reference"],
        evidence_reference=row["evidence_reference"],
        is_simulated=row["is_simulated"],
        next_action=next_action if next_action is not None else row.get("next_action"),
        updated_at=row["updated_at"],
    )


class ReferralService:
    def __init__(
        self, session: Session, repository: ReferralRepository | None = None
    ) -> None:
        self.session = session
        self.repository = repository or ReferralRepository(session)

    def routing_options(
        self, report_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> RoutingOptionsResponse:
        try:
            report = self.repository.get_scoped_report(report_id, unit_ids)
            if report is None:
                raise ReferralNotFoundError
            options = self.repository.list_routing_options(
                report["administrative_unit_id"], report["category"]
            )
            return RoutingOptionsResponse(
                report_id=report_id,
                items=[
                    RoutingOption(
                        channel_id=row["id"],
                        target_unit_id=row["target_unit_id"],
                        target_name=row["target_name"],
                        channel_name=row["display_name"],
                        mode=row["mode"],
                        authority_source=row["authority_source"],
                        is_simulated=True,
                    )
                    for row in options
                ],
                needs_review=not options,
            )
        except ReferralNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def create_draft(
        self,
        report_id: UUID,
        payload: ReferralCreate,
        actor: str,
        unit_ids: tuple[UUID, ...],
    ) -> ReferralProgress:
        package_snapshot = payload.package.model_dump(mode="json")
        try:
            with self.session.begin():
                report = self.repository.get_scoped_report(
                    report_id, unit_ids, lock=True
                )
                if report is None:
                    raise ReferralNotFoundError
                if report["status"] != "in_progress":
                    raise ReferralConflictError(
                        "Referral can only be prepared for an in-progress report"
                    )
                channel = self.repository.get_channel_for_report(
                    payload.channel_id,
                    report["administrative_unit_id"],
                    report["category"],
                )
                if channel is None:
                    raise ReferralConflictError("Routing option is not available")
                attachments = self.repository.package_attachments(
                    report_id, payload.package.attachment_ids
                )
                if {row["id"] for row in attachments} != set(
                    payload.package.attachment_ids
                ):
                    raise ReferralConflictError(
                        "Package contains an attachment outside this report"
                    )

                material = {
                    "report_id": str(report_id),
                    "source_unit_id": str(report["administrative_unit_id"]),
                    "channel_id": str(payload.channel_id),
                    "package": package_snapshot,
                    "attachments": [
                        {
                            "id": str(row["id"]),
                            "file_name": row["file_name"],
                            "mime_type": row["mime_type"],
                            "sha256": (row["metadata"] or {}).get("sha256"),
                        }
                        for row in attachments
                    ],
                }
                package_hash = canonical_hash(material)
                existing_request = self.repository.find_by_request_key(
                    report["administrative_unit_id"], payload.request_key
                )
                if existing_request is not None:
                    if existing_request["request_payload_hash"] != package_hash:
                        raise ReferralConflictError(
                            "Request key was already used for another package"
                        )
                    return self._progress(existing_request["id"], unit_ids)

                referral = self.repository.lock_referral_for_report_channel(
                    report_id, payload.channel_id
                )
                if referral is None:
                    referral = self.repository.insert_referral(
                        {
                            "report_id": report_id,
                            "source_unit_id": report["administrative_unit_id"],
                            "channel_id": payload.channel_id,
                            "active_package_version": 1,
                            "dispatch_status": "awaiting_approval",
                            "is_simulated": True,
                            "created_by": actor,
                        }
                    )
                    version = 1
                else:
                    if referral["dispatch_status"] in {
                        "queued",
                        "sending",
                        "sent",
                        "delivery_unknown",
                    }:
                        raise ReferralConflictError(
                            "A dispatched package cannot be edited in place"
                        )
                    previous = self.repository.get_package(
                        referral["id"], referral["active_package_version"]
                    )
                    if previous is not None and previous["approved_at"] is not None:
                        self.repository.revoke_package_approval(previous["id"])
                    version = referral["active_package_version"] + 1
                    referral = self.repository.update_referral(
                        referral["id"],
                        {
                            "active_package_version": version,
                            "dispatch_status": "awaiting_approval",
                            "registration_status": "unverified",
                            "handling_status": "unassigned",
                            "external_reference": None,
                            "evidence_reference": None,
                        },
                    )
                self.repository.insert_package(
                    {
                        "referral_id": referral["id"],
                        "package_version": version,
                        "package_hash": package_hash,
                        "request_key": payload.request_key,
                        "request_payload_hash": package_hash,
                        "snapshot": material,
                        "created_by": actor,
                    }
                )
                self.repository.insert_event(
                    {
                        "referral_id": referral["id"],
                        "event_type": "package_prepared",
                        "actor_identifier": actor,
                        "event_key": f"package:{version}",
                        "after_state": {
                            "package_version": version,
                            "package_hash": package_hash,
                            "is_simulated": True,
                        },
                    }
                )
                return self._progress(referral["id"], unit_ids)
        except ReferralConflictError, ReferralNotFoundError:
            raise
        except IntegrityError as exc:
            raise ReferralConflictError(
                "Referral operation conflicts with existing data"
            ) from exc
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def approve(
        self,
        referral_id: UUID,
        payload: ReferralApproval,
        actor: str,
        unit_ids: tuple[UUID, ...],
    ) -> ReferralProgress:
        try:
            with self.session.begin():
                referral = self.repository.get_scoped_referral(
                    referral_id, unit_ids, lock=True
                )
                if referral is None:
                    raise ReferralNotFoundError
                if referral["dispatch_status"] != "awaiting_approval":
                    raise ReferralConflictError("Referral is not awaiting approval")
                if payload.package_version != referral["active_package_version"]:
                    raise ReferralConflictError(
                        "Package version changed before approval"
                    )
                package = self.repository.get_package(
                    referral_id, payload.package_version
                )
                if package is None or package["package_hash"] != payload.package_hash:
                    raise ReferralConflictError("Package hash changed before approval")
                self.repository.approve_package(package["id"], actor, payload.reason)
                self.repository.update_referral(
                    referral_id, {"dispatch_status": "approved"}
                )
                self.repository.insert_event(
                    {
                        "referral_id": referral_id,
                        "event_type": "package_approved",
                        "actor_identifier": actor,
                        "event_key": f"approval:{payload.package_version}:{payload.package_hash}",
                        "after_state": {
                            "package_version": payload.package_version,
                            "package_hash": payload.package_hash,
                        },
                    }
                )
                return self._progress(referral_id, unit_ids)
        except ReferralConflictError, ReferralNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def dispatch(
        self,
        referral_id: UUID,
        operation_key: UUID,
        actor: str,
        unit_ids: tuple[UUID, ...],
    ) -> ReferralDispatchResponse:
        try:
            with self.session.begin():
                referral = self.repository.get_scoped_referral(
                    referral_id, unit_ids, lock=True
                )
                if referral is None:
                    raise ReferralNotFoundError
                package = self.repository.get_package(
                    referral_id, referral["active_package_version"]
                )
                if package is None or package["approved_at"] is None:
                    raise ReferralConflictError("Current package is not approved")
                if package["approval_revoked_at"] is not None:
                    raise ReferralConflictError("Package approval has been revoked")
                existing = self.repository.find_job_by_operation(operation_key)
                if existing is not None:
                    if (
                        existing["referral_id"] != referral_id
                        or existing["package_id"] != package["id"]
                    ):
                        raise ReferralConflictError(
                            "Operation key was already used for another dispatch"
                        )
                    progress = self._progress(referral_id, unit_ids)
                    return ReferralDispatchResponse(
                        referral=progress,
                        operation_key=operation_key,
                        job_status=existing["status"],
                        replayed=True,
                    )
                latest = self.repository.find_latest_job(referral_id)
                if latest is not None and latest["package_id"] == package["id"]:
                    raise ReferralConflictError(
                        "Current package already has a dispatch operation"
                    )
                if referral["dispatch_status"] not in {"approved", "queued"}:
                    raise ReferralConflictError("Referral is not ready for dispatch")
                job = self.repository.insert_job(
                    {
                        "referral_id": referral_id,
                        "package_id": package["id"],
                        "operation_key": operation_key,
                    }
                )
                self.repository.update_referral(
                    referral_id, {"dispatch_status": "queued"}
                )
                self.repository.insert_event(
                    {
                        "referral_id": referral_id,
                        "event_type": "dispatch_queued",
                        "actor_identifier": actor,
                        "event_key": f"dispatch:{operation_key}",
                        "after_state": {"operation_key": str(operation_key)},
                    }
                )
                return ReferralDispatchResponse(
                    referral=self._progress(referral_id, unit_ids),
                    operation_key=operation_key,
                    job_status=job["status"],
                    replayed=False,
                )
        except ReferralConflictError, ReferralNotFoundError:
            raise
        except IntegrityError as exc:
            raise ReferralConflictError("Dispatch operation already exists") from exc
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def list_for_report(
        self, report_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> list[ReferralProgress]:
        try:
            if self.repository.get_scoped_report(report_id, unit_ids) is None:
                raise ReferralNotFoundError
            return [
                referral_state(row, row["package_hash"])
                for row in self.repository.list_scoped_referrals(report_id, unit_ids)
            ]
        except ReferralNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def cancel(
        self,
        referral_id: UUID,
        payload: ReferralCancel,
        actor: str,
        unit_ids: tuple[UUID, ...],
    ) -> ReferralProgress:
        try:
            with self.session.begin():
                referral = self.repository.get_scoped_referral(
                    referral_id, unit_ids, lock=True
                )
                if referral is None:
                    raise ReferralNotFoundError
                if referral["dispatch_status"] in {
                    "sending",
                    "sent",
                    "delivery_unknown",
                }:
                    raise ReferralConflictError(
                        "Dispatch already started and cannot be claimed as cancelled"
                    )
                self.repository.cancel_queued_jobs(referral_id)
                self.repository.update_referral(
                    referral_id, {"dispatch_status": "cancelled"}
                )
                self.repository.insert_event(
                    {
                        "referral_id": referral_id,
                        "event_type": "dispatch_cancelled",
                        "actor_identifier": actor,
                        "after_state": {"reason": payload.reason},
                    }
                )
                return self._progress(referral_id, unit_ids)
        except ReferralConflictError, ReferralNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def reconcile(
        self, referral_id: UUID, actor: str, unit_ids: tuple[UUID, ...]
    ) -> ReferralProgress:
        try:
            with self.session.begin():
                referral = self.repository.get_scoped_referral(
                    referral_id, unit_ids, lock=True
                )
                if referral is None:
                    raise ReferralNotFoundError
                if referral["dispatch_status"] != "delivery_unknown":
                    raise ReferralConflictError(
                        "Referral does not require reconciliation"
                    )
                job = self.repository.find_latest_job(referral_id)
                if job is None:
                    raise ReferralConflictError("Dispatch job is missing")
                self.repository.update_job(
                    job["id"],
                    job["lease_token"],
                    {"status": "reconciliation", "next_attempt_at": func.now()},
                )
                self.repository.insert_event(
                    {
                        "referral_id": referral_id,
                        "event_type": "reconciliation_requested",
                        "actor_identifier": actor,
                        "event_key": f"reconcile:{job['operation_key']}",
                    }
                )
                return self._progress(referral_id, unit_ids)
        except ReferralConflictError, ReferralNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReferralUnavailableError from exc

    def _progress(
        self, referral_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> ReferralProgress:
        referral = self.repository.get_scoped_referral(referral_id, unit_ids)
        if referral is None:
            raise ReferralNotFoundError
        package = self.repository.get_package(
            referral_id, referral["active_package_version"]
        )
        if package is None:
            raise ReferralConflictError("Active referral package is missing")
        return referral_state(referral, package["package_hash"])


def _mock_receipt(
    operation_key: UUID, channel_id: UUID, package_hash: str, scenario: str
) -> dict[str, Any]:
    now = datetime.now(UTC)
    suffix = str(operation_key).split("-")[0].upper()
    base = {
        "operation_key": operation_key,
        "channel_id": channel_id,
        "package_hash": package_hash,
        "transport_outcome": "sent",
        "external_reference": f"MOCK-{suffix}",
        "registration_outcome": "pending",
        "handling_outcome": "awaiting_acceptance",
        "evidence_reference": f"mock-ledger:{operation_key}",
        "occurred_at": now,
        "observed_at": now,
    }
    if scenario == "transport_only":
        base.update(
            external_reference=None,
            registration_outcome="unverified",
            handling_outcome="unassigned",
        )
    elif scenario in {"accepted", "timeout_after_accept"}:
        base.update(registration_outcome="registered", handling_outcome="accepted")
    elif scenario == "business_rejected":
        base.update(registration_outcome="rejected", handling_outcome="declined")
    return base


def _store_mock_delivery(context: Mapping[str, Any]) -> MockReceipt:
    scenario = (context.get("channel_config") or {}).get("scenario", "accepted")
    if scenario == "credential_error":
        raise PermissionError("mock channel authorization rejected")
    if scenario in {"throttled", "timeout_before_accept"}:
        raise RetryableDeliveryError(scenario)
    if context["channel_mode"] != "mock" or not context["channel_synthetic"]:
        raise PermissionError("M1 worker only permits synthetic mock channels")
    if context["approved_for_production"]:
        raise PermissionError("mock fixture cannot be production-approved")

    with SessionLocal() as session, session.begin():
        repository = ReferralRepository(session)
        stored = repository.get_mock_receipt(context["operation_key"])
        created = stored is None
        if created:
            stored = repository.insert_mock_receipt(
                _mock_receipt(
                    context["operation_key"],
                    context["channel_id"],
                    context["package_hash"],
                    scenario,
                )
            )
    if scenario == "timeout_after_accept" and created:
        raise DeliveryUnknownError("mock timeout after recipient persisted operation")
    return _to_mock_receipt(stored)


def _to_mock_receipt(stored: Mapping[str, Any]) -> MockReceipt:
    return MockReceipt(
        channel_id=stored["channel_id"],
        is_simulated=True,
        operation_key=stored["operation_key"],
        transport_outcome=stored["transport_outcome"],
        external_reference=stored["external_reference"],
        registration_outcome=stored["registration_outcome"],
        handling_outcome=stored["handling_outcome"],
        evidence_reference=stored["evidence_reference"],
        occurred_at=stored["occurred_at"],
        observed_at=stored["observed_at"],
    )


def _lookup_mock_delivery(context: Mapping[str, Any]) -> MockReceipt:
    if not (context.get("channel_capabilities") or {}).get("lookup", False):
        raise DeliveryUnknownError("mock channel does not support recipient lookup")
    with SessionLocal() as session:
        stored = ReferralRepository(session).get_mock_receipt(context["operation_key"])
    if stored is None:
        raise DeliveryUnknownError("mock lookup found no persisted recipient record")
    return _to_mock_receipt(stored)


def _dispatch_block_reason(context: Mapping[str, Any]) -> str | None:
    if context["approved_at"] is None or context["approval_revoked_at"] is not None:
        return "approval_invalid"
    if context["active_package_version"] != context["package_version"]:
        return "package_version_changed"
    if not context["channel_is_active"]:
        return "channel_disabled"
    return None


def _requires_reconciliation_lookup(context: Mapping[str, Any]) -> bool:
    return str(context.get("last_error") or "").startswith("reconcile:")


def _failure_state(
    outcome: str, attempt_count: int, max_attempts: int
) -> tuple[DispatchStatus, str]:
    if outcome == "retry" and attempt_count < max_attempts:
        return DispatchStatus.QUEUED, "pending"
    if outcome == "delivery_unknown":
        return DispatchStatus.DELIVERY_UNKNOWN, "failed"
    return DispatchStatus.FAILED, "failed"


def process_next_referral_job(
    now: datetime | None = None,
    submit: Callable[[Mapping[str, Any]], MockReceipt] = _store_mock_delivery,
) -> ReferralWorkerResult:
    now = now or datetime.now(UTC)
    lease_token = uuid4()
    try:
        with SessionLocal() as session, session.begin():
            repository = ReferralRepository(session)
            repository.recover_stale_jobs(now - timedelta(minutes=5))
            job = repository.lock_next_job(now, lease_token)
            if job is None:
                return ReferralWorkerResult(processed=False)
            context = repository.get_job_context(job["id"], lock=True)
            if context is None:
                return ReferralWorkerResult(processed=False)
            block_reason = _dispatch_block_reason(context)
            if block_reason:
                repository.update_job(
                    job["id"],
                    lease_token,
                    {"status": "cancelled", "last_error": block_reason},
                )
                repository.update_referral(
                    job["referral_id"], {"dispatch_status": "cancelled"}
                )
                return ReferralWorkerResult(
                    processed=True,
                    job_id=job["id"],
                    dispatch_status=DispatchStatus.CANCELLED,
                )
            repository.update_referral(
                job["referral_id"], {"dispatch_status": "sending"}
            )
            context = dict(context)
    except SQLAlchemyError:
        logger.warning("Referral worker could not claim a job")
        return ReferralWorkerResult(processed=False)

    try:
        receipt = (
            _lookup_mock_delivery(context)
            if _requires_reconciliation_lookup(context)
            else submit(context)
        )
    except DeliveryUnknownError as exc:
        return _record_worker_problem(
            context, lease_token, "delivery_unknown", str(exc), now
        )
    except RetryableDeliveryError as exc:
        return _record_worker_problem(context, lease_token, "retry", str(exc), now)
    except PermissionError as exc:
        return _record_worker_problem(context, lease_token, "failed", str(exc), now)

    return _record_receipt(context, lease_token, receipt)


def _record_worker_problem(context, lease_token, outcome, error, now):
    with SessionLocal() as session, session.begin():
        repository = ReferralRepository(session)
        locked = repository.get_job_context(context["id"], lock=True)
        if locked is None or locked["lease_token"] != lease_token:
            return ReferralWorkerResult(processed=False)
        status, job_status = _failure_state(
            outcome, locked["attempt_count"], locked["max_attempts"]
        )
        if job_status == "pending":
            repository.update_job(
                locked["id"],
                lease_token,
                {
                    "status": "pending",
                    "next_attempt_at": now
                    + timedelta(seconds=2 ** locked["attempt_count"]),
                    "last_error": f"retry:{error}",
                },
            )
            repository.update_referral(
                locked["referral_id"], {"dispatch_status": "queued"}
            )
        else:
            unknown = outcome == "delivery_unknown"
            repository.update_job(
                locked["id"],
                lease_token,
                {
                    "status": job_status,
                    "last_error": f"reconcile:{error}" if unknown else error,
                },
            )
            repository.update_referral(
                locked["referral_id"], {"dispatch_status": status.value}
            )
            repository.insert_task(
                {
                    "referral_id": locked["referral_id"],
                    "task_type": "reconcile_delivery" if unknown else "dispatch_failed",
                    "dedup_key": f"{locked['referral_id']}:{status.value}",
                    "next_action": "Periksa bukti penerima sebelum mencoba kembali"
                    if unknown
                    else "Periksa konfigurasi kanal dan tentukan tindak lanjut",
                    "blocked_reason": error,
                }
            )
        repository.insert_event(
            {
                "referral_id": locked["referral_id"],
                "event_type": status.value,
                "actor_identifier": "referral-worker",
                "event_key": f"worker:{locked['operation_key']}:{locked['attempt_count']}",
                "after_state": {
                    "is_simulated": True,
                    "classification": outcome,
                },
            }
        )
        return ReferralWorkerResult(
            processed=True, job_id=locked["id"], dispatch_status=status
        )


def _record_receipt(context, lease_token, receipt: MockReceipt):
    with SessionLocal() as session, session.begin():
        repository = ReferralRepository(session)
        locked = repository.get_job_context(context["id"], lock=True)
        if locked is None or locked["lease_token"] != lease_token:
            return ReferralWorkerResult(processed=False)
        repository.update_job(
            locked["id"], lease_token, {"status": "succeeded", "last_error": None}
        )
        repository.update_referral(
            locked["referral_id"],
            {
                "dispatch_status": "sent",
                "registration_status": receipt.registration_outcome,
                "handling_status": receipt.handling_outcome,
                "external_reference": receipt.external_reference,
                "evidence_reference": receipt.evidence_reference,
            },
        )
        repository.complete_task(f"{locked['referral_id']}:delivery_unknown")
        repository.insert_event(
            {
                "referral_id": locked["referral_id"],
                "event_type": "mock_receipt_recorded",
                "actor_identifier": "referral-worker",
                "event_key": f"receipt:{locked['operation_key']}",
                "after_state": {
                    "transport_outcome": receipt.transport_outcome,
                    "registration_outcome": receipt.registration_outcome,
                    "handling_outcome": receipt.handling_outcome,
                    "is_simulated": True,
                },
                "evidence_reference": receipt.evidence_reference,
                "occurred_at": receipt.occurred_at,
                "observed_at": receipt.observed_at,
            }
        )
        if receipt.registration_outcome in {"unverified", "pending"}:
            repository.insert_task(
                {
                    "referral_id": locked["referral_id"],
                    "task_type": "verify_registration",
                    "dedup_key": f"{locked['referral_id']}:verify_registration",
                    "next_action": "Periksa registrasi pada kanal penerima mock",
                }
            )
        if receipt.handling_outcome == "declined":
            repository.insert_task(
                {
                    "referral_id": locked["referral_id"],
                    "task_type": "reroute",
                    "dedup_key": f"{locked['referral_id']}:reroute",
                    "next_action": "Tinjau tujuan lain tanpa menolak laporan warga",
                }
            )
        if receipt.handling_outcome == "accepted":
            reports_repository = ReportRepository(session)
            report = reports_repository.lock_report(locked["report_id"])
            if report is not None and report["status"] == "in_progress":
                reports_repository.update_report(
                    locked["report_id"], {"status": "forwarded"}
                )
                reports_repository.insert_status_history(
                    {
                        "report_id": locked["report_id"],
                        "old_status": "in_progress",
                        "new_status": "forwarded",
                        "actor_type": "system",
                        "actor_identifier": "referral-worker",
                        "notes": "Penerima mock menerima kasus; hasil simulasi.",
                    }
                )
        return ReferralWorkerResult(
            processed=True,
            job_id=locked["id"],
            dispatch_status=DispatchStatus.SENT,
        )


async def referral_worker_loop(interval_seconds: float = 5) -> None:
    while True:
        try:
            await asyncio.to_thread(process_next_referral_job)
        except SQLAlchemyError as exc:
            logger.error(
                "Referral worker iteration failed (type=%s)", type(exc).__name__
            )
        await asyncio.sleep(interval_seconds)
