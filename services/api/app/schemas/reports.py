from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.ai_analysis import ReportCategory, Urgency

NonEmptyString = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]


class ReportSource(StrEnum):
    WHATSAPP = "whatsapp"
    DASHBOARD = "dashboard"
    API = "api"
    SEED = "seed"


class ReportLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: NonEmptyString | None = None
    latitude: Annotated[float, Field(ge=-90, le=90)] | None = None
    longitude: Annotated[float, Field(ge=-180, le=180)] | None = None

    @model_validator(mode="after")
    def validate_location(self):
        coordinates_complete = self.latitude is not None and self.longitude is not None
        coordinates_partial = (self.latitude is None) != (self.longitude is None)
        if coordinates_partial:
            raise ValueError("latitude and longitude must be provided together")
        if self.text is None and not coordinates_complete:
            raise ValueError("location text or coordinates are required")
        return self


class ReportAIAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: Annotated[float, Field(ge=0, le=1)]
    summary: NonEmptyString | None = None


class CreateReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender_phone_number: NonEmptyString
    conversation_id: UUID | None = None
    category: ReportCategory
    description: NonEmptyString
    location: ReportLocation
    urgency: Urgency | None = None
    original_text: NonEmptyString | None = None
    source: ReportSource = ReportSource.WHATSAPP
    ai_analysis: ReportAIAnalysis | None = None


class CreateReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    ticket_number: str
    status: Literal["pending_verification"]
    created_at: datetime
