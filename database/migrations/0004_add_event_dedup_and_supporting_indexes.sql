begin;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'report_status_history_old_status_check'
          and conrelid = 'public.report_status_history'::regclass
    ) then
        alter table public.report_status_history
            add constraint report_status_history_old_status_check
                check (
                    old_status is null
                    or old_status in (
                        'pending_verification', 'verified', 'in_progress',
                        'forwarded', 'resolved', 'rejected'
                    )
                );
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'report_status_history_new_status_check'
          and conrelid = 'public.report_status_history'::regclass
    ) then
        alter table public.report_status_history
            add constraint report_status_history_new_status_check
                check (
                    new_status in (
                        'pending_verification', 'verified', 'in_progress',
                        'forwarded', 'resolved', 'rejected'
                    )
                );
    end if;
end
$$;

alter table public.conversation_messages
    add column if not exists external_message_id text;

create unique index if not exists conversation_messages_external_message_id_key
    on public.conversation_messages(external_message_id)
    where external_message_id is not null;

create index if not exists idx_administrative_units_parent_id
    on public.administrative_units(parent_id);

create index if not exists idx_conversation_sessions_citizen_id
    on public.conversation_sessions(citizen_id);

create index if not exists idx_routing_rules_category_id
    on public.routing_rules(category_id);

create index if not exists idx_routing_rules_target_unit_id
    on public.routing_rules(target_unit_id);

commit;
