from enum import StrEnum
from hmac import compare_digest
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, SecretStr

from app.core.config import settings
from app.core.errors import APIError


class CallerType(StrEnum):
    OPENCLAW = "openclaw"
    ADMIN = "admin"


class AuthenticatedCaller(BaseModel):
    model_config = ConfigDict(frozen=True)

    caller_type: CallerType
    identifier: str
    administrative_unit_id: UUID | None = None


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
) -> AuthenticatedCaller:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid bearer token required",
        )

    token = credentials.credentials
    is_openclaw = token_matches(token, settings.openclaw_api_key)
    is_admin = token_matches(token, settings.dashboard_api_key)

    # Reject ambiguous configuration as well as invalid credentials.
    if is_openclaw == is_admin:
        raise APIError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Valid bearer token required",
        )

    if is_openclaw:
        return AuthenticatedCaller(
            caller_type=CallerType.OPENCLAW,
            identifier="openclaw",
        )

    return AuthenticatedCaller(
        caller_type=CallerType.ADMIN,
        identifier=settings.dashboard_admin_identifier,
        administrative_unit_id=settings.dashboard_admin_unit_id,
    )


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
