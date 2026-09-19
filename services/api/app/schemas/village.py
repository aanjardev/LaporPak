"""Village schemas for multi-desa support."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ============================================================================
# AI Personality Configuration
# ============================================================================


class VillageAIPersonality(StrictSchema):
    """AI personality configuration for a village."""

    name: str = Field(default="LaporPak", max_length=100)
    emoji: str = Field(default="📋", max_length=10)
    vibe: str = Field(
        default="Tegas dan membantu",
        max_length=500,
    )
    welcome_message: str = Field(
        default="Selamat datang! Saya siap membantu Anda.",
        max_length=1000,
    )
    custom_greetings: list[str] = Field(
        default=["Halo", "Hai", "Assalamualaikum"],
        max_length=10,
    )
    tone: str = Field(
        default="santai dan familiar seperti tetangga",
        max_length=200,
    )


# ============================================================================
# Village Metadata
# ============================================================================


class VillageMetadata(StrictSchema):
    """Additional metadata for a village."""

    ai_personality: VillageAIPersonality = Field(default_factory=VillageAIPersonality)
    is_ai_enabled: bool = True
    whatsapp_business_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    address: str | None = None


# ============================================================================
# Village Create/Update
# ============================================================================


class VillageCreate(StrictSchema):
    """Request body for creating a new village."""

    name: Annotated[str, StringConstraints(min_length=1, max_length=200)]
    level: str = Field(default="village", max_length=50)
    parent_id: UUID | None = None
    metadata: VillageMetadata = Field(default_factory=VillageMetadata)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("level")
    @classmethod
    def validate_level(cls, value: str) -> str:
        allowed = {"village", "district", "city", "province"}
        if value.lower() not in allowed:
            raise ValueError(f"level must be one of: {', '.join(allowed)}")
        return value.lower()


class VillageUpdate(StrictSchema):
    """Request body for updating a village."""

    name: Annotated[str, StringConstraints(min_length=1, max_length=200)] | None = None
    parent_id: UUID | None = None
    is_active: bool | None = None
    metadata: VillageMetadata | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


# ============================================================================
# Village Response
# ============================================================================


class VillageAIPersonalityResponse(StrictSchema):
    """AI personality in response."""

    name: str
    emoji: str
    vibe: str
    welcome_message: str
    custom_greetings: list[str]
    tone: str


class VillageMetadataResponse(StrictSchema):
    """Village metadata in response."""

    ai_personality: VillageAIPersonalityResponse
    is_ai_enabled: bool
    whatsapp_business_name: str | None
    logo_url: str | None
    primary_color: str | None
    contact_phone: str | None
    contact_email: str | None
    address: str | None


class VillageResponse(StrictSchema):
    """Response for a village."""

    id: UUID
    name: str
    level: str
    parent_id: UUID | None
    metadata: VillageMetadataResponse
    is_active: bool
    created_at: datetime
    updated_at: datetime


class VillageListResponse(StrictSchema):
    """Response for listing villages."""

    items: list[VillageResponse]
    total: int


class VillageStats(StrictSchema):
    """Statistics for a village."""

    total_reports: int = 0
    pending_reports: int = 0
    resolved_reports: int = 0
    total_requests: int = 0
    pending_requests: int = 0
    knowledge_documents: int = 0
    whatsapp_connected: bool = False


class VillageDetailResponse(StrictSchema):
    """Detailed response for a village including stats."""

    id: UUID
    name: str
    level: str
    parent_id: UUID | None
    metadata: VillageMetadataResponse
    is_active: bool
    created_at: datetime
    updated_at: datetime
    stats: VillageStats


# ============================================================================
# Channel Integration
# ============================================================================


class WhatsAppChannelInfo(StrictSchema):
    """WhatsApp channel information for a village."""

    phone_number: str | None = None
    is_connected: bool = False
    connected_at: datetime | None = None
    last_message_at: datetime | None = None


class VillageChannelResponse(StrictSchema):
    """Channel information for a village."""

    village_id: UUID
    whatsapp: WhatsAppChannelInfo
