"""Village-owned WhatsApp pairing backed by the OpenClaw gateway."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole
from app.db.session import get_db_session
from app.db.tables import administrative_units, channel_integrations
from app.schemas.village import WhatsAppChannelInfo, WhatsAppPairingResponse
from app.services.openclaw_gateway import OpenClawGateway, OpenClawGatewayError
from app.services.openclaw_workspace import get_openclaw_workspace_service

router = APIRouter(prefix="/api/v1/villages", tags=["WhatsApp Setup"])
SessionDep = Annotated[Session, Depends(get_db_session)]


def _require_owner(caller: AdminCaller, village_id: UUID) -> None:
    if caller.role is not AdminRole.VILLAGE_ADMIN or village_id not in caller.unit_ids:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Village administrator membership required",
        )


def _village(session: Session, village_id: UUID) -> dict:
    row = session.execute(
        select(administrative_units).where(administrative_units.c.id == village_id)
    ).mappings().one_or_none()
    if row is None:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )
    return dict(row)


def _channel(session: Session, village_id: UUID):
    return session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).mappings().one_or_none()


def _gateway() -> OpenClawGateway:
    try:
        return OpenClawGateway()
    except OpenClawGatewayError as exc:
        raise APIError(
            status_code=503,
            code="OPENCLAW_UNAVAILABLE",
            message="WhatsApp gateway is unavailable",
        ) from exc


def _gateway_error() -> APIError:
    return APIError(
        status_code=503,
        code="OPENCLAW_UNAVAILABLE",
        message="WhatsApp gateway operation failed",
    )


@router.post(
    "/{village_id}/whatsapp/pairing",
    response_model=WhatsAppPairingResponse,
)
def start_pairing(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> WhatsAppPairingResponse:
    _require_owner(caller, village_id)
    village = _village(session, village_id)
    channel = _channel(session, village_id)
    account_id = (
        channel["external_account_id"] if channel else f"laporpak-{village_id.hex}"
    )
    gateway = _gateway()
    agent_id = f"laporpak-{village_id.hex[:12]}"
    try:
        # A stored channel means agent/account provisioning completed on an
        # earlier pairing attempt. Repeating five CLI calls added ~45 seconds
        # before OpenClaw could return a fresh QR.
        if channel is None:
            workspace_service = get_openclaw_workspace_service()
            workspace_service.create_workspace_from_village_config(village_id, village)
            gateway.ensure_village_agent(
                agent_id, workspace_service.get_workspace_path(village_id)
            )
            gateway.ensure_whatsapp_account(account_id, village["name"], agent_id)
        result = gateway.start_pairing(account_id)
    except OpenClawGatewayError as exc:
        raise _gateway_error() from exc

    connected = bool(result.get("connected"))
    now = datetime.now(UTC)
    try:
        if channel:
            session.execute(
                channel_integrations.update()
                .where(channel_integrations.c.id == channel["id"])
                .values(is_active=connected, updated_at=now)
            )
        else:
            session.execute(
                channel_integrations.insert().values(
                    id=uuid4(),
                    channel="whatsapp",
                    external_account_id=account_id,
                    administrative_unit_id=village_id,
                    is_active=connected,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise APIError(
            status_code=409,
            code="WHATSAPP_ACCOUNT_ALREADY_LINKED",
            message="WhatsApp account is already linked to another village",
        ) from exc

    qr_data_url = result.get("qrDataUrl")
    return WhatsAppPairingResponse(
        status="connected" if connected else "pairing",
        connected=connected,
        qr_data_url=qr_data_url,
        expires_at=now + timedelta(minutes=2) if qr_data_url else None,
        message=(
            "WhatsApp terhubung."
            if connected
            else "Pindai QR melalui WhatsApp sebelum kedaluwarsa."
        ),
    )


@router.get(
    "/{village_id}/whatsapp/status",
    response_model=WhatsAppChannelInfo,
)
def whatsapp_status(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> WhatsAppChannelInfo:
    _require_owner(caller, village_id)
    _village(session, village_id)
    channel = _channel(session, village_id)
    if channel is None:
        return WhatsAppChannelInfo(message="WhatsApp belum disiapkan.")
    try:
        snapshot = _gateway().status(channel["external_account_id"])
    except OpenClawGatewayError as exc:
        raise _gateway_error() from exc
    connected = bool(snapshot.get("connected") and snapshot.get("linked"))
    session.execute(
        channel_integrations.update()
        .where(channel_integrations.c.id == channel["id"])
        .values(is_active=connected, updated_at=datetime.now(UTC))
    )
    session.commit()
    identity = snapshot.get("self") or {}
    return WhatsAppChannelInfo(
        phone_number=identity.get("e164"),
        is_connected=connected,
        connected_at=channel["created_at"] if connected else None,
        last_message_at=None,
        status=(
            "connected"
            if connected
            else "error"
            if snapshot.get("lastError")
            else "disconnected"
        ),
        message=snapshot.get("lastError"),
    )


@router.delete("/{village_id}/whatsapp", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_whatsapp(
    village_id: UUID, caller: AdminCaller, session: SessionDep
) -> None:
    _require_owner(caller, village_id)
    _village(session, village_id)
    channel = _channel(session, village_id)
    if channel is None:
        return
    try:
        _gateway().logout(channel["external_account_id"])
    except OpenClawGatewayError as exc:
        raise _gateway_error() from exc
    session.execute(
        channel_integrations.update()
        .where(channel_integrations.c.id == channel["id"])
        .values(is_active=False, updated_at=datetime.now(UTC))
    )
    session.commit()
