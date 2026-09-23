from datetime import datetime
from uuid import UUID

from sqlalchemy import String, and_, case, cast, func, literal, select, union_all
from sqlalchemy.orm import Session

from app.db.tables import knowledge_documents, reports, service_requests


def canonical_knowledge():
    return and_(
        knowledge_documents.c.administrative_unit_id.is_not(None),
        knowledge_documents.c.source_type.in_(("paste", "markdown", "pdf")),
        knowledge_documents.c.content.is_not(None),
        func.btrim(knowledge_documents.c.content) != "",
    )


class DashboardRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def created_counts(
        self, village_id: UUID, start: datetime, end: datetime
    ) -> tuple[int, int]:
        report_count = self.session.execute(
            select(func.count())
            .select_from(reports)
            .where(
                reports.c.administrative_unit_id == village_id,
                reports.c.created_at >= start,
                reports.c.created_at <= end,
            )
        ).scalar_one()
        request_count = self.session.execute(
            select(func.count())
            .select_from(service_requests)
            .where(
                service_requests.c.administrative_unit_id == village_id,
                service_requests.c.created_at >= start,
                service_requests.c.created_at <= end,
            )
        ).scalar_one()
        return int(report_count), int(request_count)

    def daily_counts(self, table, village_id: UUID, start: datetime, end: datetime):
        local_date = func.date(func.timezone("Asia/Jakarta", table.c.created_at))
        return self.session.execute(
            select(local_date.label("date"), func.count().label("count"))
            .where(
                table.c.administrative_unit_id == village_id,
                table.c.created_at >= start,
                table.c.created_at <= end,
            )
            .group_by(local_date)
        ).all()

    def status_counts(self, table, village_id: UUID) -> dict[str, int]:
        rows = self.session.execute(
            select(table.c.status, func.count())
            .where(table.c.administrative_unit_id == village_id)
            .group_by(table.c.status)
        ).all()
        return {str(status): int(count) for status, count in rows}

    def knowledge_counts(self, village_id: UUID) -> dict[str, int]:
        active = knowledge_documents.c.is_active.is_(True)
        row = (
            self.session.execute(
                select(
                    func.count().filter(active).label("active"),
                    func.count()
                    .filter(
                        active,
                        knowledge_documents.c.review_status == "approved",
                        knowledge_documents.c.processing_status == "ready",
                    )
                    .label("ready"),
                    func.count()
                    .filter(active, knowledge_documents.c.review_status == "draft")
                    .label("draft"),
                    func.count()
                    .filter(active, knowledge_documents.c.processing_status == "failed")
                    .label("failed"),
                    func.count()
                    .filter(
                        active,
                        knowledge_documents.c.processing_status.in_(
                            ("pending", "processing")
                        ),
                    )
                    .label("processing"),
                ).where(
                    knowledge_documents.c.administrative_unit_id == village_id,
                    canonical_knowledge(),
                )
            )
            .mappings()
            .one()
        )
        return {
            key: int(row[key])
            for key in ("active", "ready", "draft", "failed", "processing")
        }

    def attention_counts(self, village_id: UUID) -> dict[str, int]:
        knowledge_attention = and_(
            canonical_knowledge(),
            knowledge_documents.c.is_active.is_(True),
            (
                (knowledge_documents.c.review_status == "draft")
                | (knowledge_documents.c.processing_status == "failed")
            ),
        )
        row = (
            self.session.execute(
                select(
                    select(func.count())
                    .select_from(reports)
                    .where(
                        reports.c.administrative_unit_id == village_id,
                        reports.c.status == "pending_verification",
                    )
                    .scalar_subquery()
                    .label("reports"),
                    select(func.count())
                    .select_from(service_requests)
                    .where(
                        service_requests.c.administrative_unit_id == village_id,
                        service_requests.c.status == "pending_review",
                    )
                    .scalar_subquery()
                    .label("requests"),
                    select(func.count())
                    .select_from(knowledge_documents)
                    .where(
                        knowledge_documents.c.administrative_unit_id == village_id,
                        knowledge_attention,
                    )
                    .scalar_subquery()
                    .label("knowledge"),
                )
            )
            .mappings()
            .one()
        )
        return {key: int(row[key]) for key in ("reports", "requests", "knowledge")}

    def attention(self, village_id: UUID) -> list[dict]:
        report_queue = select(
            literal("report").label("kind"),
            reports.c.id,
            reports.c.ticket_number.label("label"),
            reports.c.status,
            reports.c.created_at,
        ).where(
            reports.c.administrative_unit_id == village_id,
            reports.c.status == "pending_verification",
        )
        request_queue = select(
            literal("request").label("kind"),
            service_requests.c.id,
            service_requests.c.ticket_number.label("label"),
            service_requests.c.status,
            service_requests.c.created_at,
        ).where(
            service_requests.c.administrative_unit_id == village_id,
            service_requests.c.status == "pending_review",
        )
        knowledge_queue = select(
            literal("knowledge").label("kind"),
            knowledge_documents.c.id,
            literal("Sumber ASK").label("label"),
            case(
                (knowledge_documents.c.processing_status == "failed", "failed"),
                else_="draft",
            ).label("status"),
            knowledge_documents.c.created_at,
        ).where(
            knowledge_documents.c.administrative_unit_id == village_id,
            canonical_knowledge(),
            knowledge_documents.c.is_active.is_(True),
            (
                (knowledge_documents.c.review_status == "draft")
                | (knowledge_documents.c.processing_status == "failed")
            ),
        )
        queue = union_all(report_queue, request_queue, knowledge_queue).subquery()
        rows = (
            self.session.execute(
                select(queue)
                .order_by(
                    queue.c.created_at.desc(),
                    queue.c.kind.asc(),
                    cast(queue.c.id, String).asc(),
                )
                .limit(8)
            )
            .mappings()
            .all()
        )
        return [dict(row) for row in rows]
