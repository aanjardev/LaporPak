from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import (
    AdminCaller,
    AdminRole,
    OpenClawCaller,
    resolve_channel_unit,
)
from app.db.session import get_db_session
from app.schemas.service_requests import (
    ServiceRequestCreate,
    ServiceRequestCreated,
    ServiceRequestDetail,
    ServiceRequestList,
    ServiceRequestStatusUpdate,
    ServiceRequestStatusUpdateResponse,
)
from app.services.exceptions import (
    DuplicateOperationError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.service_requests import ServiceRequestService

router = APIRouter(prefix="/api/v1/service-requests", tags=["Service requests"])


@router.post("", response_model=ServiceRequestCreated, status_code=status.HTTP_201_CREATED)
def create(
    payload: ServiceRequestCreate,
    response: Response,
    _caller: OpenClawCaller,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestCreated:
    try:
        result = ServiceRequestService(session).create(
            payload, idempotency_key, resolve_channel_unit(session, channel_account_id)
        )
        if result.replayed:
            response.status_code = 200
        return result.item
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc
    except DuplicateOperationError as exc:
        raise APIError(
            status_code=409,
            code="DUPLICATE_OPERATION",
            message="Idempotency key was used for another payload",
        ) from exc
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Service request type is unavailable",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Service request could not be persisted",
        ) from exc


def scope(caller):
    return None if caller.role is AdminRole.SYSTEM_ADMIN else caller.unit_ids


@router.get("", response_model=ServiceRequestList)
def list_requests(
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ServiceRequestList:
    try:
        return ServiceRequestService(session).list(page, page_size, scope(caller))
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Service requests could not be loaded",
        ) from exc


@router.get("/{request_id}", response_model=ServiceRequestDetail)
def detail(
    request_id: UUID,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestDetail:
    try:
        return ServiceRequestService(session).detail(
            request_id,
            scope(caller),
            can_transition=caller.role is AdminRole.VILLAGE_ADMIN,
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="SERVICE_REQUEST_NOT_FOUND",
            message="Service request not found",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Service request could not be loaded",
        ) from exc


@router.patch(
    "/{request_id}/status", response_model=ServiceRequestStatusUpdateResponse
)
def update_status(
    request_id: UUID,
    payload: ServiceRequestStatusUpdate,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestStatusUpdateResponse:
    if caller.role is not AdminRole.VILLAGE_ADMIN:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village administrator role required",
        )
    try:
        return ServiceRequestService(session).update(
            request_id, payload.status, payload.reason, caller.identifier, scope(caller)
        )
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404,
            code="SERVICE_REQUEST_NOT_FOUND",
            message="Service request not found",
        ) from exc
    except InvalidStatusTransitionError as exc:
        raise APIError(
            status_code=409,
            code="INVALID_STATUS_TRANSITION",
            message="Service request transition is not allowed",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Service request could not be updated",
        ) from exc
