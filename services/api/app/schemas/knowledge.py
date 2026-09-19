from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.reports import StrictSchema


class KnowledgeReviewStatus(StrEnum):
    DRAFT = "draft"
    DEMO = "demo"
    APPROVED = "approved"
    REJECTED = "rejected"


class KnowledgeReviewHistory(StrictSchema):
    old_status: KnowledgeReviewStatus | None
    new_status: KnowledgeReviewStatus
    actor_type: str
    actor_display_name: str | None
    reason: str
    created_at: datetime


class KnowledgePreview(StrictSchema):
    source_type: str
    character_count: int
    chunk_count: int
    preview: str


class KnowledgeDocument(StrictSchema):
    id: UUID
    title: str
    category: str | None
    source_type: str
    administrative_unit_id: UUID
    is_mandatory: bool
    is_active: bool
    processing_status: str
    failure_message: str | None
    review_status: KnowledgeReviewStatus
    reviewer_display_name: str | None = None
    reviewed_at: datetime | None = None
    review_reason: str | None = None
    allowed_review_transitions: list[KnowledgeReviewStatus] = Field(
        default_factory=list
    )
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentList(StrictSchema):
    items: list[KnowledgeDocument]


class KnowledgeDocumentDetail(KnowledgeDocument):
    content: str
    service_key: str | None
    review_history: list[KnowledgeReviewHistory] = Field(default_factory=list)


class KnowledgeUpdate(StrictSchema):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None
    is_mandatory: bool | None = None
    content: str | None = Field(default=None, min_length=1)
    service_key: str | None = Field(
        default=None,
        pattern=r"^[a-z0-9_-]+$",
    )

    @field_validator("title", "content")
    @classmethod
    def reject_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized


class KnowledgeReviewUpdate(StrictSchema):
    status: Literal[
        KnowledgeReviewStatus.APPROVED,
        KnowledgeReviewStatus.REJECTED,
    ]
    reason: str = Field(min_length=1, max_length=1000)

    @field_validator("reason")
    @classmethod
    def reject_blank_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("reason must not be blank")
        return normalized


class EmbeddingChunk(StrictSchema):
    chunk_id: UUID
    content: str
    checksum: str


class EmbeddingJob(StrictSchema):
    document_id: UUID
    chunks: list[EmbeddingChunk]


class EmbeddingValue(StrictSchema):
    chunk_id: UUID
    embedding: list[float] = Field(min_length=768, max_length=768)


class EmbeddingComplete(StrictSchema):
    embeddings: list[EmbeddingValue]


class EmbeddingFailure(StrictSchema):
    message: str = Field(min_length=1, max_length=500)
