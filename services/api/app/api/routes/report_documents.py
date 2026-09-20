"""Role-scoped REPORT documents and public QR verification."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import (
    AdminCaller,
    OpenClawCaller,
    operator_scope,
    require_village_operator,
    resolve_channel_unit,
)
from app.db.session import get_db_session
from app.schemas.report_documents import (
    CitizenDocumentDeliveryRequest,
    ReportDocument,
    ReportDocumentList,
    ReportDocumentReason,
    ReportDocumentRevision,
    ReportDocumentVerification,
)
from app.services.exceptions import (
    DocumentDeliveryUnknownError,
    InvalidSenderIdentityError,
    ReportNotFoundError,
)
from app.services.report_documents import (
    ReportDocumentService,
    process_pending_document_jobs,
)

router = APIRouter(prefix="/api/v1", tags=["Report Documents"])
SessionDep = Annotated[Session, Depends(get_db_session)]


def _not_found(exc: ReportNotFoundError) -> APIError:
    return APIError(
        status_code=404,
        code="REPORT_DOCUMENT_NOT_FOUND",
        message="Report document not found",
    )


@router.get("/reports/{report_id}/documents", response_model=ReportDocumentList)
def list_report_documents(
    report_id: UUID, caller: AdminCaller, session: SessionDep
) -> ReportDocumentList:
    require_village_operator(caller)
    try:
        return ReportDocumentService(session).list_for_report(
            report_id, operator_scope(caller)
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc


@router.post("/reports/{report_id}/documents/receipt", response_model=ReportDocument)
def ensure_report_receipt(
    report_id: UUID,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    session: SessionDep,
) -> ReportDocument:
    require_village_operator(caller)
    try:
        result = ReportDocumentService(session).ensure_receipt(
            report_id, operator_scope(caller), caller.identifier
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc
    background_tasks.add_task(process_pending_document_jobs)
    return result


@router.get("/reports/{report_id}/documents/{document_id}/download")
def download_report_document(
    report_id: UUID,
    document_id: UUID,
    caller: AdminCaller,
    session: SessionDep,
) -> Response:
    require_village_operator(caller)
    try:
        content, mime_type = ReportDocumentService(session).get_download(
            report_id, document_id, operator_scope(caller)
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": "attachment; filename=laporan.pdf"},
    )


@router.post(
    "/reports/{report_id}/documents/{document_id}/retry",
    response_model=ReportDocument,
)
def retry_report_document(
    report_id: UUID,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    session: SessionDep,
) -> ReportDocument:
    require_village_operator(caller)
    try:
        result = ReportDocumentService(session).retry(
            report_id, document_id, operator_scope(caller), caller.identifier
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc
    background_tasks.add_task(process_pending_document_jobs)
    return result


@router.post(
    "/reports/{report_id}/documents/revisions",
    response_model=ReportDocument,
    status_code=status.HTTP_201_CREATED,
)
def revise_report_document(
    report_id: UUID,
    payload: ReportDocumentRevision,
    background_tasks: BackgroundTasks,
    caller: AdminCaller,
    session: SessionDep,
) -> ReportDocument:
    require_village_operator(caller)
    try:
        result = ReportDocumentService(session).revise(
            report_id,
            payload.document_type,
            payload.reason,
            operator_scope(caller),
            caller.identifier,
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc
    background_tasks.add_task(process_pending_document_jobs)
    return result


@router.post(
    "/reports/{report_id}/documents/{document_id}/revoke",
    response_model=ReportDocument,
)
def revoke_report_document(
    report_id: UUID,
    document_id: UUID,
    payload: ReportDocumentReason,
    caller: AdminCaller,
    session: SessionDep,
) -> ReportDocument:
    require_village_operator(caller)
    try:
        return ReportDocumentService(session).revoke(
            report_id,
            document_id,
            payload.reason,
            operator_scope(caller),
            caller.identifier,
        )
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc


@router.get(
    "/verify/{token}",
    response_model=ReportDocumentVerification,
)
def verify_report_document(
    token: UUID, session: SessionDep
) -> ReportDocumentVerification:
    result = ReportDocumentService.verify(session, token)
    if result is None:
        raise APIError(
            status_code=404,
            code="DOCUMENT_VERIFICATION_NOT_FOUND",
            message="Document verification was not found",
        )
    return result


@router.post("/report-documents/delivery-requests", response_model=ReportDocument)
def request_citizen_document_delivery(
    payload: CitizenDocumentDeliveryRequest,
    background_tasks: BackgroundTasks,
    _caller: OpenClawCaller,
    session: SessionDep,
    channel_account_id: Annotated[str, Header(alias="X-Channel-Account-ID")],
) -> ReportDocument:
    try:
        result = ReportDocumentService(session).request_citizen_delivery(
            ticket_number=payload.ticket_number,
            document_type=payload.document_type,
            sender_phone_number=payload.sender_phone_number,
            unit_id=resolve_channel_unit(session, channel_account_id),
        )
    except InvalidSenderIdentityError as exc:
        raise APIError(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Sender phone number is invalid",
        ) from exc
    except ReportNotFoundError as exc:
        raise _not_found(exc) from exc
    except DocumentDeliveryUnknownError as exc:
        raise APIError(
            status_code=409,
            code="DELIVERY_REVIEW_REQUIRED",
            message="Document delivery must be reviewed by a village administrator",
        ) from exc
    background_tasks.add_task(process_pending_document_jobs)
    return result
