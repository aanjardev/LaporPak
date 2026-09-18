from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.reports import StrictSchema


class TrackRequest(StrictSchema):
    sender_phone_number: str = Field(min_length=1)
    ticket_number: str | None = Field(default=None, pattern=r"^(LP|REQ)-\d{4}-\d{4,}$")


class TrackEvent(StrictSchema):
    status: str
    changed_at: datetime


class TrackedItem(StrictSchema):
    ticket_number: str
    kind: str
    summary: str
    status: str
    status_changed_at: datetime
    created_at: datetime
    next_step: str
    timeline: list[TrackEvent]


class TrackResponse(StrictSchema):
    checked_at: datetime
    items: list[TrackedItem]


class AskRequest(StrictSchema):
    question: str = Field(min_length=1, max_length=1000)
    query_embedding: list[float] = Field(min_length=768, max_length=768)
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


class AskResponse(StrictSchema):
    outcome: str
    answer_blocks: list[str]
    sources: list[KnowledgeSource]
