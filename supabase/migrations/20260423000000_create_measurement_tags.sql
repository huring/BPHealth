create extension if not exists pgcrypto;

create table if not exists public.measurement_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists measurement_tags_name_normalized_idx
  on public.measurement_tags (lower(trim(name)));

create index if not exists measurement_tags_created_at_idx
  on public.measurement_tags (created_at desc);

create table if not exists public.measurement_tag_assignments (
  measurement_id uuid not null references public.blood_pressure_readings (id) on delete cascade,
  tag_id uuid not null references public.measurement_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (measurement_id, tag_id)
);

create index if not exists measurement_tag_assignments_tag_id_idx
  on public.measurement_tag_assignments (tag_id);

create index if not exists measurement_tag_assignments_measurement_id_idx
  on public.measurement_tag_assignments (measurement_id);
