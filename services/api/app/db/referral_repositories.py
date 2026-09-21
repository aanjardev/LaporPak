from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from app.db.tables import (
    administrative_units,
    agency_channels,
    case_tasks,
    mock_delivery_ledger,
    referral_events,
    referral_outbox,
    referral_packages,
    report_attachments,
    report_categories,
    report_referrals,
    reports,
)


class ReferralRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_scoped_report(
        self, report_id: UUID, unit_ids: tuple[UUID, ...], *, lock: bool = False
    ) -> RowMapping | None:
        statement = (
            select(*reports.c, report_categories.c.code.label("category"))
            .join(report_categories, report_categories.c.id == reports.c.category_id)
            .where(
                reports.c.id == report_id,
                reports.c.administrative_unit_id.in_(unit_ids),
            )
        )
        if lock:
            statement = statement.with_for_update(of=reports)
        return self.session.execute(statement).mappings().one_or_none()

    def list_routing_options(
        self, source_unit_id: UUID, category: str
    ) -> list[RowMapping]:
        target = administrative_units.alias("target_unit")
        statement = (
            select(
                *agency_channels.c,
                target.c.name.label("target_name"),
            )
            .join(target, target.c.id == agency_channels.c.target_unit_id)
            .where(
                agency_channels.c.is_active.is_(True),
                agency_channels.c.mode == "mock",
                agency_channels.c.synthetic.is_(True),
                agency_channels.c.approved_for_production.is_(False),
                or_(
                    agency_channels.c.source_unit_id.is_(None),
                    agency_channels.c.source_unit_id == source_unit_id,
                ),
                agency_channels.c.supported_categories.contains([category]),
            )
            .order_by(agency_channels.c.display_name, agency_channels.c.id)
        )
        return list(self.session.execute(statement).mappings().all())

    def get_channel_for_report(
        self, channel_id: UUID, source_unit_id: UUID, category: str
    ) -> RowMapping | None:
        return next(
            (
                row
                for row in self.list_routing_options(source_unit_id, category)
                if row["id"] == channel_id
            ),
            None,
        )

    def package_attachments(
        self, report_id: UUID, attachment_ids: list[UUID]
    ) -> list[RowMapping]:
        if not attachment_ids:
            return []
        return list(
            self.session.execute(
                select(
                    report_attachments.c.id,
                    report_attachments.c.file_name,
                    report_attachments.c.mime_type,
                    report_attachments.c.metadata,
                ).where(
                    report_attachments.c.report_id == report_id,
                    report_attachments.c.id.in_(attachment_ids),
                )
            )
            .mappings()
            .all()
        )

    def find_by_request_key(
        self, source_unit_id: UUID, request_key: UUID
    ) -> RowMapping | None:
        statement = (
            select(
                *report_referrals.c,
                referral_packages.c.request_payload_hash,
            )
            .join(
                referral_packages,
                referral_packages.c.referral_id == report_referrals.c.id,
            )
            .where(
                report_referrals.c.source_unit_id == source_unit_id,
                referral_packages.c.request_key == request_key,
            )
        )
        return self.session.execute(statement).mappings().one_or_none()

    def lock_referral_for_report_channel(
        self, report_id: UUID, channel_id: UUID
    ) -> RowMapping | None:
        statement = (
            select(report_referrals)
            .where(
                report_referrals.c.report_id == report_id,
                report_referrals.c.channel_id == channel_id,
            )
            .with_for_update()
        )
        return self.session.execute(statement).mappings().one_or_none()

    def insert_referral(self, values: Mapping[str, Any]) -> RowMapping:
        return (
            self.session.execute(
                insert(report_referrals).values(**values).returning(*report_referrals.c)
            )
            .mappings()
            .one()
        )

    def update_referral(
        self, referral_id: UUID, values: Mapping[str, Any]
    ) -> RowMapping:
        return (
            self.session.execute(
                update(report_referrals)
                .where(report_referrals.c.id == referral_id)
                .values(**values, updated_at=func.now())
                .returning(*report_referrals.c)
            )
            .mappings()
            .one()
        )

    def insert_package(self, values: Mapping[str, Any]) -> RowMapping:
        return (
            self.session.execute(
                insert(referral_packages)
                .values(**values)
                .returning(*referral_packages.c)
            )
            .mappings()
            .one()
        )

    def get_package(self, referral_id: UUID, version: int) -> RowMapping | None:
        statement = select(referral_packages).where(
            referral_packages.c.referral_id == referral_id,
            referral_packages.c.package_version == version,
        )
        return self.session.execute(statement).mappings().one_or_none()

    def approve_package(self, package_id: UUID, actor: str, reason: str) -> RowMapping:
        return (
            self.session.execute(
                update(referral_packages)
                .where(referral_packages.c.id == package_id)
                .values(
                    approved_by=actor,
                    approved_at=func.now(),
                    approval_reason=reason,
                    approval_revoked_at=None,
                )
                .returning(*referral_packages.c)
            )
            .mappings()
            .one()
        )

    def revoke_package_approval(self, package_id: UUID) -> None:
        self.session.execute(
            update(referral_packages)
            .where(referral_packages.c.id == package_id)
            .values(approval_revoked_at=func.now())
        )

    def get_scoped_referral(
        self, referral_id: UUID, unit_ids: tuple[UUID, ...], *, lock: bool = False
    ) -> RowMapping | None:
        target = administrative_units.alias("target_unit")
        statement = (
            select(
                *report_referrals.c,
                agency_channels.c.display_name.label("channel_name"),
                agency_channels.c.mode.label("channel_mode"),
                agency_channels.c.synthetic.label("channel_synthetic"),
                agency_channels.c.approved_for_production,
                agency_channels.c.config.label("channel_config"),
                target.c.name.label("target_name"),
            )
            .join(
                agency_channels, agency_channels.c.id == report_referrals.c.channel_id
            )
            .join(target, target.c.id == agency_channels.c.target_unit_id)
            .where(
                report_referrals.c.id == referral_id,
                report_referrals.c.source_unit_id.in_(unit_ids),
            )
        )
        if lock:
            statement = statement.with_for_update(of=report_referrals)
        return self.session.execute(statement).mappings().one_or_none()

    def list_scoped_referrals(
        self, report_id: UUID, unit_ids: tuple[UUID, ...]
    ) -> list[RowMapping]:
        target = administrative_units.alias("target_unit")
        next_action = (
            select(case_tasks.c.next_action)
            .where(
                case_tasks.c.referral_id == report_referrals.c.id,
                case_tasks.c.status == "open",
            )
            .order_by(case_tasks.c.created_at, case_tasks.c.id)
            .limit(1)
            .scalar_subquery()
        )
        statement = (
            select(
                *report_referrals.c,
                referral_packages.c.package_hash,
                agency_channels.c.display_name.label("channel_name"),
                target.c.name.label("target_name"),
                next_action.label("next_action"),
            )
            .join(
                agency_channels, agency_channels.c.id == report_referrals.c.channel_id
            )
            .join(target, target.c.id == agency_channels.c.target_unit_id)
            .join(
                referral_packages,
                and_(
                    referral_packages.c.referral_id == report_referrals.c.id,
                    referral_packages.c.package_version
                    == report_referrals.c.active_package_version,
                ),
            )
            .where(
                report_referrals.c.report_id == report_id,
                report_referrals.c.source_unit_id.in_(unit_ids),
            )
            .order_by(report_referrals.c.created_at.desc())
        )
        return list(self.session.execute(statement).mappings().all())

    def insert_event(self, values: Mapping[str, Any]) -> RowMapping:
        return (
            self.session.execute(
                insert(referral_events).values(**values).returning(*referral_events.c)
            )
            .mappings()
            .one()
        )

    def find_job_by_operation(self, operation_key: UUID) -> RowMapping | None:
        statement = select(referral_outbox).where(
            referral_outbox.c.operation_key == operation_key
        )
        return self.session.execute(statement).mappings().one_or_none()

    def find_latest_job(self, referral_id: UUID) -> RowMapping | None:
        statement = (
            select(referral_outbox)
            .where(referral_outbox.c.referral_id == referral_id)
            .order_by(referral_outbox.c.created_at.desc())
            .limit(1)
        )
        return self.session.execute(statement).mappings().one_or_none()

    def insert_job(self, values: Mapping[str, Any]) -> RowMapping:
        return (
            self.session.execute(
                insert(referral_outbox).values(**values).returning(*referral_outbox.c)
            )
            .mappings()
            .one()
        )

    def cancel_queued_jobs(self, referral_id: UUID) -> None:
        self.session.execute(
            update(referral_outbox)
            .where(
                referral_outbox.c.referral_id == referral_id,
                referral_outbox.c.status == "pending",
            )
            .values(status="cancelled", updated_at=func.now())
        )

    def insert_task(self, values: Mapping[str, Any]) -> RowMapping:
        statement = (
            postgresql_insert(case_tasks)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[case_tasks.c.dedup_key],
                set_={
                    "next_action": values["next_action"],
                    "blocked_reason": values.get("blocked_reason"),
                    "status": "open",
                    "updated_at": func.now(),
                },
            )
            .returning(*case_tasks.c)
        )
        return self.session.execute(statement).mappings().one()

    def complete_task(self, dedup_key: str) -> None:
        self.session.execute(
            update(case_tasks)
            .where(case_tasks.c.dedup_key == dedup_key, case_tasks.c.status == "open")
            .values(status="completed", updated_at=func.now())
        )

    def lock_next_job(self, now: datetime, lease_token: UUID) -> RowMapping | None:
        candidate = (
            select(referral_outbox.c.id)
            .where(
                referral_outbox.c.status.in_(("pending", "reconciliation")),
                referral_outbox.c.next_attempt_at <= now,
            )
            .order_by(referral_outbox.c.created_at, referral_outbox.c.id)
            .with_for_update(skip_locked=True)
            .limit(1)
            .scalar_subquery()
        )
        statement = (
            update(referral_outbox)
            .where(referral_outbox.c.id == candidate)
            .values(
                status="processing",
                attempt_count=referral_outbox.c.attempt_count + 1,
                lease_token=lease_token,
                leased_at=func.now(),
                updated_at=func.now(),
            )
            .returning(*referral_outbox.c)
        )
        return self.session.execute(statement).mappings().one_or_none()

    def recover_stale_jobs(self, stale_before: datetime) -> None:
        self.session.execute(
            update(referral_outbox)
            .where(
                referral_outbox.c.status == "processing",
                referral_outbox.c.leased_at < stale_before,
            )
            .values(
                status="reconciliation",
                last_error="reconcile:worker_lease_expired",
                next_attempt_at=func.now(),
                updated_at=func.now(),
            )
        )

    def get_job_context(self, job_id: UUID, *, lock: bool = False) -> RowMapping | None:
        target = administrative_units.alias("target_unit")
        statement = (
            select(
                *referral_outbox.c,
                referral_packages.c.package_hash,
                referral_packages.c.snapshot,
                referral_packages.c.package_version,
                referral_packages.c.approved_at,
                referral_packages.c.approval_revoked_at,
                report_referrals.c.dispatch_status,
                report_referrals.c.active_package_version,
                report_referrals.c.source_unit_id,
                report_referrals.c.report_id,
                agency_channels.c.id.label("channel_id"),
                agency_channels.c.mode.label("channel_mode"),
                agency_channels.c.synthetic.label("channel_synthetic"),
                agency_channels.c.approved_for_production,
                agency_channels.c.is_active.label("channel_is_active"),
                agency_channels.c.capabilities.label("channel_capabilities"),
                agency_channels.c.config.label("channel_config"),
                target.c.name.label("target_name"),
            )
            .join(
                referral_packages,
                referral_packages.c.id == referral_outbox.c.package_id,
            )
            .join(
                report_referrals, report_referrals.c.id == referral_outbox.c.referral_id
            )
            .join(
                agency_channels, agency_channels.c.id == report_referrals.c.channel_id
            )
            .join(target, target.c.id == agency_channels.c.target_unit_id)
            .where(referral_outbox.c.id == job_id)
        )
        if lock:
            statement = statement.with_for_update(of=referral_outbox)
        return self.session.execute(statement).mappings().one_or_none()

    def update_job(
        self, job_id: UUID, lease_token: UUID, values: Mapping[str, Any]
    ) -> None:
        self.session.execute(
            update(referral_outbox)
            .where(
                referral_outbox.c.id == job_id,
                referral_outbox.c.lease_token == lease_token,
            )
            .values(**values, updated_at=func.now())
        )

    def get_mock_receipt(self, operation_key: UUID) -> RowMapping | None:
        return (
            self.session.execute(
                select(mock_delivery_ledger).where(
                    mock_delivery_ledger.c.operation_key == operation_key
                )
            )
            .mappings()
            .one_or_none()
        )

    def insert_mock_receipt(self, values: Mapping[str, Any]) -> RowMapping:
        statement = (
            postgresql_insert(mock_delivery_ledger)
            .values(**values)
            .on_conflict_do_nothing(
                index_elements=[mock_delivery_ledger.c.operation_key]
            )
            .returning(*mock_delivery_ledger.c)
        )
        created = self.session.execute(statement).mappings().one_or_none()
        return created or self.get_mock_receipt(values["operation_key"])

    def has_accepted_referral(self, report_id: UUID) -> bool:
        statement = select(
            select(report_referrals.c.id)
            .where(
                report_referrals.c.report_id == report_id,
                report_referrals.c.handling_status.in_(
                    ("accepted", "in_progress", "completed")
                ),
                report_referrals.c.evidence_reference.is_not(None),
            )
            .exists()
        )
        return bool(self.session.execute(statement).scalar_one())
