# Card 01: Data Model

## Objective
Define how tags are stored and linked to measurements.

## Scope
- Tag entity with `id`, `name`, and `created_at`
- Measurement-to-tags relationship
- Keep the schema minimal and flexible

## Acceptance Criteria
- Supports multiple tags per measurement
- Supports reuse of tags
- Simple to query later

## Notes
- Keep the model lightweight so future filtering and averages stay straightforward.
