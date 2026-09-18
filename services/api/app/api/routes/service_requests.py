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
    ServiceRequestItem,
    ServiceRequestList,
    ServiceRequestStatusUpdate,
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


@router.post("", response_model=ServiceRequestItem, status_code=status.HTTP_201_CREATED)
def create(
    payload: ServiceRequestCreate,
    response: Response,
    _caller: OpenClawCaller,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestItem:
    try:
        result = ServiceRequestService(session).create(
            payload, idempotency_key, resolve_channel_unit(session, channel_account_id)
        )
        if result.replayed:
            response.status_code = 200
        return result.item
    except InvalidSenderIdentityError as exc:
        raise APIError(
            422, "VALIDATION_ERROR", "Sender phone number is invalid"
        ) from exc
    except DuplicateOperationError as exc:
        raise APIError(
            409, "DUPLICATE_OPERATION", "Idempotency key was used for another payload"
        ) from exc
    except ReportNotFoundError as exc:
        raise APIError(
            422, "VALIDATION_ERROR", "Service request type is unavailable"
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Service request could not be persisted"
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
            503, "DATABASE_UNAVAILABLE", "Service requests could not be loaded"
        ) from exc


@router.get("/{request_id}", response_model=ServiceRequestItem)
def detail(
    request_id: UUID,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestItem:
    try:
        return ServiceRequestService(session).detail(request_id, scope(caller))
    except ReportNotFoundError as exc:
        raise APIError(404, "NOT_FOUND", "Service request not found") from exc
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Service request could not be loaded"
        ) from exc


@router.patch("/{request_id}/status", response_model=ServiceRequestItem)
def update_status(
    request_id: UUID,
    payload: ServiceRequestStatusUpdate,
    caller: AdminCaller,
    session: Annotated[Session, Depends(get_db_session)],
) -> ServiceRequestItem:
    try:
        return ServiceRequestService(session).update(
            request_id, payload.status, payload.reason, caller.identifier, scope(caller)
        )
    except ReportNotFoundError as exc:
        raise APIError(404, "NOT_FOUND", "Service request not found") from exc
    except InvalidStatusTransitionError as exc:
        raise APIError(
            409,
            "INVALID_STATUS_TRANSITION",
            "Service request transition is not allowed",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            503, "DATABASE_UNAVAILABLE", "Service request could not be updated"
        ) from exc
