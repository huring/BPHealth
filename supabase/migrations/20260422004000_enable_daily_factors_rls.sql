alter table public.daily_factors enable row level security;

create policy "Allow anon select daily factors"
  on public.daily_factors
  for select
  to anon
  using (true);

create policy "Allow anon insert daily factors"
  on public.daily_factors
  for insert
  to anon
  with check (true);

create policy "Allow anon update daily factors"
  on public.daily_factors
  for update
  to anon
  using (true)
  with check (true);

