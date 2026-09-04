# Tasks: Kaker — én standardform, ingen egen "original"

## Tasks

- [x] Task 1: Gate `FormVelger`'s guidance/warning messages on "selected pan
      differs from the source/default pan." Compute one boolean
      (`selected?.id !== source?.id`, guarding both `guidance` and `warning`)
      and suppress both blocks when it's false — including on initial page
      load, where `selected` starts equal to `source`. Rename the `"
      (original)"` option suffix to `" (standard)"`. Update
      `frontend/tests/e2e/kakeform.spec.ts`: the "no warning is shown before
      anything is converted" test extends to also assert no
      `form-velger-bake-guidance`; the two tests updated in 054 that assert
      guidance text on the *source* pan itself (Ø24) are removed or
      rewritten, since selecting the already-selected default is no longer
      how guidance is triggered — guidance now only appears after switching
      to a *different* covered preset and back.

- [x] Task 2: Remove the "Standardform" `<select>` block and its supporting
      code from `RecipeForm.tsx` — `handleTogglePanPreset`'s
      `defaultPanPresetId` bookkeeping, the `(formData.availablePanPresetIds
      ?? []).length > 0` conditional block that rendered the select, and the
      `(original)` → `(standard)` labels in the "Begrens tilgjengelige
      former" checkbox list and the source-tin `<select>`. Drop
      `defaultPanPresetId` from `RecipeFormData` (`recipe.service.ts`),
      `Recipe` (`mock-data.ts`), and the edit-page mapping
      (`edit/client.tsx`). Drop the `defaultPreset` branch in the recipe
      detail page's initial `desiredServings` computation (`client.tsx`),
      always seeding from `data.servings`. Update mock recipe 6
      (`mock-data.ts`) to drop its `defaultPanPresetId` field. Update
      `kakeform.spec.ts`: remove `'the configured default is preselected on
      load'`; change `'a restricted recipe only offers its configured
      subset, plus the source tin'`'s expected preselected pan from
      `langpanne-30x40` back to `rund-24`; remove the two edit-form tests
      that assert the Standardform select's presence/value
      (`'editing a restricted recipe shows its stored subset and default...'`
      loses its default-select assertions, `'saving an untouched restricted
      recipe keeps its subset and default'` drops its
      `defaultPanPresetId` expectation).

- [x] Task 3: Retire `DefaultPanPresetId` on the backend. Remove the property
      from `Recipe.cs`. Remove it from `RecipeDetailDto`,
      `SaveExtractedRecipeRequest`, `UpdateRecipeRequest`, and every
      assignment/read site in `RecipesController.cs` (create, update, both
      detail-DTO constructions). Drop the `defaultPanPresetId` parameter and
      its "member of the subset" check from `ValidatePanFields`, and the
      `recipe.DefaultPanPresetId = null;` line from
      `ClearPanFieldsForNonForm`. Add an EF Core migration dropping the
      column, following `RemoveSpringformShape`'s shape (a no-op `Down`,
      since there is nothing meaningful to restore). Update
      `RecipePanFieldsTests.cs`: remove the `defaultPanPresetId` parameter
      from the `UpdateRequest(...)` test helper; remove
      `UpdateRecipe_DefaultNotInSubset_ReturnsBadRequest`; rewrite
      `UpdateRecipe_ValidSubsetAndDefault_PersistsBoth` into
      `UpdateRecipe_ValidSubset_Persists` asserting only
      `AvailablePanPresetIds`; drop the `DefaultPanPresetId` assertions from
      `UpdateRecipe_SwitchingAwayFromForm_ClearsAvailablePresetsAndDefault`
      (rename if the "AndDefault" no longer fits).

## Verification (per task)

Frontend inner loop, Tasks 1-2:
```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd frontend && npx playwright test kakeform
```

Backend inner loop, Task 3:
```bash
cd backend/RecipeApi && dotnet build
cd backend/RecipeApi && dotnet test
```
