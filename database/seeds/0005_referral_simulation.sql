begin;

-- Synthetic M1 fixtures only. They never represent a real government endpoint.
insert into public.administrative_units (id, name, level, metadata, is_active)
values
    (
        '00000000-0000-4000-8000-0000000000a1',
        'DESA_UJI_A',
        'village',
        '{"synthetic":true,"approved_for_production":false}'::jsonb,
        true
    ),
    (
        '00000000-0000-4000-8000-0000000000b1',
        'DESA_UJI_B',
        'village',
        '{"synthetic":true,"approved_for_production":false}'::jsonb,
        true
    ),
    (
        '00000000-0000-4000-8000-0000000000c1',
        'INSTANSI_UJI_REFERRAL',
        'agency',
        '{"synthetic":true,"approved_for_production":false}'::jsonb,
        true
    )
on conflict (id) do nothing;

insert into public.agency_channels (
    id,
    target_unit_id,
    source_unit_id,
    channel_code,
    display_name,
    mode,
    supported_categories,
    capabilities,
    authority_source,
    config,
    synthetic,
    approved_for_production
)
values
    (
        '10000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000c1',
        '00000000-0000-4000-8000-0000000000a1',
        'mock-desa-a',
        'Kanal Mock Desa A',
        'mock',
        '["infrastructure","public_facility"]'::jsonb,
        '{"submit":true,"idempotency":true,"lookup":true,"status_polling":false}'::jsonb,
        '{"title":"Sumber simulasi M1","reviewed_at":"2026-09-21","synthetic":true}'::jsonb,
        '{"scenario":"accepted"}'::jsonb,
        true,
        false
    ),
    (
        '10000000-0000-4000-8000-0000000000b1',
        '00000000-0000-4000-8000-0000000000c1',
        '00000000-0000-4000-8000-0000000000b1',
        'mock-desa-b',
        'Kanal Mock Desa B',
        'mock',
        '["infrastructure","public_facility"]'::jsonb,
        '{"submit":true,"idempotency":true,"lookup":true,"status_polling":false}'::jsonb,
        '{"title":"Sumber simulasi M1","reviewed_at":"2026-09-21","synthetic":true}'::jsonb,
        '{"scenario":"timeout_after_accept"}'::jsonb,
        true,
        false
    )
on conflict (id) do update
set config = excluded.config,
    supported_categories = excluded.supported_categories,
    is_active = true,
    synthetic = true,
    approved_for_production = false;

commit;
