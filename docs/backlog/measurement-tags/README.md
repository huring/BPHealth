# Measurement Tags

## Feature Goal
Replace the current fixed daily factors with a flexible tagging system that can be attached to each blood pressure measurement.

## Why Tags Are Better Than Fixed Inputs
- Tags are reusable instead of being locked to a small set of predefined options.
- Tags can describe more real-world context, like exercise, stress, sex, or a nap, without changing the schema every time.
- Tags stay lightweight and mobile-friendly because the user can add only what matters for a given measurement.
- Tags make future filtering and averages more useful because the app can group measurements by combinations of context.

## Examples Of Usage
- Average BP on days with alcohol
- Average BP when nap + good feeling
- Average BP when exercise + stress

## Scope Note
Tags are scoped to the daily context around a measurement, not long-term states. They describe what was happening around that reading within roughly a 24-hour window.

## V1 Scope
- Flexible tag data model
- Reusable tag creation
- Fast tag selection UI
- Tags attached to measurements
- Automatic time-of-day tags
- Future-ready filtering and averages

## Out Of Scope
- Rich analytics dashboards
- Complex tag hierarchies
- Nested tags or tag groups
- Long-term behavior tracking
- Advanced rule engines

## Card Order
1. Data model
2. Tag creation and reuse
3. Tag selection UI
4. Measurement integration
5. Automatic tags
6. Future filtering and averages
