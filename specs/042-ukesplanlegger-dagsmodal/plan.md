# Implementation Plan: Ukesplanlegger — dagsmodal og mobilforbedringer

## Approach

Backend first, then the shared frontend helper, then the modal, then the cell rework — so each layer is green before the next depends on it.

1. **Widen the PATCH endpoint.** Make `MoveMealPlanRequest` fields optional and turn `MoveMealPlan` into a partial update with guards for the custom-entry invariant. Backend tests land in the same task so the contract is pinned before any UI calls it.
2. **Update the service layer.** Replace `moveMealPlan` with `updateMealPlan(groupId, entryId, changes, token)` and repoint the existing move call sites at it. Purely mechanical; keeps the frontend compiling.
3. **Extract `entryDisplay.ts`.** Pull the ~20 lines of icon/logo/title/side-dish resolution out of `DayCell.tsx:118-138` plus the `nb-NO` date label from `CustomCardModal.tsx:11-13` into one module. Done before the modal exists so the modal consumes it rather than copying it.
4. **Build `DayDetailModal`.** Entry list, per-entry actions, inline move and note sub-states, add footer, accessibility. Wired into `UkesplanleggerClient` in the same task so it is reachable and verifiable.
5. **Rework `DayCell`.** Chips, `+N` overflow, remove the two hover-only buttons and their now-dead props. Last because the modal must already provide delete and add-custom before they are removed from the cell — otherwise the app is briefly missing those actions.
6. **Update and extend the Playwright specs**, then run the full inner loop on both stacks.

## Stacks Affected

- [x] Frontend — new modal + shared helper, `DayCell`/`WeekCalendar`/`UkesplanleggerClient` rework, service method rename, e2e specs
- [x] Backend — `MealPlansController.MoveMealPlan` widened to a partial update, plus xUnit coverage
- [ ] Infrastructure — no Bicep, container, or Key Vault change; the endpoint and schema are unchanged in shape

## Key Decisions

**Date picker instead of touch drag-and-drop.** Porting the planner from HTML5 DnD to `@dnd-kit` would touch every drag path, and dragging inside a ~43px-wide mobile column is fiddly even when it works. A native `<input type="date">` costs nothing, brings the correct OS keyboard, is accessible by default, and reuses the existing PATCH call unchanged. `@dnd-kit` is already a dependency (used in `RecipeForm` and `KanbanBoard`) so this is a deliberate choice, not a dependency constraint.

**Modal on all breakpoints, sidebar retained.** Making the modal mobile-only would leave two divergent interaction models to maintain. Making it replace the desktop sidebar would regress a working flow. Opening it everywhere while leaving the sidebar and desktop DnD untouched gives one consistent path in without taking anything away.

**Chip tap opens the day modal, not the preview.** A chip in a 43px column is too small to demand a precise tap on a specific target. Routing every tap on the cell to the day modal makes the whole cell one large target; the preview is still one tap away via `Åpne`.

**No `Note` column.** Notes on recipe and matkasse entries would need a new nullable column and a migration. Editing an existing custom card's note covers the reported need and keeps this feature migration-free.

**Reject `customTitle` on non-custom entries rather than silently ignoring it.** Create-time already enforces exactly one of `recipeId`/`matkasseRecipeId`/`customTitle` (`MealPlansController.cs:120-126`). A `400` keeps PATCH honest about the same invariant instead of letting a client half-convert a recipe entry into an ambiguous row.

## Risks

**Removing the hover-only delete button regresses desktop.** Desktop users lose the one-hover `×` on a day cell and must open the modal to delete. Mitigation: the modal opens on a single click, and delete is a first-class button in it — one extra click, in exchange for the action existing at all on touch. Ordering task 5 after task 4 guarantees the replacement ships first.

**The `+N` cap could hide entries with no obvious way to see them.** Mitigation: the whole cell is tappable and the modal lists every entry unconditionally; the `+N` indicator is the affordance pointing at it.

**Prop removal from `DayCell` ripples through `WeekCalendar`.** `onDeleteEntry` and `onAddCustomCard` are threaded from `UkesplanleggerClient` through `WeekCalendar` into `DayCell`. Mitigation: `npx tsc --noEmit` catches every stale reference; the handlers themselves stay in the client because the modal now calls them.

**Existing e2e specs assert the old tap-opens-picker behaviour.** `ukesplanlegger-mobile.spec.ts` has two tests asserting `heading "Velg oppskrift"` appears on a day tap. Mitigation: update both in the same task as the behaviour change, routing through the modal's `+ Legg til oppskrift`.
