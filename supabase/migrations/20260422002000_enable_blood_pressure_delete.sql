create policy "Allow anon delete blood pressure readings"
  on public.blood_pressure_readings
  for delete
  to anon
  using (true);

