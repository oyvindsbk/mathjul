# Feature: Ukesplanlegger — dagsmodal og mobilforbedringer

## Summary

Tapping a day in the weekly planner opens a day detail modal listing that day's meals with real touch targets — open, move, edit note, delete — plus buttons to add a recipe or a custom card. Day cells render entries as compact chips with a `+N` overflow indicator. Desktop keeps its sidebar and drag-and-drop unchanged.

## Motivation

The planner works on desktop but breaks down on a phone. Four concrete failures, all verified in code:

1. **No way to see or manage a day.** Tapping a day cell goes straight to the recipe picker (`UkesplanleggerClient.tsx:270-274`). There is no step in between, so on mobile you cannot read what is already planned, see a note, or act on an existing entry.
2. **Delete and add-custom are invisible on touch.** The `×` delete button (`DayCell.tsx:190-200`) and the `✏️` add-custom button (`DayCell.tsx:100-112`) are both `hidden group-hover:flex`. A touch device never hovers, so neither action exists on a phone.
3. **Entries cannot be moved on mobile.** The planner uses raw HTML5 drag-and-drop (`DayCell.tsx:143-149`, `WeekCalendar.tsx:127-144`), which does not fire on touch. Deferred deliberately in `specs/020-ukesplanlegger-forbedringer/spec.md:113`.
4. **Notes on existing entries can never be edited.** `PATCH /api/groups/{groupId}/mealplans/{entryId}` accepts only `date` (`MealPlansController.cs:186-232`), so `CustomNote` is write-once at create time.

## Requirements

- **R1** Tapping or clicking a day cell opens a day detail modal at every breakpoint.
- **R2** The modal lists every entry for that day with its icon/logo, title, side dishes, and note.
- **R3** Each entry offers: `Åpne` (recipe preview), `Flytt` (move to another date), `Slett` (delete). `Notat` is offered on custom cards only.
- **R4** Moving uses a native date input, not drag-and-drop. Touch DnD stays out of scope.
- **R5** A custom card's title and note can be edited after creation.
- **R6** The modal footer offers `+ Legg til oppskrift` and `+ Legg til eget kort`, both hidden for past days.
- **R7** All action targets are at least 44×44px and never hover-gated.
- **R8** Day cells show entries as compact chips, capped at 2 on mobile / 3 on `lg+`, with a `+N` indicator for the remainder.
- **R9** Desktop behaviour is preserved: sidebar picker, drag from sidebar to a day, drag an entry between days, right-click on the week gutter for the AI menu.
- **R10** The grid must not scroll horizontally at 375px — the `lg:min-w-[700px]` floor stays `lg`-only.
- **R11** The meal-type filter continues not to filter the grid (`WeekCalendar.tsx:96` — intentional).

## Design

### Data Model

No schema changes. No EF migration. `MealPlan` keeps its existing columns; `CustomTitle`/`CustomNote` simply become updatable.

### API Changes

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/api/groups/{groupId}/mealplans/{entryId}` | Widened from date-only move to a partial update. `date`, `customTitle`, and `customNote` are all optional; only supplied fields change. |

Request body:

```json
{ "date": "2026-08-19", "customTitle": "Rester", "customNote": "fra søndag" }
```

Guards, preserving the exactly-one-of-three source invariant enforced at create (`MealPlansController.cs:120-126`):

- `customTitle`/`customNote` on a **non-custom** entry → `400`. A recipe entry must not acquire a `CustomTitle` and become ambiguous.
- Blank/whitespace `customTitle` on a custom entry → `400`. It is the discriminator; blanking it would orphan the row.
- Blank `customNote` → stored as `null`.
- Malformed `date` → `400`. Omitted `date` leaves the date untouched.
- Authorization unchanged: `GetCallerEmail()` → `IsGroupMemberAsync` → `403`.

### UI Changes

| File | Responsibility |
|---|---|
| `components/ukesplanlegger/DayDetailModal.tsx` | **New.** The day detail modal: entry list, per-entry actions, inline move/note sub-states, add footer. |
| `components/ukesplanlegger/entryDisplay.ts` | **New.** Shared `resolveEntryDisplay(plan)` (icon/logo/title/side dishes) and `formatDateLabel(date)`, consumed by `DayCell` and `DayDetailModal`. |
| `components/ukesplanlegger/DayCell.tsx` | Chips with `+N` overflow; hover-only delete and add-custom buttons removed; chip tap opens the day modal instead of the preview. |
| `components/ukesplanlegger/WeekCalendar.tsx` | Prop pass-through cleanup for the removed `DayCell` props. |
| `app/ukesplanlegger/UkesplanleggerClient.tsx` | `dayModalDate` state, `handleUpdateNote`, rewired `handleDayClick`. |
| `lib/services/mealplan.service.ts` | `moveMealPlan` → `updateMealPlan(groupId, entryId, changes, token)`. |

### Accessibility

`DayDetailModal` gets `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the date heading, Escape-to-close, and initial focus on the close button. The existing modals (`MealPlanPreviewModal`, `CustomCardModal`, `CropModal`, …) have none of this; retrofitting them is out of scope here.

## Out of Scope

- Touch drag-and-drop in the grid (would mean porting the planner from HTML5 DnD to `@dnd-kit`)
- A mobile week/agenda view toggle
- Notes on non-custom entries (needs a new `Note` column and a migration)
- Reordering entries within a day
- Dark mode — the planner is light-only by precedent
- Retrofitting focus-trap/Escape onto the pre-existing modals

## Open Questions

- None — ready to implement.
