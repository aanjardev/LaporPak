begin;

-- =========================================================
-- CITIZENS
-- =========================================================

create table if not exists public.citizens (
    id uuid primary key default gen_random_uuid(),
    phone_number text not null unique,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- ADMINISTRATIVE UNITS
-- =========================================================

create table if not exists public.administrative_units (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    level text not null
        check (
            level in (
                'village',
                'subdistrict',
                'regency',
                'agency',
                'other'
            )
        ),
    parent_id uuid
        references public.administrative_units(id)
        on delete set null,
    metadata jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- REPORT CATEGORIES
-- =========================================================

create table if not exists public.report_categories (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- REPORTS
-- =========================================================

create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),

    ticket_number text not null unique,

    citizen_id uuid
        references public.citizens(id)
        on delete set null,

    category_id uuid
        references public.report_categories(id)
        on delete set null,

    responsible_unit_id uuid
        references public.administrative_units(id)
        on delete set null,

    source text not null default 'whatsapp'
        check (
            source in (
                'whatsapp',
                'dashboard',
                'api',
                'seed'
            )
        ),

    status text not null default 'pending_verification'
        check (
            status in (
                'pending_verification',
                'verified',
                'in_progress',
                'forwarded',
                'resolved',
                'rejected'
            )
        ),

    urgency text not null default 'medium'
        check (
            urgency in (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    original_text text,
    description text not null,
    summary text,

    location_text text,

    latitude numeric(9, 6)
        check (
            latitude is null
            or latitude between -90 and 90
        ),

    longitude numeric(9, 6)
        check (
            longitude is null
            or longitude between -180 and 180
        ),

    ai_extraction jsonb not null default '{}'::jsonb,
    ai_recommendation jsonb not null default '{}'::jsonb,

    verified_at timestamptz,
    resolved_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- REPORT ATTACHMENTS
-- =========================================================

create table if not exists public.report_attachments (
    id uuid primary key default gen_random_uuid(),

    report_id uuid not null
        references public.reports(id)
        on delete cascade,

    storage_bucket text not null default 'report-attachments',
    storage_path text not null,

    file_name text,
    mime_type text,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);


-- =========================================================
-- REPORT STATUS HISTORY
-- =========================================================

create table if not exists public.report_status_history (
    id uuid primary key default gen_random_uuid(),

    report_id uuid not null
        references public.reports(id)
        on delete cascade,

    old_status text,
    new_status text not null,

    actor_type text not null default 'system'
        check (
            actor_type in (
                'system',
                'admin',
                'ai',
                'citizen'
            )
        ),

    actor_identifier text,
    notes text,

    created_at timestamptz not null default now()
);


-- =========================================================
-- CONVERSATION SESSION
-- =========================================================

create table if not exists public.conversation_sessions (
    id uuid primary key default gen_random_uuid(),

    citizen_id uuid
        references public.citizens(id)
        on delete set null,

    channel text not null default 'whatsapp',

    external_session_id text,

    is_active boolean not null default true,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- CONVERSATION MESSAGES
-- =========================================================

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),

    session_id uuid not null
        references public.conversation_sessions(id)
        on delete cascade,

    report_id uuid
        references public.reports(id)
        on delete set null,

    direction text not null
        check (
            direction in ('inbound', 'outbound')
        ),

    sender_role text not null
        check (
            sender_role in (
                'citizen',
                'agent',
                'admin',
                'system'
            )
        ),

    message_type text not null default 'text'
        check (
            message_type in (
                'text',
                'image',
                'location',
                'document'
            )
        ),

    content text,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);


-- =========================================================
-- ROUTING RULES
-- =========================================================

create table if not exists public.routing_rules (
    id uuid primary key default gen_random_uuid(),

    category_id uuid
        references public.report_categories(id)
        on delete cascade,

    target_unit_id uuid not null
        references public.administrative_units(id)
        on delete cascade,

    priority integer not null default 100,

    conditions jsonb not null default '{}'::jsonb,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- KNOWLEDGE DOCUMENTS
-- =========================================================

create table if not exists public.knowledge_documents (
    id uuid primary key default gen_random_uuid(),

    title text not null,
    document_type text,

    source_name text,
    source_url text,

    version text,

    metadata jsonb not null default '{}'::jsonb,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- KNOWLEDGE CHUNKS
-- =========================================================

create table if not exists public.knowledge_chunks (
    id uuid primary key default gen_random_uuid(),

    document_id uuid not null
        references public.knowledge_documents(id)
        on delete cascade,

    chunk_index integer not null,

    content text not null,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),

    unique(document_id, chunk_index)
);


-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists citizens_set_updated_at
    on public.citizens;

create trigger citizens_set_updated_at
before update on public.citizens
for each row
execute function public.set_updated_at();


drop trigger if exists administrative_units_set_updated_at
    on public.administrative_units;

create trigger administrative_units_set_updated_at
before update on public.administrative_units
for each row
execute function public.set_updated_at();


drop trigger if exists report_categories_set_updated_at
    on public.report_categories;

create trigger report_categories_set_updated_at
before update on public.report_categories
for each row
execute function public.set_updated_at();


drop trigger if exists reports_set_updated_at
    on public.reports;

create trigger reports_set_updated_at
before update on public.reports
for each row
execute function public.set_updated_at();


drop trigger if exists conversation_sessions_set_updated_at
    on public.conversation_sessions;

create trigger conversation_sessions_set_updated_at
before update on public.conversation_sessions
for each row
execute function public.set_updated_at();


drop trigger if exists routing_rules_set_updated_at
    on public.routing_rules;

create trigger routing_rules_set_updated_at
before update on public.routing_rules
for each row
execute function public.set_updated_at();


drop trigger if exists knowledge_documents_set_updated_at
    on public.knowledge_documents;

create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row
execute function public.set_updated_at();


-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_reports_status
    on public.reports(status);

create index if not exists idx_reports_created_at
    on public.reports(created_at desc);

create index if not exists idx_reports_citizen_id
    on public.reports(citizen_id);

create index if not exists idx_reports_category_id
    on public.reports(category_id);

create index if not exists idx_reports_responsible_unit
    on public.reports(responsible_unit_id);

create index if not exists idx_report_status_history_report
    on public.report_status_history(report_id);

create index if not exists idx_report_attachments_report
    on public.report_attachments(report_id);

create index if not exists idx_conversation_messages_session
    on public.conversation_messages(session_id);

create index if not exists idx_conversation_messages_report
    on public.conversation_messages(report_id);

create index if not exists idx_knowledge_chunks_document
    on public.knowledge_chunks(document_id);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.citizens enable row level security;
alter table public.administrative_units enable row level security;
alter table public.report_categories enable row level security;
alter table public.reports enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_status_history enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.routing_rules enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

commit;
