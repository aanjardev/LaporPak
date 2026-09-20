"""Immutable REPORT PDF rendering, verification, queue processing, and delivery."""

import asyncio
import hashlib
import io
import logging
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID
from xml.sax.saxutils import escape

import httpx
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import and_, func, insert, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.tables import (
    admin_accounts,
    administrative_units,
    channel_integrations,
    citizens,
    report_attachments,
    report_categories,
    report_document_audit,
    report_document_jobs,
    report_documents,
    reports,
)
from app.schemas.report_documents import (
    ReportDocument,
    ReportDocumentList,
    ReportDocumentType,
    ReportDocumentVerification,
)
from app.services.exceptions import DocumentDeliveryUnknownError, ReportNotFoundError
from app.services.openclaw_gateway import (
    OpenClawGateway,
    OpenClawGatewayError,
    OpenClawGatewayTimeoutError,
)

logger = logging.getLogger(__name__)
MAX_JOB_ATTEMPTS = 3
INDONESIAN_MONTHS = (
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
)


class DocumentProfileIncompleteError(RuntimeError):
    pass


def missing_letterhead_fields(metadata: dict[str, Any]) -> list[str]:
    required = (
        "regency_type",
        "regency",
        "district",
        "address",
        "postal_code",
        "logo_storage_path",
        "document_official_name",
        "document_official_title",
    )
    return [key for key in required if not metadata.get(key)]


def _storage_headers(content_type: str | None = None) -> dict[str, str]:
    key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not key:
        raise RuntimeError("document storage is not configured")
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    if content_type:
        headers.update({"Content-Type": content_type, "x-upsert": "true"})
    return headers


def upload_storage_object(bucket: str, path: str, data: bytes, mime_type: str) -> None:
    response = httpx.post(
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path}",
        headers=_storage_headers(mime_type),
        content=data,
        timeout=30,
    )
    response.raise_for_status()


def download_storage_object(bucket: str, path: str) -> bytes:
    response = httpx.get(
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path}",
        headers=_storage_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return response.content


def validate_logo(data: bytes, mime_type: str) -> str:
    if len(data) > 2 * 1024 * 1024:
        raise ValueError("Logo melebihi 2 MB")
    if mime_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if mime_type == "image/jpeg" and data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    raise ValueError("Logo harus berupa PNG atau JPEG yang valid")


def mask_phone(value: str) -> str:
    return f"{value[:5]}{'*' * max(len(value) - 8, 3)}{value[-3:]}"


def format_date(value: datetime | str | None) -> str:
    if value is None:
        return "-"
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    return f"{parsed.day} {INDONESIAN_MONTHS[parsed.month - 1]} {parsed.year}"


def _qr_drawing(value: str, size: float = 32 * mm) -> Drawing:
    widget = QrCodeWidget(value)
    x1, y1, x2, y2 = widget.getBounds()
    scale = size / max(x2 - x1, y2 - y1)
    drawing = Drawing(size, size, transform=[scale, 0, 0, scale, 0, 0])
    drawing.add(widget)
    return drawing


def render_report_pdf(
    snapshot: dict[str, Any],
    verification_url: str,
    *,
    logo: bytes | None = None,
    attachment_images: list[tuple[str, bytes]] | None = None,
) -> bytes:
    """Render one formal A4 document from a frozen database snapshot."""
    output = io.BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=24 * mm,
        leftMargin=24 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"{snapshot['title']} - {snapshot['ticket_number']}",
        author="LaporPak",
    )
    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "FormalBody",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=10.5,
        leading=15,
        alignment=TA_JUSTIFY,
    )
    centered = ParagraphStyle(
        "FormalCenter",
        parent=normal,
        alignment=TA_CENTER,
        leading=13,
    )
    heading = ParagraphStyle(
        "FormalHeading",
        parent=centered,
        fontName="Times-Bold",
        fontSize=15,
        leading=17,
        spaceAfter=1,
    )
    title = ParagraphStyle(
        "DocumentTitle",
        parent=centered,
        fontName="Times-Bold",
        fontSize=12,
        leading=15,
        spaceBefore=8,
        spaceAfter=2,
    )
    small = ParagraphStyle(
        "FormalSmall",
        parent=centered,
        fontName="Times-Roman",
        fontSize=8,
        leading=10,
    )
    village = snapshot["village"]
    regency_type = (village.get("regency_type") or "KABUPATEN").upper()
    regency = str(village["regency"]).upper()
    district = str(village["district"]).upper()
    village_name = str(village["name"]).upper()
    address = village["address"]
    postal = f" Kode Pos {village['postal_code']}" if village.get("postal_code") else ""
    header_text = [
        Paragraph(escape(f"PEMERINTAH {regency_type} {regency}"), heading),
        Paragraph(escape(f"KECAMATAN {district}"), heading),
        Paragraph(escape(f"KANTOR DESA {village_name}"), heading),
        Paragraph(escape(f"Alamat: {address}{postal}"), centered),
    ]
    logo_flowable = (
        Image(io.BytesIO(logo), 23 * mm, 23 * mm) if logo else Spacer(23 * mm, 23 * mm)
    )
    story: list[Any] = [
        Table(
            [[logo_flowable, header_text]],
            colWidths=[30 * mm, 120 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ]
            ),
        ),
        HRFlowable(
            width="100%", thickness=1.7, color=colors.black, spaceBefore=3, spaceAfter=7
        ),
        Paragraph(escape(snapshot["title"].upper()), title),
        Paragraph(escape(f"Nomor: {snapshot['ticket_number']}"), centered),
        Spacer(1, 8 * mm),
    ]
    details = [
        ("Tanggal diterima", format_date(snapshot["created_at"])),
        ("Pelapor", snapshot["citizen_name"]),
        ("Nomor WhatsApp", snapshot["citizen_phone_masked"]),
        ("Kategori", snapshot["category"]),
        ("Lokasi", snapshot["location"] or "Tidak dicantumkan"),
        ("Status", snapshot["status_label"]),
        ("Jumlah lampiran", str(snapshot["attachment_count"])),
    ]
    if snapshot.get("verified_at"):
        details.extend(
            [
                ("Diverifikasi", format_date(snapshot["verified_at"])),
                ("Petugas verifikasi", snapshot.get("verified_by") or "Petugas desa"),
            ]
        )
    story.append(
        Table(
            [
                [
                    Paragraph(escape(label), normal),
                    Paragraph(escape(f": {value}"), normal),
                ]
                for label, value in details
            ],
            colWidths=[42 * mm, 105 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
        )
    )
    story.extend(
        [
            Spacer(1, 5 * mm),
            Paragraph(
                "Uraian Laporan",
                ParagraphStyle("Subheading", parent=normal, fontName="Times-Bold"),
            ),
            Spacer(1, 2 * mm),
            Paragraph(escape(snapshot["description"]).replace("\n", "<br/>"), normal),
            Spacer(1, 8 * mm),
        ]
    )
    official = village.get("document_official_name") or "Petugas yang berwenang"
    official_title = village.get("document_official_title") or "Pemerintah Desa"
    verification_block = Table(
        [
            [
                _qr_drawing(verification_url),
                [
                    Paragraph("Verifikasi dokumen digital LaporPak", small),
                    Paragraph(escape(f"ID: {snapshot['document_id']}"), small),
                    Paragraph(escape(f"Versi: {snapshot['version']}"), small),
                ],
            ]
        ],
        colWidths=[36 * mm, 52 * mm],
        style=TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        ),
    )
    signature = [
        Paragraph(
            escape(f"{village['name']}, {format_date(snapshot['issued_at'])}"), centered
        ),
        Paragraph(escape(official_title), centered),
        Spacer(1, 18 * mm),
        Paragraph(f"<u>{escape(official)}</u>", centered),
    ]
    story.append(
        Table(
            [[verification_block, signature]],
            colWidths=[90 * mm, 65 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ]
            ),
        )
    )
    for file_name, image_data in attachment_images or []:
        try:
            image = Image(io.BytesIO(image_data))
            image._restrictSize(155 * mm, 210 * mm)
        except OSError, TypeError, ValueError:
            logger.warning("Skipping unreadable report attachment %s", file_name)
            continue
        story.extend(
            [
                PageBreak(),
                Paragraph("LAMPIRAN FOTO LAPORAN", title),
                Paragraph(escape(file_name), small),
                Spacer(1, 5 * mm),
                image,
            ]
        )

    def page_footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont("Times-Roman", 8)
        canvas.drawCentredString(
            A4[0] / 2, 9 * mm, f"{snapshot['ticket_number']} - Halaman {doc.page}"
        )
        canvas.restoreState()

    document.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return output.getvalue()


def _document_model(row: Any) -> ReportDocument:
    return ReportDocument.model_validate(
        {key: row[key] for key in ReportDocument.model_fields}
    )


class ReportDocumentService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_report(
        self, report_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> ReportDocumentList:
        report_exists = self.session.execute(
            select(reports.c.id).where(
                reports.c.id == report_id,
                reports.c.administrative_unit_id.in_(unit_ids),
            )
        ).scalar_one_or_none()
        if report_exists is None:
            raise ReportNotFoundError(report_id)
        rows = (
            self.session.execute(
                select(report_documents)
                .where(report_documents.c.report_id == report_id)
                .order_by(
                    report_documents.c.document_type, report_documents.c.version.desc()
                )
            )
            .mappings()
            .all()
        )
        return ReportDocumentList(items=[_document_model(row) for row in rows])

    def get_download(
        self, report_id: UUID, document_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> tuple[bytes, str]:
        row = (
            self.session.execute(
                select(report_documents)
                .join(reports, reports.c.id == report_documents.c.report_id)
                .where(
                    report_documents.c.id == document_id,
                    report_documents.c.report_id == report_id,
                    reports.c.administrative_unit_id.in_(unit_ids),
                    report_documents.c.status.in_(("ready", "replaced")),
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ReportNotFoundError(report_id)
        return download_storage_object(
            row["storage_bucket"], row["storage_path"]
        ), "application/pdf"

    def request_citizen_delivery(
        self,
        *,
        ticket_number: str,
        document_type: ReportDocumentType,
        sender_phone_number: str,
        unit_id: UUID,
    ) -> ReportDocument:
        from app.services.reports import normalize_phone_number

        phone = normalize_phone_number(sender_phone_number)
        with self.session.begin():
            row = (
                self.session.execute(
                    select(report_documents)
                    .join(reports, reports.c.id == report_documents.c.report_id)
                    .join(citizens, citizens.c.id == reports.c.citizen_id)
                    .where(
                        reports.c.ticket_number == ticket_number,
                        reports.c.administrative_unit_id == unit_id,
                        citizens.c.phone_number == phone,
                        report_documents.c.document_type == document_type.value,
                        report_documents.c.status.in_(("pending", "ready", "failed")),
                    )
                    .order_by(report_documents.c.version.desc())
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if row is None:
                raise ReportNotFoundError(ticket_number)
            if row["delivery_status"] == "unknown":
                raise DocumentDeliveryUnknownError
            self.session.execute(
                update(report_documents)
                .where(report_documents.c.id == row["id"])
                .values(
                    status="pending" if row["status"] == "failed" else row["status"],
                    delivery_status="pending",
                    updated_at=func.now(),
                )
            )
            self.session.execute(
                update(report_document_jobs)
                .where(report_document_jobs.c.document_id == row["id"])
                .values(
                    status="pending",
                    attempt_count=0,
                    next_attempt_at=func.now(),
                    last_error=None,
                    updated_at=func.now(),
                )
            )
            self._audit(row["id"], "retried", "citizen", "Citizen requested document")
        refreshed = (
            self.session.execute(
                select(report_documents).where(report_documents.c.id == row["id"])
            )
            .mappings()
            .one()
        )
        return _document_model(refreshed)

    def retry(
        self, report_id: UUID, document_id: UUID, unit_ids: tuple[UUID, ...], actor: str
    ) -> ReportDocument:
        with self.session.begin():
            row = self._lock_scoped(report_id, document_id, unit_ids)
            self.session.execute(
                update(report_documents)
                .where(report_documents.c.id == document_id)
                .values(
                    status="pending" if row["status"] == "failed" else row["status"],
                    delivery_status="pending",
                    updated_at=func.now(),
                )
            )
            self.session.execute(
                update(report_document_jobs)
                .where(report_document_jobs.c.document_id == document_id)
                .values(
                    status="pending",
                    attempt_count=0,
                    next_attempt_at=func.now(),
                    last_error=None,
                    updated_at=func.now(),
                )
            )
            self._audit(document_id, "retried", actor, "Manual retry")
        return _document_model(
            self.session.execute(
                select(report_documents).where(report_documents.c.id == document_id)
            )
            .mappings()
            .one()
        )

    def revise(
        self,
        report_id: UUID,
        document_type: ReportDocumentType,
        reason: str,
        unit_ids: tuple[UUID, ...],
        actor: str,
    ) -> ReportDocument:
        with self.session.begin():
            report_exists = self.session.execute(
                select(reports.c.id).where(
                    reports.c.id == report_id,
                    reports.c.administrative_unit_id.in_(unit_ids),
                )
            ).scalar_one_or_none()
            if report_exists is None:
                raise ReportNotFoundError(report_id)
            previous = (
                self.session.execute(
                    select(report_documents)
                    .where(
                        report_documents.c.report_id == report_id,
                        report_documents.c.document_type == document_type.value,
                    )
                    .order_by(report_documents.c.version.desc())
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            version = int(previous["version"]) + 1 if previous else 1
            new = (
                self.session.execute(
                    insert(report_documents)
                    .values(
                        report_id=report_id,
                        document_type=document_type.value,
                        version=version,
                        supersedes_document_id=previous["id"] if previous else None,
                        issued_by=actor,
                    )
                    .returning(*report_documents.c)
                )
                .mappings()
                .one()
            )
            self.session.execute(
                insert(report_document_jobs).values(document_id=new["id"])
            )
            self._audit(new["id"], "queued", actor, reason)
        return _document_model(new)

    def revoke(
        self,
        report_id: UUID,
        document_id: UUID,
        reason: str,
        unit_ids: tuple[UUID, ...],
        actor: str,
    ) -> ReportDocument:
        with self.session.begin():
            self._lock_scoped(report_id, document_id, unit_ids)
            row = (
                self.session.execute(
                    update(report_documents)
                    .where(report_documents.c.id == document_id)
                    .values(
                        status="revoked",
                        revoked_at=func.now(),
                        revoked_by=actor,
                        revocation_reason=reason,
                        updated_at=func.now(),
                    )
                    .returning(*report_documents.c)
                )
                .mappings()
                .one()
            )
            self._audit(document_id, "revoked", actor, reason)
        return _document_model(row)

    def _lock_scoped(
        self, report_id: UUID, document_id: UUID, unit_ids: tuple[UUID, ...]
    ):
        row = (
            self.session.execute(
                select(report_documents)
                .join(reports, reports.c.id == report_documents.c.report_id)
                .where(
                    report_documents.c.id == document_id,
                    report_documents.c.report_id == report_id,
                    reports.c.administrative_unit_id.in_(unit_ids),
                )
                .with_for_update()
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ReportNotFoundError(report_id)
        return row

    def _audit(
        self,
        document_id: UUID,
        action: str,
        actor: str | None,
        reason: str | None = None,
    ) -> None:
        self.session.execute(
            insert(report_document_audit).values(
                document_id=document_id,
                action=action,
                actor_identifier=actor,
                reason=reason,
            )
        )

    @staticmethod
    def verify(session: Session, token: UUID) -> ReportDocumentVerification | None:
        row = (
            session.execute(
                select(
                    report_documents.c.document_type,
                    report_documents.c.version,
                    report_documents.c.status,
                    report_documents.c.file_sha256,
                    report_documents.c.issued_at,
                    reports.c.ticket_number,
                    administrative_units.c.name.label("village_name"),
                )
                .join(reports, reports.c.id == report_documents.c.report_id)
                .join(
                    administrative_units,
                    administrative_units.c.id == reports.c.administrative_unit_id,
                )
                .where(report_documents.c.verification_token == token)
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        return ReportDocumentVerification(
            valid=row["status"] == "ready",
            ticket_number=row["ticket_number"],
            document_type=row["document_type"],
            version=row["version"],
            village_name=row["village_name"],
            issued_at=row["issued_at"],
            status=row["status"],
            file_sha256=row["file_sha256"],
        )


def _claim_job() -> UUID | None:
    stale_lock_cutoff = datetime.now(UTC) - timedelta(minutes=5)
    with SessionLocal() as session, session.begin():
        job = (
            session.execute(
                select(report_document_jobs)
                .where(
                    or_(
                        and_(
                            report_document_jobs.c.status.in_(("pending", "failed")),
                            report_document_jobs.c.attempt_count < MAX_JOB_ATTEMPTS,
                            report_document_jobs.c.next_attempt_at <= func.now(),
                        ),
                        and_(
                            report_document_jobs.c.status == "processing",
                            report_document_jobs.c.attempt_count <= MAX_JOB_ATTEMPTS,
                            report_document_jobs.c.locked_at <= stale_lock_cutoff,
                        ),
                    ),
                )
                .order_by(report_document_jobs.c.created_at)
                .with_for_update(skip_locked=True)
            )
            .mappings()
            .first()
        )
        if job is None:
            return None
        session.execute(
            update(report_document_jobs)
            .where(report_document_jobs.c.id == job["id"])
            .values(
                status="processing",
                attempt_count=(
                    job["attempt_count"]
                    if job["status"] == "processing"
                    else job["attempt_count"] + 1
                ),
                locked_at=func.now(),
                updated_at=func.now(),
            )
        )
        return job["document_id"]


def _load_context(
    document_id: UUID,
) -> tuple[dict[str, Any], bytes | None, list[tuple[str, bytes]], str | None, str]:
    with SessionLocal() as session:
        row = (
            session.execute(
                select(
                    report_documents,
                    reports.c.ticket_number,
                    reports.c.description,
                    reports.c.location_text,
                    reports.c.status.label("report_status"),
                    reports.c.created_at.label("report_created_at"),
                    reports.c.verified_at,
                    citizens.c.display_name.label("citizen_name"),
                    citizens.c.phone_number,
                    report_categories.c.name.label("category_name"),
                    administrative_units.c.name.label("village_name"),
                    administrative_units.c.metadata.label("village_metadata"),
                    channel_integrations.c.external_account_id,
                )
                .join(reports, reports.c.id == report_documents.c.report_id)
                .join(citizens, citizens.c.id == reports.c.citizen_id)
                .join(
                    report_categories, report_categories.c.id == reports.c.category_id
                )
                .join(
                    administrative_units,
                    administrative_units.c.id == reports.c.administrative_unit_id,
                )
                .outerjoin(
                    channel_integrations,
                    and_(
                        channel_integrations.c.administrative_unit_id
                        == reports.c.administrative_unit_id,
                        channel_integrations.c.channel == "whatsapp",
                    ),
                )
                .where(report_documents.c.id == document_id)
            )
            .mappings()
            .one()
        )
        attachments = (
            session.execute(
                select(report_attachments)
                .where(report_attachments.c.report_id == row["report_id"])
                .order_by(report_attachments.c.created_at)
            )
            .mappings()
            .all()
        )
        verified_by = (
            session.execute(
                select(admin_accounts.c.display_name).where(
                    func.concat("supabase:", admin_accounts.c.auth_user_id)
                    == row["issued_by"]
                )
            ).scalar_one_or_none()
            if row["issued_by"]
            else None
        )
    metadata = dict(row["village_metadata"] or {})
    missing = missing_letterhead_fields(metadata)
    if missing:
        raise DocumentProfileIncompleteError(
            f"Profil kop belum lengkap: {', '.join(missing)}"
        )
    logo = (
        download_storage_object(
            settings.village_logo_storage_bucket, metadata["logo_storage_path"]
        )
        if metadata.get("logo_storage_path")
        else None
    )
    images = [
        (
            item["file_name"],
            download_storage_object(item["storage_bucket"], item["storage_path"]),
        )
        for item in attachments
    ]
    issued_at = datetime.now(UTC)
    title = (
        "Bukti Penerimaan Laporan"
        if row["document_type"] == "receipt"
        else "Laporan Terverifikasi"
    )
    status_label = (
        "Diterima - menunggu verifikasi"
        if row["document_type"] == "receipt"
        else "Terverifikasi"
    )
    snapshot = {
        "document_id": str(row["id"]),
        "version": row["version"],
        "title": title,
        "ticket_number": row["ticket_number"],
        "description": row["description"],
        "location": row["location_text"],
        "status_label": status_label,
        "created_at": row["report_created_at"].isoformat(),
        "verified_at": row["verified_at"].isoformat() if row["verified_at"] else None,
        "verified_by": verified_by,
        "issued_at": issued_at.isoformat(),
        "citizen_name": row["citizen_name"] or "Warga",
        "citizen_phone_masked": mask_phone(row["phone_number"]),
        "category": row["category_name"],
        "attachment_count": len(attachments),
        "village": {"name": row["village_name"], **metadata},
    }
    return snapshot, logo, images, row["external_account_id"], row["phone_number"]


def _mark_failure(document_id: UUID, message: str, *, unknown: bool = False) -> None:
    with SessionLocal() as session, session.begin():
        job = (
            session.execute(
                select(report_document_jobs)
                .where(report_document_jobs.c.document_id == document_id)
                .with_for_update()
            )
            .mappings()
            .one()
        )
        job_status = "delivery_unknown" if unknown else "failed"
        session.execute(
            update(report_document_jobs)
            .where(report_document_jobs.c.document_id == document_id)
            .values(
                status=job_status,
                last_error=message[:1000],
                next_attempt_at=datetime.now(UTC)
                + timedelta(seconds=30 * max(job["attempt_count"], 1)),
                updated_at=func.now(),
            )
        )
        document_values = {
            "delivery_status": "unknown" if unknown else "failed",
            "updated_at": func.now(),
        }
        if not unknown:
            current = session.execute(
                select(report_documents.c.status).where(
                    report_documents.c.id == document_id
                )
            ).scalar_one()
            if current == "pending":
                document_values["status"] = "failed"
        session.execute(
            update(report_documents)
            .where(report_documents.c.id == document_id)
            .values(**document_values)
        )
        session.execute(
            insert(report_document_audit).values(
                document_id=document_id,
                action="delivery_failed",
                reason=message[:500],
            )
        )


def process_document_job(document_id: UUID) -> None:
    try:
        with SessionLocal() as session:
            document = (
                session.execute(
                    select(report_documents).where(report_documents.c.id == document_id)
                )
                .mappings()
                .one()
            )
        snapshot, logo, images, account_id, phone = _load_context(document_id)
        verification_url = f"{settings.public_verification_url.rstrip('/')}/verify/{document['verification_token']}"
        if document["status"] != "ready":
            pdf = render_report_pdf(
                snapshot, verification_url, logo=logo, attachment_images=images
            )
            digest = hashlib.sha256(pdf).hexdigest()
            storage_path = f"{document['report_id']}/{document['document_type']}-v{document['version']}-{document['id']}.pdf"
            upload_storage_object(
                settings.report_document_storage_bucket,
                storage_path,
                pdf,
                "application/pdf",
            )
            with SessionLocal() as session, session.begin():
                session.execute(
                    update(report_documents)
                    .where(report_documents.c.id == document_id)
                    .values(
                        status="ready",
                        storage_bucket=settings.report_document_storage_bucket,
                        storage_path=storage_path,
                        file_sha256=digest,
                        snapshot=snapshot,
                        issued_at=datetime.fromisoformat(snapshot["issued_at"]),
                        updated_at=func.now(),
                    )
                )
                session.execute(
                    insert(report_document_audit).values(
                        document_id=document_id, action="issued"
                    )
                )
                if document["supersedes_document_id"]:
                    session.execute(
                        update(report_documents)
                        .where(
                            report_documents.c.id == document["supersedes_document_id"]
                        )
                        .values(status="replaced", updated_at=func.now())
                    )
                    session.execute(
                        insert(report_document_audit).values(
                            document_id=document["supersedes_document_id"],
                            action="replaced",
                            reason=f"Replaced by {document_id}",
                        )
                    )
        else:
            pdf = download_storage_object(
                document["storage_bucket"], document["storage_path"]
            )
        if not account_id:
            raise OpenClawGatewayError("Village WhatsApp account is unavailable")
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temporary:
            temporary.write(pdf)
            temporary_path = Path(temporary.name)
        try:
            result = OpenClawGateway().send_document(
                account_id=account_id,
                target=phone,
                path=temporary_path,
                message=f"Dokumen {snapshot['title']} untuk tiket {snapshot['ticket_number']}.",
            )
        finally:
            temporary_path.unlink(missing_ok=True)
        with SessionLocal() as session, session.begin():
            session.execute(
                update(report_documents)
                .where(report_documents.c.id == document_id)
                .values(
                    delivery_status="sent",
                    updated_at=func.now(),
                )
            )
            session.execute(
                update(report_document_jobs)
                .where(report_document_jobs.c.document_id == document_id)
                .values(
                    status="succeeded",
                    last_error=None,
                    updated_at=func.now(),
                )
            )
            session.execute(
                insert(report_document_audit).values(
                    document_id=document_id,
                    action="delivered",
                    reason=str(result.get("messageId") or "confirmed"),
                )
            )
    except OpenClawGatewayTimeoutError as exc:
        _mark_failure(document_id, str(exc), unknown=True)
    except (
        DocumentProfileIncompleteError,
        OpenClawGatewayError,
        httpx.HTTPError,
        RuntimeError,
        OSError,
    ) as exc:
        logger.warning("Report document job %s failed: %s", document_id, exc)
        _mark_failure(document_id, str(exc))


def process_pending_document_jobs(limit: int = 3) -> int:
    processed = 0
    for _ in range(limit):
        try:
            document_id = _claim_job()
        except Exception:
            logger.exception("Document worker could not claim a job")
            break
        if document_id is None:
            break
        process_document_job(document_id)
        processed += 1
    return processed


async def document_worker_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(process_pending_document_jobs)
        except Exception:
            logger.exception("Document worker iteration failed")
        await asyncio.sleep(10)
