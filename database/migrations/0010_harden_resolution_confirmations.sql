begin;

alter table public.resolution_confirmations enable row level security;

revoke all on table public.resolution_confirmations from anon, authenticated;

create unique index if not exists resolution_confirmations_retry_key
    on public.resolution_confirmations (
        report_id,
        confirmed,
        (coalesce(feedback, ''))
    );

commit;
