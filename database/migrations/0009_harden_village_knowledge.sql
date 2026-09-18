begin;

alter table public.village_profiles enable row level security;
alter table public.knowledge_templates enable row level security;
alter table public.knowledge_analytics enable row level security;

revoke all on table public.village_profiles from anon, authenticated;
revoke all on table public.knowledge_templates from anon, authenticated;
revoke all on table public.knowledge_analytics from anon, authenticated;

-- These seeded rows contain village-specific operational facts that have not
-- been approved by an administrator. Keep only fact-free authoring templates.
delete from public.knowledge_templates
where name in (
    'SOP Surat Keterangan',
    'SOP Surat Pengantar RT/RW',
    'FAQ Layanan Desa'
);

update public.knowledge_templates
set template_content = replace(template_content, '##联络信息', '## Kontak')
where name = 'Struktur Organisasi Desa';

alter function public.update_updated_at() set search_path = pg_catalog;
revoke all on function public.update_updated_at() from public, anon, authenticated;

commit;
