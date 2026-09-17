from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response, status

from app.core.errors import APIError
from app.core.security import AdminCaller, OpenClawCaller
from app.schemas.enums import (
    ReportCategory,
    ReportSource,
    ReportStatus,
    ReportUrgency,
)
from app.schemas.reports import (
    ReportCreate,
    ReportCreateResponse,
    ReportDetail,
    ReportListResponse,
)
from app.services.dependencies import ReportServiceDependency
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    ReportNotFoundError,
    ReportPersistenceError,
)

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.post(
    "",
    response_model=ReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    payload: ReportCreate,
    response: Response,
    _caller: OpenClawCaller,
    report_service: ReportServiceDependency,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> ReportCreateResponse:
    if payload.source is not ReportSource.WHATSAPP:
        raise APIError(
            status_code=400,
            code="INVALID_REQUEST",
            message="OpenClaw report source must be whatsapp",
        )

    try:
        result = report_service.create_idempotent_report(
            payload=payload,
            idempotency_key=idempotency_key,
        )
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc
    except CategoryNotFoundError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Report category is not available",
        ) from exc
    except DuplicateOperationError as exc:
        raise APIError(
            status_code=409,
            code="DUPLICATE_OPERATION",
            message="Idempotency key was already used for another payload",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Report could not be persisted",
        ) from exc

    if result.replayed:
        response.status_code = status.HTTP_200_OK

    return ReportCreateResponse.model_validate(result.report)


@router.get("", response_model=ReportListResponse)
def list_reports(
    _caller: AdminCaller,
    report_service: ReportServiceDependency,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    report_status: Annotated[
        ReportStatus | None,
        Query(alias="status"),
    ] = None,
    urgency: Annotated[ReportUrgency | None, Query()] = None,
    category: Annotated[ReportCategory | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
) -> ReportListResponse:
    try:
        return report_service.list_reports(
            page=page,
            page_size=page_size,
            status=report_status,
            urgency=urgency,
            category=category,
            search=search,
        )
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Reports could not be loaded",
        ) from exc


@router.get("/{report_id}", response_model=ReportDetail)
def get_report_detail(
    report_id: UUID,
    _caller: AdminCaller,
    report_service: ReportServiceDependency,
) -> ReportDetail:
    try:
        return report_service.get_report_detail(report_id)
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="REPORT_NOT_FOUND",
            message="Report not found",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Report could not be loaded",
        ) from exc
