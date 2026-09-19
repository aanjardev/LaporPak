import argparse
import hashlib
from collections.abc import Callable
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.knowledge import KnowledgeService


class ReviewedKnowledgeDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    administrative_unit_id: UUID
    source_type: Literal["paste", "markdown", "pdf"]
    source_reference: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1)
    category: str | None = Field(default=None, max_length=100)
    service_key: str | None = Field(default=None, pattern=r"^[a-z0-9_-]+$")
    is_mandatory: bool = False

    @field_validator("title", "source_reference", "content")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be blank")
        return normalized

    @property
    def checksum(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()


class ReviewedKnowledgeManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    documents: list[ReviewedKnowledgeDocument]

    @model_validator(mode="after")
    def reject_duplicate_entries(self):
        keys = [
            (document.administrative_unit_id, document.checksum)
            for document in self.documents
        ]
        if len(keys) != len(set(keys)):
            raise ValueError("manifest contains a duplicate village/checksum pair")
        return self


def load_manifest(path: Path) -> ReviewedKnowledgeManifest:
    return ReviewedKnowledgeManifest.model_validate_json(path.read_text(encoding="utf-8"))


def import_manifest(
    manifest: ReviewedKnowledgeManifest,
    session_factory: Callable[[], Session],
) -> tuple[int, int]:
    imported = 0
    skipped = 0
    for document in manifest.documents:
        with session_factory() as lookup_session:
            village_exists = lookup_session.execute(
                text(
                    "select 1 from public.administrative_units "
                    "where id=:id and level='village'"
                ),
                {"id": document.administrative_unit_id},
            ).scalar_one_or_none()
            if village_exists is None:
                raise ValueError(
                    f"village does not exist: {document.administrative_unit_id}"
                )
            existing = lookup_session.execute(
                text(
                    "select id from public.knowledge_documents "
                    "where administrative_unit_id=:unit and checksum=:checksum"
                ),
                {
                    "unit": document.administrative_unit_id,
                    "checksum": document.checksum,
                },
            ).scalar_one_or_none()
        if existing is not None:
            skipped += 1
            continue

        with session_factory() as create_session:
            KnowledgeService(create_session).create(
                title=document.title,
                category=document.category,
                is_mandatory=document.is_mandatory,
                unit_id=document.administrative_unit_id,
                content=document.content,
                source_type=document.source_type,
                filename=None,
                data=None,
                service_key=document.service_key,
                source_reference=document.source_reference,
            )
        imported += 1
    return imported, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import reviewed knowledge manifest")
    parser.add_argument("manifest", type=Path)
    arguments = parser.parse_args()

    from app.db.session import SessionLocal

    imported, skipped = import_manifest(load_manifest(arguments.manifest), SessionLocal)
    print(f"Imported: {imported}; skipped: {skipped}")


if __name__ == "__main__":
    main()
