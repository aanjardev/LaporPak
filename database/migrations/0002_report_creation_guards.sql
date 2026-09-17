begin;

create sequence if not exists public.report_ticket_number_seq;

create or replace function public.next_report_ticket_number()
returns text
language sql
volatile
set search_path = ''
as $$
    -- ponytail: one global sequence is enough until the contract requires
    -- a sequence that resets independently for each calendar year.
    select format(
        'LP-%s-%s',
        to_char(timezone('UTC', now()), 'YYYY'),
        lpad(nextval('public.report_ticket_number_seq'::regclass)::text, 4, '0')
    );
$$;

alter table public.reports
    alter column ticket_number
        set default public.next_report_ticket_number(),
    add column idempotency_key uuid,
    add column idempotency_payload_hash text;

alter table public.reports
    drop constraint reports_citizen_id_fkey,
    drop constraint reports_category_id_fkey,
    alter column citizen_id set not null,
    alter column category_id set not null,
    add constraint reports_citizen_id_fkey
        foreign key (citizen_id)
        references public.citizens(id)
        on delete restrict,
    add constraint reports_category_id_fkey
        foreign key (category_id)
        references public.report_categories(id)
        on delete restrict,
    add constraint reports_description_not_blank_check
        check (btrim(description) <> ''),
    add constraint reports_coordinates_pair_check
        check (
            (latitude is null and longitude is null)
            or (latitude is not null and longitude is not null)
        ),
    add constraint reports_location_available_check
        check (
            nullif(btrim(location_text), '') is not null
            or (latitude is not null and longitude is not null)
        ),
    add constraint reports_idempotency_pair_check
        check (
            (idempotency_key is null and idempotency_payload_hash is null)
            or (idempotency_key is not null and idempotency_payload_hash is not null)
        ),
    add constraint reports_whatsapp_idempotency_check
        check (source <> 'whatsapp' or idempotency_key is not null),
    add constraint reports_idempotency_key_key unique (idempotency_key);

alter table public.report_status_history
    add constraint report_status_history_old_status_check
        check (
            old_status is null
            or old_status in (
                'pending_verification',
                'verified',
                'in_progress',
                'forwarded',
                'resolved',
                'rejected'
            )
        ),
    add constraint report_status_history_new_status_check
        check (
            new_status in (
                'pending_verification',
                'verified',
                'in_progress',
                'forwarded',
                'resolved',
                'rejected'
            )
        );

alter table public.conversation_messages
    add column external_message_id text;

create unique index conversation_messages_external_message_id_key
    on public.conversation_messages(external_message_id)
    where external_message_id is not null;

create index idx_administrative_units_parent_id
    on public.administrative_units(parent_id);

create index idx_conversation_sessions_citizen_id
    on public.conversation_sessions(citizen_id);

create index idx_routing_rules_category_id
    on public.routing_rules(category_id);

create index idx_routing_rules_target_unit_id
    on public.routing_rules(target_unit_id);

commit;
