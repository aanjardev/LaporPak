begin;

alter table public.knowledge_documents
    add column if not exists review_status text,
    add column if not exists reviewed_by_admin_id uuid
        references public.admin_accounts(id) on delete set null,
    add column if not exists reviewed_at timestamptz,
    add column if not exists review_reason text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'knowledge_documents_review_status_check'
          and conrelid = 'public.knowledge_documents'::regclass
    ) then
        alter table public.knowledge_documents
            add constraint knowledge_documents_review_status_check
            check (review_status is null or review_status in ('draft', 'demo', 'approved', 'rejected'));
    end if;
end
$$;

-- Legacy rows remain quarantined with a null review status. Only canonical rows
-- are reconciled, and demo data is never promoted to official approval.
update public.knowledge_documents
set review_status = case
        when metadata->>'source_reference' like 'DATA UJI%' then 'demo'
        else 'draft'
    end,
    reviewed_by_admin_id = null,
    reviewed_at = null,
    review_reason = case
        when metadata->>'source_reference' like 'DATA UJI%'
            then 'Synthetic development-only source'
        else null
    end
where administrative_unit_id is not null
  and source_type in ('paste', 'markdown', 'pdf')
  and content is not null
  and btrim(content) <> ''
  and review_status is null;

create table if not exists public.knowledge_review_history (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.knowledge_documents(id) on delete cascade,
    old_status text,
    new_status text not null,
    actor_type text not null,
    admin_account_id uuid references public.admin_accounts(id) on delete set null,
    reason text not null,
    created_at timestamptz not null default now(),
    constraint knowledge_review_history_old_status_check
        check (old_status is null or old_status in ('draft', 'demo', 'approved', 'rejected')),
    constraint knowledge_review_history_new_status_check
        check (new_status in ('draft', 'demo', 'approved', 'rejected')),
    constraint knowledge_review_history_reason_not_blank check (btrim(reason) <> '')
);

alter table public.knowledge_review_history enable row level security;
revoke all on table public.knowledge_review_history from anon, authenticated;

create index if not exists idx_knowledge_review_history_document
    on public.knowledge_review_history(document_id, created_at, id);

create index if not exists idx_knowledge_documents_retrieval_review
    on public.knowledge_documents(administrative_unit_id, review_status, is_active)
    where administrative_unit_id is not null
      and source_type in ('paste', 'markdown', 'pdf')
      and content is not null;

commit;
