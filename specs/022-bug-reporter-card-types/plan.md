# Implementation Plan: Bug Reporter & Dual Card Types

## Approach

Work backend-first (schema → API → service) then frontend (service model → card UI → form → bug reporter widget). Each task is independently verifiable with the inner loop.

The screenshot capture uses `html2canvas` (npm package) — it renders the visible DOM to a canvas which we then crop to the user's selection rectangle and export as a base64 PNG data URL. This is stored in the existing `uiSketch` field to avoid any schema additions beyond `CardType`.

The snipping overlay is a pure React component that listens for `mousedown`/`mousemove`/`mouseup` on a full-screen fixed div. After `mouseup` it calls `html2canvas` on `document.body`, draws the crop rectangle onto an offscreen canvas, and resolves with a data URL.

## Stacks Affected

- [x] Backend (add `CardType` to entity, DTO, requests; EF migration)
- [x] Frontend (service types, form, board UI, new BugReporter component)
- [ ] Infrastructure (no changes)

## Key Decisions

- **`cardType` as string enum in DB:** simple, avoids integer-to-meaning mapping; `"Feature"` and `"Bug"` are the only values.
- **Store screenshot in `uiSketch`:** reuses existing field, no schema additions. The field is already a freeform text area so a data URL fits without breaking anything.
- **`html2canvas` for capture:** works on same-origin DOM. No external service or browser permission required. The app is self-contained so cross-origin issues won't arise.
- **BugReporter in layout:** makes it available on every page without per-page wiring. Uses `useAuth` to pass the token to the service.
- **Bug form is simplified:** bugs don't need motivation/out-of-scope/tech fields — they need a description and steps to reproduce. Reduces noise.

## Risks

- **`html2canvas` rendering fidelity:** Tailwind CSS-in-JS and dynamic styles render correctly in most cases. If a component uses canvas or WebGL it won't capture. Acceptable for this app.
- **Data URL size in `uiSketch`:** a cropped screenshot at typical resolution is 50–200 KB as base64. The DB column is `nvarchar(max)` so no truncation. Acceptable.
