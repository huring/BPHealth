# Card 01: Chart Range Geometry

## Objective
Replace the current line chart geometry with a vertical range chart structure.

## Scope
- Render one vertical range bar per reading
- Use systolic as the top endpoint
- Use diastolic as the bottom endpoint
- Keep endpoint markers for both values
- Keep the existing time-based x-axis

## Acceptance Criteria
- The chart no longer connects readings with line paths
- Each reading is shown as a vertical high-low bar
- The chart still works with the current data model
- The chart remains readable on mobile

## Notes
- The range bars should feel slightly pill-like rather than thin lines
- Keep the existing purple and blue endpoints

