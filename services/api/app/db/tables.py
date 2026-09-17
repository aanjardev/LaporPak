from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    Numeric,
    Table,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

metadata = MetaData(schema="public")

citizens = Table(
    "citizens",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("phone_number", Text, nullable=False, unique=True),
    Column("display_name", Text),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

administrative_units = Table(
    "administrative_units",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("name", Text, nullable=False),
    Column("level", Text, nullable=False),
    Column(
        "parent_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
    ),
    Column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

report_categories = Table(
    "report_categories",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("code", Text, nullable=False, unique=True),
    Column("name", Text, nullable=False),
    Column("description", Text),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

reports = Table(
    "reports",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "ticket_number",
        Text,
        nullable=False,
        unique=True,
        server_default=text("next_report_ticket_number()"),
    ),
    Column(
        "citizen_id",
        UUID(as_uuid=True),
        ForeignKey("public.citizens.id"),
        nullable=False,
    ),
    Column(
        "category_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_categories.id"),
        nullable=False,
    ),
    Column(
        "responsible_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
    ),
    Column("source", Text, nullable=False, server_default=text("'whatsapp'")),
    Column(
        "status",
        Text,
        nullable=False,
        server_default=text("'pending_verification'"),
    ),
    Column("urgency", Text, nullable=False, server_default=text("'medium'")),
    Column("original_text", Text),
    Column("description", Text, nullable=False),
    Column("summary", Text),
    Column("location_text", Text),
    Column("latitude", Numeric(9, 6)),
    Column("longitude", Numeric(9, 6)),
    Column("ai_extraction", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column(
        "ai_recommendation",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    ),
    Column("verified_at", DateTime(timezone=True)),
    Column("resolved_at", DateTime(timezone=True)),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "updated_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column("idempotency_key", UUID(as_uuid=True), unique=True),
    Column("idempotency_payload_hash", Text),
)

report_attachments = Table(
    "report_attachments",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "report_id",
        UUID(as_uuid=True),
        ForeignKey("public.reports.id"),
        nullable=False,
    ),
    Column(
        "storage_bucket",
        Text,
        nullable=False,
        server_default=text("'report-attachments'"),
    ),
    Column("storage_path", Text, nullable=False),
    Column("file_name", Text),
    Column("mime_type", Text),
    Column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

report_status_history = Table(
    "report_status_history",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "report_id",
        UUID(as_uuid=True),
        ForeignKey("public.reports.id"),
        nullable=False,
    ),
    Column("old_status", Text),
    Column("new_status", Text, nullable=False),
    Column("actor_type", Text, nullable=False, server_default=text("'system'")),
    Column("actor_identifier", Text),
    Column("notes", Text),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)
