# Card 07: Daily Factors Migration And Cleanup

## Objective
Migrate the app away from `daily_factors` and clean up the old app and database paths once tags are fully in place.

## Scope
- Define how existing `daily_factors` data can be mapped to tags
- Migrate app logic from fixed daily inputs to tag-based measurement context
- Remove `daily_factors` usage from the measurement flow
- Clean up database objects that are no longer needed after cutover

## Acceptance Criteria
- Historical daily factor context can be preserved or translated sensibly
- The app no longer depends on `daily_factors` for new measurements
- Old UI and database paths are removed only after the tags flow is stable
- Cleanup is safe, deliberate, and low-risk

## Notes
- This card should be treated as the final cutover step, not the start of the feature.
- Keep the migration path explicit so the app can run safely during the transition.
