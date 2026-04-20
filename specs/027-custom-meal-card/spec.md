# Feature: Custom Meal Card

## Summary
Allow users to add a free-text custom card to any day in the meal planner when they don't have a full recipe in the system or just want to note a simple meal idea (e.g., "Leftovers", "Pizza night", "Out for dinner").

## Motivation
Not every meal planned is a full recipe. Users need a lightweight way to mark a day without being forced to create or pick a recipe. This reduces friction and makes the planner more useful for everyday life.

## Requirements
- User can add a custom card to any day in the meal planner
- Custom card has a short free-text title (max 100 characters)
- Custom card has an optional note/description (max 300 characters)
- Custom card is visually distinct from recipe cards (different icon or style)
- Custom cards participate in the same drag-and-drop as recipe entries
- Custom cards can be deleted like any other meal entry
- Custom cards are stored per group and per date (same scoping as recipe entries)
- Custom cards are visible to all group members (shared, not per-user)
- Custom card creation is triggered from the day cell (same UX flow as adding a recipe)

## Design

### Data Model
Extend `MealPlan` entity with two nullable fields:
- `CustomTitle: string?` — the user-provided text title
- `CustomNote: string?` — optional free-text note

A meal plan entry is custom when `RecipeId == null && MatkasseRecipeId == null && CustomTitle != null`.

No new table needed — the existing `MealPlans` table is extended with two nullable columns via EF Core migration.

### API Changes
**POST** `/api/groups/{groupId}/mealplans` — extend the existing create endpoint:
- Accept `customTitle: string` (required when no recipeId/matkasseRecipeId)
- Accept `customNote: string?` (optional)
- Validation: exactly one of (recipeId, matkasseRecipeId, customTitle) must be set

**GET** `/api/groups/{groupId}/mealplans` — extend `MealPlanDto` response:
- Add `customTitle: string?`
- Add `customNote: string?`
- Add `isCustom: bool` (computed: customTitle != null)

### UI Changes
- **DayCell**: Add a "+" button or context option to open a custom card input (inline or small modal)
- **CustomCardForm**: Small modal/popover with a title input and optional note textarea
- **DayCell entry rendering**: Custom entries show a ✏️ (pencil) or 📝 icon and the custom title
- **MealPlanPreviewModal**: Show custom title and note when previewing a custom entry (no recipe image)
- The custom card creation entry point should feel natural next to the existing recipe picker flow

## Out of Scope
- Editing a custom card after creation (delete and re-add is sufficient for v1)
- Assigning a meal type category to custom cards
- Rich text formatting in the note field
- Custom card templates or presets

## Open Questions
- None — scope is clear for v1.
