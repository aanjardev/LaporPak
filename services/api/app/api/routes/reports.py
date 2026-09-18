from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Query, Response, status

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import (
    AdminCaller,
    AdminRole,
    OpenClawCaller,
    resolve_channel_unit,
)
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
    ReportStatusUpdate,
    ReportStatusUpdateResponse,
)
from app.services.dependencies import ReportServiceDependency
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
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
    channel_account_id: Annotated[
        str | None, Header(alias="X-Channel-Account-ID")
    ] = None,
) -> ReportCreateResponse:
    if payload.source is not ReportSource.WHATSAPP:
        raise APIError(
            status_code=400,
            code="INVALID_REQUEST",
            message="OpenClaw report source must be whatsapp",
        )

    try:
        unit_id = (
            resolve_channel_unit(report_service.session, channel_account_id)
            if channel_account_id
            else settings.dashboard_admin_unit_id
        )
        if channel_account_id is None and not settings.allow_legacy_admin_fallback:
            raise APIError(422, "VALIDATION_ERROR", "X-Channel-Account-ID is required")
        if unit_id is None:
            raise APIError(422, "VALIDATION_ERROR", "X-Channel-Account-ID is required")
        create_arguments = {"payload": payload, "idempotency_key": idempotency_key}
        if channel_account_id:
            create_arguments["administrative_unit_id"] = unit_id
        result = report_service.create_idempotent_report(**create_arguments)
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

    return ReportCreateResponse(
        id=result.report["id"],
        ticket_number=result.report["ticket_number"],
        status=result.report["status"],
        created_at=result.report["created_at"],
    )


@router.get("", response_model=ReportListResponse)
def list_reports(
    caller: AdminCaller,
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
        unit_ids = (
            None
            if caller.admin_account_id is None or caller.role is AdminRole.SYSTEM_ADMIN
            else caller.unit_ids
        )
        return report_service.list_reports(
            page=page,
            page_size=page_size,
            status=report_status,
            urgency=urgency,
            category=category,
            search=search,
            unit_ids=unit_ids,
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
    caller: AdminCaller,
    report_service: ReportServiceDependency,
) -> ReportDetail:
    try:
        unit_ids = (
            None
            if caller.admin_account_id is None or caller.role is AdminRole.SYSTEM_ADMIN
            else caller.unit_ids
        )
        if unit_ids is None:
            return report_service.get_report_detail(report_id)
        return report_service.get_report_detail(report_id, unit_ids)
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


@router.patch("/{report_id}/status", response_model=ReportStatusUpdateResponse)
def update_report_status(
    report_id: UUID,
    payload: ReportStatusUpdate,
    caller: AdminCaller,
    report_service: ReportServiceDependency,
) -> ReportStatusUpdateResponse:
    try:
        unit_ids = (
            None
            if caller.admin_account_id is None or caller.role is AdminRole.SYSTEM_ADMIN
            else caller.unit_ids
        )
        return report_service.update_report_status(
            report_id=report_id,
            new_status=payload.status,
            reason=payload.reason,
            actor_identifier=caller.identifier,
            unit_ids=unit_ids,
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="REPORT_NOT_FOUND",
            message="Report not found",
        ) from exc
    except InvalidStatusTransitionError as exc:
        raise APIError(
            status_code=409,
            code="INVALID_STATUS_TRANSITION",
            message="Report status transition is not allowed",
            details={
                "old_status": exc.old_status,
                "new_status": exc.new_status,
            },
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Report status could not be updated",
        ) from exc
