# BP Range Chart

## Feature Goal
Rework the blood pressure chart from a line chart into a premium range chart, also known as a hi-low chart, while keeping the existing dark visual style, colors, and mobile-friendly feel.

## Why This Matters
Blood pressure readings are naturally range-based. Showing systolic and diastolic as a vertical range per reading makes the data easier to scan and feels more appropriate for BP than a connected line chart.

## What Changes Vs The Current Chart
- Replace connected line paths with vertical range bars
- Keep systolic and diastolic as separate endpoints
- Keep the same purple and blue color system
- Keep the current dark styling and compact mobile layout

## Principles
- Readability first
- Minimal clutter
- Premium but simple visual treatment
- Keep the current chart feel, only change the data visualization

## V1 Scope
- [x] Vertical range bars for each reading
- [x] Pill-like body for each range
- [x] Keep endpoint markers for systolic and diastolic
- [x] Keep selected-state behavior
- [x] Keep the current range selector and time filtering

## Card Status
- [x] Card 01: Chart Range Geometry
- [x] Card 02: Selection and Interaction
- [ ] Card 03: Axis Density and Spacing
- [ ] Card 04: Visual Polish

## Out Of Scope
- New analytics
- New dashboard layout
- New color palette
- New chart interactions beyond the current selection behavior
- Reworking unrelated app screens

## Card Order
1. Chart range geometry
2. Selection and interaction behavior
3. Axis density and spacing tuning
4. Visual polish and edge cases
