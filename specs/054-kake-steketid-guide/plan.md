# Implementation Plan: Kaker — temperatur og steketid per form

## Approach

Pure frontend, additive to `pan-size.ts` and `FormVelger.tsx`. No backend, no
DB, no new props threaded further than `FormVelger` already receives — the
guidance is computed entirely from the preset the component already resolves
internally (`selected = volumeToPreset(value)`), so no new data has to flow in
from `RecipeBody` or `IngredientsTab`.

1. Add `BakeGuidance` type + `BAKE_GUIDANCE` table + `bakeGuidanceFor()` to
   `pan-size.ts`, next to `conversionWarning` since the two are read together.
2. Wire `bakeGuidanceFor(selected)` into `FormVelger`, gating the existing
   warning render behind "no guidance entry."
3. Extend the `kakeform.spec.ts` e2e suite: guidance shown for a covered
   preset, qualitative warning still shown for an uncovered one, guidance
   takes precedence when both a shape/depth change *and* table coverage are
   true simultaneously.

## Stacks Affected

- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **Lookup table keyed by preset id, not a formula.** The source chart's own
  bands are non-monotonic (Ø26/28/30 tie, then Ø33 breaks the trend on both
  axes) — a formula would either misrepresent the chart or require its own
  undocumented heuristic. A table is the only representation that doesn't
  invent data the source didn't give.
- **Guidance keyed to the selected pan, not the source pan.** The reader is
  about to bake in the selected pan; the source pan's own bake time is only
  relevant if source and selected are the same preset, which the lookup
  handles for free (no special-casing needed).
- **Guidance fully replaces the qualitative warning when present, never stacks
  with it.** Showing both would either repeat the same fact twice or read as
  contradictory advice ("watch the time" next to an exact time). One
  `data-testid` swap point in `FormVelger` keeps this an either/or by
  construction rather than by convention.
- **No new props on `FormVelger`.** `selected` is already computed inside the
  component from `value`; the guidance lookup is a pure function of that same
  preset, so it needs no new data threaded from callers. Keeps the change
  contained to two files.

## Risks

- **Table drifts from `PAN_PRESETS` as presets are added/removed later** (a
  future feature adds a preset, forgets the table has nothing to say about
  it). Mitigated by `Partial<Record<string, BakeGuidance>>` typing — a missing
  key is a normal, type-checked case (falls back to the warning), not a
  runtime error — so drift degrades gracefully rather than breaking anything.
- **Table entries feel authoritative but are Idun's ranges for their own
  recipes, not this app's.** Mitigated by wording the UI as a general
  guideline, matching the source chart's own framing, not as a promise.
