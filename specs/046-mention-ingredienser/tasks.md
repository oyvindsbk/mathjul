# Tasks: @-mention ingredienser i instruksjonstrinn

Each task is one session. Run the inner loop for the affected stack before marking it done.

## Tasks

- [x] **Task 1: Backend model + id helper.** Add `Id` to `StructuredIngredient`, `Mentions` to `InstructionStep`, and the new `IngredientMention` class in `Features/Recipes/Recipe.cs`. Add `RecipeIngredientIds.EnsureIds(Recipe) : bool` walking flat + sectioned ingredients and assigning `Guid.NewGuid().ToString("N")` where the id is null/empty, preserving existing ids. Verify: `dotnet build`.

- [x] **Task 2: Backend DTO threading.** Add `IngredientMentionDto`; add `Id` to `StructuredIngredientDto` and `Mentions` to `InstructionStepDto`. Thread both through all seven mapping sites — `RecipesController`: `GetRecipeById`, `SaveExtractedRecipe`, `UpdateRecipe` (request **and** response), `UploadStepImage` response, `MapToExtractedResponse`; plus `PublicRecipesController`'s `SharedRecipeDto` projection. Call `EnsureIds` on the write paths and on the read paths (persisting only when it returns true). Verify: `dotnet build`.

- [x] **Task 3: Backend tests.** New `RecipeApi.Tests/Recipes/RecipeMentionTests.cs`: PUT a recipe carrying a mention → GET returns it intact; ingredients without ids get them; client-supplied ids are preserved verbatim across an update; a legacy recipe (no ids) gets ids backfilled and persisted on read; the shared-token payload carries mentions and ingredient ids. Verify: `dotnet test`.

- [x] **Task 4: Frontend types + resolver.** Add `id?` to `StructuredIngredient`, the `IngredientMention` interface, and `mentions?` to `InstructionStep` in `lib/mock-data.ts`. Write `lib/instruction-mentions.ts` with `indexIngredients`, `resolveStepSegments` and `stepPlainText`, reusing `formatIngredientParts` from `lib/recipe-format.ts` for scaling. Out-of-range and malformed tokens render literally. Verify: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

- [x] **Task 5: Read surfaces.** Add `components/StepText.tsx` rendering a segment list. Wire it into `RecipeBody.renderStep` (both branches, and its `aria-label`) and `matlagingsmodus/InstructionsTab` (text and `aria-label`), threading the ingredient index and `desiredServings` into the latter. Verify: lint, typecheck, build; check the detail page, matlagingsmodus and a shared link render a hand-seeded mention correctly.

- [x] **Task 6: Mention picker + hook.** Add `components/MentionPicker.tsx` (filtered listbox, `role="listbox"`/`role="option"`, `aria-activedescendant`, ↑/↓/Enter/Tab/Escape) and a `useMentions` hook owning the token↔array invariant — insert, remove-with-reindex, and dropping orphaned tokens. Verify: lint, typecheck, build.

- [x] **Task 7: Form wiring.** In `RecipeForm`'s `SortableInstruction`: the `@` caret trigger, picker anchoring and insertion, the resolved preview line, and per-mention chips for the full/name toggle and removal. Assign optimistic client ids to new ingredient rows. Warn which steps use an ingredient being removed. Verify: lint, typecheck, build.

- [x] **Task 8: E2E.** New `tests/e2e/mention-ingredienser.spec.ts`: author a mention via `@` in the form, save, assert the detail page renders the scaled text, then double the servings and assert the step and the ingredient list stay in lockstep. Extend `matlagingsmodus.spec.ts` with one case asserting a servings change in the ingredients tab moves the amount rendered inside a step on the "Slik gjør du" tab. Confirm `reorder-instructions.spec.ts` still passes unchanged. Verify: `npx playwright test`.

- [x] **Task 9: Final review.** Full inner loop on both stacks, review agents (arch, security, performance), and a Playwright MCP walkthrough of the authoring and reading flows.
