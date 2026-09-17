begin;

-- Reconcile the REPORT schema with the API contract. Some development
-- databases received these changes manually before this migration existed,
-- so every additive operation is safe to run against either schema state.

-- =========================================================
-- REQUIRED REPORT RELATIONSHIPS
-- =========================================================

do $$
begin
    if exists (
        select 1
        from public.reports
        where citizen_id is null
    ) then
        raise exception
            'Cannot require reports.citizen_id while NULL values exist';
    end if;

    if exists (
        select 1
        from public.reports
        where category_id is null
    ) then
        raise exception
            'Cannot require reports.category_id while NULL values exist';
    end if;
end;
$$;

alter table public.reports
    alter column citizen_id set not null,
    alter column category_id set not null;

-- Required relationships cannot use ON DELETE SET NULL after becoming
-- NOT NULL. Restrict deletion so persisted reports retain their ownership
-- and category references.
alter table public.reports
    drop constraint if exists reports_citizen_id_fkey,
    drop constraint if exists reports_category_id_fkey;

alter table public.reports
    add constraint reports_citizen_id_fkey
        foreign key (citizen_id)
        references public.citizens(id)
        on delete restrict,
    add constraint reports_category_id_fkey
        foreign key (category_id)
        references public.report_categories(id)
        on delete restrict;


-- =========================================================
-- AUTHORITATIVE REQUIRED-FIELD VALIDATION
-- =========================================================

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_description_not_blank_check'
    ) then
        alter table public.reports
            add constraint reports_description_not_blank_check
            check (btrim(description) <> '');
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_coordinates_pair_check'
    ) then
        alter table public.reports
            add constraint reports_coordinates_pair_check
            check (
                (latitude is null and longitude is null)
                or
                (latitude is not null and longitude is not null)
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_location_available_check'
    ) then
        alter table public.reports
            add constraint reports_location_available_check
            check (
                nullif(btrim(location_text), '') is not null
                or
                (latitude is not null and longitude is not null)
            );
    end if;
end;
$$;


-- =========================================================
-- IDEMPOTENT REPORT CREATION
-- =========================================================

alter table public.reports
    add column if not exists idempotency_key uuid,
    add column if not exists idempotency_payload_hash text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_idempotency_key_key'
    ) then
        alter table public.reports
            add constraint reports_idempotency_key_key
            unique (idempotency_key);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_idempotency_pair_check'
    ) then
        alter table public.reports
            add constraint reports_idempotency_pair_check
            check (
                (idempotency_key is null and idempotency_payload_hash is null)
                or
                (
                    idempotency_key is not null
                    and idempotency_payload_hash is not null
                )
            );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.reports'::regclass
          and conname = 'reports_whatsapp_idempotency_check'
    ) then
        alter table public.reports
            add constraint reports_whatsapp_idempotency_check
            check (source <> 'whatsapp' or idempotency_key is not null);
    end if;
end;
$$;


-- =========================================================
-- CONCURRENCY-SAFE PUBLIC TICKET NUMBER
-- =========================================================

create sequence if not exists public.report_ticket_number_seq;

create or replace function public.next_report_ticket_number()
returns text
language sql
set search_path = ''
as $$
    -- A global sequence is sufficient until the contract explicitly requires
    -- an independently resetting sequence for every calendar year.
    select format(
        'LP-%s-%s',
        to_char(timezone('UTC', now()), 'YYYY'),
        lpad(
            nextval('public.report_ticket_number_seq'::regclass)::text,
            4,
            '0'
        )
    );
$$;

alter table public.reports
    alter column ticket_number
    set default public.next_report_ticket_number();

commit;
