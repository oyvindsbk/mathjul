# Feature: Bug Reporter & Dual Card Types

## Summary

A floating bug-icon button (bottom-right of every page) lets users capture a screenshot snip or write a text description, which is then submitted directly as a **Bug** card on the Feature Planner kanban board. The Feature Planner gains a `cardType` field (`Feature` | `Bug`) that controls card appearance and form fields.

## Motivation

The app has no quick way to report bugs. Developers need to switch to the planner, open a form, and manually describe the issue. A one-click bug reporter with optional screen capture reduces friction and captures more context about bugs.

## Requirements

### Card type support
- `FeatureCard` entity gets a new `CardType` field (`Feature` | `Bug`), stored as a string enum in the DB.
- Existing cards default to `Feature`.
- Both the backend DTO and frontend service model expose `cardType`.
- Kanban cards display a visual badge/indicator for type (blue = Feature, red = Bug).

### Bug reporter widget
- A floating circular button with a bug icon (`🐛`) appears in the bottom-right corner of **every page** (rendered in the root layout).
- Clicking it opens a **Bug Reporter modal** with two options:
  - **Snip screenshot:** user drags a rectangle over the page to capture a region; the selection is rendered to a canvas using `html2canvas` and shown as a preview image.
  - **Write text:** a plain textarea for describing the issue without a screenshot.
- The modal has:
  - A title field (required, pre-filled with "Bug: " prefix as a hint).
  - A description textarea (required).
  - An optional screenshot preview (if snip was taken), stored as a base64 data URL in the `uiSketch` field.
  - A column selector (dropdown listing current board columns, defaulting to the first column).
  - Submit button that calls `POST /api/feature-board/cards` with `cardType: "Bug"`.
- The snipping overlay:
  - Covers the whole viewport with a semi-transparent dark backdrop.
  - Cursor changes to crosshair.
  - User click-drags to define a rectangle; on mouse-up the selection is captured.
  - A highlighted selection box is shown during drag.
  - After capture, the overlay closes and the modal shows the preview.

### Feature Planner form
- `CardFormModal` gains a `cardType` toggle (Feature / Bug) at the top.
- Bug cards show a simplified form: title, description (summary), and steps to reproduce (requirements) — the technical section is hidden by default.
- Feature cards keep the existing full form.

### Visual differentiation on the board
- Feature cards: existing blue accent.
- Bug cards: red accent (left border or badge).

## Design

### Data Model

`FeatureCard` — add field:
```
CardType: string  // "Feature" | "Bug", default "Feature"
```

DB migration required.

### API Changes

`FeatureCardDto`, `CreateCardRequest`, `UpdateCardRequest` — add `CardType` (string, optional on update, default `"Feature"` on create).

No new endpoints.

### UI Changes

- Root [layout.tsx](frontend/src/app/layout.tsx): render `<BugReporter />` component (client component wrapper).
- New `frontend/src/components/BugReporter.tsx`: floating button + modal + snipping overlay.
- `frontend/src/lib/services/feature-planner.service.ts`: add `cardType` to all interfaces.
- `frontend/src/app/feature-planner/CardFormModal.tsx`: add card type toggle.
- `frontend/src/app/feature-planner/KanbanBoard.tsx` (or card component): visual type indicator.

## Out of Scope

- Uploading screenshots to blob storage — base64 data URL in `uiSketch` is sufficient for now.
- AI-assisted bug analysis.
- Bug-specific columns (user manages columns manually).
- Email/Slack notifications for new bugs.

## Open Questions

- None — all decisions made above.
