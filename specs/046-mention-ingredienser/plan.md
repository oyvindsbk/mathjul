# Implementation Plan: @-mention ingredienser i instruksjonstrinn

## Approach

Build from the data outwards, so each layer is verifiable before the one above it exists.

1. **Backend model and threading.** Add `Id` to `StructuredIngredient`, `Mentions` to `InstructionStep`, and the new `IngredientMention`. Add the `RecipeIngredientIds.EnsureIds` helper and call it on both write and read paths. Thread the new fields through all seven DTO mapping sites. No EF migration — the collections are already JSON in `nvarchar(max)`.

2. **Frontend types and the resolver.** Mirror the shapes in `lib/mock-data.ts` (the single frontend definition), then write `lib/instruction-mentions.ts` as a pure module with no React dependency, so it can be tested directly and reused by all three read surfaces.

3. **Read surfaces.** A shared `<StepText>` component consuming the resolver, wired into `RecipeBody` and `InstructionsTab`. At this point mentions render and scale correctly everywhere — they just cannot be authored yet.

4. **Authoring.** The `@` trigger, `MentionPicker`, the `useMentions` hook, chips and preview line in `RecipeForm`.

5. **E2E.** Playwright specs covering the author→render→scale round trip.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **Bind by stable ingredient id, not by name or position.** Name binding breaks on rename; position binding breaks on reorder or insert — and reordering ingredients is an existing, exercised feature (dnd-kit in `RecipeForm`). A GUID is the only identity that survives both.

- **Ids assigned server-side, client ids preserved.** The server is the authority so a client cannot mint a colliding id, but ids that round-trip through an edit must be kept verbatim or every mention on the recipe would rebind on each save. The form may assign optimistic ids to brand-new rows; those survive because the server only fills in what is missing.

- **Tokens in `Text` + a typed sibling `Mentions` list**, rather than encoding the id/fallback/display into the text itself. Keeps the token short and opaque, keeps the triple typed, and keeps step text readable in the database.

- **Broken mention degrades to the fallback name as plain text**, with no warning styling for readers. The instruction still reads as a sentence; only the scaling is lost. Authors get the signal where it is actionable — at ingredient-removal time in the form.

- **No rich-text editor.** The codebase has no `contentEditable`, no `dangerouslySetInnerHTML` and no editor dependency, and introducing one to style a token inline would be far more surface area than the feature needs. A plain textarea plus a resolved preview line gives the author the same feedback.

- **One resolver module, three consumers.** `RecipeBody`, `InstructionsTab` and the share page must never disagree about what a step says. `lib/recipe-format.ts` exists precisely because that scaling logic had already been duplicated twice; this follows the same lesson.

- **AI extraction stays out.** Changing `List<string>` to an object shape means rewriting the base prompt, four JSON exemplars, and adding a string-fallback normalizer. Independently valuable, independently risky, and not needed for the feature to work.

## Risks

- **A missed DTO mapping site silently drops mentions.** There are seven, and the shared-recipe one (`PublicRecipesController`) uses its own `SharedRecipeDto`, so it would fail only on shared links — the surface least likely to be manually checked. Mitigation: a backend test asserting the shared payload carries mentions and ingredient ids, not just the detail payload.

- **No existing round-trip test for ingredients or steps.** `RecipeSideDishTests` and `RecipeShareTests` touch the detail projection but assert on side dishes, tokens and owner fields; nothing covers the JSON `HasConversion` round trip for step or ingredient content. Mitigation: the new `RecipeMentionTests` fills that gap as well as covering the feature.

- **Token/array desynchronisation.** Removing a mention must strip its token and reindex the remaining ones; an off-by-one here silently repoints a mention at the wrong ingredient. Mitigation: the invariant lives only in `useMentions`, and the resolver renders out-of-range tokens literally rather than throwing.

- **Read-path persistence on GET.** Backfilling ids during `GetRecipeById` means a read can write. Mitigation: `EnsureIds` returns whether anything changed, so `SaveChanges` runs only on the first read of a legacy recipe, not on every request.

- **In-place step mutation and EF change tracking.** `UploadStepImage`/`DeleteStepImage` mutate steps in place and already need an explicit `IsModified` flag because EF cannot see inside the JSON column. Any new in-place mutation of a step needs the same signal.
