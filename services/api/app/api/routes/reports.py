from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, Response, status

from app.core.errors import APIError
from app.core.security import OpenClawCaller
from app.schemas.enums import ReportSource
from app.schemas.reports import ReportCreate, ReportCreateResponse
from app.services.dependencies import ReportServiceDependency
from app.services.exceptions import (
    CategoryNotFoundError,
    DuplicateOperationError,
    InvalidSenderIdentityError,
    ReportPersistenceError,
)

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.post(
    "",
    response_model=ReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report(
    payload: ReportCreate,
    response: Response,
    _caller: OpenClawCaller,
    report_service: ReportServiceDependency,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> ReportCreateResponse:
    if payload.source is not ReportSource.WHATSAPP:
        raise APIError(
            status_code=400,
            code="INVALID_REQUEST",
            message="OpenClaw report source must be whatsapp",
        )

    try:
        result = report_service.create_idempotent_report(
            payload=payload,
            idempotency_key=idempotency_key,
        )
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc
    except CategoryNotFoundError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Report category is not available",
        ) from exc
    except DuplicateOperationError as exc:
        raise APIError(
            status_code=409,
            code="DUPLICATE_OPERATION",
            message="Idempotency key was already used for another payload",
        ) from exc
    except ReportPersistenceError as exc:
        raise APIError(
            status_code=503,
            code="DATABASE_UNAVAILABLE",
            message="Report could not be persisted",
        ) from exc

    if result.replayed:
        response.status_code = status.HTTP_200_OK

    return ReportCreateResponse.model_validate(result.report)
