# Tasks: Custom Meal Card

## Tasks

- [x] Task 1: Backend — extend `MealPlan` entity with `CustomTitle` and `CustomNote` fields, update create request/DTO, add validation, create EF Core migration
- [x] Task 2: Backend — update `MealPlanDto` to include `IsCustom`, `CustomTitle`, `CustomNote`; ensure GET endpoint returns them correctly
- [x] Task 3: Frontend — add `CustomCardModal` component (title input + optional note textarea) and wire it up in `DayCell` with a trigger button
- [x] Task 4: Frontend — update `DayCell` rendering to show custom entries with a distinct icon (✏️) and the custom title text
- [x] Task 5: Frontend — update `mealplan.service.ts` to support posting custom cards (`customTitle`, `customNote`) and update the `MealPlanEntry` type
- [x] Task 6: Frontend — update `MealPlanPreviewModal` to handle custom entries (show title + note, no recipe image)
- [x] Task 7: Verification — run full inner loop (lint, typecheck, build for frontend; build + test for backend) and manual smoke test
