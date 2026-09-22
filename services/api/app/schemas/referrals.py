from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DispatchStatus(StrEnum):
    DRAFT = "draft"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERY_UNKNOWN = "delivery_unknown"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RegistrationStatus(StrEnum):
    UNVERIFIED = "unverified"
    PENDING = "pending"
    REGISTERED = "registered"
    REJECTED = "rejected"


class HandlingStatus(StrEnum):
    UNASSIGNED = "unassigned"
    AWAITING_ACCEPTANCE = "awaiting_acceptance"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    DECLINED = "declined"
    COMPLETED = "completed"


class RoutingOption(StrictSchema):
    channel_id: UUID
    target_unit_id: UUID
    target_name: str
    channel_name: str
    mode: str
    authority_source: dict[str, Any]
    is_simulated: bool


class RoutingOptionsResponse(StrictSchema):
    report_id: UUID
    items: list[RoutingOption]
    needs_review: bool


class ReferralPackageInput(StrictSchema):
    summary: str = Field(min_length=1, max_length=2000)
    chronology: str = Field(min_length=1, max_length=5000)
    requested_action: str = Field(min_length=1, max_length=2000)
    attachment_ids: list[UUID] = Field(default_factory=list, max_length=10)
    share_citizen_identity: bool = False

    @field_validator("summary", "chronology", "requested_action")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized

    @field_validator("attachment_ids")
    @classmethod
    def require_unique_attachments(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("attachment_ids must be unique")
        return value


class ReferralCreate(StrictSchema):
    channel_id: UUID
    request_key: UUID
    package: ReferralPackageInput


class ReferralApproval(StrictSchema):
    package_version: int = Field(gt=0)
    package_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason must not be blank")
        return normalized


class ReferralDispatch(StrictSchema):
    operation_key: UUID


class ReferralCancel(StrictSchema):
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason must not be blank")
        return normalized


class ReferralPackageSnapshot(StrictSchema):
    summary: str
    chronology: str
    requested_action: str
    attachment_count: int = Field(ge=0)
    share_citizen_identity: bool


class ReferralTask(StrictSchema):
    id: UUID
    referral_id: UUID
    task_type: str
    status: str
    assigned: bool
    next_action: str
    due_at: datetime | None
    blocked_reason: str | None
    created_at: datetime
    updated_at: datetime


class ReferralProgress(StrictSchema):
    id: UUID
    report_id: UUID
    source_unit_id: UUID
    channel_id: UUID
    target_name: str
    channel_name: str
    active_package_version: int
    package_hash: str
    dispatch_status: DispatchStatus
    registration_status: RegistrationStatus
    handling_status: HandlingStatus
    external_reference: str | None
    evidence_reference: str | None
    is_simulated: bool
    package_snapshot: ReferralPackageSnapshot | None = None
    next_action: str | None = None
    updated_at: datetime


class ReferralDispatchResponse(StrictSchema):
    referral: ReferralProgress
    operation_key: UUID
    job_status: str
    replayed: bool


class ReferralWorkerResult(StrictSchema):
    processed: bool
    job_id: UUID | None = None
    dispatch_status: DispatchStatus | None = None
