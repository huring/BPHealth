# Card 01: Schema

Status: done

## Objective

Define the Supabase table for storing blood pressure readings.

## Scope

- `public.blood_pressure_readings`
- `id` uuid primary key
- `measured_at` timestamptz not null
- `systolic` integer not null
- `diastolic` integer not null
- `created_at` timestamptz not null default `now()`

## Acceptance Criteria

- The table has the fields needed to store a single blood pressure reading
- The schema is simple enough to support fast implementation
- The schema supports ordering by time for history and chart views
- The schema is implemented in a Supabase migration
- The implementation includes a simple index on `measured_at`

## Notes

- Implemented in [`supabase/migrations/20260422000000_create_blood_pressure_readings.sql`](../../../supabase/migrations/20260422000000_create_blood_pressure_readings.sql)
- Kept intentionally minimal for v1
