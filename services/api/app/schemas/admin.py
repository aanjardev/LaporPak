"""Admin invitation schemas for multi-desa support."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.enums import AdminRole


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ============================================================================
# Admin Invitation
# ============================================================================


class AdminInvitationCreate(StrictSchema):
    """Request body for creating an admin invitation."""

    email: Annotated[str, StringConstraints(pattern=r"^[^@]+@[^@]+$", max_length=255)]
    role: AdminRole = AdminRole.VILLAGE_ADMIN
    village_id: UUID | None = None  # Required for VILLAGE_ADMIN, None for SYSTEM_ADMIN

    @field_validator("village_id")
    @classmethod
    def validate_village_for_role(cls, value: UUID | None, info) -> UUID | None:
        # Note: validation happens in the route handler since we need DB access
        return value


class AdminInvitationResponse(StrictSchema):
    """Response for an admin invitation."""

    id: UUID
    email: str
    role: AdminRole
    village_id: UUID | None
    village_name: str | None = None
    status: str  # pending, accepted, expired, revoked
    invited_by: str | None
    invited_at: datetime
    expires_at: datetime | None
    accepted_at: datetime | None


class AdminInvitationListResponse(StrictSchema):
    """Response for listing admin invitations."""

    items: list[AdminInvitationResponse]
    total: int


class AdminInvitationAccept(StrictSchema):
    """Request body for accepting an invitation."""

    token: str = Field(min_length=1)
    password: Annotated[str, StringConstraints(min_length=8, max_length=100)]


# ============================================================================
# Admin Account
# ============================================================================


class AdminAccountResponse(StrictSchema):
    """Response for an admin account."""

    id: UUID
    email: str | None = None
    display_name: str | None = None
    role: AdminRole
    villages: list[dict] = Field(default_factory=list)
    is_active: bool
    created_at: datetime


class AdminAccountListResponse(StrictSchema):
    """Response for listing admin accounts."""

    items: list[AdminAccountResponse]
    total: int


class AdminAccountUpdate(StrictSchema):
    """Request body for updating an admin account."""

    display_name: str | None = None
    is_active: bool | None = None
    role: AdminRole | None = None


# ============================================================================
# Membership Management
# ============================================================================


class VillageAdminAssignment(StrictSchema):
    """Request body for assigning admin to village."""

    admin_id: UUID
    village_id: UUID


class VillageAdminRemoval(StrictSchema):
    """Request body for removing admin from village."""

    admin_id: UUID
    village_id: UUID
