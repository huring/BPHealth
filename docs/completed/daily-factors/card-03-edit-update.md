# Card 03: Edit Update

Status: done

## Objective

Allow updating existing daily factors for a day.

## Scope

- Load an existing day’s factors
- Change the stored values
- Save updates back to the same record

## Acceptance Criteria

- Existing daily factors can be edited
- Updates overwrite the same day’s record
- The interaction stays simple and predictable
- The form loads values for the selected day
- Saving updates the same day’s row

## Notes

- Implemented in [`app/page.tsx`](../../../app/page.tsx)
- Keep this focused on update behavior only, not history or analytics
