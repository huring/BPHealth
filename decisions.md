# Technical Decisions

- Frontend hosted on Vercel
- Backend and data layer built with Supabase
- The app is cloud-first so it is accessible everywhere
- Keep the architecture minimal
- No authentication in v1 unless Supabase setup requires it
- Optimize for fast iteration, not perfect architecture
- The blood pressure table uses simple anon select/insert policies in v1 so the app can write without auth

## Blood Pressure Card Status

- [x] Card 01: Schema
- [x] Card 02: Entry Form
- [x] Card 03: History List
- [x] Card 04: Chart

Update this list when a card is implemented and committed.
