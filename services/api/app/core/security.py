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
from app.db.tables import (
    admin_accounts,
    admin_unit_memberships,
    administrative_units,
    channel_integrations,
)


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
    operational_unit_ids: tuple[UUID, ...] | None = None


class SupabaseIdentity(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    email: str
    email_verified: bool


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
        if account is None and settings.allow_legacy_admin_fallback:
            return AuthenticatedCaller(
                caller_type=CallerType.ADMIN,
                identifier=f"supabase:{user_id}",
                administrative_unit_id=settings.dashboard_admin_unit_id,
                role=AdminRole.VILLAGE_ADMIN,
                unit_ids=(settings.dashboard_admin_unit_id,)
                if settings.dashboard_admin_unit_id
                else (),
                operational_unit_ids=(settings.dashboard_admin_unit_id,)
                if settings.dashboard_admin_unit_id
                else (),
            )
        if account is None or not account["is_active"]:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="Active admin account required",
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
        operational_units = tuple(
            session.execute(
                select(admin_unit_memberships.c.administrative_unit_id)
                .join(
                    administrative_units,
                    administrative_units.c.id
                    == admin_unit_memberships.c.administrative_unit_id,
                )
                .where(
                    admin_unit_memberships.c.admin_account_id == account["id"],
                    administrative_units.c.is_active.is_(True),
                    administrative_units.c.activation_status == "approved",
                )
            )
            .scalars()
            .all()
        )
        role = AdminRole(account["role"])
        if role is AdminRole.VILLAGE_ADMIN and not units:
            raise APIError(
                status_code=403,
                code="FORBIDDEN",
                message="Admin has no village access",
            )
        return AuthenticatedCaller(
            caller_type=CallerType.ADMIN,
            identifier=f"supabase:{user_id}",
            admin_account_id=account["id"],
            role=role,
            unit_ids=units,
            operational_unit_ids=operational_units,
        )
    except SQLAlchemyError as exc:
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
            operational_unit_ids=(settings.dashboard_admin_unit_id,)
            if settings.dashboard_admin_unit_id
            else (),
        )
    finally:
        # Authentication reads use the request-scoped session and therefore
        # autobegin a transaction. End it before a downstream write service
        # opens its own explicit atomic transaction on the same session.
        session.rollback()


def verify_supabase_identity(access_token: str) -> SupabaseIdentity:
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
        payload = response.json()
        return SupabaseIdentity(
            id=UUID(payload["id"]),
            email=str(payload["email"]),
            email_verified=bool(payload.get("email_confirmed_at")),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid Supabase access token required",
        ) from exc


def verify_supabase_access_token(access_token: str) -> UUID:
    return verify_supabase_identity(access_token).id


def authenticate_identity(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> SupabaseIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid bearer token required",
        )
    return verify_supabase_identity(credentials.credentials)


AuthenticatedCallerDependency = Annotated[
    AuthenticatedCaller,
    Depends(authenticate_caller),
]
SupabaseIdentityDependency = Annotated[
    SupabaseIdentity,
    Depends(authenticate_identity),
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


def require_village_operator(
    caller: AuthenticatedCallerDependency,
) -> AuthenticatedCaller:
    operational = (
        caller.unit_ids
        if caller.operational_unit_ids is None
        else caller.operational_unit_ids
    )
    if caller.role is not AdminRole.VILLAGE_ADMIN or not operational:
        raise APIError(
            status_code=403,
            code="FORBIDDEN",
            message="Active village administrator role required",
        )
    return caller


OpenClawCaller = Annotated[AuthenticatedCaller, Depends(require_openclaw)]
AdminCaller = Annotated[AuthenticatedCaller, Depends(require_admin)]
VillageOperator = Annotated[AuthenticatedCaller, Depends(require_village_operator)]


def operator_scope(caller: AuthenticatedCaller) -> tuple[UUID, ...]:
    return (
        caller.unit_ids
        if caller.operational_unit_ids is None
        else caller.operational_unit_ids
    )


def resolve_channel_unit(session: Session, external_account_id: str) -> UUID:
    try:
        row = session.execute(
            select(
                channel_integrations.c.administrative_unit_id,
                administrative_units.c.metadata,
            )
            .join(
                administrative_units,
                administrative_units.c.id
                == channel_integrations.c.administrative_unit_id,
            )
            .where(
                channel_integrations.c.channel == "whatsapp",
                channel_integrations.c.external_account_id == external_account_id,
                channel_integrations.c.is_active.is_(True),
                administrative_units.c.is_active.is_(True),
                administrative_units.c.activation_status == "approved",
            )
        ).one_or_none()
    except SQLAlchemyError as exc:
        session.rollback()
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Channel authorization is unavailable",
        ) from exc

    # End the implicit read transaction before a write service starts its
    # explicit atomic transaction on the same request-scoped session.
    session.rollback()
    if row is None:
        raise APIError(
            status_code=403, code="FORBIDDEN", message="Channel is not authorized"
        )
    unit_id, metadata = row
    if (metadata or {}).get("is_ai_enabled") is False:
        raise APIError(
            status_code=503,
            code="AI_DISABLED",
            message="Layanan otomatis sedang nonaktif. Silakan hubungi petugas desa.",
        )
    return unit_id
