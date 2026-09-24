import ast
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.core.security import resolve_channel_unit
from app.schemas.citizen import AskRequest
from app.schemas.service_requests import (
    ServiceRequestCreate,
    ServiceRequestStatusUpdate,
)
from app.services.knowledge import chunk_content, extract_content


def test_ask_requires_exact_embedding_dimension():
    with pytest.raises(ValidationError):
        AskRequest(question="Jam pelayanan?", query_embedding=[0.1] * 767)
    request = AskRequest(question="Jam pelayanan?", query_embedding=[0.1] * 768)
    assert len(request.query_embedding) == 768


def test_markdown_and_pasted_content_are_extracted_and_chunked():
    pasted, pasted_type = extract_content(None, "  Profil desa  ", None, None)
    markdown, markdown_type = extract_content(
        b"# Profil\n\nIsi desa", None, "profil.md", "text/markdown"
    )
    assert (pasted, pasted_type) == ("Profil desa", "paste")
    assert markdown_type == "markdown"
    assert chunk_content(markdown) == ["# Profil", "Isi desa"]


def test_residency_request_rejects_blank_fields():
    with pytest.raises(ValidationError):
        ServiceRequestCreate(
            sender_phone_number="+628123456789",
            applicant_name=" ",
            domicile_address="Alamat",
            domicile_duration="2 tahun",
            purpose="Administrasi",
        )
    with pytest.raises(ValidationError):
        ServiceRequestStatusUpdate(status="approved", reason="   ")


def test_production_migration_uses_public_ownership_uuid():
    assert UUID("00000000-0000-4000-8000-000000000002").version == 4


def test_channel_resolution_ends_implicit_read_transaction():
    unit_id = UUID("00000000-0000-4000-8000-000000000002")

    class Result:
        def one_or_none(self):
            return unit_id, {}

    class Session:
        rolled_back = False

        def execute(self, _statement):
            return Result()

        def rollback(self):
            self.rolled_back = True

    session = Session()
    assert resolve_channel_unit(session, "demo-channel") == unit_id
    assert session.rolled_back is True


def test_api_error_calls_use_keyword_arguments():
    application_root = Path(__file__).parents[1] / "app"
    positional_calls = []
    for path in application_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "APIError"
                and node.args
            ):
                positional_calls.append((path, node.lineno))
    assert positional_calls == []
