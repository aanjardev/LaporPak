from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import func, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from app.db.tables import (
    administrative_units,
    citizens,
    report_attachments,
    report_categories,
    report_status_history,
    reports,
)


class ReportRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find_citizen_by_phone(self, phone_number: str) -> RowMapping | None:
        statement = select(citizens).where(citizens.c.phone_number == phone_number)
        return self.session.execute(statement).mappings().one_or_none()

    def get_or_create_citizen(
        self,
        phone_number: str,
        display_name: str | None = None,
    ) -> RowMapping:
        statement = (
            postgresql_insert(citizens)
            .values(phone_number=phone_number, display_name=display_name)
            .on_conflict_do_nothing(index_elements=[citizens.c.phone_number])
            .returning(*citizens.c)
        )
        created = self.session.execute(statement).mappings().one_or_none()
        if created is not None:
            return created

        existing = self.find_citizen_by_phone(phone_number)
        if existing is None:
            raise RuntimeError("Citizen could not be resolved after insert conflict")
        return existing

    def resolve_active_category(self, category_code: str) -> RowMapping | None:
        statement = select(report_categories).where(
            report_categories.c.code == category_code,
            report_categories.c.is_active.is_(True),
        )
        return self.session.execute(statement).mappings().one_or_none()

    def find_report_by_id(self, report_id: UUID) -> RowMapping | None:
        statement = select(reports).where(reports.c.id == report_id)
        return self.session.execute(statement).mappings().one_or_none()

    def find_report_by_idempotency_key(
        self,
        idempotency_key: UUID,
    ) -> RowMapping | None:
        statement = select(reports).where(reports.c.idempotency_key == idempotency_key)
        return self.session.execute(statement).mappings().one_or_none()

    def acquire_idempotency_lock(self, lock_key: int) -> None:
        statement = select(func.pg_advisory_xact_lock(lock_key))
        self.session.execute(statement).scalar_one()

    def insert_report(self, values: Mapping[str, Any]) -> RowMapping:
        statement = insert(reports).values(**values).returning(*reports.c)
        return self.session.execute(statement).mappings().one()

    def insert_status_history(self, values: Mapping[str, Any]) -> RowMapping:
        statement = (
            insert(report_status_history)
            .values(**values)
            .returning(*report_status_history.c)
        )
        return self.session.execute(statement).mappings().one()

    def insert_attachment(self, values: Mapping[str, Any]) -> RowMapping:
        statement = (
            insert(report_attachments)
            .values(**values)
            .returning(*report_attachments.c)
        )
        return self.session.execute(statement).mappings().one()

    def list_reports(
        self,
        *,
        offset: int,
        limit: int,
        status: str | None = None,
        urgency: str | None = None,
        category: str | None = None,
        search: str | None = None,
        unit_ids: tuple[UUID, ...] | None = None,
    ) -> tuple[list[RowMapping], int]:
        report_join = reports.join(
            report_categories,
            report_categories.c.id == reports.c.category_id,
        )
        conditions = []
        if unit_ids is not None:
            conditions.append(reports.c.administrative_unit_id.in_(unit_ids))
        if status is not None:
            conditions.append(reports.c.status == status)
        if urgency is not None:
            conditions.append(reports.c.urgency == urgency)
        if category is not None:
            conditions.append(report_categories.c.code == category)
        if search:
            escaped_search = (
                search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            search_pattern = f"%{escaped_search}%"
            conditions.append(
                or_(
                    reports.c.ticket_number.ilike(search_pattern, escape="\\"),
                    reports.c.description.ilike(search_pattern, escape="\\"),
                    reports.c.location_text.ilike(search_pattern, escape="\\"),
                )
            )

        statement = (
            select(*reports.c, report_categories.c.code.label("category"))
            .select_from(report_join)
            .where(*conditions)
            .order_by(reports.c.created_at.desc(), reports.c.id.desc())
            .offset(offset)
            .limit(limit)
        )
        count_statement = (
            select(func.count()).select_from(report_join).where(*conditions)
        )
        rows = list(self.session.execute(statement).mappings().all())
        total = self.session.execute(count_statement).scalar_one()
        return rows, total

    def get_report_detail(
        self, report_id: UUID, unit_ids: tuple[UUID, ...] | None = None
    ) -> RowMapping | None:
        statement = (
            select(
                *reports.c,
                report_categories.c.code.label("category"),
                citizens.c.display_name.label("citizen_display_name"),
                administrative_units.c.name.label("responsible_unit_name"),
            )
            .join(citizens, citizens.c.id == reports.c.citizen_id)
            .join(
                report_categories,
                report_categories.c.id == reports.c.category_id,
            )
            .outerjoin(
                administrative_units,
                administrative_units.c.id == reports.c.responsible_unit_id,
            )
        )
        statement = statement.where(reports.c.id == report_id)
        if unit_ids is not None:
            statement = statement.where(reports.c.administrative_unit_id.in_(unit_ids))
        return self.session.execute(statement).mappings().one_or_none()

    def list_attachments(self, report_id: UUID) -> list[RowMapping]:
        statement = (
            select(report_attachments)
            .where(report_attachments.c.report_id == report_id)
            .order_by(
                report_attachments.c.created_at.asc(),
                report_attachments.c.id.asc(),
            )
        )
        return list(self.session.execute(statement).mappings().all())

    def get_scoped_attachment(
        self,
        report_id: UUID,
        attachment_id: UUID,
        unit_ids: tuple[UUID, ...] | None = None,
    ) -> RowMapping | None:
        statement = (
            select(report_attachments)
            .join(reports, reports.c.id == report_attachments.c.report_id)
            .where(
                report_attachments.c.id == attachment_id,
                report_attachments.c.report_id == report_id,
            )
        )
        if unit_ids is not None:
            statement = statement.where(reports.c.administrative_unit_id.in_(unit_ids))
        return self.session.execute(statement).mappings().one_or_none()

    def list_status_history(self, report_id: UUID) -> list[RowMapping]:
        statement = (
            select(report_status_history)
            .where(report_status_history.c.report_id == report_id)
            .order_by(
                report_status_history.c.created_at.asc(),
                report_status_history.c.id.asc(),
            )
        )
        return list(self.session.execute(statement).mappings().all())

    def lock_report(
        self, report_id: UUID, unit_ids: tuple[UUID, ...] | None = None
    ) -> RowMapping | None:
        statement = select(reports).where(reports.c.id == report_id)
        if unit_ids is not None:
            statement = statement.where(reports.c.administrative_unit_id.in_(unit_ids))
        statement = statement.with_for_update()
        return self.session.execute(statement).mappings().one_or_none()

    def update_report(
        self,
        report_id: UUID,
        values: Mapping[str, Any],
    ) -> RowMapping | None:
        statement = (
            update(reports)
            .where(reports.c.id == report_id)
            .values(**values)
            .returning(*reports.c)
        )
        return self.session.execute(statement).mappings().one_or_none()
