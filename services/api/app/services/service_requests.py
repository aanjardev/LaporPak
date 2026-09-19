import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.service_request_repositories import ServiceRequestRepository
from app.schemas.service_requests import (
    ServiceRequestCreate,
    ServiceRequestCreated,
    ServiceRequestDetail,
    ServiceRequestHistory,
    ServiceRequestList,
    ServiceRequestStatus,
    ServiceRequestStatusUpdateResponse,
    ServiceRequestSummary,
)
from app.services.exceptions import (
    DuplicateOperationError,
    InvalidSenderIdentityError,
    InvalidStatusTransitionError,
    ReportNotFoundError,
    ReportPersistenceError,
)
from app.services.reports import advisory_lock_key, normalize_phone_number

TRANSITIONS = {
    ServiceRequestStatus.PENDING_REVIEW: (
        ServiceRequestStatus.APPROVED,
        ServiceRequestStatus.REJECTED,
    ),
    ServiceRequestStatus.APPROVED: (ServiceRequestStatus.COMPLETED,),
    ServiceRequestStatus.REJECTED: (),
    ServiceRequestStatus.COMPLETED: (),
}


@dataclass(frozen=True)
class RequestResult:
    item: ServiceRequestCreated
    replayed: bool


class ServiceRequestService:
    def __init__(
        self, session: Session, repository: ServiceRequestRepository | None = None
    ) -> None:
        self.session = session
        self.repository = repository or ServiceRequestRepository(session)

    @staticmethod
    def created(row) -> ServiceRequestCreated:
        return ServiceRequestCreated.model_validate(
            {field: row[field] for field in ServiceRequestCreated.model_fields}
        )

    @staticmethod
    def summary(row) -> ServiceRequestSummary:
        return ServiceRequestSummary.model_validate(
            {field: row[field] for field in ServiceRequestSummary.model_fields}
        )

    def create(
        self, payload: ServiceRequestCreate, key: UUID, unit_id: UUID
    ) -> RequestResult:
        phone = normalize_phone_number(payload.sender_phone_number)
        digest = hashlib.sha256(
            json.dumps(
                payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        try:
            with self.session.begin():
                self.repository.acquire_lock(advisory_lock_key(key))
                existing = self.repository.by_key(key)
                if existing:
                    if existing["idempotency_payload_hash"] != digest:
                        raise DuplicateOperationError
                    row = self.repository.detail(existing["id"], None)
                    return RequestResult(self.created(row), True)
                citizen = self.repository.citizen(phone)
                request_type = self.repository.request_type(payload.request_type)
                if request_type is None:
                    raise ReportNotFoundError(payload.request_type)
                row = self.repository.insert_request(
                    {
                        **payload.model_dump(
                            exclude={"sender_phone_number", "request_type"}
                        ),
                        "request_type_id": request_type["id"],
                        "citizen_id": citizen["id"],
                        "administrative_unit_id": unit_id,
                        "idempotency_key": key,
                        "idempotency_payload_hash": digest,
                    }
                )
                self.repository.history(
                    {
                        "service_request_id": row["id"],
                        "old_status": None,
                        "new_status": "pending_review",
                        "actor_type": "system",
                        "notes": "Request created",
                    }
                )
                detail = dict(row)
                detail["request_type"] = payload.request_type
                return RequestResult(self.created(detail), False)
        except DuplicateOperationError, ReportNotFoundError, InvalidSenderIdentityError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("service request creation") from exc

    def list(
        self, page: int, page_size: int, unit_ids: tuple[UUID, ...] | None
    ) -> ServiceRequestList:
        try:
            rows, total = self.repository.list(
                (page - 1) * page_size, page_size, unit_ids
            )
            return ServiceRequestList(
                items=[self.summary(row) for row in rows],
                page=page,
                page_size=page_size,
                total=total,
            )
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("service request list") from exc

    def detail(
        self,
        request_id: UUID,
        unit_ids: tuple[UUID, ...] | None,
        *,
        can_transition: bool,
    ) -> ServiceRequestDetail:
        try:
            row = self.repository.detail(request_id, unit_ids)
            if row is None:
                raise ReportNotFoundError(request_id)
            status = ServiceRequestStatus(row["status"])
            history = self.repository.list_history(request_id)
            return ServiceRequestDetail(
                **self.created(row).model_dump(),
                allowed_transitions=list(TRANSITIONS[status])
                if can_transition
                else [],
                status_history=[
                    ServiceRequestHistory.model_validate(item) for item in history
                ],
            )
        except ReportNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("service request detail") from exc

    def update(
        self,
        request_id: UUID,
        status: ServiceRequestStatus,
        reason: str,
        actor: str,
        unit_ids: tuple[UUID, ...] | None,
    ) -> ServiceRequestStatusUpdateResponse:
        try:
            with self.session.begin():
                current = self.repository.detail(request_id, unit_ids, lock=True)
                if current is None:
                    raise ReportNotFoundError(request_id)
                old = ServiceRequestStatus(current["status"])
                if status not in TRANSITIONS[old]:
                    raise InvalidStatusTransitionError(old.value, status.value)
                updated = self.repository.update(request_id, status.value)
                self.repository.history(
                    {
                        "service_request_id": request_id,
                        "old_status": old.value,
                        "new_status": status.value,
                        "actor_type": "admin",
                        "actor_identifier": actor,
                        "notes": reason,
                    }
                )
                return ServiceRequestStatusUpdateResponse.model_validate(
                    {
                        field: updated[field]
                        for field in ServiceRequestStatusUpdateResponse.model_fields
                    }
                )
        except ReportNotFoundError, InvalidStatusTransitionError:
            raise
        except SQLAlchemyError as exc:
            raise ReportPersistenceError("service request update") from exc
