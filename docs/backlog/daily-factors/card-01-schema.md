# Card 01: Schema

## Objective

Define the storage model for daily factors.

## Scope

- One row per day
- `day` date field
- `slept_or_napped` boolean
- `had_alcohol` boolean
- `feeling` enum or constrained text with:
  - `good_productive`
  - `neutral`
  - `bad`

## Acceptance Criteria

- The schema can store one set of daily factors per day
- The schema stays minimal and easy to query alongside blood pressure data
- The feeling value is constrained to the allowed set

## Notes

- Keep the shape simple so it can support future timeline views

