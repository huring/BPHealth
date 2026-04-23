insert into public.measurement_tags (name)
select tag_name
from (
  values
    ('slept / nap'),
    ('alcohol'),
    ('good feeling'),
    ('neutral feeling'),
    ('bad feeling')
) as seeded_tags(tag_name)
on conflict do nothing;

with daily_factor_rows as (
  select
    day,
    slept_or_napped,
    had_alcohol,
    feeling
  from public.daily_factors
),
factor_tag_names as (
  select day, 'slept / nap'::text as tag_name
  from daily_factor_rows
  where slept_or_napped

  union all

  select day, 'alcohol'::text as tag_name
  from daily_factor_rows
  where had_alcohol

  union all

  select day,
         case feeling
           when 'good_productive' then 'good feeling'
           when 'neutral' then 'neutral feeling'
           when 'bad' then 'bad feeling'
         end as tag_name
  from daily_factor_rows
),
factor_tags as (
  select
    factor_tag_names.day,
    measurement_tags.id as tag_id
  from factor_tag_names
  join public.measurement_tags
    on lower(trim(public.measurement_tags.name)) = lower(trim(factor_tag_names.tag_name))
),
measurement_days as (
  select
    blood_pressure_readings.id as measurement_id,
    blood_pressure_readings.measured_at::date as day
  from public.blood_pressure_readings
),
backfilled_assignments as (
  select
    measurement_days.measurement_id,
    factor_tags.tag_id
  from measurement_days
  join factor_tags
    on factor_tags.day = measurement_days.day
)
insert into public.measurement_tag_assignments (measurement_id, tag_id)
select measurement_id, tag_id
from backfilled_assignments
on conflict do nothing;

drop table if exists public.daily_factors cascade;
drop type if exists public.daily_feeling;
