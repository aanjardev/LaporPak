from uuid import UUID

from sqlalchemy.dialects import postgresql

from app.db.service_request_repositories import ServiceRequestRepository

UNIT_A = UUID("11111111-1111-4111-8111-111111111111")
UNIT_B = UUID("22222222-2222-4222-8222-222222222222")
REQUEST_ID = UUID("33333333-3333-4333-8333-333333333333")


class Result:
    def mappings(self):
        return self

    def all(self):
        return []

    def one_or_none(self):
        return None

    def scalar_one(self):
        return 0


class CapturingSession:
    def __init__(self):
        self.statements = []

    def execute(self, statement):
        self.statements.append(statement)
        return Result()


def compiled(statement):
    return statement.compile(
        dialect=postgresql.dialect(), compile_kwargs={"render_postcompile": True}
    )


def test_request_list_is_scoped_to_only_the_admin_village():
    session = CapturingSession()

    ServiceRequestRepository(session).list(0, 20, (UNIT_A,))

    list_query = compiled(session.statements[0])
    count_query = compiled(session.statements[1])
    assert UNIT_A in list_query.params.values()
    assert UNIT_B not in list_query.params.values()
    assert UNIT_A in count_query.params.values()
    assert "administrative_unit_id IN" in str(list_query)


def test_request_detail_returns_not_found_for_out_of_scope_id():
    session = CapturingSession()

    result = ServiceRequestRepository(session).detail(REQUEST_ID, (UNIT_B,))

    query = compiled(session.statements[0])
    assert result is None
    assert REQUEST_ID in query.params.values()
    assert UNIT_B in query.params.values()
    assert UNIT_A not in query.params.values()
