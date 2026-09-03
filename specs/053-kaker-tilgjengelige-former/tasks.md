# Tasks: Kaker — forfatterstyrt formutvalg

## Tasks

- [x] Task 1: Backend data model — add `AvailablePanPresetIds` (`List<string>?`)
  and `DefaultPanPresetId` (`string?`) to `Recipe.cs`; configure the JSON
  conversion for `AvailablePanPresetIds` in `RecipeDbContext.cs` (copy the
  `Tips` converter pattern); add both fields to `RecipeDto`, `RecipeDetailDto`,
  `SaveExtractedRecipeRequest`, `UpdateRecipeRequest`, and the controller's
  read/apply code paths (mirroring the five existing pan fields' placement).

- [x] Task 2: Backend validation — extend `ValidatePanFields` with a backend
  `PanPresetIds` array (mirroring `PanShapes`) to validate every id in
  `AvailablePanPresetIds` is real, and that `DefaultPanPresetId` (if set) is a
  member of `AvailablePanPresetIds` when that list is non-empty. Extend
  `ClearPanFieldsForNonForm` to null both new fields for non-`form` recipes.
  Add xUnit tests in `RecipePanFieldsTests.cs` for: unknown preset id
  rejected, default-not-in-subset rejected, empty subset accepted, valid
  subset+default accepted, non-form recipe clears both fields.

- [x] Task 3: Frontend read side — `FormVelger.tsx`: `groupedPresets()` call
  filtered to `recipe.availablePanPresetIds` (plus the resolved source preset,
  always) when that list is non-empty; `value` prefers
  `recipe.defaultPanPresetId` on initial mount, else falls back to today's
  source-tin behavior. Update `recipe.service.ts` types/mapping for the two
  new fields (mirroring the five existing pan fields).

- [x] Task 4: Frontend write side — `RecipeForm.tsx`: add a collapsed-by-default
  disclosure section ("Begrens tilgjengelige former") containing a checkbox
  list of all 14 presets grouped like `FormVelger`'s optgroups (source preset
  checked + disabled), and a default-selector scoped to the checked subset.
  Wire both into the existing save payload alongside the other pan fields.

- [x] Task 5: E2E coverage — extend `kakeform.spec.ts` (or add a sibling spec)
  covering: a recipe with a restricted subset only shows those presets in
  `FormVelger`'s dropdown; the configured default is preselected on load; a
  recipe with no configured subset still shows the full list (regression
  guard against 052's existing behavior).
