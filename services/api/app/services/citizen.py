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
    TrackReferral,
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


def referral_next_step(row: dict) -> str:
    if row["dispatch_status"] == "delivery_unknown":
        return "Petugas perlu memeriksa hasil pengiriman."
    if row["dispatch_status"] == "failed":
        return "Petugas perlu meninjau kegagalan pengiriman."
    if row["dispatch_status"] in {"queued", "sending"}:
        return "Paket sedang dikirim ke kanal penerima."
    if row["handling_status"] == "awaiting_acceptance":
        return "Menunggu penerimaan dari unit tujuan."
    if row["handling_status"] in {"accepted", "in_progress"}:
        return "Sedang ditangani unit tujuan."
    if row["handling_status"] == "completed":
        return "Penanganan unit tujuan selesai; petugas desa akan memperbarui laporan."
    if row["handling_status"] == "declined":
        return "Unit tujuan menolak rujukan; petugas perlu meninjau langkah berikutnya."
    return "Rujukan sedang disiapkan."


def referral_view(row: dict | None) -> TrackReferral | None:
    if row is None:
        return None
    return TrackReferral(
        dispatch_status=row["dispatch_status"],
        registration_status=row["registration_status"],
        handling_status=row["handling_status"],
        next_step=referral_next_step(row),
        updated_at=row["updated_at"],
    )


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
            report_ids = [row["id"] for row in rows if row["kind"] == "report"]
            track_referrals = getattr(self.repository, "track_referrals", None)
            referral_rows = track_referrals(report_ids, unit_id) if callable(track_referrals) else []
            referrals = {row["report_id"]: row for row in referral_rows}
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
                        referral=referral_view(referrals.get(row["id"])),
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
        trust_level = None
        if rows:
            trust_level = (
                "demo"
                if any(row["review_status"] == "demo" for row in rows)
                else "approved"
            )
        return AskResponse(
            outcome="answered" if rows else "unavailable",
            trust_level=trust_level,
            answer_blocks=[row["content"] for row in rows],
            sources=[
                KnowledgeSource(
                    document_id=row["document_id"],
                    chunk_id=row["chunk_id"],
                    title=row["title"],
                    source_url=row["source_url"],
                    review_status=row["review_status"],
                )
                for row in rows
            ],
        )
