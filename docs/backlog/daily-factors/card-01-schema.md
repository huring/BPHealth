# Card 01: Schema

Status: done

## Objective

Define the storage model for daily factors.

## Scope

- `public.daily_factors`
- One row per day keyed by `day`
- `day` date primary key
- `slept_or_napped` boolean not null default `false`
- `had_alcohol` boolean not null default `false`
- `feeling` `public.daily_feeling` not null default `neutral`
- `created_at` timestamptz not null default `now()`

## Acceptance Criteria

- The schema can store one set of daily factors per day
- The schema stays minimal and easy to query alongside blood pressure data
- The feeling value is constrained to the allowed set
- The schema is implemented in a Supabase migration

## Notes

- Implemented in [`supabase/migrations/20260422003000_create_daily_factors.sql`](../../../supabase/migrations/20260422003000_create_daily_factors.sql)
- Keep the shape simple so it can support future timeline views
