import hashlib
import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import APIError
from app.db.session import get_engine
from app.schemas.reports import CreateReportRequest, CreateReportResponse, ReportSource


def normalize_phone_number(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    if not 8 <= len(digits) <= 15:
        raise APIError(422, "VALIDATION_ERROR", "Invalid sender phone number")
    return "+" + digits


def payload_hash(payload: CreateReportRequest) -> str:
    canonical = payload.model_dump_json(exclude_none=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def create_report(
    payload: CreateReportRequest,
    idempotency_key: UUID,
) -> tuple[CreateReportResponse, bool]:
    if payload.source is not ReportSource.WHATSAPP:
        raise APIError(400, "INVALID_REQUEST", "Only WhatsApp report creation is enabled")

    phone_number = normalize_phone_number(payload.sender_phone_number)
    request_hash = payload_hash(payload)

    try:
        with get_engine().begin() as connection:
            connection.execute(
                text("select pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                {"key": str(idempotency_key)},
            )
            existing = connection.execute(
                text(
                    """
                    select id, ticket_number, status, created_at,
                           idempotency_payload_hash
                    from public.reports
                    where idempotency_key = :idempotency_key
                    """
                ),
                {"idempotency_key": idempotency_key},
            ).mappings().one_or_none()
            if existing:
                if existing["idempotency_payload_hash"] != request_hash:
                    raise APIError(
                        409,
                        "DUPLICATE_OPERATION",
                        "Idempotency key was already used with a different payload",
                    )
                return CreateReportResponse.model_validate(
                    {
                        key: existing[key]
                        for key in ("id", "ticket_number", "status", "created_at")
                    }
                ), True

            citizen_id = connection.execute(
                text(
                    """
                    insert into public.citizens (phone_number)
                    values (:phone_number)
                    on conflict (phone_number) do update
                    set phone_number = excluded.phone_number
                    returning id
                    """
                ),
                {"phone_number": phone_number},
            ).scalar_one()

            category_id = connection.execute(
                text(
                    """
                    select id
                    from public.report_categories
                    where code = :category and is_active
                    """
                ),
                {"category": payload.category.value},
            ).scalar_one_or_none()
            if category_id is None:
                raise APIError(422, "VALIDATION_ERROR", "Report category is unavailable")

            ai_analysis = (
                payload.ai_analysis.model_dump(mode="json")
                if payload.ai_analysis
                else {}
            )
            report = connection.execute(
                text(
                    """
                    insert into public.reports (
                        citizen_id,
                        category_id,
                        source,
                        urgency,
                        original_text,
                        description,
                        summary,
                        location_text,
                        latitude,
                        longitude,
                        ai_extraction,
                        idempotency_key,
                        idempotency_payload_hash
                    ) values (
                        :citizen_id,
                        :category_id,
                        :source,
                        :urgency,
                        :original_text,
                        :description,
                        :summary,
                        :location_text,
                        :latitude,
                        :longitude,
                        cast(:ai_extraction as jsonb),
                        :idempotency_key,
                        :idempotency_payload_hash
                    )
                    returning id, ticket_number, status, created_at
                    """
                ),
                {
                    "citizen_id": citizen_id,
                    "category_id": category_id,
                    "source": payload.source.value,
                    "urgency": payload.urgency.value if payload.urgency else "medium",
                    "original_text": payload.original_text,
                    "description": payload.description,
                    "summary": payload.ai_analysis.summary if payload.ai_analysis else None,
                    "location_text": payload.location.text,
                    "latitude": payload.location.latitude,
                    "longitude": payload.location.longitude,
                    "ai_extraction": json.dumps(ai_analysis),
                    "idempotency_key": idempotency_key,
                    "idempotency_payload_hash": request_hash,
                },
            ).mappings().one()
            connection.execute(
                text(
                    """
                    insert into public.report_status_history (
                        report_id,
                        old_status,
                        new_status,
                        actor_type,
                        notes
                    ) values (
                        :report_id,
                        null,
                        'pending_verification',
                        'system',
                        'Report created'
                    )
                    """
                ),
                {"report_id": report["id"]},
            )
            return CreateReportResponse.model_validate(report), False
    except APIError:
        raise
    except (SQLAlchemyError, RuntimeError) as error:
        raise APIError(503, "DATABASE_UNAVAILABLE", "Database unavailable") from error
