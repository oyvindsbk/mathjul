# Tasks: Kake uten steketid (no cooking time)

## Tasks

- [x] Task 1: Add `NoCookTime` (bool, default false) to `Recipe` entity, create the EF Core migration, and reset it to `false` in `ClearPanFieldsForNonForm` when a recipe's `QuantityType` changes away from `"form"`. Verify with `dotnet build`.
- [x] Task 2: Thread `NoCookTime` through `RecipeDetailDto`, `SaveExtractedRecipeRequest`, and `UpdateRecipeRequest` in `RecipesController.cs` (map/read/write alongside the other pan fields). Verify with `dotnet build` and `dotnet test`.
- [x] Task 3: Add `noCookTime: boolean` to the frontend `RecipeFormData` type, the recipe detail DTO/service types in `recipe.service.ts`, and the `Recipe` type + an iskake-style fixture in `mock-data.ts`. Verify with lint, typecheck, build.
- [x] Task 4: In `RecipeForm.tsx`, add a "Ingen steketid (f.eks. iskake)" checkbox shown when `quantityType === 'form'`; when checked, hide the "Steketid (min)" input and exclude it from submit validation; wire the checkbox to `noCookTime` in form state and submission payload. Verify with lint, typecheck, build.
- [x] Task 5: Gate the "Steketid" badge in `RecipeBody.tsx` on `!recipe.noCookTime` in addition to the existing `cookTimeMinutes` truthiness check. Verify with lint, typecheck, build.
- [x] Task 6: In `FormVelger.tsx`, skip rendering both the bake-guidance box and the conversion-warning box when `recipe.noCookTime` is true, regardless of `hasConverted`. Verify with lint, typecheck, build.
- [x] Task 7: Add/extend Playwright E2E coverage: create or edit a `"form"` recipe, toggle "Ingen steketid," confirm the Steketid input disappears in the editor and the Steketid badge/bake guidance don't render on the detail page; confirm turning it back off restores prior behavior. Verify with `npx playwright test`.
- [x] Task 8: Full inner loop for both stacks (backend build+test, frontend lint+typecheck+build+playwright) plus review agents (security, architecture, performance) as the final gate before PR.
