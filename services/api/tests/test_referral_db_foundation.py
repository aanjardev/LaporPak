from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.dialects import postgresql

from app.db.referral_repositories import ReferralRepository
from app.db.tables import (
    agency_channels,
    case_tasks,
    mock_delivery_ledger,
    referral_events,
    referral_outbox,
    referral_packages,
    report_referrals,
)


class Result:
    def mappings(self):
        return self

    def one_or_none(self):
        return None


class Session:
    def __init__(self):
        self.statements = []

    def execute(self, statement):
        self.statements.append(statement)
        return Result()


def sql(statement):
    return str(statement.compile(dialect=postgresql.dialect()))


def test_referral_table_mappings_cover_persistent_outbox_and_mock_ledger():
    assert all(
        table.schema == "public"
        for table in (
            agency_channels,
            report_referrals,
            referral_packages,
            referral_events,
            referral_outbox,
            case_tasks,
            mock_delivery_ledger,
        )
    )
    assert referral_outbox.c.operation_key.unique is True
    assert mock_delivery_ledger.c.operation_key.primary_key is True
    assert "package_hash" in referral_packages.c
    assert "source_unit_id" in report_referrals.c


def test_worker_claim_uses_skip_locked_and_fencing_lease():
    session = Session()
    repository = ReferralRepository(session)
    lease = UUID("90000000-0000-4000-8000-000000000001")

    repository.lock_next_job(datetime(2026, 9, 21, tzinfo=UTC), lease)

    statement = sql(session.statements[0])
    assert "FOR UPDATE SKIP LOCKED" in statement
    assert "lease_token" in statement
    assert "attempt_count=(public.referral_outbox.attempt_count +" in statement
