from enum import StrEnum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictStr,
    StringConstraints,
)

NonEmptyString = Annotated[
    StrictStr,
    StringConstraints(strip_whitespace=True, min_length=1),
]


class AIIntent(StrEnum):
    REPORT = "REPORT"
    UNKNOWN = "UNKNOWN"


class ReportCategory(StrEnum):
    INFRASTRUCTURE = "infrastructure"
    PUBLIC_FACILITY = "public_facility"
    CLEANLINESS = "cleanliness"
    SECURITY = "security"
    SOCIAL = "social"
    ADMINISTRATION = "administration"
    OTHER = "other"


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AILocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: NonEmptyString | None
    latitude: Annotated[StrictFloat, Field(ge=-90, le=90)] | None
    longitude: Annotated[StrictFloat, Field(ge=-180, le=180)] | None


class AIAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: AIIntent
    confidence: Annotated[StrictFloat, Field(ge=0, le=1)]
    category: ReportCategory | None
    description: NonEmptyString | None
    location: AILocation | None
    urgency: Urgency | None
    missing_fields: list[NonEmptyString]
    needs_clarification: StrictBool
    clarification_reason: NonEmptyString | None
    summary: NonEmptyString | None
