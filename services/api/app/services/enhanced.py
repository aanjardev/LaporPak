import re
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.services.exceptions import InvalidSenderIdentityError
from app.services.reports import normalize_phone_number

EMERGENCY_KEYWORDS = (
    "kebakaran",
    "terbakar",
    "banjir",
    "genangan besar",
    "air tinggi",
    "gempa",
    "longsor",
    "tsunami",
    "listrik padam",
    "mati listrik",
    "mati lampu",
    "gas bocor",
    "bahaya",
    "darurat",
    "sakit keras",
    "kecelakaan",
)
EMERGENCY_REGEX = re.compile(
    "|".join(re.escape(keyword) for keyword in EMERGENCY_KEYWORDS),
    re.IGNORECASE,
)


def detect_emergency(message: str) -> dict[str, Any]:
    match = EMERGENCY_REGEX.search(message)
    if not match:
        return {
            "is_emergency": False,
            "keyword_matched": None,
            "confidence": 0.0,
            "suggested_action": "normal_processing",
            "message": None,
        }

    keyword = match.group(0)
    return {
        "is_emergency": True,
        "keyword_matched": keyword,
        "confidence": min(0.95, 0.7 + (len(keyword) / 20)),
        "suggested_action": "flag_for_immediate_review",
        "message": "Laporan ditandai untuk pemeriksaan segera oleh petugas.",
    }


def find_similar_reports(
    session: Session,
    unit_id: UUID,
    category: str,
    location_text: str | None,
    latitude: float | None,
    longitude: float | None,
) -> dict[str, Any]:
    filters = [
        "r.administrative_unit_id = :unit",
        "rc.code = :category",
        "r.status in ('pending_verification', 'verified', 'in_progress', 'forwarded')",
    ]
    params: dict[str, Any] = {"unit": unit_id, "category": category}

    if location_text:
        normalized = location_text.replace("%", "\\%").replace("_", "\\_")
        filters.append("r.location_text ilike :location_pattern escape '\\\\'")
        params["location_pattern"] = f"%{normalized}%"
    elif latitude is not None and longitude is not None:
        # ponytail: a small bounding box is sufficient for the pilot.
        filters.extend(
            [
                "r.latitude between :min_latitude and :max_latitude",
                "r.longitude between :min_longitude and :max_longitude",
            ]
        )
        params.update(
            {
                "min_latitude": latitude - 0.005,
                "max_latitude": latitude + 0.005,
                "min_longitude": longitude - 0.005,
                "max_longitude": longitude + 0.005,
            }
        )

    try:
        count = session.execute(
            text(
                f"""
                select count(*)
                from public.reports r
                join public.report_categories rc on rc.id = r.category_id
                where {' and '.join(filters)}
                """
            ),
            params,
        ).scalar_one()
    except SQLAlchemyError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Similar-report check is unavailable",
        ) from exc

    return {
        "similar_found": count > 0,
        "count": count,
        "message": (
            f"Sudah ada {count} laporan serupa yang masih ditangani. "
            "Laporan baru tetap dapat dibuat."
            if count
            else None
        ),
    }


def confirm_resolution(
    session: Session,
    unit_id: UUID,
    ticket_number: str,
    sender_phone_number: str,
    confirmed: bool,
    feedback: str | None,
) -> dict[str, Any]:
    try:
        phone_number = normalize_phone_number(sender_phone_number)
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc

    try:
        with session.begin():
            report = (
                session.execute(
                    text(
                        """
                        select r.id, r.status
                        from public.reports r
                        join public.citizens c on c.id = r.citizen_id
                        where r.ticket_number = :ticket
                          and r.administrative_unit_id = :unit
                          and c.phone_number = :phone
                        """
                    ),
                    {
                        "ticket": ticket_number,
                        "unit": unit_id,
                        "phone": phone_number,
                    },
                )
                .mappings()
                .one_or_none()
            )
            if report is None:
                raise APIError(
                    status_code=404,
                    code="REPORT_NOT_FOUND",
                    message="Report not found",
                )
            if report["status"] != "resolved":
                raise APIError(
                    status_code=409,
                    code="INVALID_STATUS",
                    message="Report must be resolved before confirmation",
                )
            session.execute(
                text(
                    """
                    insert into public.resolution_confirmations
                        (report_id, confirmed, feedback)
                    values (:report, :confirmed, :feedback)
                    on conflict do nothing
                    """
                ),
                {
                    "report": report["id"],
                    "confirmed": confirmed,
                    "feedback": feedback,
                },
            )
    except APIError:
        raise
    except SQLAlchemyError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Resolution confirmation is unavailable",
        ) from exc

    if confirmed:
        return {
            "ticket_number": ticket_number,
            "status": "confirmed",
            "message": "Terima kasih, penyelesaian laporan telah dikonfirmasi.",
        }
    return {
        "ticket_number": ticket_number,
        "status": "needs_review",
        "message": "Masukan Anda dicatat untuk ditinjau petugas.",
        "action": "human_review_required",
    }
