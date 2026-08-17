# Tasks: Ukesplanlegger — dagsmodal og mobilforbedringer

## Tasks

- [x] Task 1: Widen the PATCH endpoint to a partial update. In `backend/RecipeApi/Features/MealPlans/MealPlansController.cs`, make `MoveMealPlanRequest.Date` nullable and add optional `CustomTitle`/`CustomNote`. Rework `MoveMealPlan` to apply only the supplied fields, returning 400 for a malformed `date`, for `customTitle`/`customNote` on a non-custom entry, and for a blank `customTitle` on a custom entry; store a blank `customNote` as null. Leave the route, method name, DTO shape, and the email/membership authorization untouched.
      Verify: `cd backend/RecipeApi && dotnet build`.

- [x] Task 2: Cover the widened PATCH with xUnit tests in `backend/RecipeApi.Tests/`. Cases: date-only move still works; note-only update leaves the date alone; note update on a recipe entry returns 400; blank `customTitle` on a custom entry returns 400; a non-member returns 403.
      Verify: `cd backend/RecipeApi && dotnet build`, `dotnet test`.

- [x] Task 3: Replace `moveMealPlan` with `updateMealPlan` in `frontend/src/lib/services/mealplan.service.ts`, taking a `changes: { date?, customTitle?, customNote? }` object against the same PATCH URL. Repoint the existing move call site in `UkesplanleggerClient.tsx` to pass `{ date }`.
      Verify: `cd frontend && npm run lint`, `npx tsc --noEmit`.

- [x] Task 4: Extract shared display helpers into `frontend/src/components/ukesplanlegger/entryDisplay.ts` — `resolveEntryDisplay(plan)` returning the icon, matkasse logo, title, and side-dish titles currently computed inline at `DayCell.tsx:118-138`, plus `formatDateLabel(date)` from `CustomCardModal.tsx:11-13`. Consume it from both `DayCell.tsx` and `CustomCardModal.tsx` so there is a single source before the modal is written.
      Verify: `cd frontend && npm run lint`, `npx tsc --noEmit`, `npm run build`.

- [x] Task 5: Build `frontend/src/components/ukesplanlegger/DayDetailModal.tsx` and wire it into `UkesplanleggerClient.tsx`. The modal lists the day's entries via `resolveEntryDisplay`, offers `Åpne`/`Flytt`/`Slett` per entry plus `Notat` on custom cards, holds inline `movingEntryId` (native date input) and `editingNoteId` (textarea, maxLength 300) sub-states, and footers `+ Legg til oppskrift` / `+ Legg til eget kort` hidden for past days. Add `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close, and initial focus on the close button. In the client, add `dayModalDate` state and `handleUpdateNote`, and rewire `handleDayClick` to open the modal instead of the picker directly. Add `data-testid="day-detail-modal"` and `data-testid="day-detail-entry"`.
      Verify: `cd frontend && npm run lint`, `npx tsc --noEmit`, `npm run build`.

- [x] Task 6: Rework `DayCell.tsx` for touch. Render entries as compact chips capped at 2 on mobile / 3 on `lg+` with a `+N` indicator for the remainder; remove the hover-only `×` delete and `✏️` add-custom buttons and drop the now-unused `onDeleteEntry`/`onAddCustomCard` props from `DayCellProps` and the `WeekCalendar` pass-through; route a chip tap to the day modal rather than the preview. Keep `draggable`/`onDragStart` and the `draggingRef` click guard so desktop DnD is unchanged, and keep `min-w-0 break-words hyphens-auto` so long Norwegian compounds still wrap.
      Verify: `cd frontend && npm run lint`, `npx tsc --noEmit`, `npm run build`.

- [x] Task 7: Update and extend `frontend/tests/e2e/ukesplanlegger-mobile.spec.ts`. Rewrite the two tests that assert a day tap shows "Velg oppskrift" so they go through the modal's `+ Legg til oppskrift`; keep the no-horizontal-overflow assertion intact. Add coverage for: the modal listing a day's entries, `Slett` removing one, `Flytt` moving an entry to another date, and editing a custom card's note.
      Verify: `cd frontend && npx playwright test ukesplanlegger-mobile`.

- [x] Task 8: Final verification. Run the full inner loop on both stacks, then check the feature in a real browser at 375×667 — day modal opens on tap, action targets are ≥44px, `+N` appears past the cap, a move across a month boundary lands correctly — and confirm the desktop regression set at ≥1024px: sidebar opens, drag from sidebar creates an entry, dragging an entry between days moves it, right-click on the week gutter opens the AI menu.
      Verify: `cd frontend && npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test`; `cd backend/RecipeApi && dotnet build`, `dotnet test`.
