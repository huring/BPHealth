# Card 07: Offline and Poor Network Behavior

## Objective

Define graceful behavior when network is weak or unavailable.

## Scope

- App shell loading
- Cached static assets
- Basic fallback behavior
- What should and should not work offline

## Acceptance Criteria

- The app remains usable enough in weak network conditions
- Behavior is predictable and simple
- There is no overengineered offline sync system

## Notes

- Cache the last known readings and daily factors locally for read-only fallback
- Block writes when offline and explain why
- Focus on resilience, not full offline complexity
