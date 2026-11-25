# Implementation Plan: Notater – projects, colors and a OneNote-style sidebar

## Approach
Do the cheap UI fixes first, then the rename end to end (backend, migration, frontend, tests) as one commit so the app works at every commit, then colors on top of the renamed model, then the sidebar, which needs no backend change.

## Stacks Affected
- [x] Frontend (`frontend-notes`)
- [x] Backend (`backend/NotesApi`, `backend/NotesApi.Tests`)
- [ ] Infrastructure

## Key Decisions
- **Full rename, not just labels:** keeps one word in code, API and UI. The migration uses `RenameTable`/`RenameColumn`/`RenameIndex` only, so it's data-safe. Hand-check the generated migration: EF sometimes emits drop+create for renamed entities; rewrite it as renames if so.
- **Entity name `Project`:** no clash with EF's `DbContext` anymore, so the `WorkContext` workaround goes away.
- **Color as a palette key, not hex:** the frontend owns the actual light/dark values, so dark mode stays readable and the palette can be tuned without a migration. Backend validates against the same 10 keys (`ProjectColors.All`).
- **`ClearColor` flag** in PATCH: distinguishes "remove color" from "not sent" without custom JSON handling.
- **Sidebar reuses `GET api/weeks/{week}`** lazily per expanded week: no new endpoint, and 8 weeks collapsed cost 1–2 requests on load.
- **`NotesShell` client component** owns sidebar state (open on mobile, refresh signal). Pages stay server components that render inside it.
- **Cursor via one global CSS rule** in `@layer base`, so Tailwind utilities can still override it.

## Risks
- **Migration on prod renames a live table:** deploy-notes runs the migration before the new API starts; old API pods referencing `Contexts` fail for the seconds between. Acceptable for a single-user app; note it in the PR.
- **EF generates drop/create instead of rename:** inspect the migration; rewrite by hand. Add a test that items keep their `ProjectId` is not possible against SQLite/InMemory history — verify by running the migration locally against Aspire's SQL with existing data.
- **Sidebar + DayEditor both fetching:** the refresh context only reloads the affected week, debounced by the existing `onChanged` granularity.
- **Mobile overlay focus:** close on Escape and on navigation; keep it simple.
