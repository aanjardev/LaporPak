from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Header, Query, Response, status

from app.core.config import settings
from app.core.errors import APIError
from app.core.security import (
    AdminCaller,
    OpenClawCaller,
    operator_scope,
    require_village_operator,
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
    AttachmentUnavailableError,
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidAttachmentError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
    ReportRateLimitError,
)
from app.services.report_documents import process_pending_document_jobs

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.post(
    "",
    response_model=ReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    payload: ReportCreate,
    response: Response,
    background_tasks: BackgroundTasks,
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
            raise APIError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="X-Channel-Account-ID is required",
            )
        if unit_id is None:
            raise APIError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="X-Channel-Account-ID is required",
            )
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
    except InvalidAttachmentError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message=exc.message,
        ) from exc
    except DuplicateOperationError as exc:
        raise APIError(
            status_code=409,
            code="DUPLICATE_OPERATION",
            message="Idempotency key was already used for another payload",
        ) from exc
    except ReportRateLimitError as exc:
        raise APIError(
            status_code=429,
            code="RATE_LIMIT_EXCEEDED",
            message="Batas laporan per jam telah tercapai. Coba lagi nanti.",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Report could not be persisted",
        ) from exc

    if result.replayed:
        response.status_code = status.HTTP_200_OK
    else:
        background_tasks.add_task(process_pending_document_jobs)

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
    require_village_operator(caller)
    try:
        unit_ids = operator_scope(caller)
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
    require_village_operator(caller)
    try:
        unit_ids = operator_scope(caller)
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


@router.get("/{report_id}/attachments/{attachment_id}")
def get_report_attachment(
    report_id: UUID,
    attachment_id: UUID,
    caller: AdminCaller,
    report_service: ReportServiceDependency,
) -> Response:
    require_village_operator(caller)
    unit_ids = operator_scope(caller)
    try:
        content, mime_type = report_service.get_report_attachment(
            report_id, attachment_id, unit_ids
        )
        return Response(
            content=content,
            media_type=mime_type,
            headers={"Content-Disposition": "inline"},
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="REPORT_NOT_FOUND",
            message="Report not found",
        ) from exc
    except (AttachmentUnavailableError, ReportPersistenceError) as exc:
        raise APIError(
            status_code=503,
            code="ATTACHMENT_UNAVAILABLE",
            message="Report attachment is unavailable",
        ) from exc


@router.patch("/{report_id}/status", response_model=ReportStatusUpdateResponse)
def update_report_status(
    report_id: UUID,
    payload: ReportStatusUpdate,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    report_service: ReportServiceDependency,
) -> ReportStatusUpdateResponse:
    require_village_operator(caller)
    try:
        unit_ids = operator_scope(caller)
        result = report_service.update_report_status(
            report_id=report_id,
            new_status=payload.status,
            reason=payload.reason,
            actor_identifier=caller.identifier,
            unit_ids=unit_ids,
        )
        if payload.status is ReportStatus.VERIFIED:
            background_tasks.add_task(process_pending_document_jobs)
        return result
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
