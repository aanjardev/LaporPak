"""Self-service village onboarding and restricted super-admin APIs."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole, SupabaseIdentityDependency
from app.db.session import get_db_session
from app.db.tables import (
    admin_accounts,
    admin_unit_memberships,
    administrative_units,
    channel_integrations,
    knowledge_documents,
    reports,
    service_requests,
    village_activation_history,
)
from app.schemas.admin import (
    ActivationDecision,
    AdminMeResponse,
    AdminSelfUpdate,
    AdminVillageSummary,
    VillageMonitoringItem,
    VillageMonitoringResponse,
    VillageOnboardingCreate,
)
from app.services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError
from app.services.regions import validate_village_region

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])
SessionDep = Annotated[Session, Depends(get_db_session)]
REQUIRED_PROFILE_FIELDS = (
    "village_code",
    "province",
    "regency",
    "district",
    "address",
    "contact_phone",
    "office_hours",
)


def _require_system_admin(caller: AdminCaller) -> None:
    if caller.role is not AdminRole.SYSTEM_ADMIN:
        raise APIError(status_code=403, code="FORBIDDEN", message="Super Admin role required")


def _require_own_village(caller: AdminCaller, village_id: UUID) -> None:
    if caller.role is not AdminRole.VILLAGE_ADMIN or village_id not in caller.unit_ids:
        raise APIError(status_code=403, code="FORBIDDEN", message="Village membership required")


def profile_complete(account: dict, village: dict) -> bool:
    metadata = village.get("metadata") or {}
    return bool(
        account.get("display_name")
        and account.get("contact_phone")
        and village.get("name")
        and all(metadata.get(field) for field in REQUIRED_PROFILE_FIELDS)
    )


def public_village_metadata(metadata: dict | None) -> dict:
    result = dict(metadata or {})
    result["has_logo"] = bool(result.pop("logo_storage_path", None))
    return result


def village_summary(row: dict) -> AdminVillageSummary:
    return AdminVillageSummary(
        id=row["id"],
        name=row["name"],
        level=row["level"],
        metadata=public_village_metadata(row.get("metadata")),
        is_active=row["is_active"],
        activation_status=row["activation_status"],
        activation_requested_at=row.get("activation_requested_at"),
        activation_reviewed_at=row.get("activation_reviewed_at"),
        activation_review_reason=row.get("activation_review_reason"),
    )


def _load_account(session: Session, account_id: UUID | None) -> dict:
    row = session.execute(
        select(admin_accounts).where(admin_accounts.c.id == account_id)
    ).mappings().one_or_none()
    if row is None:
        raise APIError(status_code=404, code="ACCOUNT_NOT_FOUND", message="Admin account not found")
    return dict(row)


def _load_villages(session: Session, account_id: UUID) -> list[dict]:
    rows = session.execute(
        select(administrative_units)
        .join(
            admin_unit_memberships,
            admin_unit_memberships.c.administrative_unit_id
            == administrative_units.c.id,
        )
        .where(admin_unit_memberships.c.admin_account_id == account_id)
        .order_by(administrative_units.c.name)
    ).mappings().all()
    return [dict(row) for row in rows]


def _me_response(account: dict, villages: list[dict], identity) -> AdminMeResponse:
    role = AdminRole(account["role"])
    return AdminMeResponse(
        id=account["id"],
        auth_user_id=account["auth_user_id"],
        email=identity.email,
        email_verified=identity.email_verified,
        display_name=account.get("display_name"),
        contact_phone=account.get("contact_phone"),
        role=role.value,
        role_label="Super Admin" if role is AdminRole.SYSTEM_ADMIN else "Admin Desa",
        villages=[village_summary(row) for row in villages],
    )


@router.get("/me", response_model=AdminMeResponse)
def get_me(
    caller: AdminCaller,
    identity: SupabaseIdentityDependency,
    session: SessionDep,
) -> AdminMeResponse:
    account = _load_account(session, caller.admin_account_id)
    return _me_response(account, _load_villages(session, account["id"]), identity)


@router.patch("/me", response_model=AdminMeResponse)
def update_me(
    payload: AdminSelfUpdate,
    caller: AdminCaller,
    identity: SupabaseIdentityDependency,
    session: SessionDep,
) -> AdminMeResponse:
    values = payload.model_dump(exclude_none=True)
    if values:
        values["updated_at"] = datetime.now(UTC)
        session.execute(
            admin_accounts.update()
            .where(admin_accounts.c.id == caller.admin_account_id)
            .values(**values)
        )
        session.commit()
    account = _load_account(session, caller.admin_account_id)
    return _me_response(account, _load_villages(session, account["id"]), identity)


@router.post(
    "/onboarding",
    response_model=AdminMeResponse,
    status_code=status.HTTP_201_CREATED,
)
def onboard(
    payload: VillageOnboardingCreate,
    identity: SupabaseIdentityDependency,
    session: SessionDep,
) -> AdminMeResponse:
    if not identity.email_verified:
        raise APIError(status_code=403, code="EMAIL_NOT_VERIFIED", message="Verify your email before onboarding")
    existing = session.execute(
        select(admin_accounts).where(admin_accounts.c.auth_user_id == identity.id)
    ).mappings().one_or_none()
    if existing:
        return _me_response(
            dict(existing), _load_villages(session, existing["id"]), identity
        )
    validate_village_region(
        village_code=payload.village_code,
        village_name=payload.village_name,
        province=payload.province,
        regency=payload.regency,
        district=payload.district,
    )

    now = datetime.now(UTC)
    account_id, village_id = uuid4(), uuid4()
    metadata = {
        "village_code": payload.village_code,
        "province": payload.province,
        "regency": payload.regency,
        "district": payload.district,
        "address": payload.address,
        "contact_phone": payload.service_contact_phone,
        "contact_email": payload.contact_email or identity.email,
        "office_hours": payload.office_hours,
        "is_ai_enabled": True,
        "ai_personality": {},
    }
    try:
        session.execute(
            admin_accounts.insert().values(
                id=account_id,
                auth_user_id=identity.id,
                role=AdminRole.VILLAGE_ADMIN.value,
                display_name=payload.display_name,
                contact_phone=payload.contact_phone,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
        session.execute(
            administrative_units.insert().values(
                id=village_id,
                name=payload.village_name,
                level="village",
                metadata=metadata,
                is_active=False,
                activation_status="draft",
                created_at=now,
                updated_at=now,
            )
        )
        session.execute(
            admin_unit_memberships.insert().values(
                admin_account_id=account_id,
                administrative_unit_id=village_id,
                created_at=now,
            )
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        existing = session.execute(
            select(admin_accounts).where(admin_accounts.c.auth_user_id == identity.id)
        ).mappings().one_or_none()
        if existing:
            return _me_response(
                dict(existing), _load_villages(session, existing["id"]), identity
            )
        raise APIError(status_code=409, code="ONBOARDING_CONFLICT", message="Onboarding already exists") from exc

    account = _load_account(session, account_id)
    return _me_response(account, _load_villages(session, account_id), identity)


@router.post(
    "/villages/{village_id}/activation-submission",
    response_model=AdminVillageSummary,
)
def submit_activation(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> AdminVillageSummary:
    _require_own_village(caller, village_id)
    account = _load_account(session, caller.admin_account_id)
    village = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one_or_none()
    if village is None:
        raise APIError(status_code=404, code="VILLAGE_NOT_FOUND", message="Village not found")
    if village["activation_status"] not in {"draft", "changes_requested"}:
        raise APIError(status_code=409, code="INVALID_ACTIVATION_STATUS", message="Village cannot be submitted")
    if not profile_complete(account, dict(village)):
        raise APIError(status_code=422, code="PROFILE_INCOMPLETE", message="Complete all required profile fields")

    now = datetime.now(UTC)
    session.execute(
        administrative_units.update()
        .where(administrative_units.c.id == village_id)
        .values(
            activation_status="pending_review",
            activation_requested_at=now,
            activation_reviewed_at=None,
            activation_reviewed_by=None,
            activation_review_reason=None,
            updated_at=now,
        )
    )
    session.execute(
        village_activation_history.insert().values(
            administrative_unit_id=village_id,
            old_status=village["activation_status"],
            new_status="pending_review",
            actor_admin_account_id=caller.admin_account_id,
            created_at=now,
        )
    )
    session.commit()
    updated = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one()
    return village_summary(dict(updated))


@router.patch(
    "/villages/{village_id}/activation",
    response_model=AdminVillageSummary,
)
def decide_activation(
    village_id: UUID,
    payload: ActivationDecision,
    caller: AdminCaller,
    session: SessionDep,
) -> AdminVillageSummary:
    _require_system_admin(caller)
    if payload.status == "changes_requested" and not payload.reason:
        raise APIError(status_code=422, code="REASON_REQUIRED", message="Reason is required")
    village = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one_or_none()
    if village is None:
        raise APIError(status_code=404, code="VILLAGE_NOT_FOUND", message="Village not found")
    if village["activation_status"] != "pending_review":
        raise APIError(status_code=409, code="INVALID_ACTIVATION_STATUS", message="Village is not pending review")

    now = datetime.now(UTC)
    session.execute(
        administrative_units.update()
        .where(administrative_units.c.id == village_id)
        .values(
            activation_status=payload.status,
            is_active=payload.status == "approved",
            activation_reviewed_at=now,
            activation_reviewed_by=caller.admin_account_id,
            activation_review_reason=payload.reason,
            updated_at=now,
        )
    )
    session.execute(
        village_activation_history.insert().values(
            administrative_unit_id=village_id,
            old_status="pending_review",
            new_status=payload.status,
            actor_admin_account_id=caller.admin_account_id,
            reason=payload.reason,
            created_at=now,
        )
    )
    session.commit()
    updated = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one()
    return village_summary(dict(updated))


def _status_counts_by_village(
    session: Session, table, village_ids: list[UUID]
) -> dict[UUID, dict[str, int]]:
    if not village_ids:
        return {}
    rows = session.execute(
        select(table.c.administrative_unit_id, table.c.status, func.count())
        .where(table.c.administrative_unit_id.in_(village_ids))
        .group_by(table.c.administrative_unit_id, table.c.status)
    ).all()
    result: dict[UUID, dict[str, int]] = {}
    for unit_id, item_status, count in rows:
        result.setdefault(unit_id, {})[str(item_status)] = int(count)
    return result


def _monitoring(
    session: Session,
    page: int,
    page_size: int,
    activation_status: str | None,
    *,
    check_gateway: bool = True,
) -> VillageMonitoringResponse:
    query = select(administrative_units).where(administrative_units.c.level == "village")
    if activation_status:
        query = query.where(administrative_units.c.activation_status == activation_status)
    total = session.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()
    villages = session.execute(
        query.order_by(administrative_units.c.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).mappings().all()
    village_ids = [row["id"] for row in villages]
    if not village_ids:
        return VillageMonitoringResponse(items=[], total=total)

    account_rows = session.execute(
        select(
            admin_unit_memberships.c.administrative_unit_id.label("unit_id"),
            admin_accounts,
        )
        .join(
            admin_accounts,
            admin_accounts.c.id == admin_unit_memberships.c.admin_account_id,
        )
        .where(admin_unit_memberships.c.administrative_unit_id.in_(village_ids))
        .order_by(admin_accounts.c.created_at)
    ).mappings().all()
    accounts: dict[UUID, dict] = {}
    for account in account_rows:
        accounts.setdefault(account["unit_id"], dict(account))

    report_counts_by_village = _status_counts_by_village(session, reports, village_ids)
    request_counts_by_village = _status_counts_by_village(
        session, service_requests, village_ids
    )
    channel_rows = session.execute(
        select(
            channel_integrations.c.administrative_unit_id,
            channel_integrations.c.external_account_id,
        ).where(
            channel_integrations.c.administrative_unit_id.in_(village_ids),
            channel_integrations.c.channel == "whatsapp",
        )
    ).all()
    channels = {row[0]: row[1] for row in channel_rows}
    knowledge_rows = session.execute(
        select(knowledge_documents.c.administrative_unit_id, func.count())
        .where(
            knowledge_documents.c.administrative_unit_id.in_(village_ids),
            knowledge_documents.c.is_active.is_(True),
        )
        .group_by(knowledge_documents.c.administrative_unit_id)
    ).all()
    knowledge_counts = {row[0]: int(row[1]) for row in knowledge_rows}

    whatsapp_statuses: dict[str, dict] = {}
    if check_gateway and channels:
        try:
            whatsapp_statuses, _ = OpenClawGateway().whatsapp_statuses()
        except OpenClawGatewayError:
            pass
    items = []
    for row in villages:
        village = dict(row)
        account = accounts.get(row["id"])
        report_counts = report_counts_by_village.get(row["id"], {})
        request_counts = request_counts_by_village.get(row["id"], {})
        account_id = channels.get(row["id"])
        whatsapp_connected = False
        if account_id:
            gateway_status = whatsapp_statuses.get(account_id, {})
            whatsapp_connected = bool(
                gateway_status.get("connected") and gateway_status.get("linked")
            )
        items.append(
            VillageMonitoringItem(
                **village_summary(village).model_dump(),
                profile_complete=bool(account)
                and profile_complete(dict(account), village),
                whatsapp_connected=whatsapp_connected,
                total_reports=sum(report_counts.values()),
                report_status_counts=report_counts,
                total_requests=sum(request_counts.values()),
                request_status_counts=request_counts,
                knowledge_documents=knowledge_counts.get(row["id"], 0),
            )
        )
    return VillageMonitoringResponse(items=items, total=total)


@router.get("/activation-queue", response_model=VillageMonitoringResponse)
def activation_queue(
    caller: AdminCaller,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> VillageMonitoringResponse:
    _require_system_admin(caller)
    return _monitoring(
        session, page, page_size, "pending_review", check_gateway=False
    )


@router.get("/monitoring", response_model=VillageMonitoringResponse)
def monitoring(
    caller: AdminCaller,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> VillageMonitoringResponse:
    _require_system_admin(caller)
    return _monitoring(session, page, page_size, None)
