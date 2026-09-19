import hashlib
import io
import json
import re
from uuid import UUID

import httpx
from pypdf import PdfReader
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.knowledge import (
    KnowledgeDocument,
    KnowledgeDocumentDetail,
    KnowledgeDocumentList,
)
from app.services.exceptions import ReportNotFoundError, ReportPersistenceError


def canonical_document_sql(alias: str | None = None) -> str:
    prefix = f"{alias}." if alias else ""
    return (
        f"{prefix}administrative_unit_id is not null "
        f"and {prefix}source_type in ('paste', 'markdown', 'pdf') "
        f"and {prefix}content is not null "
        f"and btrim({prefix}content) <> ''"
    )


CANONICAL_DOCUMENT_SQL = canonical_document_sql()


def extract_content(
    data: bytes | None,
    pasted: str | None,
    filename: str | None,
    content_type: str | None,
) -> tuple[str, str]:
    if pasted and pasted.strip():
        return pasted.strip(), "paste"
    if not data or not filename:
        raise ValueError("A PDF, Markdown file, or pasted content is required")
    suffix = filename.lower().rsplit(".", 1)[-1]
    if suffix == "pdf" and content_type in {
        "application/pdf",
        "application/octet-stream",
    }:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF is not supported")
        content = "\n\n".join(
            page.extract_text() or "" for page in reader.pages
        ).strip()
        source = "pdf"
    elif suffix in {"md", "markdown"} and content_type in {
        "text/markdown",
        "text/plain",
        "application/octet-stream",
    }:
        content = data.decode("utf-8").strip()
        source = "markdown"
    else:
        raise ValueError("Only PDF and Markdown files are supported")
    if not content:
        raise ValueError("Document does not contain extractable text")
    return content, source


def chunk_content(content: str, maximum: int = 1200) -> list[str]:
    blocks = [
        block.strip()
        for block in re.split(r"\n\s*\n|(?=^#{1,6}\s)", content, flags=re.MULTILINE)
        if block.strip()
    ]
    chunks: list[str] = []
    for block in blocks:
        while len(block) > maximum:
            split_at = block.rfind(" ", 0, maximum)
            split_at = split_at if split_at > maximum // 2 else maximum
            chunks.append(block[:split_at].strip())
            block = block[split_at:].strip()
        if block:
            chunks.append(block)
    return chunks


class KnowledgeService:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def _model(row) -> KnowledgeDocument:
        return KnowledgeDocument.model_validate(
            {field: row[field] for field in KnowledgeDocument.model_fields}
        )

    @staticmethod
    def _detail_model(row) -> KnowledgeDocumentDetail:
        metadata = row["metadata"] or {}
        return KnowledgeDocumentDetail(
            **{
                field: row[field]
                for field in KnowledgeDocument.model_fields
            },
            content=row["content"] or "",
            service_key=metadata.get("service_key"),
        )

    def create(
        self,
        *,
        title: str,
        category: str | None,
        is_mandatory: bool,
        unit_id: UUID,
        content: str,
        source_type: str,
        filename: str | None,
        data: bytes | None,
        service_key: str | None = None,
        source_reference: str | None = None,
    ) -> KnowledgeDocument:
        chunks = chunk_content(content)
        checksum = hashlib.sha256(content.encode()).hexdigest()
        storage_path = f"{unit_id}/{checksum}/{filename}" if filename else None
        if data is not None and storage_path:
            self._upload(storage_path, data)
        try:
            with self.session.begin():
                document = (
                    self.session.execute(
                        text("""
                    insert into public.knowledge_documents
                    (title, document_type, source_name, metadata, is_active, administrative_unit_id,
                     category, content, source_type, storage_bucket, storage_path, is_mandatory,
                     processing_status, checksum)
                    values (:title,:source_type,:filename,cast(:metadata as jsonb),true,:unit,
                            :category,:content,:source_type,:bucket,:path,:mandatory,'pending',:checksum)
                    returning *
                """),
                        {
                            "title": title,
                            "source_type": source_type,
                            "filename": filename,
                            "metadata": json.dumps(
                                {
                                    "approval_status": "approved",
                                    **(
                                        {"service_key": service_key}
                                        if service_key
                                        else {}
                                    ),
                                    **(
                                        {"source_reference": source_reference}
                                        if source_reference
                                        else {}
                                    ),
                                }
                            ),
                            "unit": unit_id,
                            "category": category,
                            "content": content,
                            "bucket": settings.knowledge_storage_bucket
                            if storage_path
                            else None,
                            "path": storage_path,
                            "mandatory": is_mandatory,
                            "checksum": checksum,
                        },
                    )
                    .mappings()
                    .one()
                )
                for index, chunk in enumerate(chunks):
                    self.session.execute(
                        text("""insert into public.knowledge_chunks
                        (document_id,chunk_index,content,metadata,checksum)
                        values (:document,:index,:content,cast(:metadata as jsonb),:checksum)"""),
                        {
                            "document": document["id"],
                            "index": index,
                            "content": chunk,
                            "metadata": json.dumps(
                                {"service_key": service_key} if service_key else {}
                            ),
                            "checksum": hashlib.sha256(chunk.encode()).hexdigest(),
                        },
                    )
                return self._model(document)
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("knowledge creation") from exc

    def _upload(self, path: str, data: bytes) -> None:
        server_key = settings.supabase_secret_key or settings.supabase_service_role_key
        if not settings.supabase_url or not server_key:
            raise ReportPersistenceError("knowledge storage is not configured")
        try:
            response = httpx.post(
                f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.knowledge_storage_bucket}/{path}",
                headers={
                    "Authorization": f"Bearer {server_key}",
                    "apikey": server_key,
                    "Content-Type": "application/octet-stream",
                    "x-upsert": "false",
                },
                content=data,
                timeout=30,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ReportPersistenceError("knowledge file upload") from exc

    def list(self, unit_ids: tuple[UUID, ...] | None) -> KnowledgeDocumentList:
        unit_condition = (
            "" if unit_ids is None else "and administrative_unit_id = any(:units)"
        )
        try:
            rows = (
                self.session.execute(
                    text(
                        f"select * from public.knowledge_documents "
                        f"where {CANONICAL_DOCUMENT_SQL} {unit_condition} "
                        "order by created_at desc"
                    ),
                    {"units": list(unit_ids or [])},
                )
                .mappings()
                .all()
            )
            return KnowledgeDocumentList(items=[self._model(row) for row in rows])
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("knowledge list") from exc

    def detail(
        self,
        document_id: UUID,
        unit_ids: tuple[UUID, ...] | None,
    ) -> KnowledgeDocumentDetail:
        unit_condition = (
            "" if unit_ids is None else "and administrative_unit_id = any(:units)"
        )
        row = (
            self.session.execute(
                text(
                    f"select * from public.knowledge_documents where id=:id "
                    f"and {CANONICAL_DOCUMENT_SQL} {unit_condition}"
                ),
                {"id": document_id, "units": list(unit_ids or [])},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ReportNotFoundError(document_id)
        return self._detail_model(row)

    def update(
        self, document_id: UUID, values: dict, unit_ids: tuple[UUID, ...] | None
    ):
        allowed = {key: value for key, value in values.items() if value is not None}
        if not allowed:
            return self.detail(document_id, unit_ids)
        content = allowed.pop("content", None)
        service_key = allowed.pop("service_key", None)
        assignments = [f"{key}=:{key}" for key in allowed]
        if content is not None:
            allowed["content"] = content.strip()
            allowed["checksum"] = hashlib.sha256(content.strip().encode()).hexdigest()
            assignments.extend(
                [
                    "content=:content",
                    "checksum=:checksum",
                    "processing_status='pending'",
                    "failure_message=null",
                ]
            )
        if service_key is not None:
            allowed["service_key"] = service_key
            assignments.append(
                "metadata=jsonb_set(metadata, '{service_key}', to_jsonb(cast(:service_key as text)), true)"
            )
        unit_condition = (
            "" if unit_ids is None else "and administrative_unit_id = any(:units)"
        )
        try:
            with self.session.begin():
                if not assignments:
                    return self.detail(document_id, unit_ids)
                result = self.session.execute(
                    text(
                        f"update public.knowledge_documents set {','.join(assignments)}, "
                        f"updated_at=now() where id=:id and {CANONICAL_DOCUMENT_SQL} "
                        f"{unit_condition}"
                    ),
                    {**allowed, "id": document_id, "units": list(unit_ids or [])},
                )
                if result.rowcount == 0:
                    raise ReportNotFoundError(document_id)
                if content is not None:
                    self.session.execute(
                        text(
                            "delete from public.knowledge_chunks where document_id=:id"
                        ),
                        {"id": document_id},
                    )
                    for index, chunk in enumerate(chunk_content(content.strip())):
                        self.session.execute(
                            text("""
                                insert into public.knowledge_chunks
                                    (document_id, chunk_index, content, metadata, checksum)
                                values
                                    (:document, :index, :content, cast(:metadata as jsonb), :checksum)
                            """),
                            {
                                "document": document_id,
                                "index": index,
                                "content": chunk,
                                "metadata": json.dumps(
                                    {"service_key": service_key}
                                    if service_key
                                    else {}
                                ),
                                "checksum": hashlib.sha256(chunk.encode()).hexdigest(),
                            },
                        )
                elif service_key is not None:
                    self.session.execute(
                        text("""
                            update public.knowledge_chunks
                            set metadata=jsonb_set(
                                metadata,
                                '{service_key}',
                                to_jsonb(cast(:service_key as text)),
                                true
                            )
                            where document_id=:id
                        """),
                        {"id": document_id, "service_key": service_key},
                    )
            return self.detail(document_id, unit_ids)
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("knowledge update") from exc

    def deactivate(
        self,
        document_id: UUID,
        unit_ids: tuple[UUID, ...] | None,
    ) -> None:
        unit_condition = (
            "" if unit_ids is None else "and administrative_unit_id = any(:units)"
        )
        try:
            with self.session.begin():
                result = self.session.execute(
                    text(
                        "update public.knowledge_documents set is_active=false, "
                        f"updated_at=now() where id=:id and {CANONICAL_DOCUMENT_SQL} "
                        f"{unit_condition}"
                    ),
                    {"id": document_id, "units": list(unit_ids or [])},
                )
                if result.rowcount == 0:
                    raise ReportNotFoundError(document_id)
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("knowledge deactivation") from exc
