# Card 02: Entry Form

Status: done

## Objective

Create a simple form for entering a blood pressure reading.

## Scope

- `systolic`
- `diastolic`
- `measured_at`
- Save the entry to Supabase

## Acceptance Criteria

- The user can enter systolic, diastolic, and measured time
- The form saves the reading to Supabase
- The form stays simple and fast to use
- The form is implemented on the home page
- The implementation resets the form after a successful save

## Notes

- Implemented in [`app/page.tsx`](../../../app/page.tsx)
- Uses the existing Supabase browser client helper
- Avoid extra validation or optional fields unless they are clearly necessary
