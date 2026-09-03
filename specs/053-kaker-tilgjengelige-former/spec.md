# Feature: Kaker — forfatterstyrt formutvalg

## Summary

The recipe author picks which of the 14 pan presets are offered as conversion
targets for their cake recipe, and which one is preselected by default. Today
`FormVelger` always lists every preset in `PAN_PRESETS`; this narrows that
list per recipe, at the author's discretion.

## Motivation

Not every baker owns a springform *and* a stor langpanne *and* seven round
diameters. A recipe author who only ever bakes their cake in a Ø24 and a
langpanne shouldn't have to see (or have their readers accidentally pick) ten
other tins that will never make sense for that recipe. Letting the author
curate the list also lets them flag which pan the recipe is *best* baked in,
distinct from the tin it happens to be written for.

## Requirements

- While editing a `form` recipe, the author can select a subset of
  `PAN_PRESETS` as "available" for that recipe.
- The author can mark exactly one of the selected presets as the **default**
  — the one `FormVelger` preselects when a reader opens the recipe.
- The recipe's own source tin (`PanShape`/`PanDiameter`/etc.) is always
  implicitly available and cannot be deselected — a recipe must always be
  convertible back to the tin it was written for.
- If the author selects no presets at all, `FormVelger` falls back to
  offering the full `PAN_PRESETS` list (today's behavior) — this feature
  narrows, it never leaves a recipe with zero usable options.
- If no default is chosen, the default stays the recipe's own source tin
  (today's behavior), not an arbitrary member of the subset.
- Existing cake recipes (no stored subset) are unaffected: full preset list,
  source tin preselected, exactly as today.

## Design

### Data Model

Two nullable columns on `Recipe`, alongside the existing pan fields:

| Column | Type | Notes |
|---|---|---|
| `AvailablePanPresetIds` | `List<string>?` | Subset of `PanPreset.id` values. JSON column, same pattern as `Tips`. Null/empty means "no restriction — offer everything." |
| `DefaultPanPresetId` | `string?` | One id, must be a member of `AvailablePanPresetIds` when both are set. Null means "default to the source tin," as today. |

Both are only meaningful for `QuantityType == "form"`; `ClearPanFieldsForNonForm`
clears them alongside the other pan fields when a recipe stops being a cake.

### API Changes

No new endpoints. `AvailablePanPresetIds` and `DefaultPanPresetId` are added to
`RecipeDto`, `RecipeDetailDto`, `SaveExtractedRecipeRequest`, and
`UpdateRecipeRequest`, following the exact field placement pattern the five
existing pan fields already use in `RecipesController`.

Backend validation (`ValidatePanFields`, extended):
- Every id in `AvailablePanPresetIds` must be a real `PanPreset.id` — validated
  against a backend copy of the id list (mirroring the existing `PanShapes`
  array pattern), since the preset table itself is frontend-only.
- `DefaultPanPresetId`, if set, must be a member of `AvailablePanPresetIds`
  (when that list is non-empty) — otherwise "the default" would be unreachable
  from "the available options," which is a contradiction the API should
  reject rather than silently accept.

### UI Changes

**`RecipeForm`** — the pan section (~line 1067, `handlePanPreset`) gains a
multi-select list of all 14 presets (checkboxes, grouped the same way
`FormVelger`'s `optgroup`s are) plus a single-select "default" control scoped
to whichever presets are currently checked. The recipe's own source preset is
shown checked and disabled — it cannot be unchecked.

**`FormVelger`** — `groupedPresets()` gains an optional filter: when the
recipe carries a non-empty `AvailablePanPresetIds`, only those ids (plus the
source preset, always) are rendered; otherwise every preset is shown, as
today. Initial `value` prefers `DefaultPanPresetId` when present, else falls
back to the source tin's volume as it does today.

## Out of Scope

- Reordering presets within the picker — display order stays `PAN_PRESETS`'s
  fixed order regardless of which subset is chosen.
- Per-recipe custom (non-preset) pans — still just a subset of the existing
  14, per [052](../052-kaker-formstorrelse/spec.md)'s own out-of-scope note.
- Any per-*user* preference (e.g. "which pans do I personally own,"
  independent of any recipe). This is scoped entirely to the recipe author's
  choice at edit time.

## Open Questions

None. Confirmed with the user: this is an author-time, per-recipe setting —
not a per-viewer/per-user preference.
