# Tasks: Ukesplanlegger Forbedringer

## Tasks

### Backend

- [x] Task 1: Add `MealPlanEnabled` to `Group`, remove unique constraint on `(GroupId, Date)` in `MealPlan`, create and apply EF Core migration
- [x] Task 2: Update `MealPlansController` — add POST (create entry), change DELETE to by-id, update GET to include `mealTypeCategory` on recipe DTO; add `PATCH /api/groups/{id}/settings`
- [x] Task 3: Build + test backend (`dotnet build` + `dotnet test`)

### Frontend — Service & Types

- [x] Task 4: Update `mealplan.service.ts` types and methods (multi-entry per day, `mealTypeCategory`, delete by id, POST instead of PUT)
- [x] Task 5: Add `groupId` and `mealType` URL param sync to `UkesplanleggerClient.tsx`; active-day selection state for sidebar

### Frontend — Calendar & Filter

- [x] Task 6: Create `MealTypeFilter.tsx` chip-bar component
- [x] Task 7: Update `DayCell.tsx` — stacked multi-entry list with meal-type icons, per-entry delete button, drop target highlight
- [x] Task 8: Update `WeekCalendar.tsx` — multi-entry maps, pass active filter and drop handlers

### Frontend — Sidebar / Recipe Picker

- [x] Task 9: Refactor `RecipePickerModal.tsx` → `RecipePickerPanel.tsx` (sidebar on lg+, modal on mobile); filter recipes by selected meal type

### Frontend — Drag and Drop

- [x] Task 10: Make recipe items in panel `draggable`; wire `onDrop` on day cells to call the new POST endpoint

### Frontend — Group Integration

- [x] Task 11: Make group name in planner header a clickable `<Link>` to `/groups/{id}`
- [x] Task 12: Add "Åpne ukesplanlegger" link to group detail page (`/groups/[id]/page.tsx`)
- [x] Task 13: Add `MealPlanEnabled` toggle to group detail page (calls `PATCH /api/groups/{id}/settings`)
- [x] Task 14: Fetch `mealPlanEnabled` for selected group in planner; hide calendar with message when disabled

### Verification

- [x] Task 15: Full inner loop — lint, typecheck, build frontend + backend
