# Implementation Plan: Ukesplanlegger Forbedringer

## Approach
Work backend-first (data model, migrations, new endpoints) then frontend (service layer, components, layout). Each task leaves the inner loop green.

## Stacks Affected
- [x] Backend
- [x] Frontend
- [ ] Infrastructure

## Key Decisions

- **Entry-per-row model**: Switch from "one MealPlan per date" to "multiple MealPlan rows per date, each with a mealType". This is a breaking data-model change that requires a migration. Old single-entry rows get mealType = "Middag" as the migration default.
- **DELETE by entryId, not date**: With multiple entries per day we can no longer key on date alone. Delete takes the integer PK.
- **Sidebar vs modal**: Use a single `RecipePickerPanel` component. At `lg` breakpoint it renders inside a sticky right column; below that it renders inside a `<dialog>` (the current modal). No duplicate logic.
- **Drag and drop**: Use the native HTML5 drag-and-drop API (no third-party library) — recipes in the sidebar are `draggable`, day cells are drop targets. On drop a `MealTypePicker` popover asks which meal type before saving.
- **Filter in URL param**: `?groupId=&mealType=` — both default on mount. Makes the planner shareable and reload-stable.
- **mealPlanEnabled on Group**: simple boolean column, PATCH endpoint protected to group members (backend enforces; UI shows to all members).

## Risks
- **Migration on existing data**: Existing `MealPlan` rows have no `mealType`. Migration sets a non-null default of `"Middag"`. Low risk.
- **Drag-and-drop on touch**: Native HTML5 DnD doesn't work well on touch screens. Acceptable — sidebar/modal flow remains for mobile. Out of scope to add touch-DnD.
