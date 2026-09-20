begin;

alter table public.admin_accounts
    add column contact_phone text;

alter table public.administrative_units
    add column activation_status text not null default 'approved'
        check (activation_status in ('draft','pending_review','changes_requested','approved')),
    add column activation_requested_at timestamptz,
    add column activation_reviewed_at timestamptz,
    add column activation_reviewed_by uuid references public.admin_accounts(id),
    add column activation_review_reason text;

alter table public.administrative_units
    add constraint administrative_units_active_requires_approval
    check (not is_active or activation_status = 'approved');

create table public.village_activation_history (
    id uuid primary key default gen_random_uuid(),
    administrative_unit_id uuid not null
        references public.administrative_units(id) on delete cascade,
    old_status text,
    new_status text not null
        check (new_status in ('draft','pending_review','changes_requested','approved')),
    actor_admin_account_id uuid not null references public.admin_accounts(id),
    reason text,
    created_at timestamptz not null default now()
);

create index idx_village_activation_history_unit_created
    on public.village_activation_history(administrative_unit_id, created_at desc);

alter table public.village_activation_history enable row level security;
revoke all on public.village_activation_history from anon, authenticated;

commit;
