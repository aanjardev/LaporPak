-- Production provisioning template. Replace variables with real identifiers.
-- No active placeholder account is inserted by this seed.
-- \set auth_user_id 'real-supabase-auth-uuid'
-- \set unit_id 'real-administrative-unit-uuid'
-- \set whatsapp_account_id 'real-whatsapp-phone-number-id'

-- insert into public.admin_accounts (auth_user_id, role, display_name)
-- values (:'auth_user_id', 'village_admin', 'Admin Desa')
-- on conflict (auth_user_id) do update
-- set role=excluded.role, display_name=excluded.display_name, is_active=true;

-- insert into public.admin_unit_memberships (admin_account_id, administrative_unit_id)
-- select id, :'unit_id' from public.admin_accounts where auth_user_id=:'auth_user_id'
-- on conflict do nothing;

-- insert into public.channel_integrations (channel, external_account_id, administrative_unit_id)
-- values ('whatsapp', :'whatsapp_account_id', :'unit_id')
-- on conflict (channel, external_account_id) do update
-- set administrative_unit_id=excluded.administrative_unit_id, is_active=true;
