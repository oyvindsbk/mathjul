# Tasks: Kaker — skalering etter formstørrelse

## Tasks

- [x] Task 1: Add the five pan columns (`PanShape`, `PanDiameter`, `PanLength`,
      `PanWidth`, `PanHeight`) to `Recipe.cs`, seed the `Kake` category (id 17,
      Måltidstype) in `RecipeDbContext.cs`, expose `KakeId`/`KakeName` in
      `RecipeCategories.cs`, and generate the EF migration. Verify: `dotnet build`.

- [x] Task 2: Flow the pan fields through the `RecipesController` create/update/
      detail DTOs, and validate that `QuantityType == "form"` requires
      `PanShape` plus the dimensions matching that shape (positive values).
      Add xUnit tests for the validation branches. Verify: `dotnet build`,
      `dotnet test`.

- [x] Task 3: Add the pan preset lookup and area math as a pure frontend module
      (`frontend/src/lib/pan-size.ts`): the 14 presets, `panArea(shape, dims)`,
      `areaToPreset(area)` nearest-match resolution, and
      `conversionWarning(from, to)` returning the >25%-or-shape-change warning.
      Verify: `npm run lint`, `npx tsc --noEmit`.

- [x] Task 4: Add `roundForUnit(quantity, unit)` to `recipe-format.ts` with the
      unit classes from the spec (countable → whole, clamped to min 1; `g` →
      nearest 5; `dl`/`ts`/`ss` → existing kitchen fractions; unknown →
      unchanged), and apply it inside `formatIngredientParts` for `form`
      recipes only. Add the `form` case to `servingsLabel`. Verify: lint,
      tsc, and the existing recipe-format tests still pass.

- [x] Task 5: Build the `FormVelger` pan-picker component — presets grouped by
      shape, source pan marked, selection sets `desiredServings` to the pan
      area, warning rendered when `conversionWarning` returns one. Verify:
      lint, tsc, build.

- [x] Task 6: Render `FormVelger` in place of `ServingsStepper` in
      `RecipeBody.tsx` and `MatlagingsmodusOverlay.tsx` when
      `quantityType === "form"`, branching on the quantity type (not on a
      missing prop). Verify: lint, tsc, build.

- [x] Task 7: Add the fourth `Form` option to the quantity-type picker in
      `RecipeForm.tsx` (~line 1067), swapping the numeric servings input for the
      pan picker plus optional height field, and persisting the pan fields plus
      the computed area into `servings`. Verify: lint, tsc, build.

- [x] Task 8: Add Playwright E2E coverage in `frontend/tests/e2e/` — create a
      cake recipe with a Ø24 tin, open it, convert to langpanne 30×40, and
      assert the scaled+rounded amounts and the conversion warning. Verify:
      lint, tsc, build, `npx playwright test`.

- [x] Task 9: Final pass — full inner loop on both stacks, run the review
      agents, and drive the feature manually in Chrome via Playwright MCP.
