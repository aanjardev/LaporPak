from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.db.dashboard_repository import DashboardRepository
from app.db.tables import reports, service_requests
from app.schemas.dashboard import VillageDashboardResponse

REPORT_STATUSES = (
    "pending_verification",
    "verified",
    "in_progress",
    "forwarded",
    "resolved",
    "rejected",
)
REQUEST_STATUSES = ("pending_review", "approved", "rejected", "completed")
JAKARTA = ZoneInfo("Asia/Jakarta")


def build_dashboard(
    repository: DashboardRepository,
    village: dict,
    days: int,
    now: datetime | None = None,
) -> VillageDashboardResponse:
    generated_at = (now or datetime.now(JAKARTA)).astimezone(JAKARTA)
    end_date = generated_at.date()
    start_date = end_date - timedelta(days=days - 1)
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=JAKARTA)

    reports_created, requests_created = repository.created_counts(
        village["id"], start, generated_at
    )
    report_daily = {
        row.date: int(row.count)
        for row in repository.daily_counts(reports, village["id"], start, generated_at)
    }
    request_daily = {
        row.date: int(row.count)
        for row in repository.daily_counts(
            service_requests, village["id"], start, generated_at
        )
    }
    report_counts = repository.status_counts(reports, village["id"])
    request_counts = repository.status_counts(service_requests, village["id"])
    knowledge = repository.knowledge_counts(village["id"])
    attention_counts = repository.attention_counts(village["id"])

    daily = []
    for offset in range(days):
        item_date = start_date + timedelta(days=offset)
        daily.append(
            {
                "date": item_date,
                "reports": report_daily.get(item_date, 0),
                "requests": request_daily.get(item_date, 0),
            }
        )

    return VillageDashboardResponse(
        village={"id": village["id"], "name": village["name"]},
        period={"days": days, "start_date": start_date, "end_date": end_date},
        generated_at=generated_at,
        kpis={
            "reports_created": reports_created,
            "requests_created": requests_created,
            "needs_attention": sum(attention_counts.values()),
            "ask_ready": knowledge["ready"],
        },
        attention_counts=attention_counts,
        report_status_counts={
            status: report_counts.get(status, 0) for status in REPORT_STATUSES
        },
        request_status_counts={
            status: request_counts.get(status, 0) for status in REQUEST_STATUSES
        },
        knowledge=knowledge,
        daily=daily,
        attention=repository.attention(village["id"]),
    )
