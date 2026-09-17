from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas import (
    ReportCategory,
    ReportCreate,
    ReportCreateResponse,
    ReportLocation,
    ReportSource,
    ReportStatus,
    ReportStatusUpdate,
    ReportUrgency,
)


def valid_report_payload() -> dict:
    return {
        "sender_phone_number": " +6281234567890 ",
        "conversation_id": "fa5d95ae-514f-4ce0-a3c2-735d8558948b",
        "category": "infrastructure",
        "description": " Jalan di RT 03 rusak parah. ",
        "location": {
            "text": " RT 03 dekat masjid ",
            "latitude": -7.123,
            "longitude": 112.123,
        },
        "urgency": "high",
        "original_text": "Pak jalan di RT 03 rusak parah.",
        "source": "whatsapp",
        "ai_analysis": {
            "confidence": 0.94,
            "summary": "Kerusakan jalan di RT 03 dekat masjid.",
        },
    }


def test_canonical_enum_values():
    assert {category.value for category in ReportCategory} == {
        "infrastructure",
        "public_facility",
        "cleanliness",
        "security",
        "social",
        "administration",
        "other",
    }
    assert {urgency.value for urgency in ReportUrgency} == {
        "low",
        "medium",
        "high",
        "critical",
    }
    assert {status.value for status in ReportStatus} == {
        "pending_verification",
        "verified",
        "in_progress",
        "forwarded",
        "resolved",
        "rejected",
    }


def test_report_create_accepts_contract_payload_and_normalizes_text():
    report = ReportCreate.model_validate(valid_report_payload())

    assert report.sender_phone_number == "+6281234567890"
    assert report.description == "Jalan di RT 03 rusak parah."
    assert report.location.text == "RT 03 dekat masjid"
    assert report.category is ReportCategory.INFRASTRUCTURE
    assert report.urgency is ReportUrgency.HIGH
    assert report.source is ReportSource.WHATSAPP


@pytest.mark.parametrize(
    "location",
    [
        {"text": "RT 03", "latitude": None, "longitude": None},
        {"text": None, "latitude": -7.123, "longitude": 112.123},
    ],
)
def test_location_accepts_text_or_complete_coordinates(location):
    assert ReportLocation.model_validate(location)


@pytest.mark.parametrize(
    "location",
    [
        {"text": "   ", "latitude": None, "longitude": None},
        {"text": None, "latitude": -7.123, "longitude": None},
        {"text": None, "latitude": None, "longitude": 112.123},
        {"text": None, "latitude": -91, "longitude": 112.123},
        {"text": None, "latitude": -7.123, "longitude": 181},
    ],
)
def test_location_rejects_missing_partial_or_out_of_range_values(location):
    with pytest.raises(ValidationError):
        ReportLocation.model_validate(location)


@pytest.mark.parametrize("field", ["sender_phone_number", "description"])
def test_report_create_rejects_blank_required_text(field):
    payload = valid_report_payload()
    payload[field] = "   "

    with pytest.raises(ValidationError):
        ReportCreate.model_validate(payload)


def test_report_create_rejects_unknown_fields():
    payload = valid_report_payload()
    payload["ticket_number"] = "LP-2026-9999"

    with pytest.raises(ValidationError):
        ReportCreate.model_validate(payload)


def test_report_create_defaults_optional_operational_values():
    payload = valid_report_payload()
    payload.pop("urgency")
    payload.pop("source")

    report = ReportCreate.model_validate(payload)

    assert report.urgency is ReportUrgency.MEDIUM
    assert report.source is ReportSource.WHATSAPP


def test_create_response_matches_contract_shape():
    response = ReportCreateResponse(
        id=UUID("72af1a52-7016-48c7-aacc-6c35417be819"),
        ticket_number="LP-2026-0001",
        status=ReportStatus.PENDING_VERIFICATION,
        created_at=datetime(2026, 9, 16, 14, tzinfo=UTC),
    )

    assert set(response.model_dump(mode="json")) == {
        "id",
        "ticket_number",
        "status",
        "created_at",
    }


def test_status_update_requires_a_non_blank_reason():
    update = ReportStatusUpdate(status="verified", reason=" Sudah diperiksa. ")
    assert update.reason == "Sudah diperiksa."

    with pytest.raises(ValidationError):
        ReportStatusUpdate(status="rejected", reason="   ")
