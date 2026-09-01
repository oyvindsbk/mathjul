# Implementation Plan: Kaker — skalering etter formstørrelse

## Approach

Reuse the existing scaling pipeline rather than building a parallel one. The
whole feature reduces to: *put an area in `Servings`, and swap the input
control*. `formatIngredientParts(ingredient, baseServings, desiredServings)`
already computes `quantity * desired / base`; feeding it two areas instead of
two portion counts is arithmetically identical, so matlagingsmodus, ingredient
mentions, the share page and the ukesplanlegger inherit cake scaling for free.

Work proceeds backend-first (model + migration + validation), then the pure
functions (area math, unit-aware rounding) which are trivially testable, then
the UI that composes them.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **`Servings` stores area (cm²), not a new field.** Keeps every downstream
  consumer working unchanged. The alternative — a parallel `PanArea` column —
  would force every scaling call site to branch on quantity type.
- **`QuantityType = "form"` is the cake marker, not a `RecipeKind` enum.** A
  cake is a recipe with a different portion unit, not a different kind of thing.
  A separate entity would duplicate search, ukesplan, favoritter and share.
- **Pure area scaling, not volume.** Matches how bakers actually convert tins.
  `PanHeight` is stored so depth-aware scaling stays possible without a second
  migration, but is deliberately not read.
- **True factor + per-unit rounding, not a snapped factor.** Snapping the whole
  factor to 2.5× or 3× keeps ingredient ratios exact but over- or under-fills
  the tin — 3× batter into a tin holding 2.65× overflows. Rounding each amount
  independently fills the tin correctly with negligible ratio drift, and is what
  a baker does by hand.
- **Presets live in the frontend, not the database.** They are display
  constants, never referenced by foreign key. A lookup table would add a
  migration and a join for no gain.

## Risks

- **`recipes/[id]/client.tsx:66` seeds `desiredServings` from `data.servings`.**
  For a cake this becomes an area (e.g. 452), which is correct but only because
  the picker — not a stepper — renders it. Verify the picker preselects the
  matching preset rather than showing a raw "452".
  *Mitigation:* the picker resolves area → preset by nearest match; covered by
  its own task and a unit test.
- **`stepUp`/`stepDown` in `ServingsStepper` would produce nonsense on areas**
  (452 → 453 cm²). *Mitigation:* the stepper is never rendered for `form`
  recipes — this is why the decision was picker-only, and the branch must be on
  `quantityType`, not on a prop being absent.
- **`servingsLabel()` returns "porsjoner" for unknown types**, so a cake would
  read "452 porsjoner" anywhere the label leaks. *Mitigation:* add the `form`
  case to `servingsLabel` in the same task that adds the type.
- **Rounding countables to whole numbers can produce 0** when scaling down
  (1 egg × 0.56 → 0.56 → 1, not 0). *Mitigation:* `roundForUnit` clamps
  countables to a minimum of 1 when the input was non-zero; explicit test case.
- **Existing rows have `QuantityType` non-null with a 20-char limit** — `"form"`
  fits, and the new columns are all nullable, so the migration is additive and
  needs no data backfill.
