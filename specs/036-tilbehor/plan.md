# Implementation Plan: Tilbehør

## Approach

Backend first, then frontend, then the weekly planner.

1. Add the `RecipeSideDish` join entity, the two `Recipe` navigations, and a `RecipeCategories` constants class.
2. Configure the join in `RecipeDbContext` with Cascade on the owning side and Restrict on the reverse, and seed category `Id=16`.
3. Generate the migration and verify the generated SQL has one Cascade and one Restrict FK.
4. Extend the recipe DTOs with `RecipeRefDto`, `SideDishes`, `UsedAsSideDishIn` and `SideDishIds`.
5. Add a validation helper and wire it into `UpdateRecipe` and `SaveExtractedRecipe`, using clear-and-re-add semantics that mirror how categories already work.
6. Return both directions from `GetRecipeById`, filtering the reverse by visibility.
7. Clean up links in `DeleteRecipe` and when the Tilbehør mark is removed.
8. Exclude Tilbehør from the AI category list.
9. Extend `MealPlanRecipeDto` and all four of its construction sites.
10. Add recipe test infrastructure (none exists today) and validation tests.
11. Frontend: types, service wrapper, the `RecipeForm` picker, then detail / edit / upload wiring.
12. Planner: `DayCell`, `MealPlanPreviewModal`, `RecipePickerPanel` exclusion.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure (no changes needed)

## Key Decisions

- **Tilbehør is a `Category` row, not a flag on `Recipe`**: no schema change on `Recipe`, and it inherits filtering, the form chip UI and the browse-page filter panel for free. The cost is that it needs explicitly excluding from the AI list and the planner picker — two small, contained filters.
- **Referenced by id (16), not by name**: `"Tilbehør"` contains a non-ASCII character whose LINQ-to-SQL matching depends on DB collation. The id is seeded via `HasData` and stable across environments, and the codebase already relies on hardcoded seeded ids (`FeatureColumn` 1-4).
- **One-way link, edited from the main dish**: matches how people think about it ("what goes with the curry?") and keeps a single writer for the join table. The reverse direction is a read-only projection, so there is nothing to keep in sync.
- **No new endpoints — extend `UpdateRecipeRequest`**: side dishes are edited inside `RecipeForm`, which makes exactly one save call. Dedicated endpoints would force the create flow into a two-request sequence with partial-failure handling. Reordering is free because list order is the SortOrder.
- **Cascade on the owning FK, Restrict on the reverse**: SQL Server rejects two cascade paths from `RecipeSideDishes` to `Recipes`. Deleting a main dish should drop its links (like `RecipeGroup`/`RecipeLike`); the reverse gets Restrict, and `DeleteRecipe` cleans up explicitly.
- **Silent cleanup rather than blocking**: deleting a recipe used as tilbehør, and un-marking a recipe as Tilbehør, both remove the affected links without an error. This matches how meal-plan references are already handled on delete, and keeps the invariant "everything in `SideDishes` is a Tilbehør" true at all times — which is what the frontend assumes.
- **`"Måltidstype"` magic string retired**: `MealPlansController` has four literals. This feature would otherwise triple the usage, so they move to `RecipeCategories.MealTypeGroup`.
- **No drag-and-drop reordering in v1**: `RecipeForm` already runs three sortable domains under one `DndContext`. A fourth is disproportionate risk for a list that will hold 1-2 items; ↑/↓ buttons are enough.

## Risks

- **Prod DB may already have a "Tilbehør" category** → the `HasData` insert violates `IX_Categories_Name`, and since migrations run at startup (`Program.cs:247`) this bricks the API rather than just failing the deploy. *Mitigation:* query prod `Categories` before deploying. Highest-severity item.
- **Multiple-cascade-path error** surfaces at `dotnet ef migrations add` with a message that does not name the culprit. *Mitigation:* configure the entity (Task 2) before scaffolding (Task 3), and eyeball the generated FKs.
- **Silent side-dish wipe**: `SideDishIds` defaults to empty and update clears-then-re-adds, so any client PUTting without it erases the links. Consistent with `categoryIds`/`groupIds`, but invisible when wrong. *Mitigation:* Task 14 populates `sideDishIds` from the detail response; covered by a test.
- **`MealPlanRecipeDto` is constructed in four places** — miss one and side dishes appear on load but vanish after a drag-to-move. *Mitigation:* route all four through a shared resolver.
- **DayCell vertical space on mobile**: cells are already `min-h-[80px]` with multi-entry support; an extra line per entry may push the week grid past the fold. *Mitigation:* `line-clamp-1` when stacked, plus a visual check on a narrow viewport.
- **InMemory EF provider enforces neither FKs nor unique indexes**, so tests cannot prove the Cascade/Restrict behaviour. *Mitigation:* accept it — the migration applying successfully is the real proof; SQLite would not reproduce SQL Server's cascade rule either.
