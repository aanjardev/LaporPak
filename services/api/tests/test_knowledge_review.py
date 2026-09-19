from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.api.routes.knowledge import review_document
from app.core.errors import APIError
from app.core.security import AdminRole, AuthenticatedCaller, CallerType
from app.schemas.knowledge import (
    KnowledgeReviewHistory,
    KnowledgeReviewStatus,
    KnowledgeReviewUpdate,
    KnowledgeUpdate,
)
from app.services.exceptions import InvalidStatusTransitionError
from app.services.knowledge import KnowledgeService

DOCUMENT_ID = UUID("11111111-1111-4111-8111-111111111111")
UNIT_ID = UUID("22222222-2222-4222-8222-222222222222")
ADMIN_ID = UUID("33333333-3333-4333-8333-333333333333")


class Result:
    def __init__(self, *, scalar=None, rowcount=1):
        self.scalar = scalar
        self.rowcount = rowcount

    def scalar_one_or_none(self):
        return self.scalar


class Session:
    def __init__(self, status="draft"):
        self.status = status
        self.calls = []

    def begin(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, statement, parameters=None):
        sql = " ".join(str(statement).split())
        self.calls.append((sql, parameters or {}))
        if sql.startswith("select review_status"):
            return Result(scalar=self.status)
        if sql.startswith("update public.knowledge_documents"):
            self.status = parameters["status"]
        return Result()


def test_review_input_and_document_updates_reject_whitespace():
    with pytest.raises(ValidationError):
        KnowledgeReviewUpdate(status="approved", reason="   ")
    with pytest.raises(ValidationError):
        KnowledgeUpdate(title="   ")
    with pytest.raises(ValidationError):
        KnowledgeUpdate(content="\n\t")
    with pytest.raises(ValidationError):
        KnowledgeReviewUpdate(status="demo", reason="Tidak boleh dari dashboard")


def test_village_review_writes_status_and_history_atomically():
    session = Session()
    service = KnowledgeService(session)
    service.detail = lambda *_args, **_kwargs: "detail"

    result = service.review(
        DOCUMENT_ID,
        KnowledgeReviewStatus.APPROVED,
        "  Sudah diverifikasi perangkat desa.  ".strip(),
        (UNIT_ID,),
        ADMIN_ID,
    )

    assert result == "detail"
    assert session.status == "approved"
    sql = " ".join(statement for statement, _ in session.calls)
    assert "administrative_unit_id = any(:units)" in sql
    assert "insert into public.knowledge_review_history" in sql
    assert "processing_status=case when :status='approved' then 'pending'" in sql


def test_repeating_same_review_status_is_rejected_without_update():
    session = Session(status="approved")
    with pytest.raises(InvalidStatusTransitionError):
        KnowledgeService(session).review(
            DOCUMENT_ID,
            KnowledgeReviewStatus.APPROVED,
            "Tetap disetujui",
            (UNIT_ID,),
            ADMIN_ID,
        )
    assert not any(
        sql.startswith("update public.knowledge_documents")
        for sql, _ in session.calls
    )


def test_system_admin_cannot_review_knowledge():
    caller = AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier="supabase:hidden",
        admin_account_id=ADMIN_ID,
        role=AdminRole.SYSTEM_ADMIN,
    )
    with pytest.raises(APIError) as error:
        review_document(
            DOCUMENT_ID,
            KnowledgeReviewUpdate(status="approved", reason="Reviewed"),
            caller,
            Session(),
        )
    assert error.value.status_code == 403
    assert error.value.code == "FORBIDDEN"


def test_review_history_contract_never_contains_raw_actor_identifier():
    row = {
        "old_status": "draft",
        "new_status": "approved",
        "actor_type": "admin",
        "actor_display_name": "Admin Desa",
        "reason": "Reviewed",
        "created_at": datetime(2026, 9, 19, tzinfo=UTC),
    }
    dumped = KnowledgeReviewHistory.model_validate(row).model_dump()
    assert dumped["actor_display_name"] == "Admin Desa"
    assert "actor_identifier" not in dumped
    assert "admin_account_id" not in dumped
