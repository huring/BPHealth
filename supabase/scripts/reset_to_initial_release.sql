-- Reset public data to an empty initial-release state.
-- Run this only when you want to clear all app data and start fresh.

begin;

truncate table
  public.measurement_tag_assignments,
  public.blood_pressure_readings,
  public.measurement_tags
restart identity cascade;

insert into public.measurement_tags (name)
values
  ('morning'),
  ('lunch'),
  ('evening')
on conflict do nothing;

commit;
