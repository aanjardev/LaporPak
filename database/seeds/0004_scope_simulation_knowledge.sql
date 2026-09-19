-- Scope legacy simulation fixtures only when the environment has one active
-- channel unit. Multi-village environments require an explicit owner mapping.
with sole_active_unit as (
    select min(administrative_unit_id::text)::uuid as administrative_unit_id
    from public.channel_integrations
    where is_active
    having count(distinct administrative_unit_id) = 1
)
update public.knowledge_documents as document
set administrative_unit_id = unit.administrative_unit_id
from sole_active_unit as unit
where document.administrative_unit_id is null
  and document.metadata->>'simulation' = 'true';
