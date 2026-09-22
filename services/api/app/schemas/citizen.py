from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.reports import StrictSchema


class TrackRequest(StrictSchema):
    sender_phone_number: str = Field(min_length=1)
    ticket_number: str | None = Field(default=None, pattern=r"^(LP|REQ)-\d{4}-\d{4,}$")


class TrackEvent(StrictSchema):
    status: str
    changed_at: datetime


class TrackReferral(StrictSchema):
    dispatch_status: str
    registration_status: str
    handling_status: str
    next_step: str
    updated_at: datetime


class TrackedItem(StrictSchema):
    ticket_number: str
    kind: str
    summary: str
    status: str
    status_changed_at: datetime
    created_at: datetime
    next_step: str
    timeline: list[TrackEvent]
    referral: TrackReferral | None = None


class TrackResponse(StrictSchema):
    checked_at: datetime
    items: list[TrackedItem]


class AskRequest(StrictSchema):
    question: str = Field(min_length=1, max_length=1000)
    query_embedding: list[float] | None = Field(
        default=None,
        min_length=768,
        max_length=768,
    )
    service_key: str | None = Field(default=None, pattern=r"^[a-z0-9_-]+$")

    @field_validator("question")
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be blank")
        return value


class KnowledgeSource(StrictSchema):
    document_id: UUID
    chunk_id: UUID
    title: str
    source_url: str | None
    review_status: str


class AskResponse(StrictSchema):
    outcome: str
    trust_level: str | None
    answer_blocks: list[str]
    sources: list[KnowledgeSource]


class EmergencyDetectionRequest(StrictSchema):
    text: str = Field(min_length=1, max_length=4000)


class SimilarReportsRequest(StrictSchema):
    category: str = Field(
        pattern=r"^(infrastructure|public_facility|cleanliness|security|social|administration|other)$"
    )
    location_text: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_location(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if not self.location_text and self.latitude is None:
            raise ValueError("location text or coordinates are required")
        return self


class ResolutionConfirmationRequest(StrictSchema):
    sender_phone_number: str = Field(min_length=1)
    confirmed: bool
    feedback: str | None = Field(default=None, max_length=2000)
