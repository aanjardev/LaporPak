from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.reports import StrictSchema


class ServiceRequestStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class ServiceRequestCreate(StrictSchema):
    sender_phone_number: str = Field(min_length=1)
    request_type: str = Field(default="residency_letter", pattern="^residency_letter$")
    applicant_name: str = Field(min_length=1, max_length=200)
    domicile_address: str = Field(min_length=1, max_length=1000)
    domicile_duration: str = Field(min_length=1, max_length=200)
    purpose: str = Field(min_length=1, max_length=1000)

    @field_validator(
        "applicant_name", "domicile_address", "domicile_duration", "purpose"
    )
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value


class ServiceRequestCreated(StrictSchema):
    id: UUID
    ticket_number: str
    request_type: str
    applicant_name: str
    domicile_address: str
    domicile_duration: str
    purpose: str
    status: ServiceRequestStatus
    administrative_unit_id: UUID
    created_at: datetime
    updated_at: datetime


class ServiceRequestSummary(StrictSchema):
    id: UUID
    ticket_number: str
    request_type: str
    applicant_name: str
    status: ServiceRequestStatus
    administrative_unit_id: UUID
    created_at: datetime
    updated_at: datetime


class ServiceRequestHistory(StrictSchema):
    old_status: ServiceRequestStatus | None
    new_status: ServiceRequestStatus
    actor_type: str
    actor_display_name: str | None
    reason: str | None
    created_at: datetime


class ServiceRequestDetail(ServiceRequestCreated):
    allowed_transitions: list[ServiceRequestStatus]
    status_history: list[ServiceRequestHistory]


class ServiceRequestList(StrictSchema):
    items: list[ServiceRequestSummary]
    page: int
    page_size: int
    total: int


class ServiceRequestStatusUpdate(StrictSchema):
    status: ServiceRequestStatus
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def non_blank_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("reason must not be blank")
        return value


class ServiceRequestStatusUpdateResponse(StrictSchema):
    id: UUID
    ticket_number: str
    status: ServiceRequestStatus
    updated_at: datetime
