# Card 06: Future Filtering And Averages

Status: done

## Objective
Create feature documentation for future filtering and define how tags will be used for insights later.

## Scope
- Filtering measurements by one or more tags
- Calculating averages based on tag combinations
- Examples:
  - Average BP when alcohol tag is present
  - Average BP when nap + other tags are present

## Acceptance Criteria
- Data model supports filtering by one or more tags
- Averages update from the filtered measurement set
- Logic stays simple and extensible

## Notes
- Implemented in [`app/page.tsx`](../../../app/page.tsx)
