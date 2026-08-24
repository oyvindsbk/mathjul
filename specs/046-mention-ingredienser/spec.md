# Feature: @-mention ingredienser i instruksjonstrinn

## Summary

While writing an instruction step, the author types `@` and picks an ingredient from the recipe. The step then renders that ingredient's scaled amount, unit and name inline, and keeps following the ingredient when the portion count changes or the creator edits the ingredient list.

## Motivation

An instruction step is a plain string today, so any quantity written into it is dead text.

- A step reading "Fres 1 stk løk til den er blank" still says "1 stk" after the reader doubles the portions with the servings stepper, while the ingredient list beside it correctly says "2 stk". The two halves of the same recipe disagree.
- Renaming "løk" to "rødløk" in the ingredient list leaves every step still saying "løk".

This matters most in matlagingsmodus, where the cook is looking at the steps rather than the ingredient list, and is exactly where a wrong number does damage.

## Requirements

### Authoring
- In the recipe form, typing `@` in an instruction step opens a picker listing that recipe's ingredients (flat and sectioned), filtered as the author keeps typing.
- The picker is keyboard-operable: ↑/↓ to move, Enter/Tab to accept, Escape to dismiss.
- Accepting an ingredient inserts a mention at the caret.
- Each mention on a step can be toggled between two display modes: **full** (`1 stk løk`) and **name only** (`løk`) — "Fres løken til den er blank" often reads better than repeating the amount.
- A mention can be removed without hand-editing the step text.
- Ingredient rows added but not yet saved are mentionable.
- Removing an ingredient that is mentioned warns the author which steps use it. The removal is still allowed.

### Rendering
- A mention renders the ingredient's amount, unit and name, with the amount **scaled to the currently selected servings** using the same rules as the ingredient list.
- Mentions render identically on the recipe detail page, in matlagingsmodus, and on a public shared recipe (`/delt/[token]`).
- A mention whose ingredient no longer exists renders its last-known name as ordinary text — the sentence still reads, it just stops scaling.
- Accessible names (`aria-label`) on steps use the resolved text, never the raw storage token.

### Durability
- Mentions survive: renaming the ingredient, reordering ingredients, reordering steps, adding/removing ingredient or instruction sections, uploading or removing a step photo, and sharing the recipe by link.

## Design

### Data Model

`backend/RecipeApi/Features/Recipes/Recipe.cs`:

```csharp
public class StructuredIngredient {
    public string? Id { get; set; }          // GUID ("N" format), assigned server-side
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class IngredientMention {
    public string IngredientId { get; set; } = string.Empty;
    /// Snapshot of the name at authoring time; the fallback when the ingredient is gone.
    public string FallbackName { get; set; } = string.Empty;
    /// "full" (amount + unit + name) or "name".
    public string Display { get; set; } = "full";
}

public class InstructionStep {
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public List<IngredientMention> Mentions { get; set; } = new();
}
```

`Text` carries opaque tokens `@[0]`, `@[1]`, … indexing into `Mentions`. Keeping the mention data in a typed sibling list rather than encoding it into the text keeps the token short and the id/fallback/display triple properly typed.

**Binding is by stable ingredient id**, not by name and not by position — a rename or a reorder must not break a mention.

**No EF migration is required.** All four recipe collections are already serialized to `nvarchar(max)` JSON via `HasConversion` in `Infrastructure/RecipeDbContext.cs` (~lines 170-208); the EF model only knows about `string`. Existing rows deserialize with `Id = null` and `Mentions = []`, so every read path must tolerate those defaults.

**Ingredient id backfill.** Ids are assigned server-side so a client can never mint a colliding one:
- On write (`SaveExtractedRecipe`, `UpdateRecipe`): assign a GUID to any ingredient (flat or sectioned) arriving without one. Ids the client sends back are preserved verbatim — that is how an edit keeps existing mentions bound.
- On read (`GetRecipeById`, `PublicRecipesController`): if any ingredient lacks an id, assign and **persist** it, so the detail page and its edit form agree on identity.

Both paths go through one shared helper, `RecipeIngredientIds.EnsureIds(Recipe) : bool`, returning whether anything changed.

### API Changes

No new endpoints. Two DTOs gain a field and one DTO is new; the shapes must be threaded at **every** mapping site or the data silently vanishes on a round-trip:

- `StructuredIngredientDto` gains `Id`; `InstructionStepDto` gains `Mentions`; new `IngredientMentionDto`.
- `RecipesController.cs`: `GetRecipeById`, `SaveExtractedRecipe`, `UpdateRecipe` (request mapping **and** response), `UploadStepImage` response, `MapToExtractedResponse`.
- `PublicRecipesController.cs`: the shared-recipe projection builds its own `SharedRecipeDto` rather than reusing `RecipeDetailDto` — missing this site breaks mentions on shared links only.

### UI Changes

**New module `frontend/src/lib/instruction-mentions.ts`** — the single place a step's text is resolved, so the detail page, matlagingsmodus and the share page cannot drift:

```ts
export type InstructionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; resolved: boolean };

export function indexIngredients(recipe): Map<string, StructuredIngredient>;
export function resolveStepSegments(step, ingredientsById, baseServings, desiredServings): InstructionSegment[];
export function stepPlainText(step, ingredientsById, baseServings, desiredServings): string;
```

Scaling reuses `formatIngredientParts` from `lib/recipe-format.ts` — it is not reimplemented. Malformed or out-of-range tokens render literally rather than throwing.

**Read surfaces** — a shared `<StepText segments={…} />` component renders the segments; mentions get a subtle emphasis so they read as data. Consumed by `components/RecipeBody.tsx` (`renderStep`, both the interactive and presentational branches) and `components/matlagingsmodus/InstructionsTab.tsx`. The share page reaches both through the same components.

**Authoring** — `SortableInstruction` in `components/RecipeForm.tsx` keeps its plain `<textarea>`; no rich-text editor is introduced. Around it:
- an `@`-trigger reading backwards from the caret,
- a new `MentionPicker` listbox anchored under the textarea, modeled on the existing search-and-select behaviour in `components/ukesplanlegger/RecipePickerPanel.tsx`,
- a resolved preview line beneath the textarea (shown only when the step has mentions), since a textarea cannot style its own content,
- one chip per mention for the full/name toggle and removal,
- a `useMentions` hook holding the token↔array invariant (reindexing after removal, dropping orphaned tokens).

## Out of Scope

- **AI extraction emitting mentions.** The extraction DTO carries instructions as `List<string>` and the prompt has four JSON exemplars to rewrite; that is a separate, larger piece of work. Extracted recipes arrive with `mentions: []` and the author adds mentions by hand. This is a recorded decision, not an oversight.
- Mentioning anything other than an ingredient (other recipes, steps, tools).
- Mentions in fields other than instruction steps (description, tips, section headings).
- A rich-text editor for step text.
- Backfilling mentions into existing recipes by matching ingredient names against step text.

## Open Questions

None — binding strategy, broken-reference behaviour and display modes were all settled before implementation.
