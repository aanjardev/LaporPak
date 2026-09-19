import base64
import binascii
from datetime import datetime
from typing import Annotated, Any, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.schemas.enums import (
    ReportActorType,
    ReportCategory,
    ReportSource,
    ReportStatus,
    ReportUrgency,
)


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReportLocation(StrictSchema):
    text: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_location(self) -> Self:
        has_latitude = self.latitude is not None
        has_longitude = self.longitude is not None

        if has_latitude != has_longitude:
            raise ValueError("latitude and longitude must be provided together")

        if self.text is None and not (has_latitude and has_longitude):
            raise ValueError("location text or coordinates are required")

        return self


class ReportCreateAIAnalysis(StrictSchema):
    confidence: float = Field(ge=0, le=1)
    summary: str | None = None

    @field_validator("summary")
    @classmethod
    def normalize_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


ALLOWED_ATTACHMENT_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})


class ReportAttachmentInput(StrictSchema):
    data_base64: Annotated[
        str,
        StringConstraints(min_length=1, max_length=7_000_000),
    ]
    mime_type: str
    filename: str | None = Field(default=None, max_length=255)
    size: int | None = Field(default=None, gt=0, le=5 * 1024 * 1024)

    @field_validator("mime_type")
    @classmethod
    def validate_mime_type(cls, value: str) -> str:
        if value not in ALLOWED_ATTACHMENT_MIME_TYPES:
            raise ValueError("attachment must be a JPEG, PNG, or WebP image")
        return value

    @field_validator("data_base64")
    @classmethod
    def validate_data(cls, value: str) -> str:
        try:
            data = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("attachment must contain valid base64") from exc
        if len(data) > 5 * 1024 * 1024:
            raise ValueError("attachment must not exceed 5 MB")
        return value


class ReportCreate(StrictSchema):
    sender_phone_number: str = Field(min_length=1)
    conversation_id: UUID | None = None
    category: ReportCategory
    description: str = Field(min_length=1)
    location: ReportLocation
    urgency: ReportUrgency = ReportUrgency.MEDIUM
    original_text: str | None = None
    source: ReportSource = ReportSource.WHATSAPP
    ai_analysis: ReportCreateAIAnalysis | None = None
    attachments: list[ReportAttachmentInput] = Field(min_length=1, max_length=3)

    @field_validator("sender_phone_number", "description")
    @classmethod
    def require_non_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized

    @field_validator("original_text")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class ReportCreateResponse(StrictSchema):
    id: UUID
    ticket_number: str
    status: ReportStatus
    created_at: datetime


class ReportListItem(ReportCreateResponse):
    category: ReportCategory
    description: str
    location: ReportLocation
    urgency: ReportUrgency


class ReportListResponse(StrictSchema):
    items: list[ReportListItem]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: int = Field(ge=0)


class ReportCitizen(StrictSchema):
    display_name: str


class ReportStatusHistory(StrictSchema):
    old_status: ReportStatus | None
    new_status: ReportStatus
    actor_type: ReportActorType
    actor_display_name: str | None
    notes: str | None
    created_at: datetime


class ReportAttachment(StrictSchema):
    id: UUID
    file_name: str | None
    mime_type: str
    file_size: int
    created_at: datetime


class ReportDetail(ReportListItem):
    citizen: ReportCitizen
    summary: str | None
    responsible_unit: dict[str, Any] | None
    ai_recommendation: dict[str, Any]
    attachments: list[ReportAttachment]
    status_history: list[ReportStatusHistory]
    allowed_transitions: list[ReportStatus]
    verified_at: datetime | None
    resolved_at: datetime | None
    updated_at: datetime


class ReportStatusUpdate(StrictSchema):
    status: ReportStatus
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def require_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason must not be blank")
        return normalized


class ReportStatusUpdateResponse(StrictSchema):
    id: UUID
    ticket_number: str
    status: ReportStatus
    updated_at: datetime


# Compatibility names used by the OpenClaw integration contract.
CreateReportRequest = ReportCreate
CreateReportResponse = ReportCreateResponse
