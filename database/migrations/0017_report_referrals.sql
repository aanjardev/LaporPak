begin;

create table public.agency_channels (
    id uuid primary key default gen_random_uuid(),
    target_unit_id uuid not null references public.administrative_units(id),
    source_unit_id uuid references public.administrative_units(id),
    channel_code text not null,
    display_name text not null,
    mode text not null check (mode in ('mock','live')),
    supported_categories jsonb not null default '[]'::jsonb,
    capabilities jsonb not null default '{}'::jsonb,
    authority_source jsonb not null default '{}'::jsonb,
    config jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    synthetic boolean not null default false,
    approved_for_production boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (target_unit_id, channel_code),
    check (mode <> 'mock' or synthetic),
    check (mode <> 'live' or approved_for_production)
);

create table public.report_referrals (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    source_unit_id uuid not null references public.administrative_units(id),
    channel_id uuid not null references public.agency_channels(id),
    active_package_version integer not null default 1 check (active_package_version > 0),
    dispatch_status text not null default 'awaiting_approval'
        check (dispatch_status in ('draft','awaiting_approval','approved','queued','sending','sent','delivery_unknown','failed','cancelled')),
    registration_status text not null default 'unverified'
        check (registration_status in ('unverified','pending','registered','rejected')),
    handling_status text not null default 'unassigned'
        check (handling_status in ('unassigned','awaiting_acceptance','accepted','in_progress','declined','completed')),
    external_reference text,
    evidence_reference text,
    is_simulated boolean not null default true,
    created_by text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (report_id, channel_id)
);

create table public.referral_packages (
    id uuid primary key default gen_random_uuid(),
    referral_id uuid not null references public.report_referrals(id) on delete cascade,
    package_version integer not null check (package_version > 0),
    package_hash text not null,
    request_key uuid not null unique,
    request_payload_hash text not null,
    snapshot jsonb not null,
    created_by text not null,
    approved_by text,
    approved_at timestamptz,
    approval_reason text,
    approval_revoked_at timestamptz,
    created_at timestamptz not null default now(),
    unique (referral_id, package_version)
);

create table public.referral_events (
    id uuid primary key default gen_random_uuid(),
    referral_id uuid not null references public.report_referrals(id) on delete cascade,
    event_type text not null,
    actor_identifier text not null,
    event_key text,
    before_state jsonb,
    after_state jsonb,
    evidence_reference text,
    occurred_at timestamptz not null default now(),
    observed_at timestamptz not null default now(),
    unique (referral_id, event_key)
);

create table public.referral_outbox (
    id uuid primary key default gen_random_uuid(),
    referral_id uuid not null references public.report_referrals(id) on delete cascade,
    package_id uuid not null references public.referral_packages(id),
    operation_key uuid not null unique,
    status text not null default 'pending'
        check (status in ('pending','processing','succeeded','failed','reconciliation','cancelled')),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    max_attempts integer not null default 3 check (max_attempts > 0),
    next_attempt_at timestamptz not null default now(),
    lease_token uuid,
    leased_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.case_tasks (
    id uuid primary key default gen_random_uuid(),
    referral_id uuid not null references public.report_referrals(id) on delete cascade,
    task_type text not null,
    dedup_key text not null unique,
    status text not null default 'open' check (status in ('open','completed','cancelled')),
    assigned_to text,
    next_action text not null,
    due_at timestamptz,
    blocked_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.mock_delivery_ledger (
    operation_key uuid primary key,
    channel_id uuid not null references public.agency_channels(id),
    package_hash text not null,
    transport_outcome text not null,
    external_reference text,
    registration_outcome text not null,
    handling_outcome text not null,
    evidence_reference text,
    occurred_at timestamptz not null default now(),
    observed_at timestamptz not null default now()
);

create index idx_report_referrals_report on public.report_referrals(report_id, created_at desc);
create index idx_referral_events_referral on public.referral_events(referral_id, observed_at, id);
create index idx_referral_outbox_ready on public.referral_outbox(status, next_attempt_at)
    where status in ('pending','reconciliation');
create index idx_case_tasks_referral on public.case_tasks(referral_id, status);

alter table public.agency_channels enable row level security;
alter table public.report_referrals enable row level security;
alter table public.referral_packages enable row level security;
alter table public.referral_events enable row level security;
alter table public.referral_outbox enable row level security;
alter table public.case_tasks enable row level security;
alter table public.mock_delivery_ledger enable row level security;

revoke all on public.agency_channels from anon, authenticated;
revoke all on public.report_referrals from anon, authenticated;
revoke all on public.referral_packages from anon, authenticated;
revoke all on public.referral_events from anon, authenticated;
revoke all on public.referral_outbox from anon, authenticated;
revoke all on public.case_tasks from anon, authenticated;
revoke all on public.mock_delivery_ledger from anon, authenticated;

commit;
