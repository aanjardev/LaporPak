import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.repositories import ReportRepository
from app.schemas.reports import ReportCreate
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    ReportNotFoundError,
    ReportPersistenceError,
)

PHONE_NUMBER_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


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
        offset: int,
        limit: int,
    ) -> tuple[list[Mapping[str, Any]], int]:
        rows, total = self.repository.list_reports(offset=offset, limit=limit)
        return list(rows), total

    def get_report_detail(self, report_id: UUID) -> dict[str, Any]:
        report = self.repository.get_report_detail(report_id)
        if report is None:
            raise ReportNotFoundError(report_id)

        return {
            **dict(report),
            "attachments": [
                dict(row) for row in self.repository.list_attachments(report_id)
            ],
            "status_history": [
                dict(row)
                for row in self.repository.list_status_history(report_id)
            ],
        }

    def update_report_with_history(
        self,
        *,
        report_id: UUID,
        report_values: Mapping[str, Any],
        history_values: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        try:
            with self.session.begin():
                current = self.repository.lock_report(report_id)
                if current is None:
                    raise ReportNotFoundError(report_id)

                updated = self.repository.update_report(report_id, report_values)
                if updated is None:
                    raise ReportNotFoundError(report_id)

                self.repository.insert_status_history(
                    {
                        **history_values,
                        "report_id": report_id,
                        "old_status": current["status"],
                        "new_status": updated["status"],
                    }
                )
                return updated
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("status update") from exc
