# Implementation Plan: Kake uten steketid (no cooking time)

## Approach

Add a single boolean field (`NoCookTime`) to `Recipe`, threaded through the
same DTO/validation/lifecycle path as the existing pan-only fields
(`PanShape`, `AvailablePanPresetIds`, etc.), then gate the three existing
cook-time display sites (`RecipeBody` badge, `RecipeForm` input,
`FormVelger` guidance/warning) on it. No new entity, no changes to the pan
preset catalog or bake-guidance math.

## Stacks Affected

- [x] Backend
- [x] Frontend
- [ ] Infrastructure

## Key Decisions

- **Per-recipe flag, not per-preset**: cook time is already authored
  per-recipe (`CookTime`/`CookTimeMinutes` live on `Recipe`), and there is no
  kakeform/pan-preset entity to attach a flag to (presets are frontend
  constants only). A per-recipe boolean fits the existing shape exactly.
- **Hide, don't clear**: keep `CookTime`/`CookTimeMinutes` values in the
  database when the flag is set, so toggling it off later doesn't lose data.
  All consumers must check `NoCookTime` explicitly rather than relying on
  field truthiness.
- **Reuse the pan-field lifecycle**: `NoCookTime` resets to `false` in
  `ClearPanFieldsForNonForm` when `QuantityType` changes away from `"form"`,
  consistent with how the other pan-only fields are cleaned up.

## Risks

- **Missed consumption site**: cook time is read in at least three frontend
  places (`RecipeBody`, `RecipeForm`, `FormVelger`) — mitigated by grepping
  for `cookTimeMinutes`/`CookTime` across `frontend/src` before calling the
  feature done, to make sure no display site was missed.
- **Migration drift between Aspire/Docker**: new column must be picked up by
  both local Aspire (Debug) and Docker (Release) DB configs — mitigated by
  running the standard EF Core migration workflow used for prior pan-field
  columns.
