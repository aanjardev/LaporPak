from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.services.reports import ReportPersistenceService


def get_report_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> ReportPersistenceService:
    return ReportPersistenceService(session)


ReportServiceDependency = Annotated[
    ReportPersistenceService,
    Depends(get_report_service),
]
