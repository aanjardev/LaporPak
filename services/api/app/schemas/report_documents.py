"""Contracts for immutable REPORT PDF documents and public verification."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReportDocumentType(StrEnum):
    RECEIPT = "receipt"
    VERIFIED = "verified"


class ReportDocumentStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"
    REPLACED = "replaced"
    REVOKED = "revoked"


class ReportDocument(StrictSchema):
    id: UUID
    document_type: ReportDocumentType
    version: int
    status: ReportDocumentStatus
    delivery_status: str
    file_sha256: str | None = None
    issued_at: datetime | None = None
    created_at: datetime
    revocation_reason: str | None = None


class ReportDocumentList(StrictSchema):
    items: list[ReportDocument]


class ReportDocumentRevision(StrictSchema):
    document_type: ReportDocumentType
    reason: str = Field(min_length=3, max_length=500)


class ReportDocumentReason(StrictSchema):
    reason: str = Field(min_length=3, max_length=500)


class CitizenDocumentDeliveryRequest(StrictSchema):
    sender_phone_number: str = Field(min_length=8, max_length=32)
    ticket_number: str = Field(pattern=r"^LP-[0-9]{4}-[0-9]{4,}$")
    document_type: ReportDocumentType = ReportDocumentType.RECEIPT


class ReportDocumentVerification(StrictSchema):
    valid: bool
    ticket_number: str
    document_type: ReportDocumentType
    version: int
    village_name: str
    issued_at: datetime | None
    status: str
    file_sha256: str | None
