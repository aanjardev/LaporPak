import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.ai_analysis import AIAnalysis, AIIntent, ReportCategory, Urgency


def report_analysis(**overrides):
    data = {
        "intent": "REPORT",
        "confidence": 0.94,
        "category": "infrastructure",
        "description": "Jalan di RT 03 rusak parah.",
        "location": {
            "text": "RT 03 dekat masjid",
            "latitude": None,
            "longitude": None,
        },
        "urgency": "high",
        "missing_fields": [],
        "needs_clarification": False,
        "clarification_reason": None,
        "summary": "Kerusakan jalan di RT 03 dekat masjid.",
    }
    return AIAnalysis.model_validate(data | overrides)


def test_validates_canonical_report():
    analysis = report_analysis()

    assert analysis.intent is AIIntent.REPORT
    assert analysis.category is ReportCategory.INFRASTRUCTURE
    assert analysis.urgency is Urgency.HIGH


def test_accepts_incomplete_report_for_clarification():
    analysis = report_analysis(
        location=None,
        missing_fields=["location"],
        needs_clarification=True,
        clarification_reason="Lokasi kejadian belum disebutkan.",
    )

    assert analysis.location is None
    assert analysis.needs_clarification is True


def test_accepts_unknown_contract_shape():
    analysis = report_analysis(
        intent="UNKNOWN",
        confidence=0.55,
        category=None,
        description=None,
        location=None,
        urgency=None,
        needs_clarification=True,
        clarification_reason="Intent belum dapat dipastikan.",
        summary=None,
    )

    assert analysis.intent is AIIntent.UNKNOWN


@pytest.mark.parametrize(
    "overrides",
    [
        {"intent": "ASK"},
        {"category": "road_damage"},
        {"urgency": "urgent"},
        {"confidence": 1.01},
        {"confidence": "0.94"},
        {"needs_clarification": "false"},
        {
            "location": {
                "text": "RT 03",
                "latitude": -91,
                "longitude": 112,
            }
        },
        {"summary": "   "},
    ],
)
def test_rejects_values_outside_contract(overrides):
    with pytest.raises(ValidationError):
        report_analysis(**overrides)


def test_requires_all_top_level_fields():
    data = report_analysis().model_dump()
    data.pop("summary")

    with pytest.raises(ValidationError):
        AIAnalysis.model_validate(data)


def test_rejects_unknown_fields_at_every_level():
    with pytest.raises(ValidationError):
        report_analysis(ticket_number="LP-2026-0001")

    with pytest.raises(ValidationError):
        report_analysis(
            location={
                "text": "RT 03",
                "latitude": None,
                "longitude": None,
                "village": "Desa Contoh",
            }
        )


def test_json_schema_matches_required_contract_fields():
    assert set(AIAnalysis.model_json_schema()["required"]) == {
        "intent",
        "confidence",
        "category",
        "description",
        "location",
        "urgency",
        "missing_fields",
        "needs_clarification",
        "clarification_reason",
        "summary",
    }


def test_openclaw_schema_is_generated_from_pydantic_contract():
    schema_path = (
        Path(__file__).parents[3]
        / "integrations"
        / "openclaw"
        / "schemas"
        / "ai-analysis.schema.json"
    )

    assert json.loads(schema_path.read_text(encoding="utf-8")) == (
        AIAnalysis.model_json_schema()
    )


def test_eval_dataset_covers_minimum_workflows():
    cases_path = (
        Path(__file__).parents[3]
        / "integrations"
        / "openclaw"
        / "evals"
        / "report-p0.json"
    )
    cases = json.loads(cases_path.read_text(encoding="utf-8"))

    assert {
        "complete_report",
        "missing_location",
        "vague_description",
        "unrelated_input",
        "ambiguous_urgency",
        "prompt_injection",
        "multiple_facts",
    }.issubset({case["id"] for case in cases})
    assert all(case.get("citizen_text") and case.get("expected") for case in cases)
