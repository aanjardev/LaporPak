from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, status

from app.core.errors import APIError
from app.core.security import AdminCaller, operator_scope, require_village_operator
from app.schemas.referrals import (
    ReferralApproval,
    ReferralCancel,
    ReferralCreate,
    ReferralDispatch,
    ReferralDispatchResponse,
    ReferralProgress,
    ReferralTask,
    ReferralTaskUpdate,
    RoutingOptionsResponse,
)
from app.services.dependencies import ReferralServiceDependency
from app.services.referrals import (
    ReferralConflictError,
    ReferralNotFoundError,
    ReferralUnavailableError,
    process_next_referral_job,
)

router = APIRouter(prefix="/api/v1", tags=["referrals"])


def _scope(caller: AdminCaller):
    require_village_operator(caller)
    return operator_scope(caller)


def _raise_api_error(exc: Exception) -> None:
    if isinstance(exc, ReferralNotFoundError):
        raise APIError(
            status_code=404,
            code="REFERRAL_NOT_FOUND",
            message="Report or referral not found",
        ) from exc
    if isinstance(exc, ReferralConflictError):
        raise APIError(
            status_code=409,
            code="REFERRAL_CONFLICT",
            message=str(exc),
        ) from exc
    raise APIError(
        status_code=503,
        code="REFERRAL_UNAVAILABLE",
        message="Referral service is temporarily unavailable",
    ) from exc


@router.get(
    "/reports/{report_id}/routing-options", response_model=RoutingOptionsResponse
)
def get_routing_options(
    report_id: UUID,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> RoutingOptionsResponse:
    try:
        return service.routing_options(report_id, _scope(caller))
    except (ReferralNotFoundError, ReferralUnavailableError) as exc:
        _raise_api_error(exc)


@router.post(
    "/reports/{report_id}/referrals",
    response_model=ReferralProgress,
    status_code=status.HTTP_201_CREATED,
)
def create_referral(
    report_id: UUID,
    payload: ReferralCreate,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralProgress:
    try:
        return service.create_draft(
            report_id, payload, caller.identifier, _scope(caller)
        )
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)


@router.get("/reports/{report_id}/referrals", response_model=list[ReferralProgress])
def list_referrals(
    report_id: UUID,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> list[ReferralProgress]:
    try:
        return service.list_for_report(report_id, _scope(caller))
    except (ReferralNotFoundError, ReferralUnavailableError) as exc:
        _raise_api_error(exc)


@router.get("/reports/{report_id}/tasks", response_model=list[ReferralTask])
def list_referral_tasks(
    report_id: UUID,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> list[ReferralTask]:
    try:
        return service.list_tasks(report_id, _scope(caller), caller.identifier)
    except (ReferralNotFoundError, ReferralUnavailableError) as exc:
        _raise_api_error(exc)


@router.patch("/referral-tasks/{task_id}", response_model=ReferralTask)
def update_referral_task(
    task_id: UUID,
    payload: ReferralTaskUpdate,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralTask:
    try:
        return service.update_task(
            task_id, payload, caller.identifier, _scope(caller)
        )
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)


@router.post("/referrals/{referral_id}/approve", response_model=ReferralProgress)
def approve_referral(
    referral_id: UUID,
    payload: ReferralApproval,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralProgress:
    try:
        return service.approve(referral_id, payload, caller.identifier, _scope(caller))
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)


@router.post(
    "/referrals/{referral_id}/dispatch",
    response_model=ReferralDispatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def dispatch_referral(
    referral_id: UUID,
    payload: ReferralDispatch,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralDispatchResponse:
    try:
        result = service.dispatch(
            referral_id, payload.operation_key, caller.identifier, _scope(caller)
        )
        background_tasks.add_task(process_next_referral_job)
        return result
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)


@router.post("/referrals/{referral_id}/reconcile", response_model=ReferralProgress)
def reconcile_referral(
    referral_id: UUID,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralProgress:
    try:
        result = service.reconcile(referral_id, caller.identifier, _scope(caller))
        background_tasks.add_task(process_next_referral_job)
        return result
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)


@router.post("/referrals/{referral_id}/cancel", response_model=ReferralProgress)
def cancel_referral(
    referral_id: UUID,
    payload: ReferralCancel,
    caller: AdminCaller,
    service: ReferralServiceDependency,
) -> ReferralProgress:
    try:
        return service.cancel(referral_id, payload, caller.identifier, _scope(caller))
    except (
        ReferralNotFoundError,
        ReferralConflictError,
        ReferralUnavailableError,
    ) as exc:
        _raise_api_error(exc)
