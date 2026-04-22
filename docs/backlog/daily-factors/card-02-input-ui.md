# Card 02: Input UI

Status: done

## Objective

Create a simple UI for entering daily factors.

## Scope

- Toggle slept / napped
- Toggle alcohol use
- Select feeling
- Save the daily factors for a day

## Acceptance Criteria

- The user can enter the daily factors quickly
- The UI is easy to scan and use
- The form remains lightweight with minimal steps
- The form saves to Supabase
- The UI is implemented on the main page

## Notes

- Implemented in [`app/page.tsx`](../../../app/page.tsx)
- Uses an upsert against [`supabase/migrations/20260422003000_create_daily_factors.sql`](../../../supabase/migrations/20260422003000_create_daily_factors.sql)
- Favor a compact, low-friction layout
