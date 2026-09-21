from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
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
        "activation_status",
        Text,
        nullable=False,
        server_default=text("'approved'"),
    ),
    Column("activation_requested_at", DateTime(timezone=True)),
    Column("activation_reviewed_at", DateTime(timezone=True)),
    Column(
        "activation_reviewed_by",
        UUID(as_uuid=True),
        ForeignKey("public.admin_accounts.id"),
    ),
    Column("activation_review_reason", Text),
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
    Column("contact_phone", Text),
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
        server_default=text("next_service_request_ticket_number()"),
    ),
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
    Column("status", Text, nullable=False, server_default=text("'pending_review'")),
    Column("applicant_name", Text, nullable=False),
    Column("domicile_address", Text, nullable=False),
    Column("domicile_duration", Text, nullable=False),
    Column("purpose", Text, nullable=False),
    Column("idempotency_key", UUID(as_uuid=True), nullable=False, unique=True),
    Column("idempotency_payload_hash", Text, nullable=False),
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

service_request_status_history = Table(
    "service_request_status_history",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
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
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
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

admin_invitations = Table(
    "admin_invitations",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("email", Text, nullable=False),
    Column("role", Text, nullable=False),
    Column(
        "village_id", UUID(as_uuid=True), ForeignKey("public.administrative_units.id")
    ),
    Column("token", Text, nullable=False, unique=True),
    Column("status", Text, nullable=False, server_default=text("'pending'")),
    Column("invited_by", Text),
    Column("invited_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True)),
    Column("accepted_at", DateTime(timezone=True)),
    Column("revoked_at", DateTime(timezone=True)),
)

village_activation_history = Table(
    "village_activation_history",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "administrative_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
    ),
    Column("old_status", Text),
    Column("new_status", Text, nullable=False),
    Column(
        "actor_admin_account_id",
        UUID(as_uuid=True),
        ForeignKey("public.admin_accounts.id"),
        nullable=False,
    ),
    Column("reason", Text),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

report_documents = Table(
    "report_documents",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "report_id", UUID(as_uuid=True), ForeignKey("public.reports.id"), nullable=False
    ),
    Column("document_type", Text, nullable=False),
    Column("version", Integer, nullable=False, server_default=text("1")),
    Column("status", Text, nullable=False, server_default=text("'pending'")),
    Column("delivery_status", Text, nullable=False, server_default=text("'pending'")),
    Column(
        "verification_token",
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("storage_bucket", Text),
    Column("storage_path", Text),
    Column("file_sha256", Text),
    Column("snapshot", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column(
        "supersedes_document_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_documents.id"),
    ),
    Column("issued_by", Text),
    Column("issued_at", DateTime(timezone=True)),
    Column("revoked_at", DateTime(timezone=True)),
    Column("revoked_by", Text),
    Column("revocation_reason", Text),
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

report_document_jobs = Table(
    "report_document_jobs",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_documents.id"),
        nullable=False,
        unique=True,
    ),
    Column("status", Text, nullable=False, server_default=text("'pending'")),
    Column("attempt_count", Integer, nullable=False, server_default=text("0")),
    Column(
        "next_attempt_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column("locked_at", DateTime(timezone=True)),
    Column("last_error", Text),
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

report_document_audit = Table(
    "report_document_audit",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "document_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_documents.id"),
        nullable=False,
    ),
    Column("action", Text, nullable=False),
    Column("actor_identifier", Text),
    Column("reason", Text),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

agency_channels = Table(
    "agency_channels",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "target_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
    ),
    Column(
        "source_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
    ),
    Column("channel_code", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column("mode", Text, nullable=False),
    Column(
        "supported_categories",
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    ),
    Column("capabilities", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column(
        "authority_source", JSONB, nullable=False, server_default=text("'{}'::jsonb")
    ),
    Column("config", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column("synthetic", Boolean, nullable=False, server_default=text("false")),
    Column(
        "approved_for_production", Boolean, nullable=False, server_default=text("false")
    ),
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

report_referrals = Table(
    "report_referrals",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "report_id", UUID(as_uuid=True), ForeignKey("public.reports.id"), nullable=False
    ),
    Column(
        "source_unit_id",
        UUID(as_uuid=True),
        ForeignKey("public.administrative_units.id"),
        nullable=False,
    ),
    Column(
        "channel_id",
        UUID(as_uuid=True),
        ForeignKey("public.agency_channels.id"),
        nullable=False,
    ),
    Column("active_package_version", Integer, nullable=False, server_default=text("1")),
    Column(
        "dispatch_status",
        Text,
        nullable=False,
        server_default=text("'awaiting_approval'"),
    ),
    Column(
        "registration_status", Text, nullable=False, server_default=text("'unverified'")
    ),
    Column(
        "handling_status", Text, nullable=False, server_default=text("'unassigned'")
    ),
    Column("external_reference", Text),
    Column("evidence_reference", Text),
    Column("is_simulated", Boolean, nullable=False, server_default=text("true")),
    Column("created_by", Text, nullable=False),
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

referral_packages = Table(
    "referral_packages",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "referral_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_referrals.id"),
        nullable=False,
    ),
    Column("package_version", Integer, nullable=False),
    Column("package_hash", Text, nullable=False),
    Column("request_key", UUID(as_uuid=True), nullable=False, unique=True),
    Column("request_payload_hash", Text, nullable=False),
    Column("snapshot", JSONB, nullable=False),
    Column("created_by", Text, nullable=False),
    Column("approved_by", Text),
    Column("approved_at", DateTime(timezone=True)),
    Column("approval_reason", Text),
    Column("approval_revoked_at", DateTime(timezone=True)),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

referral_events = Table(
    "referral_events",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "referral_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_referrals.id"),
        nullable=False,
    ),
    Column("event_type", Text, nullable=False),
    Column("actor_identifier", Text, nullable=False),
    Column("event_key", Text),
    Column("before_state", JSONB),
    Column("after_state", JSONB),
    Column("evidence_reference", Text),
    Column(
        "occurred_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "observed_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)

referral_outbox = Table(
    "referral_outbox",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "referral_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_referrals.id"),
        nullable=False,
    ),
    Column(
        "package_id",
        UUID(as_uuid=True),
        ForeignKey("public.referral_packages.id"),
        nullable=False,
    ),
    Column("operation_key", UUID(as_uuid=True), nullable=False, unique=True),
    Column("status", Text, nullable=False, server_default=text("'pending'")),
    Column("attempt_count", Integer, nullable=False, server_default=text("0")),
    Column("max_attempts", Integer, nullable=False, server_default=text("3")),
    Column(
        "next_attempt_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column("lease_token", UUID(as_uuid=True)),
    Column("leased_at", DateTime(timezone=True)),
    Column("last_error", Text),
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

case_tasks = Table(
    "case_tasks",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column(
        "referral_id",
        UUID(as_uuid=True),
        ForeignKey("public.report_referrals.id"),
        nullable=False,
    ),
    Column("task_type", Text, nullable=False),
    Column("dedup_key", Text, nullable=False, unique=True),
    Column("status", Text, nullable=False, server_default=text("'open'")),
    Column("assigned_to", Text),
    Column("next_action", Text, nullable=False),
    Column("due_at", DateTime(timezone=True)),
    Column("blocked_reason", Text),
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

mock_delivery_ledger = Table(
    "mock_delivery_ledger",
    metadata,
    Column("operation_key", UUID(as_uuid=True), primary_key=True),
    Column(
        "channel_id",
        UUID(as_uuid=True),
        ForeignKey("public.agency_channels.id"),
        nullable=False,
    ),
    Column("package_hash", Text, nullable=False),
    Column("transport_outcome", Text, nullable=False),
    Column("external_reference", Text),
    Column("registration_outcome", Text, nullable=False),
    Column("handling_outcome", Text, nullable=False),
    Column("evidence_reference", Text),
    Column(
        "occurred_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
    Column(
        "observed_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    ),
)
