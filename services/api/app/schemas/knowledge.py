from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.reports import StrictSchema


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
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentList(StrictSchema):
    items: list[KnowledgeDocument]


class KnowledgeUpdate(StrictSchema):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


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
