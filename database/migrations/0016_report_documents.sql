begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('report-documents', 'report-documents', false, 15728640, array['application/pdf']),
    ('village-logos', 'village-logos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.report_documents (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    document_type text not null check (document_type in ('receipt','verified')),
    version integer not null default 1 check (version > 0),
    status text not null default 'pending'
        check (status in ('pending','ready','failed','replaced','revoked')),
    delivery_status text not null default 'pending'
        check (delivery_status in ('pending','sent','failed','unknown','not_applicable')),
    verification_token uuid not null default gen_random_uuid() unique,
    storage_bucket text,
    storage_path text,
    file_sha256 text,
    snapshot jsonb not null default '{}'::jsonb,
    supersedes_document_id uuid references public.report_documents(id),
    issued_by text,
    issued_at timestamptz,
    revoked_at timestamptz,
    revoked_by text,
    revocation_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (report_id, document_type, version),
    check ((status = 'ready' and storage_path is not null and file_sha256 is not null)
        or status <> 'ready')
);

create table public.report_document_jobs (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null unique
        references public.report_documents(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending','processing','succeeded','failed','delivery_unknown')),
    attempt_count integer not null default 0 check (attempt_count between 0 and 3),
    next_attempt_at timestamptz not null default now(),
    locked_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.report_document_audit (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.report_documents(id) on delete cascade,
    action text not null check (action in ('queued','issued','delivered','delivery_failed','replaced','revoked','retried')),
    actor_identifier text,
    reason text,
    created_at timestamptz not null default now()
);

create index idx_report_documents_report_created
    on public.report_documents(report_id, created_at desc);
create index idx_report_document_jobs_pending
    on public.report_document_jobs(status, next_attempt_at)
    where status in ('pending','failed');
create index idx_report_document_audit_document_created
    on public.report_document_audit(document_id, created_at);

alter table public.report_documents enable row level security;
alter table public.report_document_jobs enable row level security;
alter table public.report_document_audit enable row level security;
revoke all on public.report_documents from anon, authenticated;
revoke all on public.report_document_jobs from anon, authenticated;
revoke all on public.report_document_audit from anon, authenticated;

commit;
