begin;

-- Stable identifiers keep the demo seed deterministic across environments.
insert into public.administrative_units (
    id,
    name,
    level,
    parent_id,
    metadata,
    is_active
)
values (
    '00000000-0000-4000-8000-000000000001',
    'Kecamatan Sukamakmur',
    'subdistrict',
    null,
    '{"demo": true}'::jsonb,
    true
)
on conflict (id) do update
set
    name = excluded.name,
    level = excluded.level,
    parent_id = excluded.parent_id,
    metadata = excluded.metadata,
    is_active = excluded.is_active
where (
    administrative_units.name,
    administrative_units.level,
    administrative_units.parent_id,
    administrative_units.metadata,
    administrative_units.is_active
) is distinct from (
    excluded.name,
    excluded.level,
    excluded.parent_id,
    excluded.metadata,
    excluded.is_active
);

insert into public.administrative_units (
    id,
    name,
    level,
    parent_id,
    metadata,
    is_active
)
values (
    '00000000-0000-4000-8000-000000000002',
    'Desa Sukamaju',
    'village',
    '00000000-0000-4000-8000-000000000001',
    '{"demo": true}'::jsonb,
    true
)
on conflict (id) do update
set
    name = excluded.name,
    level = excluded.level,
    parent_id = excluded.parent_id,
    metadata = excluded.metadata,
    is_active = excluded.is_active
where (
    administrative_units.name,
    administrative_units.level,
    administrative_units.parent_id,
    administrative_units.metadata,
    administrative_units.is_active
) is distinct from (
    excluded.name,
    excluded.level,
    excluded.parent_id,
    excluded.metadata,
    excluded.is_active
);

commit;
