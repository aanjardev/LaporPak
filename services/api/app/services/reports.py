from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.repositories import ReportRepository
from app.services.exceptions import (
    CategoryNotFoundError,
    ReportNotFoundError,
    ReportPersistenceError,
)


class ReportPersistenceService:
    def __init__(
        self,
        session: Session,
        repository: ReportRepository | None = None,
    ) -> None:
        self.session = session
        self.repository = repository or ReportRepository(session)

    def create_report(
        self,
        *,
        citizen_phone_number: str,
        category_code: str,
        report_values: Mapping[str, Any],
        initial_history_values: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        try:
            with self.session.begin():
                citizen = self.repository.get_or_create_citizen(
                    citizen_phone_number
                )
                category = self.repository.resolve_active_category(category_code)
                if category is None:
                    raise CategoryNotFoundError(category_code)

                report = self.repository.insert_report(
                    {
                        **report_values,
                        "citizen_id": citizen["id"],
                        "category_id": category["id"],
                    }
                )
                self.repository.insert_status_history(
                    {
                        **initial_history_values,
                        "report_id": report["id"],
                    }
                )
                return report
        except CategoryNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("report creation") from exc

    def list_reports(
        self,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[Mapping[str, Any]], int]:
        rows, total = self.repository.list_reports(offset=offset, limit=limit)
        return list(rows), total

    def get_report_detail(self, report_id: UUID) -> dict[str, Any]:
        report = self.repository.get_report_detail(report_id)
        if report is None:
            raise ReportNotFoundError(report_id)

        return {
            **dict(report),
            "attachments": [
                dict(row) for row in self.repository.list_attachments(report_id)
            ],
            "status_history": [
                dict(row)
                for row in self.repository.list_status_history(report_id)
            ],
        }

    def update_report_with_history(
        self,
        *,
        report_id: UUID,
        report_values: Mapping[str, Any],
        history_values: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        try:
            with self.session.begin():
                current = self.repository.lock_report(report_id)
                if current is None:
                    raise ReportNotFoundError(report_id)

                updated = self.repository.update_report(report_id, report_values)
                if updated is None:
                    raise ReportNotFoundError(report_id)

                self.repository.insert_status_history(
                    {
                        **history_values,
                        "report_id": report_id,
                        "old_status": current["status"],
                        "new_status": updated["status"],
                    }
                )
                return updated
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("status update") from exc
