create extension if not exists pgcrypto;

create table if not exists public.blood_pressure_readings (
  id uuid primary key default gen_random_uuid(),
  measured_at timestamptz not null,
  systolic integer not null check (systolic > 0),
  diastolic integer not null check (diastolic > 0),
  created_at timestamptz not null default now()
);

create index if not exists blood_pressure_readings_measured_at_idx
  on public.blood_pressure_readings (measured_at desc);

