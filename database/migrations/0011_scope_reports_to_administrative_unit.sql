begin;

alter table public.reports
    add column if not exists administrative_unit_id uuid
    references public.administrative_units(id);

create index if not exists idx_reports_administrative_unit
    on public.reports(administrative_unit_id);

commit;
