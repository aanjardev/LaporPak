import secrets
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Response

from app.core.config import settings
from app.core.errors import APIError
from app.schemas.reports import CreateReportRequest, CreateReportResponse
from app.services.reports import create_report

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


def require_openclaw_api_key(value: str | None) -> None:
    if not settings.openclaw_api_key:
        raise APIError(503, "INTERNAL_ERROR", "OpenClaw authentication is not configured")
    if value is None or not secrets.compare_digest(value, settings.openclaw_api_key):
        raise APIError(401, "UNAUTHORIZED", "Invalid OpenClaw API key")


@router.post("", response_model=CreateReportResponse, status_code=201)
def create_report_endpoint(
    payload: CreateReportRequest,
    response: Response,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
    openclaw_api_key: Annotated[
        str | None,
        Header(alias="X-OpenClaw-API-Key"),
    ] = None,
):
    require_openclaw_api_key(openclaw_api_key)
    report, replayed = create_report(payload, idempotency_key)
    response.status_code = 200 if replayed else 201
    return report
