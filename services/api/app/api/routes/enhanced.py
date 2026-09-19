from typing import Annotated

from fastapi import APIRouter, Depends, Header, Path
from sqlalchemy.orm import Session

from app.core.security import OpenClawCaller, resolve_channel_unit
from app.db.session import get_db_session
from app.schemas.citizen import (
    EmergencyDetectionRequest,
    ResolutionConfirmationRequest,
    SimilarReportsRequest,
)
from app.services.enhanced import (
    confirm_resolution,
    detect_emergency,
    find_similar_reports,
)

router = APIRouter(prefix="/api/v1", tags=["Citizen"])


@router.post("/detect-emergency")
def detect_emergency_endpoint(
    payload: EmergencyDetectionRequest,
    _caller: OpenClawCaller,
):
    return detect_emergency(payload.text)


@router.post("/check-similar")
def check_similar_reports_endpoint(
    payload: SimilarReportsRequest,
    _caller: OpenClawCaller,
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
):
    return find_similar_reports(
        session=session,
        unit_id=resolve_channel_unit(session, channel_account_id),
        category=payload.category,
        location_text=payload.location_text,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )


@router.post("/confirm-resolution/{ticket_number}")
def confirm_resolution_endpoint(
    ticket_number: Annotated[str, Path(pattern=r"^LP-\d{4}-\d{4,}$")],
    payload: ResolutionConfirmationRequest,
    _caller: OpenClawCaller,
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
    session: Annotated[Session, Depends(get_db_session)],
):
    unit_id = resolve_channel_unit(session, channel_account_id)
    return confirm_resolution(
        session=session,
        unit_id=unit_id,
        ticket_number=ticket_number,
        sender_phone_number=payload.sender_phone_number,
        confirmed=payload.confirmed,
        feedback=payload.feedback,
    )
