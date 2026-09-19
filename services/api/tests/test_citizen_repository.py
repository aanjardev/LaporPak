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


def test_knowledge_queries_cast_optional_service_key_to_text():
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
