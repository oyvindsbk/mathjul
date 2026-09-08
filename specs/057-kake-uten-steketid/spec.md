# Feature: Kake uten steketid (no cooking time)

## Summary

Let a cake recipe (`QuantityType == "form"`) be marked as having no meaningful
cooking/baking time — e.g. an ice cake ("iskake") that is frozen, not baked —
and hide all cooking-time information for that recipe instead of showing or
computing it.

## Motivation

Cooking time only makes sense for recipes that are actually baked or cooked.
An ice cake has no oven step, so showing a "Steketid" field (or pan-derived
bake guidance) is misleading. Authors need a way to say "this recipe has no
cooking time" so the UI stops asking for or displaying one.

## Requirements

- A recipe with `QuantityType == "form"` can be flagged as having no cooking
  time.
- The flag is only meaningful for `"form"` recipes; it must be cleared when a
  recipe stops being `"form"` (same lifecycle as the other pan fields).
- When the flag is set:
  - The recipe editor hides the "Steketid (min)" input entirely and does not
    require it.
  - The recipe detail page does not render the "Steketid" badge.
  - `FormVelger`'s pan-derived bake guidance (`bakeGuidanceFor`) and the
    qualitative conversion warning (`conversionWarning`) are not shown, since
    both are about baking time/temperature.
- Existing `CookTime` / `CookTimeMinutes` values are **not cleared** when the
  flag is turned on — they stay in the database so authors don't lose data if
  they toggle the flag back off. All display/consumption sites must check the
  flag, not just field truthiness.
- Turning the flag back off restores normal cook-time display/validation
  using whatever `CookTime`/`CookTimeMinutes` values are still stored.

## Design

### Data Model

- New column on `Recipe`: `NoCookTime` (`bool`, default `false`).
  - Only meaningful when `QuantityType == "form"`.
  - Cleared (reset to `false`) by `ClearPanFieldsForNonForm` alongside the
    other pan-only fields when a recipe's `QuantityType` changes away from
    `"form"`.
- No changes to `CookTime` / `CookTimeMinutes` columns or the pan preset
  catalog (`frontend/src/lib/pan-size.ts`) — this is purely a per-recipe
  display flag, not a new pan preset concept.

### API Changes

- `RecipeDetailDto`, `SaveExtractedRecipeRequest`, and `UpdateRecipeRequest`
  (in `RecipesController.cs`) gain a `NoCookTime` boolean field, following the
  same threading pattern as `PanShape` etc.
- `ValidatePanFields` no longer requires `CookTime`/`CookTimeMinutes` to be
  meaningful when `NoCookTime` is true (if any such requirement exists today,
  otherwise no validation change is needed since cook time is not currently
  required at all).
- EF Core migration adding the `NoCookTime` column (`AddColumn`, default
  `false`), following the precedent of prior pan-field migrations — no data
  migration needed since the field is new.

### UI Changes

- `RecipeForm.tsx` (editor):
  - When `quantityType === 'form'`, show a checkbox (e.g. "Ingen steketid
    (f.eks. iskake)") near the pan fields.
  - When checked, hide the "Steketid (min)" input and its label, and skip it
    on submit validation.
  - When unchecked (or `quantityType !== 'form'`), current behavior is
    unchanged.
- `RecipeBody.tsx`: the "Steketid" badge renders only if
  `!recipe.noCookTime && recipe.cookTimeMinutes` (extends the existing
  truthiness gate).
- `FormVelger.tsx`: skip rendering both the bake-guidance box and the
  conversion-warning box when `recipe.noCookTime` is true, regardless of
  `hasConverted`.
- Frontend types (`RecipeFormData`, `RecipeDto`/detail DTO in
  `recipe.service.ts`, `Recipe` in `mock-data.ts`) gain `noCookTime: boolean`,
  mirrored from the backend field.
- Add an iskake-style fixture (`quantityType: 'form'`, `noCookTime: true`) to
  `mock-data.ts` for dev/testing.

## Out of Scope

- Any change to how cook time is calculated/scaled for recipes that do have
  one (spec 054's `BAKE_GUIDANCE` logic itself is untouched).
- Auto-clearing `CookTime`/`CookTimeMinutes` when the flag is turned on.
- Applying this flag to non-`"form"` recipes (portions/antall/custom) — cook
  time suppression is scoped to cakes only for this iteration.
- A general "no cooking required" concept for other recipe types (e.g. raw
  desserts, no-bake bars) — out of scope; can be a future generalization if
  needed.

## Open Questions

None — resolved with the user before implementation:
- Flag scope: per recipe (not per pan preset/shape).
- Data handling: hide only, keep `CookTime`/`CookTimeMinutes` in place.
- Editor UX: hide the cook time input entirely when the flag is on.
