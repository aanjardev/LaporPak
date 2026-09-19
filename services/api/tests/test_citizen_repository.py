from uuid import UUID

from app.db.citizen_repositories import CitizenRepository


class EmptyResult:
    def mappings(self):
        return self

    def all(self):
        return []


class CapturingSession:
    def __init__(self):
        self.statements = []

    def execute(self, statement, _parameters):
        self.statements.append(str(statement))
        return EmptyResult()


def test_knowledge_queries_support_natural_language_fts_and_safe_filters():
    session = CapturingSession()
    repository = CitizenRepository(session)
    unit_id = UUID("00000000-0000-4000-8000-000000000002")

    repository.hybrid_search("jam kantor", None, unit_id, "office_hours_demo")
    repository.hybrid_search("jam kantor", [0.0] * 768, unit_id, None)

    assert "cast(:service_key as text) is null" in session.statements[0]
    assert session.statements[1].count("cast(:service_key as text) is null") == 2
    assert "d.metadata->>'approval_status'='approved'" in session.statements[0]
    assert session.statements[1].count(
        "d.metadata->>'approval_status'='approved'"
    ) == 2
    assert "coalesce(d.metadata->>'approval_status'" not in session.statements[0]
    assert "string_agg(quote_literal(term), ' | ')" in session.statements[0]
    assert "string_agg(quote_literal(term), ' | ')" in session.statements[1]
    assert "limit 1" in session.statements[0]


def test_track_queries_cast_optional_ticket_parameter_to_text():
    session = CapturingSession()
    repository = CitizenRepository(session)
    unit_id = UUID("00000000-0000-4000-8000-000000000002")

    repository.track_reports("+6281200000000", None, unit_id)
    repository.track_requests("+6281200000000", "REQ-2026-0001", unit_id)

    for statement in session.statements:
        normalized = " ".join(statement.split())
        assert "cast(:ticket as text) is null" in normalized
        assert "ticket_number = cast(:ticket as text)" in normalized
        assert ":ticket is null" not in normalized
