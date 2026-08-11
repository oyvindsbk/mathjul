# Feature: Tilbehør

## Summary
Add a "Tilbehør" category. A recipe marked Tilbehør can be attached as a side dish to other recipes, so "Chicken tikka masala" can carry "Ris" and "Naanbrød" as tilbehør.

## Motivation
Today a recipe is a standalone island — `Recipe` has categories, groups and likes, but no relationship to another recipe. There is no way to express that a dish is served with something else, even though that is how most dinners are actually cooked. Users have to remember the pairing themselves, and the weekly planner shows no sign of it.

## Requirements
- A new seeded category **Tilbehør** (`Id=16`, group `Måltidstype`)
- A recipe marked Tilbehør can be attached as a side dish to other recipes
- Side dishes are attached from the **main dish's** edit form, in a chosen order
- Unlimited side dishes per main dish
- The main dish's detail page lists its tilbehør as links
- A tilbehør's own detail page shows read-only which dishes use it ("Brukes som tilbehør til")
- The AI must **not** suggest Tilbehør during recipe extraction — the user sets it manually
- The weekly planner shows attached tilbehør as a subtitle under the main dish
- Tilbehør recipes never appear as standalone cards in the planner's recipe picker
- Validation: a recipe cannot be its own tilbehør; only Tilbehør-marked recipes can be attached; a recipe marked Tilbehør cannot itself have tilbehør (one level only)
- Removing the Tilbehør mark from a recipe silently removes its links, so the invariant always holds

## Design

### Data Model

**New entity: `RecipeSideDish`** — a self-referencing join on `Recipe`. This is the first self-referencing relationship in the model.

```
RecipeSideDish
  RecipeId          int (FK -> Recipe, the main dish, ON DELETE CASCADE)
  SideDishRecipeId  int (FK -> Recipe, the tilbehør,  ON DELETE RESTRICT)
  SortOrder         int
  PK (RecipeId, SideDishRecipeId)
  IX (RecipeId, SortOrder)
```

Both foreign keys point at `Recipes.Id`. SQL Server rejects two cascading FKs from one table to itself (msg 1785), so the reverse side must be `Restrict` — following the `Group.OwnerId -> User` precedent. The consequence is that `DeleteRecipe` must remove reverse links explicitly.

Navigations on `Recipe`: `SideDishes` (this recipe is the main dish) and `UsedAsSideDishIn` (reverse lookup).

**New seed row:** `Category { Id = 16, Name = "Tilbehør", Group = "Måltidstype" }`. Verified not to collide with `IX_Categories_Name`.

**New constants class** `RecipeCategories` — `TilbehorId = 16`, `MealTypeGroup = "Måltidstype"`. Tilbehør is referenced by id, not name: the name contains `ø` and would depend on DB collation in LINQ-to-SQL, while the id is seeded and stable.

### API Changes

No new endpoints. Side dishes ride the existing `CategoryIds` pattern, because the form makes exactly one save call and dedicated endpoints would force the create flow into a two-request sequence with partial-failure handling.

**New DTO**
```
RecipeRefDto { Id, Title, ImageUrl }
```

**Changed DTOs**

| DTO | Added |
|-----|-------|
| `RecipeDetailDto` | `SideDishes: RecipeRefDto[]`, `UsedAsSideDishIn: RecipeRefDto[]` |
| `UpdateRecipeRequest` | `SideDishIds: int[]?` — list order is the SortOrder |
| `SaveExtractedRecipeRequest` | `SideDishIds: int[]?` |
| `MealPlanRecipeDto` | `SideDishTitles: string[]` |

`RecipeDto` (list card) and `ExtractedRecipeResponse` are unchanged.

**GET `/api/recipes/{id}`** — now returns both directions; the reverse lookup is served here rather than by a separate endpoint. `UsedAsSideDishIn` is filtered by visibility so a private recipe's title cannot leak through a public main dish.

**GET `/api/recipes?categories=16`** — already works via the existing AND-filter; this is the tilbehør picker's data source. No change needed.

**Validation** lives in a private controller helper called by both write paths, returning `BadRequest(new { message })`.

### UI Changes

- **`RecipeForm`** — a "Tilbehør" chip picker after the Categories block, using the same chip styling. Hidden when the recipe itself is marked Tilbehør. Selected chips render first in order with ↑/↓ buttons. No drag-and-drop in v1.
- **Recipe detail** — "Tilbehør" chips after the category chips; "Brukes som tilbehør til" at the bottom after tips. Both are links.
- **Upload and edit pages** — load the tilbehør list and pass it to `RecipeForm`. The edit page must populate `sideDishIds` from the detail response, otherwise every save wipes them.
- **Browse list** — no changes; "Tilbehør" appears automatically as a new Måltidstype filter chip.
- **Ukesplanlegger** — `DayCell` shows a `+ Ris, Naan` line under the title; `MealPlanPreviewModal` shows a Tilbehør list; `RecipePickerPanel` excludes tilbehør recipes before the meal-type filter so the exclusion also applies to "Alle". `MealTypeFilter` gets no new tab.

## Out of Scope
- Tilbehør attached to a *meal plan entry* rather than a recipe ("just this Tuesday, rice with the curry")
- Nested tilbehør / more than one level
- Editing the link from the tilbehør's own page
- Aggregating tilbehør ingredients into the main dish's ingredient list or the shopping flow
- AI suggesting side-dish pairings
- A Tilbehør tab in the planner's `MEAL_TYPES`
- Deleting the unused `RecipePickerModal.tsx`

## Open Questions
- None
