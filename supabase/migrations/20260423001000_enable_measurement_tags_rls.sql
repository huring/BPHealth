alter table public.measurement_tags enable row level security;
alter table public.measurement_tag_assignments enable row level security;

create policy "Allow anon select measurement tags"
  on public.measurement_tags
  for select
  to anon
  using (true);

create policy "Allow anon insert measurement tags"
  on public.measurement_tags
  for insert
  to anon
  with check (true);

create policy "Allow anon select measurement tag assignments"
  on public.measurement_tag_assignments
  for select
  to anon
  using (true);

create policy "Allow anon insert measurement tag assignments"
  on public.measurement_tag_assignments
  for insert
  to anon
  with check (true);

create policy "Allow anon delete measurement tag assignments"
  on public.measurement_tag_assignments
  for delete
  to anon
  using (true);
