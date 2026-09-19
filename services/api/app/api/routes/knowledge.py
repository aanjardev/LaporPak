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
    KnowledgeDocumentDetail,
    KnowledgeDocumentList,
    KnowledgePreview,
    KnowledgeReviewUpdate,
    KnowledgeUpdate,
)
from app.services.exceptions import (
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.knowledge import (
    CANONICAL_DOCUMENT_SQL,
    KnowledgeService,
    canonical_document_sql,
    chunk_content,
    extract_content,
)

router = APIRouter(prefix="/api/v1/knowledge", tags=["Knowledge"])
tools_router = APIRouter(prefix="/api/v1/tools/knowledge", tags=["Knowledge tools"])


async def read_source(file: UploadFile | None, pasted_content: str | None):
    data = await file.read() if file else None
    if data is not None and len(data) > settings.knowledge_max_upload_bytes:
        raise APIError(
            status_code=413,
            code="VALIDATION_ERROR",
            message="Knowledge file exceeds 10 MB",
        )
    try:
        content, source_type = extract_content(
            data,
            pasted_content,
            file.filename if file else None,
            file.content_type if file else None,
        )
    except (ValueError, UnicodeError) as exc:
        raise APIError(
            status_code=422, code="VALIDATION_ERROR", message=str(exc)
        ) from exc
    return data, content, source_type


def unit_scope(caller):
    return None if caller.role is AdminRole.SYSTEM_ADMIN else caller.unit_ids


def choose_unit(caller, requested: UUID | None) -> UUID:
    if caller.role is AdminRole.SYSTEM_ADMIN:
        if requested is None:
            raise APIError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="administrative_unit_id is required for system admin",
            )
        return requested
    if requested is not None and requested not in caller.unit_ids:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village is outside admin scope",
        )
    return requested or caller.unit_ids[0]


def can_review(caller) -> bool:
    return caller.role is AdminRole.VILLAGE_ADMIN


def embedding_review_sql(alias: str | None = None) -> str:
    prefix = f"{alias}." if alias else ""
    if settings.app_env == "development":
        return f"{prefix}review_status in ('approved','demo')"
    return f"{prefix}review_status='approved'"


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
    service_key: Annotated[str | None, Form(pattern=r"^[a-z0-9_-]+$")] = None,
    file: Annotated[UploadFile | None, File()] = None,
) -> KnowledgeDocument:
    data, content, source_type = await read_source(file, pasted_content)
    normalized_title = title.strip()
    if not normalized_title:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Knowledge title must not be blank",
        )
    try:
        return KnowledgeService(session).create(
            title=normalized_title,
            category=category,
            is_mandatory=is_mandatory,
            unit_id=choose_unit(caller, administrative_unit_id),
            content=content,
            source_type=source_type,
            filename=file.filename if file else None,
            data=data,
            service_key=service_key,
        )
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge document could not be stored",
        ) from exc


@router.get("/documents", response_model=KnowledgeDocumentList)
def list_documents(
    caller: AdminCaller, session: Annotated[Session, Depends(get_db_session)]
) -> KnowledgeDocumentList:
    try:
        return KnowledgeService(session).list(
            unit_scope(caller), can_review=can_review(caller)
        )
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge documents could not be loaded",
        ) from exc


@router.get("/documents/{document_id}", response_model=KnowledgeDocumentDetail)
def document_detail(
    document_id: UUID,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> KnowledgeDocumentDetail:
    try:
        return KnowledgeService(session).detail(
            document_id, unit_scope(caller), can_review=can_review(caller)
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="KNOWLEDGE_DOCUMENT_NOT_FOUND",
            message="Knowledge document not found",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge document could not be loaded",
        ) from exc


@router.patch("/documents/{document_id}", response_model=KnowledgeDocumentDetail)
def update_document(
    document_id: UUID,
    payload: KnowledgeUpdate,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> KnowledgeDocumentDetail:
    try:
        return KnowledgeService(session).update(
            document_id,
            payload.model_dump(),
            unit_scope(caller),
            caller.admin_account_id,
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="KNOWLEDGE_DOCUMENT_NOT_FOUND",
            message="Knowledge document not found",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge document could not be updated",
        ) from exc


@router.patch("/documents/{document_id}/review", response_model=KnowledgeDocumentDetail)
def review_document(
    document_id: UUID,
    payload: KnowledgeReviewUpdate,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> KnowledgeDocumentDetail:
    if caller.role is not AdminRole.VILLAGE_ADMIN or caller.admin_account_id is None:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village administrator role required",
        )
    try:
        return KnowledgeService(session).review(
            document_id,
            payload.status,
            payload.reason,
            caller.unit_ids,
            caller.admin_account_id,
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="KNOWLEDGE_DOCUMENT_NOT_FOUND",
            message="Knowledge document not found",
        ) from exc
    except InvalidStatusTransitionError as exc:
        raise APIError(
            status_code=409,
            code="INVALID_STATUS_TRANSITION",
            message="Knowledge review transition is not allowed",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge review could not be stored",
        ) from exc


@router.delete("/documents/{document_id}", status_code=204)
def deactivate_document(
    document_id: UUID,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> None:
    try:
        KnowledgeService(session).deactivate(document_id, unit_scope(caller))
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="KNOWLEDGE_DOCUMENT_NOT_FOUND",
            message="Knowledge document not found",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge document could not be deactivated",
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
                        "select id from public.knowledge_documents "
                        "where processing_status='pending' "
                        f"and {CANONICAL_DOCUMENT_SQL} "
                        f"and {embedding_review_sql()} "
                        "order by created_at for update skip locked limit 1"
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
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Embedding job is unavailable",
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
                        "select c.id from public.knowledge_chunks c "
                        "join public.knowledge_documents d on d.id=c.document_id "
                        f"where c.document_id=:id and {canonical_document_sql('d')} "
                        f"and {embedding_review_sql('d')} for update of d"
                    ),
                    {"id": document_id},
                )
                .scalars()
                .all()
            )
            supplied = {item.chunk_id for item in payload.embeddings}
            if not expected or supplied != expected:
                raise APIError(
                    status_code=422,
                    code="VALIDATION_ERROR",
                    message="Embeddings must cover every document chunk exactly once",
                )
            for item in payload.embeddings:
                vector = "[" + ",".join(str(value) for value in item.embedding) + "]"
                session.execute(
                    text(
                        "update public.knowledge_chunks set embedding=cast(:embedding as vector) where id=:id and document_id=:document"
                    ),
                    {"embedding": vector, "id": item.chunk_id, "document": document_id},
                )
            result = session.execute(
                text(
                    "update public.knowledge_documents set processing_status='ready', "
                    f"failure_message=null, updated_at=now() where id=:id and {CANONICAL_DOCUMENT_SQL} "
                    f"and {embedding_review_sql()}"
                ),
                {"id": document_id},
            )
            if result.rowcount != 1:
                raise APIError(
                    status_code=409,
                    code="INVALID_STATUS_TRANSITION",
                    message="Knowledge review status changed during embedding",
                )
        return {"document_id": document_id, "processing_status": "ready"}
    except APIError:
        raise
    except SQLAlchemyError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Embeddings could not be stored",
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
                    "update public.knowledge_documents set processing_status='failed', "
                    f"failure_message=:message, updated_at=now() where id=:id and {CANONICAL_DOCUMENT_SQL} "
                    f"and {embedding_review_sql()}"
                ),
                {"id": document_id, "message": payload.message},
            )
            if result.rowcount == 0:
                raise APIError(
                    status_code=404,
                    code="KNOWLEDGE_DOCUMENT_NOT_FOUND",
                    message="Knowledge document not found",
                )
        return {"document_id": document_id, "processing_status": "failed"}
    except APIError:
        raise
    except SQLAlchemyError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Embedding failure could not be stored",
        ) from exc
