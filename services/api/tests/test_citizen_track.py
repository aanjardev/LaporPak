from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.services.citizen import CitizenService
from app.services.exceptions import ReportNotFoundError

UNIT_ID = UUID("00000000-0000-4000-8000-000000000002")
REPORT_ID = UUID("11111111-1111-4111-8111-111111111111")
NOW = datetime(2026, 9, 19, tzinfo=UTC)


class Repository:
    def track_reports(self, phone, ticket, unit_id):
        assert ticket == "LP-2026-0010"
        assert unit_id == UNIT_ID
        if phone != "+6281200000010":
            return []
        return [
            {
                "id": REPORT_ID,
                "ticket_number": ticket,
                "kind": "report",
                "summary": "DATA UJI laporan selesai",
                "status": "resolved",
                "created_at": NOW,
                "status_changed_at": NOW,
            }
        ]

    def history(self, kind, item_ids):
        if not item_ids:
            return []
        assert kind == "report"
        assert item_ids == [REPORT_ID]
        return [{"item_id": REPORT_ID, "new_status": "resolved", "created_at": NOW}]


def test_owner_can_track_report_ticket():
    result = CitizenService(None, Repository()).track(
        "+6281200000010", "LP-2026-0010", UNIT_ID
    )

    assert result.items[0].ticket_number == "LP-2026-0010"
    assert result.items[0].status == "resolved"
    assert result.items[0].timeline[0].status == "resolved"


def test_other_sender_cannot_track_report_ticket():
    with pytest.raises(ReportNotFoundError):
        CitizenService(None, Repository()).track(
            "+6281200000099", "LP-2026-0010", UNIT_ID
        )
