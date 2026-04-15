# Feature: Ukesplanlegger Forbedringer

## Summary
Significant UX improvements to the weekly meal planner: desktop sidebar for recipe picking, drag-and-drop, multiple meals per day, meal-type filtering (derived from recipe categories), meal type icons, navigable group name, group-page entry point, group selector with URL param persistence, and a per-group toggle to enable/disable the planner.

## Motivation
The meal planner is the primary household-coordination feature. The current modal-based recipe picker is slow and the calendar only supports one recipe per day. Families plan multiple meals (dinner + dessert, lunch + dinner) and want a faster drag-and-drop workflow on desktop.

## Requirements

### Desktop Sidebar (Recipe Picker)
- On desktop (lg breakpoint and up), show a fixed right sidebar containing the recipe picker instead of opening a modal.
- The sidebar contains both the search tab and the spin-the-wheel tab (same content as the current modal).
- Clicking a day cell selects it as the active target; the sidebar stays open.
- On mobile the existing modal behaviour is preserved.

### Drag and Drop
- Recipes in the sidebar can be dragged onto a day cell to add them.
- Dragging an existing meal entry in the calendar to another day moves it.
- No meal type picker on drop — meal type is inferred from the recipe's categories.

### Multiple Meals Per Day (Manual)
- Each day cell supports multiple `MealPlan` entries (one row per recipe added).
- The user manually adds each dish by clicking/selecting the day, then picking a recipe from the sidebar.
- There is no automatic multi-dish planning — the AI plan and spin-the-wheel still add one entry per day.
- Each entry is deleted independently (its own remove button).
- Backend: switch from one-per-date to one-per-entry. `POST /mealplans` creates an entry, `DELETE /mealplans/{entryId}` removes one.

### Meal Type Filter
- A filter bar above the calendar shows meal-type chips derived from `mockCategories` where `group === 'Måltidstype'`: All / Frokost / Lunsj / Middag / Dessert / Kveldsmat / Søtbakst / Snacks / Drikke.
- Default filter is **Middag**.
- Filtering shows only calendar entries whose recipe has that `Måltidstype` category. Entries of other types are hidden from the cell (not deleted).
- The filter also narrows the recipe picker: search and spin wheel only show recipes that have the selected meal-type category (or all recipes when filter is "All").
- Filter value persisted in URL param `?mealType=`.

### Meal Type Icon
- Each meal plan entry card in the calendar shows a small emoji icon derived from the recipe's first `Måltidstype` category:
  - Frokost: 🌅, Lunsj: 🥗, Middag: 🍽️, Dessert: 🍰, Kveldsmat: 🌙, Søtbakst: 🥐, Snacks: 🍿, Drikke: 🥤
- If the recipe has no `Måltidstype` category, show 🍴.

### Clickable Group Name
- The group name shown in the planner header is rendered as a `<Link>` to `/groups/{id}`.

### Weekly Planner Accessible from Group Page
- The group detail page (`/groups/[id]`) gets an "Åpne ukesplanlegger" button/link that navigates to `/ukesplanlegger?groupId={id}`.
- The planner pre-selects the group from the `?groupId=` query parameter on mount.

### Group Selector with URL Persistence
- The group selector (already present for multi-group users) syncs with URL param `?groupId=` so reloads and shared links preserve context.

### Group Config: Enable/Disable Week Planner
- Add a `MealPlanEnabled` boolean field to the `Group` entity (default `true`).
- The group detail page shows a toggle: "Ukesplanlegger aktiv" — any group member can toggle this.
- The weekly planner page hides the calendar and shows a message if `MealPlanEnabled` is `false` for the selected group.
- New API: `PATCH /api/groups/{id}/settings` with `{ mealPlanEnabled: bool }`.

## Design

### Data Model

**MealPlan entity — changed:**
```
MealPlan
  Id            int  PK
  GroupId       int  FK
  Date          DateOnly
  RecipeId      int  FK
  CreatedByEmail string?
  CreatedAt     DateTime
  UpdatedAt     DateTime
```
No `MealType` column — meal type is derived from the recipe's categories at read time.
The uniqueness constraint changes from `(GroupId, Date)` to no uniqueness constraint — multiple entries per date are allowed.

**MealPlanRecipeDto — extended:**
```
MealPlanRecipeDto
  Id           int
  Title        string
  ImageUrl     string?
  MealTypeCategory  string?   -- NEW: first Måltidstype category name, resolved server-side
```

**Group entity — extended:**
```
Group
  ...existing...
  MealPlanEnabled  bool  default true  -- NEW
```

### API Changes

| Method | Route | Notes |
|--------|-------|-------|
| GET    | `/api/groups/{id}/mealplans?from=&to=` | Response includes `mealTypeCategory` on recipe |
| POST   | `/api/groups/{id}/mealplans` | **NEW** – `{ date, recipeId }` — replaces PUT |
| DELETE | `/api/groups/{id}/mealplans/{entryId:int}` | Delete by entry id, not by date |
| PATCH  | `/api/groups/{id}/settings` | **NEW** – `{ mealPlanEnabled: bool }` |

The old `PUT /mealplans/{date}` and `DELETE /mealplans/{date}` endpoints are removed.

### UI Changes

- `UkesplanleggerClient.tsx` — sidebar layout on desktop, URL param sync (`groupId`, `mealType`), multi-entry state, active-day selection
- `WeekCalendar.tsx` — accept `MealPlan[]` (multiple per day), pass filter, drag-drop targets
- `DayCell.tsx` — render stacked list of entries with type icons; drop target; per-entry delete
- `RecipePickerModal.tsx` → `RecipePickerPanel.tsx` — renders as sidebar column on desktop, modal on mobile; filters recipes by selected meal type
- `MealTypeFilter.tsx` — **new** filter chip bar
- `/groups/[id]/page.tsx` — add planner toggle and "Åpne ukesplanlegger" link

## Out of Scope
- Automatic multi-dish AI planning (AI plan still assigns one recipe per day)
- Touch drag-and-drop (native HTML5 DnD is desktop only)
- Reordering entries within a day cell

## Open Questions
- None — implementation can start.
