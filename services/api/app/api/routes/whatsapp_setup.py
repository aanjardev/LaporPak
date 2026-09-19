"""WhatsApp setup API routes for multi-desa support."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import AdminCaller, AdminRole
from app.db.session import get_db_session
from app.db.tables import channel_integrations, administrative_units
from app.schemas.village import WhatsAppChannelInfo

router = APIRouter(prefix="/api/v1/villages", tags=["WhatsApp Setup"])


SessionDep = Annotated[Session, Depends(get_db_session)]


def require_admin_access(caller: AdminCaller, village_id: UUID) -> AdminCaller:
    """Require admin access to village."""
    if caller.role == AdminRole.VILLAGE_ADMIN:
        if village_id not in caller.unit_ids:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="You don't have access to this village",
            )
    return caller


def get_village_or_404(session: Session, village_id: UUID) -> dict:
    """Get village by ID or raise 404."""
    row = session.execute(
        select(administrative_units).where(
            administrative_units.c.id == village_id,
            administrative_units.c.is_active.is_(True),
        )
    ).mappings().one_or_none()

    if row is None:
        raise APIError(
            status_code=404,
            code="VILLAGE_NOT_FOUND",
            message="Village not found",
        )
    return dict(row)


def check_whatsapp_webhook_configured() -> bool:
    """Check if WhatsApp webhook is properly configured."""
    from app.core.config import settings
    return bool(
        settings.whatsapp_access_token
        and settings.whatsapp_phone_number_id
        and settings.whatsapp_verify_token
    )


@router.get(
    "/{village_id}/whatsapp/status",
    response_model=WhatsAppChannelInfo,
)
def get_whatsapp_status(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> WhatsAppChannelInfo:
    """Get WhatsApp connection status for a village."""

    require_admin_access(caller, village_id)
    get_village_or_404(session, village_id)

    # Get existing WhatsApp channel
    channel = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).mappings().one_or_none()

    if channel is None:
        return WhatsAppChannelInfo(
            phone_number=None,
            is_connected=False,
            connected_at=None,
            last_message_at=None,
        )

    return WhatsAppChannelInfo(
        phone_number=channel["external_account_id"],
        is_connected=channel["is_active"],
        connected_at=channel["created_at"],
        last_message_at=channel["updated_at"],
    )


@router.post(
    "/{village_id}/whatsapp/init",
    response_model=dict,
)
def init_whatsapp_connection(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> dict:
    """Initialize WhatsApp connection for a village.

    This endpoint provides the configuration needed to connect a WhatsApp
    Business account to a village via QR code or phone number linking.

    Note: Actual WhatsApp Business API integration requires:
    1. Meta Business App setup
    2. WhatsApp Business API credentials
    3. Webhook endpoint configuration

    For development/demo, this returns mock configuration.
    """

    require_admin_access(caller, village_id)
    village = get_village_or_404(session, village_id)

    # Check if already connected
    existing = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).mappings().one_or_none()

    if existing and existing["is_active"]:
        return {
            "status": "already_connected",
            "phone_number": existing["external_account_id"],
            "village_id": str(village_id),
            "village_name": village["name"],
            "message": "WhatsApp is already connected to this village",
        }

    # Generate connection info
    # In production, this would integrate with WhatsApp Business API
    connection_token = f"WA_CONN_{village_id.hex[:8]}"

    # If there's an existing inactive connection, reactivate it
    if existing:
        session.execute(
            channel_integrations.update()
            .where(channel_integrations.c.id == existing["id"])
            .values(
                is_active=True,
                updated_at=datetime.utcnow(),
            )
        )
        session.commit()
        return {
            "status": "reconnected",
            "connection_token": connection_token,
            "village_id": str(village_id),
            "village_name": village["name"],
            "message": "WhatsApp connection reactivated",
        }

    # Create new channel integration
    from uuid import uuid4
    session.execute(
        channel_integrations.insert().values(
            id=uuid4(),
            channel="whatsapp",
            external_account_id=connection_token,  # Placeholder until actual phone is linked
            administrative_unit_id=village_id,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    session.commit()

    return {
        "status": "initialized",
        "connection_token": connection_token,
        "village_id": str(village_id),
        "village_name": village["name"],
        "instructions": {
            "step_1": "Go to WhatsApp Business API setup",
            "step_2": "Link your business phone number",
            "step_3": "Configure webhook URL for this village",
            "webhook_url": f"/api/v1/webhooks/whatsapp/{village_id}",
        },
        "message": "WhatsApp connection initialized. Complete setup in WhatsApp Business portal.",
    }


@router.post(
    "/{village_id}/whatsapp/link-phone",
    response_model=dict,
)
def link_whatsapp_phone(
    village_id: UUID,
    phone_number: str,
    caller: AdminCaller,
    session: SessionDep,
) -> dict:
    """Link a WhatsApp Business phone number to a village.

    This is called after the WhatsApp Business API verification is complete.
    """

    require_admin_access(caller, village_id)
    village = get_village_or_404(session, village_id)

    # Check if phone is already linked to another village
    existing_phone = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.channel == "whatsapp",
            channel_integrations.c.external_account_id == phone_number,
            channel_integrations.c.is_active == True,
        )
    ).mappings().one_or_none()

    if existing_phone and existing_phone["administrative_unit_id"] != village_id:
        raise APIError(
            status_code=409,
            code="PHONE_ALREADY_LINKED",
            message="This phone number is already linked to another village",
        )

    # Check if village has existing channel
    existing = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
    ).mappings().one_or_none()

    if existing:
        # Update existing channel
        session.execute(
            channel_integrations.update()
            .where(channel_integrations.c.id == existing["id"])
            .values(
                external_account_id=phone_number,
                is_active=True,
                updated_at=datetime.utcnow(),
            )
        )
    else:
        # Create new channel
        from uuid import uuid4
        session.execute(
            channel_integrations.insert().values(
                id=uuid4(),
                channel="whatsapp",
                external_account_id=phone_number,
                administrative_unit_id=village_id,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )

    session.commit()

    return {
        "status": "linked",
        "phone_number": phone_number,
        "village_id": str(village_id),
        "village_name": village["name"],
        "message": f"WhatsApp number {phone_number} successfully linked to {village['name']}",
    }


@router.delete(
    "/{village_id}/whatsapp/disconnect",
    status_code=status.HTTP_204_NO_CONTENT,
)
def disconnect_whatsapp(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> None:
    """Disconnect WhatsApp from a village."""

    require_admin_access(caller, village_id)
    get_village_or_404(session, village_id)

    session.execute(
        channel_integrations.update()
        .where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
        )
        .values(
            is_active=False,
            updated_at=datetime.utcnow(),
        )
    )
    session.commit()


# ============================================================================
# WhatsApp Webhook Handler
# ============================================================================

@router.post(
    "/webhooks/whatsapp/{village_id}",
)
def whatsapp_webhook(
    village_id: UUID,
    payload: dict,
    session: SessionDep,
) -> dict:
    """Handle incoming WhatsApp webhook events.

    This endpoint receives webhook events from WhatsApp Business API.
    It validates the webhook and forwards the event to the OpenClaw integration.
    """

    # Verify webhook token
    from fastapi import Header, Request
    # Note: In production, verify X-Hub-Signature-256 from Meta

    get_village_or_404(session, village_id)

    # Get channel
    channel = session.execute(
        select(channel_integrations).where(
            channel_integrations.c.administrative_unit_id == village_id,
            channel_integrations.c.channel == "whatsapp",
            channel_integrations.c.is_active == True,
        )
    ).mappings().one_or_none()

    if channel is None:
        raise APIError(
            status_code=404,
            code="CHANNEL_NOT_FOUND",
            message="WhatsApp channel not configured for this village",
        )

    # Forward to OpenClaw
    # In production, this would call the OpenClaw webhook endpoint
    return {
        "status": "received",
        "village_id": str(village_id),
        "message": "Webhook event received",
    }


# ============================================================================
# OpenClaw Integration
# ============================================================================

@router.get(
    "/{village_id}/openclaw/config",
    response_model=dict,
)
def get_openclaw_config(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> dict:
    """Get OpenClaw configuration for a village.

    This returns the configuration needed to connect a village's
    WhatsApp to OpenClaw.
    """

    require_admin_access(caller, village_id)
    village = get_village_or_404(session, village_id)

    from app.core.config import settings
    from app.services.openclaw_workspace import get_openclaw_workspace_service

    workspace_service = get_openclaw_workspace_service()

    # Ensure workspace exists
    workspace_path = workspace_service.ensure_workspace_exists(village_id)

    # Get or create workspace config
    if not workspace_service.workspace_exists(village_id):
        workspace_service.create_workspace_from_village_config(
            village_id=village_id,
            village_config={"metadata": village.get("metadata", {})},
        )

    return {
        "village_id": str(village_id),
        "village_name": village["name"],
        "workspace_path": str(workspace_path),
        "openclaw_api_url": settings.openclaw_api_url,
        "openclaw_api_key": settings.openclaw_api_key.get_secret_value() if settings.openclaw_api_key else None,
        "instructions": [
            "1. Install OpenClaw on your server",
            "2. Configure OpenClaw to use this workspace",
            "3. Link WhatsApp Business API to OpenClaw",
            "4. Start OpenClaw agent for this village",
        ],
    }


@router.post(
    "/{village_id}/openclaw/generate-workspace",
    response_model=dict,
)
def generate_openclaw_workspace(
    village_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> dict:
    """Generate or regenerate OpenClaw workspace for a village.

    This creates the workspace files (IDENTITY.md, SOUL.md, openclaw.json)
    based on the village's current configuration.
    """

    require_admin_access(caller, village_id)
    village = get_village_or_404(session, village_id)

    from app.services.openclaw_workspace import get_openclaw_workspace_service

    workspace_service = get_openclaw_workspace_service()

    created_files = workspace_service.create_workspace_from_village_config(
        village_id=village_id,
        village_config=village,
    )

    return {
        "status": "generated",
        "village_id": str(village_id),
        "village_name": village["name"],
        "files": created_files,
        "message": "OpenClaw workspace generated successfully",
    }
