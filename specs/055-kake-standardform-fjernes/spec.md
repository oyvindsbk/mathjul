# Feature: Kaker — én standardform, ingen egen "original"

## Summary

Collapse two overlapping concepts from [052](../052-kaker-formstorrelse/spec.md)
and [053](../053-kaker-tilgjengelige-former/spec.md) into one: the pan a
recipe is authored for (`PanShape`/`PanDiameter`/etc.) **is** the default the
reader sees, full stop. Removes 053's separate "Standardform" selector and
its backing `DefaultPanPresetId` field entirely. Also stops showing the
bake-time warning/guidance ([054](../054-kake-steketid-guide/spec.md)) except
when the reader has actually picked something other than the default.

## Motivation

053 added a second, independent "default" on top of the recipe's own source
tin — an author could restrict the picker to a subset *and* nominate any one
of that subset as what opens by default, separate from the tin the recipe was
actually written for. In practice this is a distinction without a difference:
nobody wants a cake recipe to open on a pan the recipe wasn't written for by
default. The source tin already **is** the sensible default; a second control
for the same idea is just more surface to configure and more copy ("original"
vs "standardform") describing the same thing two ways.

Separately, [054](../054-kake-steketid-guide/spec.md) added a message (either
concrete bake guidance or the qualitative warning) that today renders as soon
as any preset is resolved — including the default itself on first load. That
reads as "something is different" before the reader has changed anything.

## Requirements

- `FormVelger` shows **one** message area, and only when the reader has
  selected a pan other than the recipe's default (today's "source" pan).
  Selecting the default itself — including on initial page load — shows no
  guidance and no warning.
- The RecipeForm editor's separate "Standardform" `<select>` (053) is
  removed. The source-tin picker (`handlePanPreset`) is the only place an
  author sets a pan, and it is the only default there is.
- `AvailablePanPresetIds` (the author-curated subset restriction) is
  **unchanged** — an author can still narrow which presets a reader may
  convert to. Only the separate "which one of those is the default" question
  goes away.
- `DefaultPanPresetId` is retired end-to-end: dropped from `Recipe`, its
  DTOs, request validation, and the database (migration), not just hidden in
  the UI.
- Reader-facing copy that says "original" is reworded to "standard"/
  "standardform" — the concept has always meant "the pan this recipe
  defaults to"; the wording now says so directly instead of implying a second
  concept ("original" vs "default") that no longer exists.
- Existing recipes with a stored `DefaultPanPresetId` lose that value on
  migration; they fall back to their source tin as the default, which was
  already 053's own behavior whenever `DefaultPanPresetId` was unset.

## Design

### Data Model

Drop `DefaultPanPresetId` from `Recipe` ([Recipe.cs:142-148](../../backend/RecipeApi/Features/Recipes/Recipe.cs)).
New EF Core migration, following the precedent set by
[`RemoveSpringformShape`](../../backend/RecipeApi/Migrations/20260903111019_RemoveSpringformShape.cs):
drop the column outright (no data to preserve — see Requirements above for
why losing the value is correct, not merely tolerated).

`AvailablePanPresetIds` and its validation are untouched.

### API Changes

No new endpoints. `DefaultPanPresetId` is removed from `RecipeDetailDto`,
`SaveExtractedRecipeRequest`, and `UpdateRecipeRequest` in
`RecipesController.cs`. `ValidatePanFields` drops its
`defaultPanPresetId` parameter and the "default must be a member of the
subset" check that existed only to validate it.

### UI Changes

**`FormVelger`** ([FormVelger.tsx](../../frontend/src/components/FormVelger.tsx)) —

- Drop the `sourceVolume`-vs-`selected` special case in `onChange` for
  guidance purposes; that logic (reproducing the exact stored base) stays,
  it is unrelated to this change.
- Gate both `guidance` and `warning` on `selected?.id !== source?.id`. Today
  both are computed unconditionally from `source`/`selected` and
  `conversionWarning` already short-circuits on `from.id === to.id` — this
  makes that same condition also suppress 054's guidance block, so the two
  messages share one gate instead of only one of them having it.
- Rename the `" (original)"` option suffix to `" (standard)"`.

**`RecipeForm`** ([RecipeForm.tsx:1258-1277](../../frontend/src/components/RecipeForm.tsx)) —
remove the "Standardform" `<select>` block entirely (the `<div className="mt-3">`
wrapping it). The `(formData.availablePanPresetIds ?? []).length > 0` gate that
wrapped it is not reused for anything else and goes with it. `handleTogglePanPreset`
loses its `defaultPanPresetId` bookkeeping — it becomes a plain toggle of
`availablePanPresetIds` with no companion field to keep in sync.
`handlePanPreset`, `handleQuantityType`, and the checkbox's `(original)` label
in the "Begrens tilgjengelige former" list are reworded to "(standard)" to
match.

**`RecipeFormData`** ([recipe.service.ts:41](../../frontend/src/lib/services/recipe.service.ts)),
**`Recipe`** ([mock-data.ts:100](../../frontend/src/lib/mock-data.ts)),
and the edit-page mapping ([edit/client.tsx:69,102](../../frontend/src/app/(app)/recipes/[id]/edit/client.tsx))
drop `defaultPanPresetId`.

**`client.tsx`** (recipe detail page) — the initial `desiredServings`
computation ([client.tsx:66-84](../../frontend/src/app/(app)/recipes/[id]/client.tsx))
drops the `defaultPreset` branch entirely; it always starts from
`data.servings` (the source/default tin), which was already the fallback
path for every recipe without a `defaultPanPresetId` set.

**Wording** — `conversionWarning`'s message text
([pan-size.ts:293](../../frontend/src/lib/pan-size.ts)) changes "enn
originalen" to "enn standardstørrelsen" (or equivalent — exact Norwegian
phrasing decided during implementation, not a spec-level decision).

## Out of Scope

- Any change to `AvailablePanPresetIds`/the subset-restriction feature
  itself — only the separate default-within-the-subset control goes away.
- Changing which pan is stored as the recipe's source
  (`PanShape`/`PanDiameter`/etc.) — that continues to be set the same way,
  via `handlePanPreset`, and is simply now the *only* notion of "default"
  rather than one of two.
- Backfilling or preserving `DefaultPanPresetId` values before the column is
  dropped — see Requirements: falling back to the source tin was already the
  documented 053 behavior for "no default set," so no recipe's reader-facing
  behavior changes as a result of losing the column, except a recipe that had
  deliberately set a default different from its source tin (which reverts to
  the source tin).

## Open Questions

None. The two decisions worth pinning down — whether to retire
`DefaultPanPresetId` fully vs. leave it dormant, and whether the message gate
applies to guidance, the warning, or both — were resolved with the user
before this spec was written (full retirement; both messages share the same
gate).
