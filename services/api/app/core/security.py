from enum import StrEnum
from hmac import compare_digest
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, SecretStr
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.db.session import get_db_session
from app.db.tables import admin_accounts, admin_unit_memberships, channel_integrations


class CallerType(StrEnum):
    OPENCLAW = "openclaw"
    ADMIN = "admin"


class AdminRole(StrEnum):
    SYSTEM_ADMIN = "system_admin"
    VILLAGE_ADMIN = "village_admin"


class AuthenticatedCaller(BaseModel):
    model_config = ConfigDict(frozen=True)

    caller_type: CallerType
    identifier: str
    administrative_unit_id: UUID | None = None
    admin_account_id: UUID | None = None
    role: AdminRole | None = None
    unit_ids: tuple[UUID, ...] = ()


bearer_scheme = HTTPBearer(auto_error=False)


def token_matches(candidate: str, configured: SecretStr | str | None) -> bool:
    if configured is None:
        return False

    expected = (
        configured.get_secret_value()
        if isinstance(configured, SecretStr)
        else configured
    )
    return bool(expected) and compare_digest(candidate, expected)


def authenticate_caller(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthenticatedCaller:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid bearer token required",
        )

    user_id = verify_supabase_access_token(credentials.credentials)
    try:
        account = (
            session.execute(
                select(admin_accounts).where(admin_accounts.c.auth_user_id == user_id)
            )
            .mappings()
            .one_or_none()
        )
    except SQLAlchemyError as exc:
        session.rollback()
        if not settings.allow_legacy_admin_fallback:
            raise APIError(
                status_code=503,
                code="DATABASE_UNAVAILABLE",
                message="Admin authorization is unavailable",
            ) from exc
        return AuthenticatedCaller(
            caller_type=CallerType.ADMIN,
            identifier=f"supabase:{user_id}",
            administrative_unit_id=settings.dashboard_admin_unit_id,
            role=AdminRole.VILLAGE_ADMIN,
            unit_ids=(settings.dashboard_admin_unit_id,)
            if settings.dashboard_admin_unit_id
            else (),
        )
    if account is None or not account["is_active"]:
        raise APIError(
            status_code=403, code="FORBIDDEN", message="Active admin account required"
        )
    units = tuple(
        session.execute(
            select(admin_unit_memberships.c.administrative_unit_id).where(
                admin_unit_memberships.c.admin_account_id == account["id"]
            )
        )
        .scalars()
        .all()
    )
    role = AdminRole(account["role"])
    if role is AdminRole.VILLAGE_ADMIN and not units:
        raise APIError(
            status_code=403, code="FORBIDDEN", message="Admin has no village access"
        )
    return AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier=f"supabase:{user_id}",
        admin_account_id=account["id"],
        role=role,
        unit_ids=units,
    )


def verify_supabase_access_token(access_token: str) -> UUID:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise APIError(
            status_code=503,
            code="INTERNAL_ERROR",
            message="Admin authentication is not configured",
        )

    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=5,
        )
    except httpx.HTTPError as exc:
        raise APIError(
            status_code=503,
            code="INTERNAL_ERROR",
            message="Admin authentication is temporarily unavailable",
        ) from exc

    if response.status_code in {401, 403}:
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid Supabase access token required",
        )
    if response.is_error:
        raise APIError(
            status_code=503,
            code="INTERNAL_ERROR",
            message="Admin authentication is temporarily unavailable",
        )

    try:
        return UUID(response.json()["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid Supabase access token required",
        ) from exc


AuthenticatedCallerDependency = Annotated[
    AuthenticatedCaller,
    Depends(authenticate_caller),
]


def require_openclaw(
    api_key: Annotated[str | None, Header(alias="X-OpenClaw-API-Key")] = None,
) -> AuthenticatedCaller:
    if api_key is None or not token_matches(api_key, settings.openclaw_api_key):
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid OpenClaw API key required",
        )
    return AuthenticatedCaller(
        caller_type=CallerType.OPENCLAW,
        identifier="openclaw",
    )


def require_admin(
    caller: AuthenticatedCallerDependency,
) -> AuthenticatedCaller:
    if caller.caller_type is not CallerType.ADMIN:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Admin caller required",
        )
    return caller


OpenClawCaller = Annotated[AuthenticatedCaller, Depends(require_openclaw)]
AdminCaller = Annotated[AuthenticatedCaller, Depends(require_admin)]


def resolve_channel_unit(session: Session, external_account_id: str) -> UUID:
    row = session.execute(
        select(channel_integrations.c.administrative_unit_id).where(
            channel_integrations.c.channel == "whatsapp",
            channel_integrations.c.external_account_id == external_account_id,
            channel_integrations.c.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if row is None:
        raise APIError(
            status_code=403, code="FORBIDDEN", message="Channel is not authorized"
        )
    return row
