"""Admin invitation and management API routes for multi-desa support."""

import secrets
from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole
from app.db.session import get_db_session
from app.db.tables import (
    admin_accounts,
    admin_invitations,
    admin_unit_memberships,
    administrative_units,
)
from app.schemas.admin import (
    AdminAccountListResponse,
    AdminAccountResponse,
    AdminAccountUpdate,
    AdminInvitationAccept,
    AdminInvitationCreate,
    AdminInvitationListResponse,
    AdminInvitationResponse,
    VillageAdminAssignment,
    VillageAdminRemoval,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Management"])


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


def generate_invitation_token() -> str:
    """Generate a secure invitation token."""
    return secrets.token_urlsafe(32)


@router.post(
    "/invitations",
    response_model=AdminInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    payload: AdminInvitationCreate,
    caller: SystemAdminDep,
    session: SessionDep,
) -> AdminInvitationResponse:
    """Create an invitation for a new admin. System admin only."""

    # Validate village for VILLAGE_ADMIN role
    if payload.role == AdminRole.VILLAGE_ADMIN:
        if payload.village_id is None:
            raise APIError(
                status_code=400,
                code="VALIDATION_ERROR",
                message="village_id is required for VILLAGE_ADMIN role",
            )

        # Verify village exists
        village = session.execute(
            select(administrative_units).where(
                administrative_units.c.id == payload.village_id,
                administrative_units.c.is_active == True,
            )
        ).mappings().one_or_none()

        if village is None:
            raise APIError(
                status_code=404,
                code="VILLAGE_NOT_FOUND",
                message="Village not found",
            )
        village_name = village["name"]
    else:
        payload.village_id = None
        village_name = None

    # Check for existing pending invitation
    existing = session.execute(
        select(admin_invitations).where(
            admin_invitations.c.email == payload.email.lower(),
            admin_invitations.c.role == payload.role.value,
            admin_invitations.c.village_id == payload.village_id,
            admin_invitations.c.status == "pending",
            admin_invitations.c.expires_at > datetime.utcnow(),
        )
    ).mappings().one_or_none()

    if existing:
        raise APIError(
            status_code=409,
            code="DUPLICATE_INVITATION",
            message="A pending invitation already exists for this email and role",
        )

    # Create invitation
    invitation_id = UUID(secrets.token_hex(16))
    token = generate_invitation_token()
    expires_at = datetime.utcnow() + timedelta(days=7)

    session.execute(
        admin_invitations.insert().values(
            id=invitation_id,
            email=payload.email.lower(),
            role=payload.role.value,
            village_id=payload.village_id,
            token=token,
            status="pending",
            invited_by=caller.identifier,
            invited_at=datetime.utcnow(),
            expires_at=expires_at,
        )
    )
    session.commit()

    return AdminInvitationResponse(
        id=invitation_id,
        email=payload.email.lower(),
        role=payload.role,
        village_id=payload.village_id,
        village_name=village_name,
        status="pending",
        invited_by=caller.identifier,
        invited_at=datetime.utcnow(),
        expires_at=expires_at,
        accepted_at=None,
    )


@router.get("/invitations", response_model=AdminInvitationListResponse)
def list_invitations(
    caller: SystemAdminDep,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: str | None = None,
    role: AdminRole | None = None,
    village_id: UUID | None = None,
) -> AdminInvitationListResponse:
    """List admin invitations. System admin only."""

    query = select(admin_invitations)

    if status_filter:
        query = query.where(admin_invitations.c.status == status_filter)
    if role:
        query = query.where(admin_invitations.c.role == role.value)
    if village_id:
        query = query.where(admin_invitations.c.village_id == village_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.execute(count_query).scalar() or 0

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(admin_invitations.c.invited_at.desc())

    rows = session.execute(query).mappings().all()

    # Get village names
    village_names = {}
    village_ids = set(row["village_id"] for row in rows if row["village_id"])
    if village_ids:
        villages = session.execute(
            select(administrative_units.c.id, administrative_units.c.name).where(
                administrative_units.c.id.in_(village_ids)
            )
        ).mappings().all()
        village_names = {v["id"]: v["name"] for v in villages}

    items = [
        AdminInvitationResponse(
            id=row["id"],
            email=row["email"],
            role=AdminRole(row["role"]),
            village_id=row["village_id"],
            village_name=village_names.get(row["village_id"]),
            status=row["status"],
            invited_by=row["invited_by"],
            invited_at=row["invited_at"],
            expires_at=row["expires_at"],
            accepted_at=row["accepted_at"],
        )
        for row in rows
    ]

    return AdminInvitationListResponse(items=items, total=total)


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: UUID,
    caller: SystemAdminDep,
    session: SessionDep,
) -> None:
    """Revoke an invitation. System admin only."""

    invitation = session.execute(
        select(admin_invitations).where(admin_invitations.c.id == invitation_id)
    ).mappings().one_or_none()

    if invitation is None:
        raise APIError(
            status_code=404,
            code="INVITATION_NOT_FOUND",
            message="Invitation not found",
        )

    if invitation["status"] != "pending":
        raise APIError(
            status_code=400,
            code="INVALID_STATUS",
            message="Only pending invitations can be revoked",
        )

    session.execute(
        admin_invitations.update()
        .where(admin_invitations.c.id == invitation_id)
        .values(status="revoked")
    )
    session.commit()


@router.post("/invitations/{invitation_id}/resend", response_model=AdminInvitationResponse)
def resend_invitation(
    invitation_id: UUID,
    caller: SystemAdminDep,
    session: SessionDep,
) -> AdminInvitationResponse:
    """Resend an invitation with a new token. System admin only."""

    invitation = session.execute(
        select(admin_invitations).where(admin_invitations.c.id == invitation_id)
    ).mappings().one_or_none()

    if invitation is None:
        raise APIError(
            status_code=404,
            code="INVITATION_NOT_FOUND",
            message="Invitation not found",
        )

    if invitation["status"] != "pending":
        raise APIError(
            status_code=400,
            code="INVALID_STATUS",
            message="Only pending invitations can be resent",
        )

    # Generate new token
    new_token = generate_invitation_token()
    expires_at = datetime.utcnow() + timedelta(days=7)

    session.execute(
        admin_invitations.update()
        .where(admin_invitations.c.id == invitation_id)
        .values(
            token=new_token,
            expires_at=expires_at,
        )
    )
    session.commit()

    village_name = None
    if invitation["village_id"]:
        village = session.execute(
            select(administrative_units.c.name).where(
                administrative_units.c.id == invitation["village_id"]
            )
        ).scalar_one_or_none()
        village_name = village

    return AdminInvitationResponse(
        id=invitation["id"],
        email=invitation["email"],
        role=AdminRole(invitation["role"]),
        village_id=invitation["village_id"],
        village_name=village_name,
        status="pending",
        invited_by=invitation["invited_by"],
        invited_at=invitation["invited_at"],
        expires_at=expires_at,
        accepted_at=invitation["accepted_at"],
    )


# ============================================================================
# Admin Accounts Management
# ============================================================================


@router.get("/accounts", response_model=AdminAccountListResponse)
def list_admin_accounts(
    caller: SystemAdminDep,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    role: AdminRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
) -> AdminAccountListResponse:
    """List admin accounts. System admin only."""

    query = select(admin_accounts)

    if role:
        query = query.where(admin_accounts.c.role == role.value)
    if is_active is not None:
        query = query.where(admin_accounts.c.is_active == is_active)
    if search:
        query = query.where(admin_accounts.c.display_name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = session.execute(count_query).scalar() or 0

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(admin_accounts.c.created_at.desc())

    rows = session.execute(query).mappings().all()

    # Get villages for each admin
    items = []
    for row in rows:
        villages_query = (
            select(
                admin_unit_memberships.c.administrative_unit_id,
                administrative_units.c.name,
            )
            .join(
                administrative_units,
                administrative_units.c.id == admin_unit_memberships.c.administrative_unit_id,
            )
            .where(admin_unit_memberships.c.admin_account_id == row["id"])
        )
        villages = session.execute(villages_query).mappings().all()

        items.append(
            AdminAccountResponse(
                id=row["id"],
                email=None,  # Email from Supabase, not stored locally
                display_name=row["display_name"],
                role=AdminRole(row["role"]),
                villages=[
                    {"id": str(v["administrative_unit_id"]), "name": v["name"]}
                    for v in villages
                ],
                is_active=row["is_active"],
                created_at=row["created_at"],
            )
        )

    return AdminAccountListResponse(items=items, total=total)


@router.patch("/accounts/{account_id}", response_model=AdminAccountResponse)
def update_admin_account(
    account_id: UUID,
    payload: AdminAccountUpdate,
    caller: SystemAdminDep,
    session: SessionDep,
) -> AdminAccountResponse:
    """Update an admin account. System admin only."""

    account = session.execute(
        select(admin_accounts).where(admin_accounts.c.id == account_id)
    ).mappings().one_or_none()

    if account is None:
        raise APIError(
            status_code=404,
            code="ACCOUNT_NOT_FOUND",
            message="Admin account not found",
        )

    update_values = {}
    if payload.display_name is not None:
        update_values["display_name"] = payload.display_name
    if payload.is_active is not None:
        update_values["is_active"] = payload.is_active
    if payload.role is not None:
        update_values["role"] = payload.role.value

    if update_values:
        update_values["updated_at"] = datetime.utcnow()
        session.execute(
            admin_accounts.update()
            .where(admin_accounts.c.id == account_id)
            .values(**update_values)
        )
        session.commit()

    # Fetch updated account
    updated = session.execute(
        select(admin_accounts).where(admin_accounts.c.id == account_id)
    ).mappings().one()

    return AdminAccountResponse(
        id=updated["id"],
        email=None,
        display_name=updated["display_name"],
        role=AdminRole(updated["role"]),
        villages=[],  # Simplified - would need separate query
        is_active=updated["is_active"],
        created_at=updated["created_at"],
    )


# ============================================================================
# Village-Admin Membership Management
# ============================================================================


@router.post("/villages/{village_id}/admins", status_code=status.HTTP_201_CREATED)
def assign_admin_to_village(
    village_id: UUID,
    payload: VillageAdminAssignment,
    caller: SystemAdminDep,
    session: SessionDep,
) -> dict:
    """Assign an admin to a village. System admin only."""

    # Verify village exists
    village = session.execute(
        select(administrative_units).where(
            administrative_units.c.id == village_id,
            administrative_units.c.is_active == True,
        )
    ).mappings().one_or_none()

    if village is None:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )

    # Verify admin account exists and is VILLAGE_ADMIN role
    account = session.execute(
        select(admin_accounts).where(admin_accounts.c.id == payload.admin_id)
    ).mappings().one_or_none()

    if account is None:
        raise APIError(
            status_code=404,
            code="ACCOUNT_NOT_FOUND",
            message="Admin account not found",
        )

    if account["role"] != AdminRole.VILLAGE_ADMIN.value:
        raise APIError(
            status_code=400,
            code="INVALID_ROLE",
            message="Only VILLAGE_ADMIN can be assigned to villages",
        )

    # Check if already assigned
    existing = session.execute(
        select(admin_unit_memberships).where(
            admin_unit_memberships.c.admin_account_id == payload.admin_id,
            admin_unit_memberships.c.administrative_unit_id == village_id,
        )
    ).mappings().one_or_none()

    if existing:
        raise APIError(
            status_code=409,
            code="ALREADY_ASSIGNED",
            message="Admin is already assigned to this village",
        )

    # Create membership
    session.execute(
        admin_unit_memberships.insert().values(
            admin_account_id=payload.admin_id,
            administrative_unit_id=village_id,
            created_at=datetime.utcnow(),
        )
    )
    session.commit()

    return {
        "message": "Admin assigned to village successfully",
        "admin_id": str(payload.admin_id),
        "village_id": str(village_id),
        "village_name": village["name"],
    }


@router.delete("/villages/{village_id}/admins/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin_from_village(
    village_id: UUID,
    admin_id: UUID,
    caller: SystemAdminDep,
    session: SessionDep,
) -> None:
    """Remove an admin from a village. System admin only."""

    membership = session.execute(
        select(admin_unit_memberships).where(
            admin_unit_memberships.c.admin_account_id == admin_id,
            admin_unit_memberships.c.administrative_unit_id == village_id,
        )
    ).mappings().one_or_none()

    if membership is None:
        raise APIError(
            status_code=404,
            code="MEMBERSHIP_NOT_FOUND",
            message="Admin is not assigned to this village",
        )

    session.execute(
        admin_unit_memberships.delete().where(
            admin_unit_memberships.c.admin_account_id == admin_id,
            admin_unit_memberships.c.administrative_unit_id == village_id,
        )
    )
    session.commit()
