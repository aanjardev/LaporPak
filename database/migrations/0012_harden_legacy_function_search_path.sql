begin;

-- Some existing Supabase projects still contain this REQUEST helper even when
-- REQUEST is not enabled by the current application. Keep it safe without
-- making it a dependency of a clean installation.
do $$
begin
    if to_regprocedure('public.next_service_request_ticket_number()') is not null then
        alter function public.next_service_request_ticket_number()
            set search_path = pg_catalog;
    end if;
end
$$;

commit;
