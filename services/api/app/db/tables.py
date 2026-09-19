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
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
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

admin_accounts = Table(
    "admin_accounts",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("auth_user_id", UUID(as_uuid=True), nullable=False, unique=True),
    Column("role", Text, nullable=False),
    Column("display_name", Text),
    Column("is_active", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

admin_unit_memberships = Table(
    "admin_unit_memberships",
    metadata,
    Column(
        "admin_account_id",
        UUID(as_uuid=True),
        ForeignKey("public.admin_accounts.id"),
        primary_key=True,
    ),
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        primary_key=True,
    ),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

channel_integrations = Table(
    "channel_integrations",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("channel", Text, nullable=False),
    Column("external_account_id", Text, nullable=False),
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
    ),
    Column("is_active", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

service_request_types = Table(
    "service_request_types",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("code", Text, nullable=False, unique=True),
    Column("name", Text, nullable=False),
    Column("is_active", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

service_requests = Table(
    "service_requests",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("ticket_number", Text, nullable=False, unique=True),
    Column(
        "request_type_id",
        UUID(as_uuid=True),
        ForeignKey("public.service_request_types.id"),
        nullable=False,
    ),
    Column(
        "citizen_id",
        UUID(as_uuid=True),
        ForeignKey("public.citizens.id"),
        nullable=False,
    ),
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
    ),
    Column("status", Text, nullable=False),
    Column("applicant_name", Text, nullable=False),
    Column("domicile_address", Text, nullable=False),
    Column("domicile_duration", Text, nullable=False),
    Column("purpose", Text, nullable=False),
    Column("idempotency_key", UUID(as_uuid=True), nullable=False, unique=True),
    Column("idempotency_payload_hash", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

service_request_status_history = Table(
    "service_request_status_history",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column(
        "service_request_id",
        UUID(as_uuid=True),
        ForeignKey("public.service_requests.id"),
        nullable=False,
    ),
    Column("old_status", Text),
    Column("new_status", Text, nullable=False),
    Column("actor_type", Text, nullable=False),
    Column("actor_identifier", Text),
    Column("notes", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

knowledge_documents = Table(
    "knowledge_documents",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("title", Text, nullable=False),
    Column("document_type", Text),
    Column("source_name", Text),
    Column("source_url", Text),
    Column("version", Text),
    Column("metadata", JSONB, nullable=False),
    Column("is_active", Boolean, nullable=False),
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
    ),
    Column("category", Text),
    Column("content", Text),
    Column("source_type", Text),
    Column("storage_bucket", Text),
    Column("storage_path", Text),
    Column("is_mandatory", Boolean, nullable=False),
    Column("processing_status", Text, nullable=False),
    Column("checksum", Text),
    Column("failure_message", Text),
    Column("review_status", Text),
    Column(
        "reviewed_by_admin_id",
        UUID(as_uuid=True),
        ForeignKey("public.admin_accounts.id"),
    ),
    Column("reviewed_at", DateTime(timezone=True)),
    Column("review_reason", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

knowledge_review_history = Table(
    "knowledge_review_history",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("public.knowledge_documents.id"),
        nullable=False,
    ),
    Column("old_status", Text),
    Column("new_status", Text, nullable=False),
    Column("actor_type", Text, nullable=False),
    Column(
        "admin_account_id",
        UUID(as_uuid=True),
        ForeignKey("public.admin_accounts.id"),
    ),
    Column("reason", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

knowledge_chunks = Table(
    "knowledge_chunks",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("public.knowledge_documents.id"),
        nullable=False,
    ),
    Column("chunk_index", Numeric, nullable=False),
    Column("content", Text, nullable=False),
    Column("metadata", JSONB, nullable=False),
    Column("checksum", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
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
