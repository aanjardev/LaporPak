from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.tables import (
    citizens,
    service_request_status_history,
    service_request_types,
    service_requests,
)


class ServiceRequestRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def acquire_lock(self, key: int) -> None:
        self.session.execute(select(func.pg_advisory_xact_lock(key))).scalar_one()

    def citizen(self, phone: str):
        created = (
            self.session.execute(
                pg_insert(citizens)
                .values(phone_number=phone)
                .on_conflict_do_nothing(index_elements=[citizens.c.phone_number])
                .returning(*citizens.c)
            )
            .mappings()
            .one_or_none()
        )
        return (
            created
            or self.session.execute(
                select(citizens).where(citizens.c.phone_number == phone)
            )
            .mappings()
            .one()
        )

    def request_type(self, code: str):
        return (
            self.session.execute(
                select(service_request_types).where(
                    service_request_types.c.code == code,
                    service_request_types.c.is_active.is_(True),
                )
            )
            .mappings()
            .one_or_none()
        )

    def by_key(self, key: UUID):
        return (
            self.session.execute(
                select(service_requests).where(
                    service_requests.c.idempotency_key == key
                )
            )
            .mappings()
            .one_or_none()
        )

    def insert_request(self, values: Mapping[str, Any]):
        return (
            self.session.execute(
                insert(service_requests).values(**values).returning(*service_requests.c)
            )
            .mappings()
            .one()
        )

    def history(self, values: Mapping[str, Any]) -> None:
        self.session.execute(insert(service_request_status_history).values(**values))

    def list(self, offset: int, limit: int, unit_ids: tuple[UUID, ...] | None):
        joined = service_requests.join(
            service_request_types,
            service_request_types.c.id == service_requests.c.request_type_id,
        )
        condition = (
            service_requests.c.administrative_unit_id.in_(unit_ids)
            if unit_ids is not None
            else True
        )
        rows = (
            self.session.execute(
                select(
                    *service_requests.c,
                    service_request_types.c.code.label("request_type"),
                )
                .select_from(joined)
                .where(condition)
                .order_by(service_requests.c.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            .mappings()
            .all()
        )
        total = self.session.execute(
            select(func.count()).select_from(service_requests).where(condition)
        ).scalar_one()
        return list(rows), total

    def detail(
        self, request_id: UUID, unit_ids: tuple[UUID, ...] | None, lock: bool = False
    ):
        joined = service_requests.join(
            service_request_types,
            service_request_types.c.id == service_requests.c.request_type_id,
        )
        statement = (
            select(
                *service_requests.c, service_request_types.c.code.label("request_type")
            )
            .select_from(joined)
            .where(service_requests.c.id == request_id)
        )
        if unit_ids is not None:
            statement = statement.where(
                service_requests.c.administrative_unit_id.in_(unit_ids)
            )
        if lock:
            statement = statement.with_for_update()
        return self.session.execute(statement).mappings().one_or_none()

    def update(self, request_id: UUID, status: str):
        return (
            self.session.execute(
                update(service_requests)
                .where(service_requests.c.id == request_id)
                .values(status=status)
                .returning(*service_requests.c)
            )
            .mappings()
            .one()
        )
