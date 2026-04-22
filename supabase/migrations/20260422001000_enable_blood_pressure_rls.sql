alter table public.blood_pressure_readings enable row level security;

create policy "Allow anon select blood pressure readings"
  on public.blood_pressure_readings
  for select
  to anon
  using (true);

create policy "Allow anon insert blood pressure readings"
  on public.blood_pressure_readings
  for insert
  to anon
  with check (true);

