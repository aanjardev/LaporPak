from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole, OpenClawCaller
from app.db.session import get_db_session
from app.schemas.knowledge import (
    EmbeddingComplete,
    EmbeddingFailure,
    EmbeddingJob,
    KnowledgeDocument,
    KnowledgeDocumentList,
    KnowledgePreview,
    KnowledgeUpdate,
)
from app.services.exceptions import ReportNotFoundError, ReportPersistenceError
from app.services.knowledge import KnowledgeService, chunk_content, extract_content

router = APIRouter(prefix="/api/v1/knowledge", tags=["Knowledge"])
tools_router = APIRouter(prefix="/api/v1/tools/knowledge", tags=["Knowledge tools"])


async def read_source(file: UploadFile | None, pasted_content: str | None):
    data = await file.read() if file else None
    if data is not None and len(data) > settings.knowledge_max_upload_bytes:
        raise APIError(413, "VALIDATION_ERROR", "Knowledge file exceeds 10 MB")
    try:
        content, source_type = extract_content(
            data,
            pasted_content,
            file.filename if file else None,
            file.content_type if file else None,
        )
    except (ValueError, UnicodeError) as exc:
        raise APIError(422, "VALIDATION_ERROR", str(exc)) from exc
    return data, content, source_type


def unit_scope(caller):
    return None if caller.role is AdminRole.SYSTEM_ADMIN else caller.unit_ids


def choose_unit(caller, requested: UUID | None) -> UUID:
    if caller.role is AdminRole.SYSTEM_ADMIN:
        if requested is None:
            raise APIError(
                422,
                "VALIDATION_ERROR",
                "administrative_unit_id is required for system admin",
            )
        return requested
    if requested is not None and requested not in caller.unit_ids:
        raise APIError(403, "FORBIDDEN", "Village is outside admin scope")
    return requested or caller.unit_ids[0]


@router.post("/preview", response_model=KnowledgePreview)
async def preview(
    _caller: AdminCaller,
    file: Annotated[UploadFile | None, File()] = None,
    pasted_content: Annotated[str | None, Form()] = None,
) -> KnowledgePreview:
    _, content, source_type = await read_source(file, pasted_content)
    chunks = chunk_content(content)
    return KnowledgePreview(
        source_type=source_type,
        character_count=len(content),
        chunk_count=len(chunks),
        preview=content[:2000],
    )


@router.post("/documents", response_model=KnowledgeDocument)
async def create_document(
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
    title: Annotated[str, Form(min_length=1, max_length=300)],
    category: Annotated[str | None, Form(max_length=100)] = None,
    is_mandatory: Annotated[bool, Form()] = False,
    administrative_unit_id: Annotated[UUID | None, Form()] = None,
    pasted_content: Annotated[str | None, Form()] = None,
    file: Annotated[UploadFile | None, File()] = None,
) -> KnowledgeDocument:
    data, content, source_type = await read_source(file, pasted_content)
    try:
        return KnowledgeService(session).create(
            title=title.strip(),
            category=category,
            is_mandatory=is_mandatory,
            unit_id=choose_unit(caller, administrative_unit_id),
            content=content,
            source_type=source_type,
            filename=file.filename if file else None,
            data=data,
        )
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Knowledge document could not be stored"
        ) from exc


@router.get("/documents", response_model=KnowledgeDocumentList)
def list_documents(
    caller: AdminCaller, session: Annotated[Session, Depends(get_db_session)]
) -> KnowledgeDocumentList:
    try:
        return KnowledgeService(session).list(unit_scope(caller))
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Knowledge documents could not be loaded"
        ) from exc


@router.get("/documents/{document_id}", response_model=KnowledgeDocument)
def document_detail(
    document_id: UUID,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> KnowledgeDocument:
    try:
        return KnowledgeService(session).detail(document_id, unit_scope(caller))
    except ReportNotFoundError as exc:
        raise APIError(404, "NOT_FOUND", "Knowledge document not found") from exc


@router.patch("/documents/{document_id}", response_model=KnowledgeDocument)
def update_document(
    document_id: UUID,
    payload: KnowledgeUpdate,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> KnowledgeDocument:
    try:
        return KnowledgeService(session).update(
            document_id, payload.model_dump(), unit_scope(caller)
        )
    except ReportNotFoundError as exc:
        raise APIError(404, "NOT_FOUND", "Knowledge document not found") from exc
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Knowledge document could not be updated"
        ) from exc


@tools_router.get("/embedding-jobs", response_model=EmbeddingJob | None)
def embedding_job(
    _caller: OpenClawCaller, session: Annotated[Session, Depends(get_db_session)]
) -> EmbeddingJob | None:
    try:
        with session.begin():
            document = (
                session.execute(
                    text(
                        "select id from public.knowledge_documents where processing_status='pending' order by created_at for update skip locked limit 1"
                    )
                )
                .mappings()
                .one_or_none()
            )
            if document is None:
                return None
            session.execute(
                text(
                    "update public.knowledge_documents set processing_status='processing' where id=:id"
                ),
                {"id": document["id"]},
            )
            chunks = (
                session.execute(
                    text(
                        "select id chunk_id, content, checksum from public.knowledge_chunks where document_id=:id order by chunk_index"
                    ),
                    {"id": document["id"]},
                )
                .mappings()
                .all()
            )
            return EmbeddingJob(document_id=document["id"], chunks=list(chunks))
    except SQLAlchemyError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Embedding job is unavailable"
        ) from exc


@tools_router.post("/embedding-jobs/{document_id}/complete")
def complete_embedding(
    document_id: UUID,
    payload: EmbeddingComplete,
    _caller: OpenClawCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> dict:
    try:
        with session.begin():
            expected = set(
                session.execute(
                    text(
                        "select id from public.knowledge_chunks where document_id=:id"
                    ),
                    {"id": document_id},
                )
                .scalars()
                .all()
            )
            supplied = {item.chunk_id for item in payload.embeddings}
            if not expected or supplied != expected:
                raise APIError(
                    422,
                    "VALIDATION_ERROR",
                    "Embeddings must cover every document chunk exactly once",
                )
            for item in payload.embeddings:
                vector = "[" + ",".join(str(value) for value in item.embedding) + "]"
                session.execute(
                    text(
                        "update public.knowledge_chunks set embedding=cast(:embedding as vector) where id=:id and document_id=:document"
                    ),
                    {"embedding": vector, "id": item.chunk_id, "document": document_id},
                )
            session.execute(
                text(
                    "update public.knowledge_documents set processing_status='ready', failure_message=null, updated_at=now() where id=:id"
                ),
                {"id": document_id},
            )
        return {"document_id": document_id, "processing_status": "ready"}
    except APIError:
        raise
    except SQLAlchemyError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Embeddings could not be stored"
        ) from exc


@tools_router.post("/embedding-jobs/{document_id}/fail")
def fail_embedding(
    document_id: UUID,
    payload: EmbeddingFailure,
    _caller: OpenClawCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> dict:
    try:
        with session.begin():
            result = session.execute(
                text(
                    "update public.knowledge_documents set processing_status='failed', failure_message=:message, updated_at=now() where id=:id"
                ),
                {"id": document_id, "message": payload.message},
            )
            if result.rowcount == 0:
                raise APIError(404, "NOT_FOUND", "Knowledge document not found")
        return {"document_id": document_id, "processing_status": "failed"}
    except APIError:
        raise
    except SQLAlchemyError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Embedding failure could not be stored"
        ) from exc
