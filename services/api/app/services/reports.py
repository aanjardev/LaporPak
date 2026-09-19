import base64
import binascii
import hashlib
import json
import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import httpx
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.repositories import ReportRepository
from app.schemas.enums import ReportCategory, ReportStatus, ReportUrgency
from app.schemas.reports import (
    ReportAttachment,
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
    AttachmentUnavailableError,
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidAttachmentError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)

PHONE_NUMBER_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
logger = logging.getLogger(__name__)

ALLOWED_STATUS_TRANSITIONS = {
    ReportStatus.PENDING_VERIFICATION: (
        ReportStatus.VERIFIED,
        ReportStatus.REJECTED,
    ),
    ReportStatus.VERIFIED: (ReportStatus.IN_PROGRESS,),
    ReportStatus.IN_PROGRESS: (
        ReportStatus.FORWARDED,
        ReportStatus.RESOLVED,
    ),
    ReportStatus.FORWARDED: (ReportStatus.RESOLVED,),
    ReportStatus.RESOLVED: (),
    ReportStatus.REJECTED: (),
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


def canonical_payload_hash(
    payload: ReportCreate,
    phone_number: str,
    administrative_unit_id: UUID | None = None,
) -> str:
    canonical_payload = payload.model_dump(mode="json")
    canonical_payload["sender_phone_number"] = phone_number
    canonical_payload["administrative_unit_id"] = (
        str(administrative_unit_id) if administrative_unit_id else None
    )
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


def validate_image_signature(data: bytes, mime_type: str) -> None:
    signatures = {
        "image/jpeg": data.startswith(b"\xff\xd8\xff"),
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    }
    if not signatures.get(mime_type, False):
        raise ValueError("attachment bytes do not match the declared image type")


def upload_report_attachment(report_id: UUID, data: bytes, mime_type: str) -> str:
    from app.core.config import settings

    server_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not server_key:
        raise RuntimeError("report attachment storage is not configured")

    storage_path = f"{report_id}/{uuid4()}.{MIME_EXTENSIONS[mime_type]}"
    response = httpx.post(
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"report-attachments/{storage_path}",
        headers={
            "Authorization": f"Bearer {server_key}",
            "apikey": server_key,
            "Content-Type": mime_type,
            "x-upsert": "false",
        },
        content=data,
        timeout=30,
    )
    response.raise_for_status()
    return storage_path


def delete_storage_object(bucket: str, storage_path: str) -> None:
    server_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not server_key:
        return
    try:
        response = httpx.delete(
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{storage_path}",
            headers={"Authorization": f"Bearer {server_key}", "apikey": server_key},
            timeout=30,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Could not remove orphaned object from bucket %s", bucket)


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
        administrative_unit_id: UUID | None = None,
    ) -> IdempotentReportResult:
        phone_number = normalize_phone_number(payload.sender_phone_number)
        payload_hash = canonical_payload_hash(
            payload, phone_number, administrative_unit_id
        )
        uploaded_paths: list[str] = []
        transaction_work_complete = False

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
                        **(
                            {"administrative_unit_id": administrative_unit_id}
                            if administrative_unit_id
                            else {}
                        ),
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
                for attachment in payload.attachments:
                    try:
                        data = base64.b64decode(
                            attachment.data_base64, validate=True
                        )
                    except (binascii.Error, ValueError) as exc:
                        raise InvalidAttachmentError(
                            "attachment data is not valid base64"
                        ) from exc
                    if len(data) > MAX_ATTACHMENT_BYTES:
                        raise InvalidAttachmentError("attachment exceeds 5 MB")
                    try:
                        validate_image_signature(data, attachment.mime_type)
                    except ValueError as exc:
                        raise InvalidAttachmentError(str(exc)) from exc
                    storage_path = upload_report_attachment(
                        report["id"], data, attachment.mime_type
                    )
                    uploaded_paths.append(storage_path)
                    filename = (
                        Path(attachment.filename).name
                        if attachment.filename
                        else f"photo.{MIME_EXTENSIONS[attachment.mime_type]}"
                    )
                    self.repository.insert_attachment(
                        {
                            "report_id": report["id"],
                            "storage_bucket": "report-attachments",
                            "storage_path": storage_path,
                            "file_name": filename,
                            "mime_type": attachment.mime_type,
                            "metadata": {"file_size": len(data)},
                        }
                    )
                transaction_work_complete = True
                return IdempotentReportResult(report, replayed=False)
        except CategoryNotFoundError, DuplicateOperationError, InvalidAttachmentError:
            for storage_path in uploaded_paths:
                delete_storage_object("report-attachments", storage_path)
            raise
        except (httpx.HTTPError, RuntimeError, SQLAlchemyError) as exc:
            should_cleanup = not transaction_work_complete
            if transaction_work_complete:
                try:
                    should_cleanup = (
                        self.repository.find_report_by_idempotency_key(
                            idempotency_key
                        )
                        is None
                    )
                except SQLAlchemyError:
                    logger.warning(
                        "Report commit outcome is unknown; orphan cleanup deferred"
                    )
                    should_cleanup = False
            if should_cleanup:
                for storage_path in uploaded_paths:
                    delete_storage_object("report-attachments", storage_path)
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
        unit_ids: tuple[UUID, ...] | None = None,
    ) -> ReportListResponse:
        normalized_search = search.strip() if search else None
        try:
            kwargs = {
                "offset": (page - 1) * page_size,
                "limit": page_size,
                "status": status.value if status else None,
                "urgency": urgency.value if urgency else None,
                "category": category.value if category else None,
                "search": normalized_search or None,
            }
            if unit_ids is not None:
                kwargs["unit_ids"] = unit_ids
            rows, total = self.repository.list_reports(**kwargs)
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report list") from exc

        return ReportListResponse(
            items=[self._to_list_item(row) for row in rows],
            page=page,
            page_size=page_size,
            total=total,
        )

    def get_report_detail(
        self,
        report_id: UUID,
        unit_ids: tuple[UUID, ...] | None = None,
        *,
        can_transition: bool = True,
    ) -> ReportDetail:
        try:
            report = (
                self.repository.get_report_detail(report_id)
                if unit_ids is None
                else self.repository.get_report_detail(report_id, unit_ids)
            )
            if report is None:
                raise ReportNotFoundError(report_id)

            attachments = [
                self._to_attachment(row)
                for row in self.repository.list_attachments(report_id)
            ]
            history = [
                ReportStatusHistory.model_validate(
                    {
                        field: row.get(field)
                        for field in ReportStatusHistory.model_fields
                    }
                )
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
                display_name=report["citizen_display_name"] or "Warga",
            ),
            summary=report["summary"],
            responsible_unit=responsible_unit,
            ai_recommendation=report["ai_recommendation"] or {},
            attachments=attachments,
            status_history=history,
            allowed_transitions=(
                list(ALLOWED_STATUS_TRANSITIONS[ReportStatus(report["status"])])
                if can_transition
                else []
            ),
            verified_at=report["verified_at"],
            resolved_at=report["resolved_at"],
            updated_at=report["updated_at"],
        )

    def get_report_attachment(
        self,
        report_id: UUID,
        attachment_id: UUID,
        unit_ids: tuple[UUID, ...] | None = None,
    ) -> tuple[bytes, str]:
        try:
            attachment = self.repository.get_scoped_attachment(
                report_id, attachment_id, unit_ids
            )
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report attachment lookup") from exc
        if attachment is None:
            raise ReportNotFoundError(report_id)

        server_key = settings.supabase_secret_key or settings.supabase_service_role_key
        if not settings.supabase_url or not server_key:
            raise AttachmentUnavailableError()
        try:
            response = httpx.get(
                f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
                f"{attachment['storage_bucket']}/{attachment['storage_path']}",
                headers={
                    "Authorization": f"Bearer {server_key}",
                    "apikey": server_key,
                },
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise AttachmentUnavailableError() from exc
        return response.content, attachment["mime_type"]

    @staticmethod
    def _to_attachment(row: Mapping[str, Any]) -> ReportAttachment:
        metadata = row["metadata"] or {}
        return ReportAttachment(
            id=row["id"],
            file_name=row["file_name"],
            mime_type=row["mime_type"],
            file_size=metadata.get("file_size", 0),
            created_at=row["created_at"],
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
        unit_ids: tuple[UUID, ...] | None = None,
    ) -> ReportStatusUpdateResponse:
        try:
            with self.session.begin():
                current = (
                    self.repository.lock_report(report_id)
                    if unit_ids is None
                    else self.repository.lock_report(report_id, unit_ids)
                )
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
        except InvalidStatusTransitionError, ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("status update") from exc
