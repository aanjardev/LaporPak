import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.services.exceptions import ReportNotFoundError
from app.services.knowledge import KnowledgeService
from app.services.knowledge_import import (
    ReviewedKnowledgeManifest,
    import_manifest,
    load_manifest,
)

DOCUMENT_ID = UUID("11111111-1111-4111-8111-111111111111")
UNIT_ID = UUID("22222222-2222-4222-8222-222222222222")
NOW = datetime(2026, 9, 19, tzinfo=UTC)


class Result:
    def __init__(self, rows=None, row=None, rowcount=0):
        self.rows = rows or []
        self.row = row
        self.rowcount = rowcount

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def one_or_none(self):
        return self.row


class Session:
    def __init__(self, result):
        self.result = result
        self.statements = []

    def execute(self, statement, _parameters=None):
        self.statements.append(str(statement))
        return self.result

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def begin(self):
        return self


def canonical_row():
    return {
        "id": DOCUMENT_ID,
        "title": "SOP layanan",
        "category": "sop",
        "source_type": "paste",
        "administrative_unit_id": UNIT_ID,
        "is_mandatory": False,
        "is_active": True,
        "processing_status": "pending",
        "failure_message": None,
        "created_at": NOW,
        "updated_at": NOW,
    }


def test_list_query_quarantines_legacy_rows_for_system_admin():
    session = Session(Result(rows=[canonical_row()]))

    result = KnowledgeService(session).list(None)

    assert len(result.items) == 1
    sql = session.statements[0]
    assert "administrative_unit_id is not null" in sql
    assert "source_type in ('paste', 'markdown', 'pdf')" in sql
    assert "btrim(content) <> ''" in sql


def test_detail_query_treats_legacy_document_as_not_found():
    session = Session(Result(row=None))

    with pytest.raises(ReportNotFoundError):
        KnowledgeService(session).detail(DOCUMENT_ID, None)

    assert "administrative_unit_id is not null" in session.statements[0]


@pytest.mark.parametrize("operation", ["update", "deactivate"])
def test_legacy_document_cannot_be_mutated(operation):
    session = Session(Result(rowcount=0))
    service = KnowledgeService(session)

    with pytest.raises(ReportNotFoundError):
        if operation == "update":
            service.update(DOCUMENT_ID, {"title": "Revised"}, None)
        else:
            service.deactivate(DOCUMENT_ID, None)

    assert "administrative_unit_id is not null" in session.statements[0]


@pytest.mark.parametrize(
    "body",
    [
        {"documents": [{"title": "x", "source_type": "paste", "content": "ok"}]},
        {
            "documents": [
                {
                    "title": "x",
                    "administrative_unit_id": str(UNIT_ID),
                    "source_type": "paste",
                    "content": "   ",
                }
            ]
        },
        {
            "documents": [
                {
                    "title": "x",
                    "administrative_unit_id": str(UNIT_ID),
                    "source_type": "url",
                    "content": "ok",
                }
            ]
        },
    ],
)
def test_reviewed_manifest_rejects_incomplete_entries(tmp_path: Path, body):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps(body), encoding="utf-8")
    with pytest.raises(ValidationError):
        load_manifest(manifest)


def reviewed_manifest():
    return ReviewedKnowledgeManifest.model_validate(
        {
            "documents": [
                {
                    "title": "SOP reviewed",
                    "administrative_unit_id": str(UNIT_ID),
                    "source_type": "paste",
                    "source_reference": "review/approval-001",
                    "content": "Konten yang sudah disetujui.",
                }
            ]
        }
    )


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class LookupSession(Session):
    def __init__(self, values):
        super().__init__(None)
        self.values = iter(values)

    def execute(self, statement, _parameters=None):
        self.statements.append(str(statement))
        return ScalarResult(next(self.values))


def test_reviewed_import_skips_existing_village_checksum(monkeypatch):
    lookup = LookupSession([1, DOCUMENT_ID])
    created = []
    monkeypatch.setattr(
        KnowledgeService, "create", lambda self, **values: created.append(values)
    )

    assert import_manifest(reviewed_manifest(), lambda: lookup) == (0, 1)
    assert created == []


def test_reviewed_import_rejects_unknown_village():
    lookup = LookupSession([None])

    with pytest.raises(ValueError, match="village does not exist"):
        import_manifest(reviewed_manifest(), lambda: lookup)
