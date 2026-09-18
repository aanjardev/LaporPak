from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.citizen_repositories import CitizenRepository
from app.schemas.citizen import (
    AskRequest,
    AskResponse,
    KnowledgeSource,
    TrackedItem,
    TrackEvent,
    TrackResponse,
)
from app.services.exceptions import (
    InvalidSenderIdentityError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.reports import normalize_phone_number

NEXT_STEP = {
    "pending_verification": "Menunggu pemeriksaan petugas.",
    "verified": "Terverifikasi dan menunggu penanganan.",
    "in_progress": "Sedang ditangani.",
    "forwarded": "Diteruskan ke unit berwenang.",
    "resolved": "Selesai.",
    "rejected": "Tidak dilanjutkan.",
    "pending_review": "Menunggu pemeriksaan pengajuan.",
    "approved": "Pengajuan disetujui.",
    "completed": "Pengajuan selesai.",
}


class CitizenService:
    def __init__(
        self, session: Session, repository: CitizenRepository | None = None
    ) -> None:
        self.repository = repository or CitizenRepository(session)

    def track(
        self, sender_phone: str, ticket: str | None, unit_id: UUID
    ) -> TrackResponse:
        phone = normalize_phone_number(sender_phone)
        try:
            rows = (
                self.repository.track_requests(phone, ticket, unit_id)
                if ticket and ticket.startswith("REQ-")
                else self.repository.track_reports(phone, ticket, unit_id)
            )
            if ticket is None:
                rows += self.repository.track_requests(phone, None, unit_id)
                rows = sorted(rows, key=lambda item: item["created_at"], reverse=True)[
                    :5
                ]
            if ticket and not rows:
                raise ReportNotFoundError(ticket)
            timelines: dict[UUID, list[TrackEvent]] = {row["id"]: [] for row in rows}
            for kind in ("report", "service_request"):
                ids = [row["id"] for row in rows if row["kind"] == kind]
                for event in self.repository.history(kind, ids):
                    timelines[event["item_id"]].append(
                        TrackEvent(
                            status=event["new_status"], changed_at=event["created_at"]
                        )
                    )
            return TrackResponse(
                checked_at=datetime.now(UTC),
                items=[
                    TrackedItem(
                        ticket_number=row["ticket_number"],
                        kind=row["kind"],
                        summary=row["summary"],
                        status=row["status"],
                        status_changed_at=row["status_changed_at"],
                        created_at=row["created_at"],
                        next_step=NEXT_STEP.get(row["status"], "Hubungi petugas."),
                        timeline=timelines[row["id"]],
                    )
                    for row in rows
                ],
            )
        except InvalidSenderIdentityError, ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("tracking") from exc

    def ask(self, payload: AskRequest, unit_id: UUID) -> AskResponse:
        try:
            rows = self.repository.hybrid_search(
                payload.question, payload.query_embedding, unit_id, payload.service_key
            )
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("knowledge search") from exc
        return AskResponse(
            outcome="answered" if rows else "unavailable",
            answer_blocks=[row["content"] for row in rows],
            sources=[
                KnowledgeSource(
                    document_id=row["document_id"],
                    chunk_id=row["chunk_id"],
                    title=row["title"],
                    source_url=row["source_url"],
                )
                for row in rows
            ],
        )
