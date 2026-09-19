"""Village management API routes for multi-desa support."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole
from app.db.session import get_db_session
from app.db.tables import (
    administrative_units,
    channel_integrations,
    knowledge_documents,
    reports,
    service_requests,
)
from app.schemas.admin import AdminRole
from app.schemas.village import (
    VillageAIPersonalityResponse,
    VillageChannelResponse,
    VillageCreate,
    VillageDetailResponse,
    VillageListResponse,
    VillageMetadataResponse,
    VillageResponse,
    VillageStats,
    VillageUpdate,
    WhatsAppChannelInfo,
)

router = APIRouter(prefix="/api/v1/villages", tags=["Villages"])


def get_session() -> Session:
    return Session()


SessionDep = Annotated[Session, Depends(get_db_session)]


def require_system_admin(caller: AdminCaller) -> AdminCaller:
    """Require system admin role."""
    if caller.role != AdminRole.SYSTEM_ADMIN:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Only system administrators can perform this action",
        )
    return caller


SystemAdminDep = Annotated[AdminCaller, Depends(require_system_admin)]


def get_village_or_404(session: Session, village_id: UUID) -> dict:
    """Get village by ID or raise 404."""
    row = session.execute(
        select(administrative_units).where(
            administrative_units.c.id == village_id,
            administrative_units.c.is_active.is_(True),
        )
    ).mappings().one_or_none()

    if row is None:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )
    return dict(row)


def row_to_village_response(row: dict) -> VillageResponse:
    """Convert database row to VillageResponse."""
    metadata = row.get("metadata", {})
    if isinstance(metadata, str):
        import json
        metadata = json.loads(metadata)

    return VillageResponse(
        id=row["id"],
        name=row["name"],
        level=row["level"],
        parent_id=row["parent_id"],
        metadata=VillageMetadataResponse(
            ai_personality=VillageAIPersonalityResponse(
                name=metadata.get("ai_personality", {}).get("name", "LaporPak"),
                emoji=metadata.get("ai_personality", {}).get("emoji", "📋"),
                vibe=metadata.get("ai_personality", {}).get("vibe", "Tegas dan membantu"),
                welcome_message=metadata.get("ai_personality", {}).get(
                    "welcome_message",
                    "Selamat datang! Saya siap membantu Anda."
                ),
                custom_greetings=metadata.get("ai_personality", {}).get(
                    "custom_greetings",
                    ["Halo", "Hai", "Assalamualaikum"]
                ),
                tone=metadata.get("ai_personality", {}).get(
                    "tone",
                    "santai dan familiar seperti tetangga"
                ),
            ),
            is_ai_enabled=metadata.get("is_ai_enabled", True),
            whatsapp_business_name=metadata.get("whatsapp_business_name"),
            logo_url=metadata.get("logo_url"),
            primary_color=metadata.get("primary_color"),
            contact_phone=metadata.get("contact_phone"),
            contact_email=metadata.get("contact_email"),
            address=metadata.get("address"),
        ),
        is_active=row["is_active"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.post(
    "",
    response_model=VillageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_village(
    payload: VillageCreate,
    caller: SystemAdminDep,
    session: SessionDep,
) -> VillageResponse:
    """Create a new village. System admin only."""

    metadata_dict = {
        "ai_personality": {
            "name": payload.metadata.ai_personality.name,
            "emoji": payload.metadata.ai_personality.emoji,
            "vibe": payload.metadata.ai_personality.vibe,
            "welcome_message": payload.metadata.ai_personality.welcome_message,
            "custom_greetings": payload.metadata.ai_personality.custom_greetings,
            "tone": payload.metadata.ai_personality.tone,
        },
        "is_ai_enabled": payload.metadata.is_ai_enabled,
        "whatsapp_business_name": payload.metadata.whatsapp_business_name,
        "logo_url": payload.metadata.logo_url,
        "primary_color": payload.metadata.primary_color,
        "contact_phone": payload.metadata.contact_phone,
        "contact_email": payload.metadata.contact_email,
        "address": payload.metadata.address,
    }

    from uuid import uuid4
    import json

    now = func.now()
    new_id = uuid4()

    session.execute(
        administrative_units.insert().values(
            id=new_id,
            name=payload.name,
            level=payload.level,
            parent_id=payload.parent_id,
            metadata=json.dumps(metadata_dict),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    session.commit()

    row = session.execute(
        select(administrative_units).where(administrative_units.c.id == new_id)
    ).mappings().one()

    return row_to_village_response(dict(row))


@router.get("", response_model=VillageListResponse)
def list_villages(
    caller: AdminCaller,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    level: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> VillageListResponse:
    """List villages. System admin sees all, village admin sees only their villages."""

    query = select(administrative_units)

    # Apply filters
    if level:
        query = query.where(administrative_units.c.level == level)
    if is_active is not None:
        query = query.where(administrative_units.c.is_active == is_active)
    if search:
        query = query.where(administrative_units.c.name.ilike(f"%{search}%"))

    # Role-based filtering
    if caller.role == AdminRole.VILLAGE_ADMIN and caller.unit_ids:
        query = query.where(administrative_units.c.id.in_(caller.unit_ids))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.execute(count_query).scalar() or 0

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(administrative_units.c.name)

    rows = session.execute(query).mappings().all()

    return VillageListResponse(
        items=[row_to_village_response(dict(row)) for row in rows],
        total=total,
    )


@router.get("/me", response_model=VillageListResponse)
def get_my_villages(
    caller: AdminCaller,
    session: SessionDep,
) -> VillageListResponse:
    """Get villages accessible to the current admin."""

    if caller.role == AdminRole.SYSTEM_ADMIN:
        # System admin sees all villages
        query = select(administrative_units).where(
            administrative_units.c.is_active == True
        ).order_by(administrative_units.c.name)
        rows = session.execute(query).mappings().all()
    else:
        # Village admin sees only their assigned villages
        from app.db.tables import admin_unit_memberships
        query = (
            select(administrative_units)
            .join(
                admin_unit_memberships,
                admin_unit_memberships.c.administrative_unit_id == administrative_units.c.id
            )
            .where(
                admin_unit_memberships.c.admin_account_id == caller.admin_account_id,
                administrative_units.c.is_active == True,
            )
            .order_by(administrative_units.c.name)
        )
        rows = session.execute(query).mappings().all()

    return VillageListResponse(
        items=[row_to_village_response(dict(row)) for row in rows],
        total=len(rows),
    )


@router.get("/{village_id}", response_model=VillageDetailResponse)
def get_village(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> VillageDetailResponse:
    """Get village details including statistics."""

    # Check access for village admins
    if caller.role == AdminRole.VILLAGE_ADMIN:
        if village_id not in caller.unit_ids:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="You don't have access to this village",
            )

    row = get_village_or_404(session, village_id)

    # Get statistics
    total_reports = session.execute(
        select(func.count()).select_from(reports).where(
            reports.c.administrative_unit_id == village_id
        )
    ).scalar() or 0

    pending_reports = session.execute(
        select(func.count()).select_from(reports).where(
            reports.c.administrative_unit_id == village_id,
            reports.c.status.in_(["pending_verification", "verified", "in_progress"]),
        )
    ).scalar() or 0

    resolved_reports = session.execute(
        select(func.count()).select_from(reports).where(
            reports.c.administrative_unit_id == village_id,
            reports.c.status == "resolved",
        )
    ).scalar() or 0

    total_requests = session.execute(
        select(func.count()).select_from(service_requests).where(
            service_requests.c.administrative_unit_id == village_id
        )
    ).scalar() or 0

    pending_requests = session.execute(
        select(func.count()).select_from(service_requests).where(
            service_requests.c.administrative_unit_id == village_id,
            service_requests.c.status.in_(["pending_review", "in_progress"]),
        )
    ).scalar() or 0

    knowledge_docs = session.execute(
        select(func.count()).select_from(knowledge_documents).where(
            knowledge_documents.c.administrative_unit_id == village_id,
            knowledge_documents.c.is_active == True,
        )
    ).scalar() or 0

    # Check WhatsApp connection
    whatsapp_channel = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
            channel_integrations.c.is_active == True,
        )
    ).mappings().one_or_none()

    stats = VillageStats(
        total_reports=total_reports,
        pending_reports=pending_reports,
        resolved_reports=resolved_reports,
        total_requests=total_requests,
        pending_requests=pending_requests,
        knowledge_documents=knowledge_docs,
        whatsapp_connected=whatsapp_channel is not None,
    )

    return VillageDetailResponse(
        **row_to_village_response(row).model_dump(),
        stats=stats,
    )


@router.patch("/{village_id}", response_model=VillageResponse)
def update_village(
    village_id: UUID,
    payload: VillageUpdate,
    caller: SystemAdminDep,
    session: SessionDep,
) -> VillageResponse:
    """Update a village. System admin only."""

    row = get_village_or_404(session, village_id)

    update_values = {}
    if payload.name is not None:
        update_values["name"] = payload.name
    if payload.parent_id is not None:
        update_values["parent_id"] = payload.parent_id
    if payload.is_active is not None:
        update_values["is_active"] = payload.is_active
    if payload.metadata is not None:
        # Merge with existing metadata
        existing_metadata = row.get("metadata", {})
        if isinstance(existing_metadata, str):
            import json
            existing_metadata = json.loads(existing_metadata)

        new_metadata = {
            "ai_personality": {
                "name": payload.metadata.ai_personality.name,
                "emoji": payload.metadata.ai_personality.emoji,
                "vibe": payload.metadata.ai_personality.vibe,
                "welcome_message": payload.metadata.ai_personality.welcome_message,
                "custom_greetings": payload.metadata.ai_personality.custom_greetings,
                "tone": payload.metadata.ai_personality.tone,
            },
            "is_ai_enabled": payload.metadata.is_ai_enabled,
            "whatsapp_business_name": payload.metadata.whatsapp_business_name,
            "logo_url": payload.metadata.logo_url,
            "primary_color": payload.metadata.primary_color,
            "contact_phone": payload.metadata.contact_phone,
            "contact_email": payload.metadata.contact_email,
            "address": payload.metadata.address,
        }
        # Preserve existing fields not in payload
        for key, value in existing_metadata.items():
            if key not in new_metadata:
                new_metadata[key] = value

        update_values["metadata"] = __import__("json").dumps(new_metadata)

    if update_values:
        update_values["updated_at"] = func.now()
        session.execute(
            administrative_units.update()
            .where(administrative_units.c.id == village_id)
            .values(**update_values)
        )
        session.commit()

    # Fetch updated row
    updated_row = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one()

    return row_to_village_response(dict(updated_row))


@router.delete("/{village_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_village(
    village_id: UUID,
    caller: SystemAdminDep,
    session: SessionDep,
) -> None:
    """Soft-delete a village (set is_active=False). System admin only."""

    get_village_or_404(session, village_id)

    session.execute(
        administrative_units.update()
        .where(administrative_units.c.id == village_id)
        .values(is_active=False, updated_at=func.now())
    )
    session.commit()


@router.get("/{village_id}/channels", response_model=VillageChannelResponse)
def get_village_channels(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> VillageChannelResponse:
    """Get channel information for a village."""

    # Check access
    if caller.role == AdminRole.VILLAGE_ADMIN:
        if village_id not in caller.unit_ids:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="You don't have access to this village",
            )

    get_village_or_404(session, village_id)

    # Get WhatsApp channel
    whatsapp_channel = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).mappings().one_or_none()

    whatsapp_info = WhatsAppChannelInfo(
        phone_number=whatsapp_channel["external_account_id"] if whatsapp_channel else None,
        is_connected=whatsapp_channel["is_active"] if whatsapp_channel else False,
        connected_at=whatsapp_channel["created_at"] if whatsapp_channel else None,
        last_message_at=whatsapp_channel["updated_at"] if whatsapp_channel else None,
    ) if whatsapp_channel else WhatsAppChannelInfo()

    return VillageChannelResponse(
        village_id=village_id,
        whatsapp=whatsapp_info,
    )


# ============================================================================
# Village Admin Management (within village)
# ============================================================================


@router.get("/{village_id}/admins", response_model=list[dict])
def list_village_admins(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> list[dict]:
    """List all admins for a village."""

    # Check access
    if caller.role == AdminRole.VILLAGE_ADMIN:
        if village_id not in caller.unit_ids:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="You don't have access to this village",
            )

    get_village_or_404(session, village_id)

    from app.db.tables import admin_unit_memberships, admin_accounts

    query = (
        select(admin_accounts, admin_unit_memberships.c.created_at.label("assigned_at"))
        .join(
            admin_unit_memberships,
            admin_unit_memberships.c.admin_account_id == admin_accounts.c.id,
        )
        .where(
            admin_unit_memberships.c.administrative_unit_id == village_id,
            admin_accounts.c.is_active == True,
        )
    )

    rows = session.execute(query).mappings().all()

    return [
        {
            "id": row["id"],
            "display_name": row["display_name"],
            "role": row["role"],
            "is_active": row["is_active"],
            "assigned_at": row["assigned_at"],
        }
        for row in rows
    ]
