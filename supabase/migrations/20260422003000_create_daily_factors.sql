create type public.daily_feeling as enum (
  'good_productive',
  'neutral',
  'bad'
);

create table if not exists public.daily_factors (
  day date primary key,
  slept_or_napped boolean not null default false,
  had_alcohol boolean not null default false,
  feeling public.daily_feeling not null default 'neutral',
  created_at timestamptz not null default now()
);

