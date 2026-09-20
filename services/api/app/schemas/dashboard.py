from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DashboardSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DashboardVillage(DashboardSchema):
    id: UUID
    name: str


class DashboardPeriod(DashboardSchema):
    days: Literal[7, 30, 90]
    start_date: date
    end_date: date
    timezone: Literal["Asia/Jakarta"] = "Asia/Jakarta"


class DashboardKpis(DashboardSchema):
    reports_created: int = Field(ge=0)
    requests_created: int = Field(ge=0)
    needs_attention: int = Field(ge=0)
    ask_ready: int = Field(ge=0)


class DashboardAttentionCounts(DashboardSchema):
    reports: int = Field(ge=0)
    requests: int = Field(ge=0)
    knowledge: int = Field(ge=0)


class ReportStatusCounts(DashboardSchema):
    pending_verification: int = Field(ge=0)
    verified: int = Field(ge=0)
    in_progress: int = Field(ge=0)
    forwarded: int = Field(ge=0)
    resolved: int = Field(ge=0)
    rejected: int = Field(ge=0)


class RequestStatusCounts(DashboardSchema):
    pending_review: int = Field(ge=0)
    approved: int = Field(ge=0)
    rejected: int = Field(ge=0)
    completed: int = Field(ge=0)


class KnowledgeCounts(DashboardSchema):
    active: int = Field(ge=0)
    ready: int = Field(ge=0)
    draft: int = Field(ge=0)
    failed: int = Field(ge=0)
    processing: int = Field(ge=0)


class DashboardDaily(DashboardSchema):
    date: date
    reports: int = Field(ge=0)
    requests: int = Field(ge=0)


class DashboardAttentionItem(DashboardSchema):
    kind: Literal["report", "request", "knowledge"]
    id: UUID
    label: str
    status: Literal["pending_verification", "pending_review", "draft", "failed"]
    created_at: datetime


class VillageDashboardResponse(DashboardSchema):
    village: DashboardVillage
    period: DashboardPeriod
    generated_at: datetime
    kpis: DashboardKpis
    attention_counts: DashboardAttentionCounts
    report_status_counts: ReportStatusCounts
    request_status_counts: RequestStatusCounts
    knowledge: KnowledgeCounts
    daily: list[DashboardDaily]
    attention: list[DashboardAttentionItem]
