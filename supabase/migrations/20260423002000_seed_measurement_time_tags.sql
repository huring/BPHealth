insert into public.measurement_tags (name)
select tag_name
from (values ('morning'), ('lunch'), ('evening')) as system_tags(tag_name)
where not exists (
  select 1
  from public.measurement_tags
  where lower(trim(public.measurement_tags.name)) = lower(trim(system_tags.tag_name))
);
