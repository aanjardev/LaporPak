begin;

create extension if not exists vector;

create table public.admin_accounts (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique,
    role text not null check (role in ('system_admin', 'village_admin')),
    display_name text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.admin_unit_memberships (
    admin_account_id uuid not null references public.admin_accounts(id) on delete cascade,
    administrative_unit_id uuid not null references public.administrative_units(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (admin_account_id, administrative_unit_id)
);

alter table public.reports add column administrative_unit_id uuid
    references public.administrative_units(id);
update public.reports
set administrative_unit_id = '00000000-0000-4000-8000-000000000002'
where administrative_unit_id is null;
alter table public.reports alter column administrative_unit_id set not null;
create index idx_reports_administrative_unit on public.reports(administrative_unit_id);

create table public.channel_integrations (
    id uuid primary key default gen_random_uuid(),
    channel text not null check (channel in ('whatsapp')),
    external_account_id text not null,
    administrative_unit_id uuid not null references public.administrative_units(id),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (channel, external_account_id)
);

create sequence public.service_request_ticket_number_seq;
create or replace function public.next_service_request_ticket_number()
returns text language sql as $$
    select 'REQ-' || extract(year from current_date)::integer || '-' ||
           lpad(nextval('public.service_request_ticket_number_seq')::text, 4, '0');
$$;

create table public.service_request_types (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.service_requests (
    id uuid primary key default gen_random_uuid(),
    ticket_number text not null unique default public.next_service_request_ticket_number(),
    request_type_id uuid not null references public.service_request_types(id),
    citizen_id uuid not null references public.citizens(id),
    administrative_unit_id uuid not null references public.administrative_units(id),
    status text not null default 'pending_review'
        check (status in ('pending_review','approved','rejected','completed')),
    applicant_name text not null,
    domicile_address text not null,
    domicile_duration text not null,
    purpose text not null,
    idempotency_key uuid not null unique,
    idempotency_payload_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index idx_service_requests_unit on public.service_requests(administrative_unit_id);
create index idx_service_requests_citizen on public.service_requests(citizen_id);

create table public.service_request_status_history (
    id uuid primary key default gen_random_uuid(),
    service_request_id uuid not null references public.service_requests(id) on delete cascade,
    old_status text,
    new_status text not null,
    actor_type text not null,
    actor_identifier text,
    notes text,
    created_at timestamptz not null default now()
);

alter table public.knowledge_documents
    add column administrative_unit_id uuid references public.administrative_units(id),
    add column category text,
    add column content text,
    add column source_type text check (source_type in ('paste','markdown','pdf')),
    add column storage_bucket text,
    add column storage_path text,
    add column is_mandatory boolean not null default false,
    add column processing_status text not null default 'pending'
        check (processing_status in ('pending','processing','ready','failed')),
    add column checksum text,
    add column failure_message text;

alter table public.knowledge_chunks
    add column embedding vector(768),
    add column checksum text,
    add column search_vector tsvector generated always as
        (to_tsvector('simple', content || ' ' || coalesce(metadata->>'aliases', ''))) stored;
create index idx_knowledge_documents_unit on public.knowledge_documents(administrative_unit_id);
create index idx_knowledge_chunks_fts on public.knowledge_chunks using gin(search_vector);
create index idx_knowledge_chunks_embedding on public.knowledge_chunks
    using hnsw (embedding vector_cosine_ops) where embedding is not null;

insert into public.service_request_types (code, name)
values ('residency_letter', 'Surat Keterangan Domisili')
on conflict (code) do update set name = excluded.name, is_active = true;

alter table public.admin_accounts enable row level security;
alter table public.admin_unit_memberships enable row level security;
alter table public.channel_integrations enable row level security;
alter table public.service_request_types enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_status_history enable row level security;
revoke all on public.admin_accounts, public.admin_unit_memberships,
    public.channel_integrations, public.service_request_types,
    public.service_requests, public.service_request_status_history from anon, authenticated;
revoke all on sequence public.service_request_ticket_number_seq from anon, authenticated;

commit;
