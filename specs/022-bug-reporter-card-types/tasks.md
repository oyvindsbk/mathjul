# Tasks: Bug Reporter & Dual Card Types

## Tasks

- [ ] Task 1: Add `CardType` to backend entity, DTOs, requests, and EF migration
  - Add `CardType` string property to `FeatureCard` entity (default `"Feature"`)
  - Add `CardType` to `FeatureCardDto`, `CreateCardRequest`, `UpdateCardRequest`
  - Update `MapCardToDto` and `CreateCard`/`UpdateCard` controller methods
  - Add EF Core migration
  - Verify: `dotnet build` + `dotnet test`

- [ ] Task 2: Expose `cardType` in frontend service and types
  - Add `cardType: 'Feature' | 'Bug'` to `FeatureCardData`, `CreateCardPayload`, `UpdateCardPayload`
  - Add `cardType` to `GeneratedPrd` (always `'Feature'`)
  - Verify: `tsc --noEmit`

- [ ] Task 3: Visual card type indicator on the Kanban board
  - In the card component (KanbanBoard), show a small badge or coloured left border for Bug cards (red) vs Feature cards (blue/default)
  - Verify: `lint` + `tsc --noEmit` + `build`

- [ ] Task 4: Add card type toggle to `CardFormModal`
  - Add a Feature / Bug toggle at the top of the manual form
  - When Bug is selected: show simplified fields (title, summary as "Beskrivelse", requirements as "Steg for å reprodusere"), hide motivation/out-of-scope/open-questions/technical section
  - `cardType` is included in `handleSave` payload
  - Verify: `lint` + `tsc --noEmit` + `build`

- [ ] Task 5: Install `html2canvas` and build `BugReporter` component
  - `npm install html2canvas @types/html2canvas` in `frontend/`
  - Create `frontend/src/components/BugReporter.tsx`:
    - Floating bug button (bottom-right, fixed)
    - Modal with: title input, description textarea, optional screenshot preview, column selector, submit
    - Snipping overlay: full-screen fixed div, crosshair cursor, drag-to-select rectangle, on mouseup → html2canvas crop → preview
    - On submit: call `featurePlannerService.createCard` with `cardType: 'Bug'`; fetch board columns on open
  - Verify: `lint` + `tsc --noEmit` + `build`

- [ ] Task 6: Mount `BugReporter` in root layout
  - Add `<BugReporterButton />` (a thin client-component wrapper) to `frontend/src/app/layout.tsx`
  - Verify: `lint` + `tsc --noEmit` + `build`
