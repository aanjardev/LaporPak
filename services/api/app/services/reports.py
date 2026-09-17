import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.repositories import ReportRepository
from app.schemas.enums import ReportCategory, ReportStatus, ReportUrgency
from app.schemas.reports import (
    ReportCitizen,
    ReportCreate,
    ReportDetail,
    ReportListItem,
    ReportListResponse,
    ReportLocation,
    ReportStatusHistory,
    ReportStatusUpdateResponse,
)
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)

PHONE_NUMBER_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")

ALLOWED_STATUS_TRANSITIONS = {
    ReportStatus.PENDING_VERIFICATION: {
        ReportStatus.VERIFIED,
        ReportStatus.REJECTED,
    },
    ReportStatus.VERIFIED: {ReportStatus.IN_PROGRESS},
    ReportStatus.IN_PROGRESS: {
        ReportStatus.FORWARDED,
        ReportStatus.RESOLVED,
    },
    ReportStatus.FORWARDED: {ReportStatus.RESOLVED},
    ReportStatus.RESOLVED: set(),
    ReportStatus.REJECTED: set(),
}


@dataclass(frozen=True)
class IdempotentReportResult:
    report: Mapping[str, Any]
    replayed: bool


def normalize_phone_number(value: str) -> str:
    compact = re.sub(r"[\s().-]", "", value)
    if compact.startswith("0"):
        compact = "+62" + compact[1:]
    elif compact.startswith("62"):
        compact = "+" + compact

    if not PHONE_NUMBER_PATTERN.fullmatch(compact):
        raise InvalidSenderIdentityError
    return compact


def canonical_payload_hash(payload: ReportCreate, phone_number: str) -> str:
    canonical_payload = payload.model_dump(mode="json")
    canonical_payload["sender_phone_number"] = phone_number
    serialized = json.dumps(
        canonical_payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def advisory_lock_key(idempotency_key: UUID) -> int:
    unsigned = idempotency_key.int & ((1 << 64) - 1)
    return unsigned - (1 << 64) if unsigned >= (1 << 63) else unsigned


class ReportPersistenceService:
    def __init__(
        self,
        session: Session,
        repository: ReportRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or ReportRepository(session)

    def create_idempotent_report(
        self,
        *,
        payload: ReportCreate,
        idempotency_key: UUID,
    ) -> IdempotentReportResult:
        phone_number = normalize_phone_number(payload.sender_phone_number)
        payload_hash = canonical_payload_hash(payload, phone_number)

        try:
            with self.session.begin():
                self.repository.acquire_idempotency_lock(
                    advisory_lock_key(idempotency_key)
                )
                existing = self.repository.find_report_by_idempotency_key(
                    idempotency_key
                )
                if existing is not None:
                    if existing["idempotency_payload_hash"] != payload_hash:
                        raise DuplicateOperationError
                    return IdempotentReportResult(existing, replayed=True)

                citizen = self.repository.get_or_create_citizen(phone_number)
                category = self.repository.resolve_active_category(
                    payload.category.value
                )
                if category is None:
                    raise CategoryNotFoundError(payload.category.value)

                ai_extraction = (
                    payload.ai_analysis.model_dump(mode="json")
                    if payload.ai_analysis is not None
                    else {}
                )
                summary = (
                    payload.ai_analysis.summary
                    if payload.ai_analysis is not None
                    else None
                )
                report = self.repository.insert_report(
                    {
                        "citizen_id": citizen["id"],
                        "category_id": category["id"],
                        "source": payload.source.value,
                        "urgency": payload.urgency.value,
                        "original_text": payload.original_text,
                        "description": payload.description,
                        "summary": summary,
                        "location_text": payload.location.text,
                        "latitude": payload.location.latitude,
                        "longitude": payload.location.longitude,
                        "ai_extraction": ai_extraction,
                        "ai_recommendation": {},
                        "idempotency_key": idempotency_key,
                        "idempotency_payload_hash": payload_hash,
                    }
                )
                self.repository.insert_status_history(
                    {
                        "report_id": report["id"],
                        "old_status": None,
                        "new_status": "pending_verification",
                        "actor_type": "system",
                        "actor_identifier": None,
                        "notes": "Report created",
                    }
                )
                return IdempotentReportResult(report, replayed=False)
        except (CategoryNotFoundError, DuplicateOperationError):
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report creation") from exc

    def list_reports(
        self,
        *,
        page: int,
        page_size: int,
        status: ReportStatus | None = None,
        urgency: ReportUrgency | None = None,
        category: ReportCategory | None = None,
        search: str | None = None,
    ) -> ReportListResponse:
        normalized_search = search.strip() if search else None
        try:
            rows, total = self.repository.list_reports(
                offset=(page - 1) * page_size,
                limit=page_size,
                status=status.value if status else None,
                urgency=urgency.value if urgency else None,
                category=category.value if category else None,
                search=normalized_search or None,
            )
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report list") from exc

        return ReportListResponse(
            items=[self._to_list_item(row) for row in rows],
            page=page,
            page_size=page_size,
            total=total,
        )

    def get_report_detail(self, report_id: UUID) -> ReportDetail:
        try:
            report = self.repository.get_report_detail(report_id)
            if report is None:
                raise ReportNotFoundError(report_id)

            attachments = [
                dict(row) for row in self.repository.list_attachments(report_id)
            ]
            history = [
                ReportStatusHistory.model_validate(dict(row))
                for row in self.repository.list_status_history(report_id)
            ]
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report detail") from exc

        responsible_unit = None
        if report["responsible_unit_id"] is not None:
            responsible_unit = {
                "id": report["responsible_unit_id"],
                "name": report["responsible_unit_name"],
            }

        list_item = self._to_list_item(report)
        return ReportDetail(
            **list_item.model_dump(),
            citizen=ReportCitizen(
                id=report["citizen_id"],
                display_name=report["citizen_display_name"] or "Warga",
            ),
            summary=report["summary"],
            responsible_unit=responsible_unit,
            ai_recommendation=report["ai_recommendation"] or {},
            attachments=attachments,
            status_history=history,
            verified_at=report["verified_at"],
            resolved_at=report["resolved_at"],
            updated_at=report["updated_at"],
        )

    @staticmethod
    def _to_list_item(report: Mapping[str, Any]) -> ReportListItem:
        return ReportListItem(
            id=report["id"],
            ticket_number=report["ticket_number"],
            category=report["category"],
            description=report["description"],
            location=ReportLocation(
                text=report["location_text"],
                latitude=report["latitude"],
                longitude=report["longitude"],
            ),
            urgency=report["urgency"],
            status=report["status"],
            created_at=report["created_at"],
        )

    def update_report_status(
        self,
        *,
        report_id: UUID,
        new_status: ReportStatus,
        reason: str,
        actor_identifier: str,
    ) -> ReportStatusUpdateResponse:
        try:
            with self.session.begin():
                current = self.repository.lock_report(report_id)
                if current is None:
                    raise ReportNotFoundError(report_id)

                current_status = ReportStatus(current["status"])
                if new_status not in ALLOWED_STATUS_TRANSITIONS[current_status]:
                    raise InvalidStatusTransitionError(
                        current_status.value,
                        new_status.value,
                    )

                report_values: dict[str, Any] = {"status": new_status.value}
                if new_status is ReportStatus.VERIFIED:
                    report_values["verified_at"] = func.now()
                if new_status is ReportStatus.RESOLVED:
                    report_values["resolved_at"] = func.now()

                updated = self.repository.update_report(report_id, report_values)
                if updated is None:
                    raise ReportNotFoundError(report_id)

                self.repository.insert_status_history(
                    {
                        "report_id": report_id,
                        "old_status": current_status.value,
                        "new_status": new_status.value,
                        "actor_type": "admin",
                        "actor_identifier": actor_identifier,
                        "notes": reason,
                    }
                )
                return ReportStatusUpdateResponse(
                    id=updated["id"],
                    ticket_number=updated["ticket_number"],
                    status=updated["status"],
                    updated_at=updated["updated_at"],
                )
        except (InvalidStatusTransitionError, ReportNotFoundError):
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("status update") from exc
