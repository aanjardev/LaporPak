begin;

-- Auth UUIDs are public identifiers from this project's Supabase Auth tenant,
-- not passwords or tokens. This seed grants only the intended demo accounts.
insert into public.admin_accounts (auth_user_id, role, display_name, is_active)
values
    ('29b2bc8e-6afe-4368-8298-60390eed0b14', 'village_admin', 'Anjar', true),
    ('debeeae2-1a11-4c42-897d-bfdf8ec9ef07', 'village_admin', 'Ferdi', true),
    ('10a3c757-de6f-4a46-b773-ea99ec0bb656', 'village_admin', 'Ferdi', true)
on conflict (auth_user_id) do update
set role = excluded.role,
    display_name = excluded.display_name,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.admin_unit_memberships (
    admin_account_id,
    administrative_unit_id
)
select
    account.id,
    '00000000-0000-4000-8000-000000000002'::uuid
from public.admin_accounts account
where account.auth_user_id in (
    '29b2bc8e-6afe-4368-8298-60390eed0b14'::uuid,
    'debeeae2-1a11-4c42-897d-bfdf8ec9ef07'::uuid,
    '10a3c757-de6f-4a46-b773-ea99ec0bb656'::uuid
)
on conflict (admin_account_id, administrative_unit_id) do nothing;

-- Trusted OpenClaw WhatsApp account identifier for the shared demo environment.
insert into public.channel_integrations (
    channel,
    external_account_id,
    administrative_unit_id,
    is_active
)
values (
    'whatsapp',
    'default',
    '00000000-0000-4000-8000-000000000002',
    true
)
on conflict (channel, external_account_id) do update
set administrative_unit_id = excluded.administrative_unit_id,
    is_active = excluded.is_active,
    updated_at = now();

commit;
