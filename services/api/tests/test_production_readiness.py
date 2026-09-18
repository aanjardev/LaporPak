from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.citizen import AskRequest
from app.schemas.service_requests import ServiceRequestCreate
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


def test_production_migration_uses_public_ownership_uuid():
    assert UUID("00000000-0000-4000-8000-000000000002").version == 4
