begin;

-- ============================================================================
-- Resolution Confirmations Table
-- Track citizen confirmation of resolved reports
-- ============================================================================

create table if not exists public.resolution_confirmations (
    id uuid primary key default gen_random_uuid(),

    report_id uuid not null
        references public.reports(id)
        on delete cascade,

    confirmed boolean not null,
    feedback text,

    created_at timestamptz not null default now()
);

create index if not exists idx_resolution_confirmations_report
    on public.resolution_confirmations(report_id);

-- ============================================================================
-- SLA Tracking: Add deadline column to reports
-- ============================================================================

-- Add sla_deadline column if not exists (idempotent)
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'reports'
        and column_name = 'sla_deadline'
    ) then
        alter table public.reports
        add column sla_deadline timestamptz;
    end if;
end
$$;

-- ============================================================================
-- Emergency Flag: Add is_emergency column to reports
-- ============================================================================

do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'reports'
        and column_name = 'is_emergency'
    ) then
        alter table public.reports
        add column is_emergency boolean not null default false;
    end if;
end
$$;

-- ============================================================================
-- Similar Report Detection: Add location_hash for clustering
-- ============================================================================

do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'reports'
        and column_name = 'location_hash'
    ) then
        alter table public.reports
        add column location_hash text;
    end if;
end
$$;

-- Index for location-based similarity search
create index if not exists idx_reports_location_hash
    on public.reports(location_hash);

-- Index for SLA overdue queries
create index if not exists idx_reports_sla_deadline
    on public.reports(sla_deadline)
    where sla_deadline is not null;

-- Index for emergency flag
create index if not exists idx_reports_is_emergency
    on public.reports(is_emergency)
    where is_emergency = true;

commit;
