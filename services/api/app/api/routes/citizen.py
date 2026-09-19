from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import OpenClawCaller, resolve_channel_unit
from app.db.session import get_db_session
from app.schemas.citizen import AskRequest, AskResponse, TrackRequest, TrackResponse
from app.services.citizen import CitizenService
from app.services.exceptions import (
    InvalidSenderIdentityError,
    ReportNotFoundError,
    ReportPersistenceError,
)

router = APIRouter(prefix="/api/v1", tags=["Citizen"])


@router.post("/track", response_model=TrackResponse)
def track(
    payload: TrackRequest,
    _caller: OpenClawCaller,
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
) -> TrackResponse:
    try:
        return CitizenService(session).track(
            payload.sender_phone_number,
            payload.ticket_number,
            resolve_channel_unit(session, channel_account_id),
        )
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc
    except ReportNotFoundError as exc:
        raise APIError(
            status_code=404, code="TICKET_NOT_FOUND", message="Ticket not found"
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Tracking is unavailable",
        ) from exc


@router.post("/ask", response_model=AskResponse)
def ask(
    payload: AskRequest,
    _caller: OpenClawCaller,
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
) -> AskResponse:
    try:
        return CitizenService(session).ask(
            payload, resolve_channel_unit(session, channel_account_id)
        )
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Knowledge search is unavailable",
        ) from exc
