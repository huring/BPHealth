# Technical Decisions

- Frontend hosted on Vercel
- Backend and data layer built with Supabase
- The app is cloud-first so it is accessible everywhere
- Keep the architecture minimal
- No authentication in v1 unless Supabase setup requires it
- Optimize for fast iteration, not perfect architecture
- The blood pressure table uses simple anon select/insert/delete policies in v1 so the app can work without auth
- When a feature is merged to `main`, move its docs from `docs/backlog/` to `docs/completed/`
- The daily factors table uses simple anon select/insert/update policies in v1 so the app can save one row per day without auth

## Blood Pressure Card Status

- [x] Card 01: Schema
- [x] Card 02: Entry Form
- [x] Card 03: History List
- [x] Card 04: Chart

## Daily Factors Card Status

- [x] Card 01: Schema
- [x] Card 02: Input UI
- [x] Card 03: Edit Update

## Design Polish Card Status

- [x] Card 01: Mobile First Layout
- [x] Card 02: Input UX Reduction
- [x] Card 03: Visual Style Dark Mode
- [x] Card 04: Dashboard Polish

Update this list when a card is implemented and committed.
