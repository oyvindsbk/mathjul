# Implementation Plan: Custom Meal Card

## Approach
Extend the existing `MealPlan` entity with two nullable text columns (`CustomTitle`, `CustomNote`). Update the backend create endpoint and DTOs to accept and return custom card data. On the frontend, add a small modal for custom card entry and update `DayCell` to render custom entries distinctly.

No new tables, no new controllers — this is a minimal extension of the existing meal plan system.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions
- **Single table extension over new table**: Adding nullable columns to `MealPlan` avoids join complexity and keeps the existing list endpoints unchanged except for two new nullable fields. The discriminator is implicit: custom when both FK refs are null and `CustomTitle` is set.
- **No meal type for custom cards v1**: Simplifies the form and avoids forcing the user to categorize something informal.
- **Modal for input**: A small modal (matching the existing `RecipePickerModal` pattern) is consistent with mobile UX and avoids layout shifts in the day cell.
- **"+" add button per day cell**: Render a small add-custom button in each day cell alongside the existing recipe picker trigger. On mobile this opens the modal; on desktop it can do the same for simplicity.

## Risks
- **Migration on shared data**: Adding two nullable columns is safe (no defaults needed, no existing rows affected).
- **Validation logic**: The create endpoint must reject entries with both a recipeId and a customTitle to avoid inconsistent state — add a guard in the controller.
