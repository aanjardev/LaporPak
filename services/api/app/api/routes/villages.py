"""Village profile APIs with role-scoped access."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole
from app.db.dashboard_repository import DashboardRepository
from app.db.session import get_db_session
from app.db.tables import (
    administrative_units,
    channel_integrations,
    knowledge_documents,
    reports,
    service_requests,
)
from app.schemas.dashboard import VillageDashboardResponse
from app.schemas.village import (
    VillageAIPersonalityResponse,
    VillageChannelResponse,
    VillageDetailResponse,
    VillageListResponse,
    VillageMetadataResponse,
    VillageResponse,
    VillageStats,
    VillageUpdate,
    WhatsAppChannelInfo,
)
from app.services.dashboard import build_dashboard
from app.services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError
from app.services.openclaw_workspace import get_openclaw_workspace_service
from app.services.regions import validate_village_region
from app.services.report_documents import (
    download_storage_object,
    upload_storage_object,
    validate_logo,
)

router = APIRouter(prefix="/api/v1/villages", tags=["Villages"])
SessionDep = Annotated[Session, Depends(get_db_session)]


def _require_access(caller: AdminCaller, village_id: UUID) -> None:
    if caller.role is AdminRole.VILLAGE_ADMIN and village_id not in caller.unit_ids:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village is outside admin scope",
        )


def _require_owner(caller: AdminCaller, village_id: UUID) -> None:
    if caller.role is not AdminRole.VILLAGE_ADMIN or village_id not in caller.unit_ids:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village administrator membership required",
        )


def get_village_or_404(session: Session, village_id: UUID) -> dict:
    row = (
        session.execute(
            select(administrative_units).where(administrative_units.c.id == village_id)
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )
    return dict(row)


def row_to_village_response(row: dict) -> VillageResponse:
    metadata = row.get("metadata") or {}
    personality = metadata.get("ai_personality") or {}
    return VillageResponse(
        id=row["id"],
        name=row["name"],
        level=row["level"],
        parent_id=row.get("parent_id"),
        metadata=VillageMetadataResponse(
            ai_personality=VillageAIPersonalityResponse(
                name=personality.get("name", "LaporPak"),
                emoji=personality.get("emoji", "📋"),
                vibe=personality.get("vibe", "Tegas dan membantu"),
                welcome_message=personality.get(
                    "welcome_message", "Selamat datang! Saya siap membantu Anda."
                ),
                custom_greetings=personality.get(
                    "custom_greetings", ["Halo", "Hai", "Assalamualaikum"]
                ),
                tone=personality.get("tone", "santai dan familiar seperti tetangga"),
            ),
            is_ai_enabled=metadata.get("is_ai_enabled", True),
            whatsapp_business_name=metadata.get("whatsapp_business_name"),
            logo_url=metadata.get("logo_url"),
            primary_color=metadata.get("primary_color"),
            contact_phone=metadata.get("contact_phone"),
            contact_email=metadata.get("contact_email"),
            address=metadata.get("address"),
            village_code=metadata.get("village_code"),
            province=metadata.get("province"),
            regency=metadata.get("regency"),
            district=metadata.get("district"),
            office_hours=metadata.get("office_hours"),
            regency_type=metadata.get("regency_type"),
            postal_code=metadata.get("postal_code"),
            document_official_name=metadata.get("document_official_name"),
            document_official_title=metadata.get("document_official_title"),
            has_logo=bool(metadata.get("logo_storage_path")),
            logo_file_name=metadata.get("logo_file_name"),
        ),
        is_active=row["is_active"],
        activation_status=row.get("activation_status", "approved"),
        activation_requested_at=row.get("activation_requested_at"),
        activation_reviewed_at=row.get("activation_reviewed_at"),
        activation_review_reason=row.get("activation_review_reason"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=VillageListResponse)
def list_villages(
    caller: AdminCaller,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    search: str | None = None,
) -> VillageListResponse:
    query = select(administrative_units).where(
        administrative_units.c.level == "village"
    )
    if caller.role is AdminRole.VILLAGE_ADMIN:
        query = query.where(administrative_units.c.id.in_(caller.unit_ids))
    if search:
        query = query.where(administrative_units.c.name.ilike(f"%{search}%"))
    total = session.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()
    rows = (
        session.execute(
            query.order_by(administrative_units.c.name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .mappings()
        .all()
    )
    return VillageListResponse(
        items=[row_to_village_response(dict(row)) for row in rows], total=total
    )


@router.get("/me", response_model=VillageListResponse)
def get_my_villages(caller: AdminCaller, session: SessionDep) -> VillageListResponse:
    if caller.role is not AdminRole.VILLAGE_ADMIN:
        return VillageListResponse(items=[], total=0)
    rows = (
        session.execute(
            select(administrative_units)
            .where(administrative_units.c.id.in_(caller.unit_ids))
            .order_by(administrative_units.c.name)
        )
        .mappings()
        .all()
    )
    return VillageListResponse(
        items=[row_to_village_response(dict(row)) for row in rows], total=len(rows)
    )


def _status_counts(session: Session, table, village_id: UUID) -> dict[str, int]:
    rows = session.execute(
        select(table.c.status, func.count())
        .where(table.c.administrative_unit_id == village_id)
        .group_by(table.c.status)
    ).all()
    return {str(row[0]): int(row[1]) for row in rows}


@router.get("/{village_id}/dashboard", response_model=VillageDashboardResponse)
def get_village_dashboard(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
    response: Response,
    days: Annotated[int, Query()] = 30,
) -> VillageDashboardResponse:
    if days not in {7, 30, 90}:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="days must be one of: 7, 30, 90",
        )
    if caller.role is not AdminRole.VILLAGE_ADMIN:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village administrator role required",
        )
    if village_id not in caller.unit_ids:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )
    try:
        village = (
            session.execute(
                select(administrative_units).where(
                    administrative_units.c.id == village_id
                )
            )
            .mappings()
            .one_or_none()
        )
        if village is None:
            raise APIError(
                status_code=404,
                code="VILLAGE_NOT_FOUND",
                message="Village not found",
            )
        if not village["is_active"] or village["activation_status"] != "approved":
            raise APIError(
                status_code=403,
                code="VILLAGE_INACTIVE",
                message="Village is not active",
            )
        result = build_dashboard(DashboardRepository(session), dict(village), days)
    except APIError:
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Village dashboard is temporarily unavailable",
        ) from exc
    response.headers["Cache-Control"] = "private, no-store"
    return result


@router.get("/{village_id}", response_model=VillageDetailResponse)
def get_village(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> VillageDetailResponse:
    _require_access(caller, village_id)
    village = row_to_village_response(get_village_or_404(session, village_id))
    report_counts = _status_counts(session, reports, village_id)
    request_counts = _status_counts(session, service_requests, village_id)
    knowledge_count = session.execute(
        select(func.count())
        .select_from(knowledge_documents)
        .where(
            knowledge_documents.c.administrative_unit_id == village_id,
            knowledge_documents.c.is_active.is_(True),
        )
    ).scalar_one()
    account_id = session.execute(
        select(channel_integrations.c.external_account_id).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).scalar_one_or_none()
    connected = False
    if account_id:
        try:
            snapshot = OpenClawGateway().status(account_id)
            connected = bool(snapshot.get("connected") and snapshot.get("linked"))
        except OpenClawGatewayError:
            pass
    stats = VillageStats(
        total_reports=sum(report_counts.values()),
        pending_reports=sum(
            report_counts.get(value, 0)
            for value in ("pending_verification", "verified", "in_progress")
        ),
        resolved_reports=report_counts.get("resolved", 0),
        total_requests=sum(request_counts.values()),
        pending_requests=request_counts.get("pending_review", 0),
        knowledge_documents=knowledge_count,
        whatsapp_connected=connected,
        report_status_counts=report_counts,
        request_status_counts=request_counts,
    )
    return VillageDetailResponse(**village.model_dump(), stats=stats)


@router.patch("/{village_id}", response_model=VillageResponse)
def update_village(
    village_id: UUID,
    payload: VillageUpdate,
    caller: AdminCaller,
    session: SessionDep,
) -> VillageResponse:
    _require_owner(caller, village_id)
    if payload.parent_id is not None or payload.is_active is not None:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Activation and village hierarchy cannot be changed here",
        )
    row = get_village_or_404(session, village_id)
    values = {}
    if payload.name is not None:
        values["name"] = payload.name
    if payload.metadata is not None:
        existing = row.get("metadata") or {}
        incoming = payload.metadata.model_dump(exclude_unset=True)
        region_fields = {"village_code", "province", "regency", "district"}
        region_changed = payload.name is not None and payload.name != row["name"]
        region_changed = region_changed or any(
            field in incoming and incoming[field] != existing.get(field)
            for field in region_fields
        )
        if region_changed:
            selection = {**existing, **incoming}
            validate_village_region(
                village_code=str(selection.get("village_code") or ""),
                village_name=payload.name or row["name"],
                province=str(selection.get("province") or ""),
                regency=str(selection.get("regency") or ""),
                district=str(selection.get("district") or ""),
            )
        existing.update(incoming)
        values["metadata"] = existing
    if values:
        values["updated_at"] = func.now()
        session.execute(
            administrative_units.update()
            .where(administrative_units.c.id == village_id)
            .values(**values)
        )
        session.commit()
    updated = get_village_or_404(session, village_id)
    get_openclaw_workspace_service().create_workspace_from_village_config(
        village_id, updated
    )
    return row_to_village_response(updated)


@router.get("/{village_id}/channels", response_model=VillageChannelResponse)
def get_village_channels(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> VillageChannelResponse:
    _require_access(caller, village_id)
    get_village_or_404(session, village_id)
    row = (
        session.execute(
            select(channel_integrations).where(
                channel_integrations.c.administrative_unit_id == village_id,
                channel_integrations.c.channel == "whatsapp",
            )
        )
        .mappings()
        .one_or_none()
    )
    connected = False
    if row:
        try:
            snapshot = OpenClawGateway().status(row["external_account_id"])
            connected = bool(snapshot.get("connected") and snapshot.get("linked"))
        except OpenClawGatewayError:
            pass
    return VillageChannelResponse(
        village_id=village_id,
        whatsapp=WhatsAppChannelInfo(
            is_connected=connected,
            connected_at=row["created_at"] if row and connected else None,
            last_message_at=row["updated_at"] if row else None,
        ),
    )


@router.post("/{village_id}/logo", response_model=VillageResponse)
async def upload_village_logo(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> VillageResponse:
    _require_owner(caller, village_id)
    row = get_village_or_404(session, village_id)
    data = await file.read(2 * 1024 * 1024 + 1)
    try:
        extension = validate_logo(data, file.content_type or "")
        path = f"{village_id}/logo.{extension}"
        upload_storage_object(
            settings.village_logo_storage_bucket,
            path,
            data,
            file.content_type or "application/octet-stream",
        )
    except ValueError as exc:
        raise APIError(
            status_code=422,
            code="INVALID_VILLAGE_LOGO",
            message=str(exc),
        ) from exc
    except Exception as exc:
        raise APIError(
            status_code=503,
            code="STORAGE_UNAVAILABLE",
            message="Logo desa tidak dapat disimpan",
        ) from exc
    metadata = dict(row.get("metadata") or {})
    metadata.update(
        {
            "logo_storage_path": path,
            "logo_file_name": file.filename or f"logo.{extension}",
        }
    )
    session.execute(
        administrative_units.update()
        .where(administrative_units.c.id == village_id)
        .values(metadata=metadata, updated_at=func.now())
    )
    session.commit()
    return row_to_village_response(get_village_or_404(session, village_id))


@router.get("/{village_id}/logo")
def get_village_logo(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> Response:
    _require_access(caller, village_id)
    row = get_village_or_404(session, village_id)
    metadata = row.get("metadata") or {}
    path = metadata.get("logo_storage_path")
    if not path:
        raise APIError(
            status_code=404,
            code="VILLAGE_LOGO_NOT_FOUND",
            message="Logo desa belum tersedia",
        )
    try:
        content = download_storage_object(settings.village_logo_storage_bucket, path)
    except Exception as exc:
        raise APIError(
            status_code=503,
            code="STORAGE_UNAVAILABLE",
            message="Logo desa tidak dapat dimuat",
        ) from exc
    media_type = "image/png" if str(path).endswith(".png") else "image/jpeg"
    return Response(content=content, media_type=media_type)
