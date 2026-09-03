# Feature: Kaker — temperatur og steketid per form

## Summary

Show concrete oven temperature and bake-time ranges for the selected pan on a
cake recipe (`quantityType === "form"`), sourced from a small static lookup
table keyed by preset id. Replaces today's qualitative "kaken blir
tynnere/tykkere" warning for presets the table covers; the existing warning
stays as the fallback for presets it doesn't.

## Motivation

`conversionWarning` ([pan-size.ts:276-294](../../frontend/src/lib/pan-size.ts))
already tells a baker *that* the bake time will change when they convert to a
different tin, but not *to what*. A published reference chart ("Grader og
steketider") gives real, testable ranges per pan size — round Ø23-Ø30 bake at
175-180°C for 30-40 minutes depending on size, Ø33 drops to 160-170°C for
50-55 minutes, and the two langpanne sizes each carry their own band. This
data is a lookup, not a formula — Ø26/28/30 share a band and Ø33 breaks the
pattern with both a lower temperature and a longer time, which volume-ratio
math cannot produce. Giving bakers the number outright is more useful than
telling them to watch the oven.

## Requirements

- For a pan preset the table covers, the picker shows the temperature range
  and bake-time range for the **selected** pan (not the source pan) —
  the reader picked that tin because that's what they're baking in.
- For a pan preset the table does not cover, fall back to today's qualitative
  `conversionWarning` unchanged — no guidance is worse than wrong guidance,
  and no volume-ratio formula reliably reproduces this chart's bands (see
  Motivation).
- Selecting the recipe's own source tin, when the source has table coverage,
  shows that tin's own range — this is not conditional on conversion; it
  replaces the recipe's single authored `cookTimeMinutes` display for cakes
  with the table's own text, since the table is strictly more specific for
  covered presets.
- The guidance is advisory text only — this feature does not write to
  `Recipe.CookTimeMinutes`, does not change the authored recipe, and does not
  affect scaling math (`formatIngredientParts` is untouched).
- Renders everywhere `FormVelger` renders: the recipe detail page and
  matlagingsmodus's ingredients tab (`IngredientsTab`).

## Design

### Data Model

A new frontend-only constant in `pan-size.ts`, following the same "display
constant, never a DB table" precedent as `PAN_PRESETS` itself
([052's spec](../052-kaker-formstorrelse/spec.md#data-model)):

```ts
interface BakeGuidance {
  tempMinC: number;
  tempMaxC: number;
  timeMinMinutes: number;
  timeMaxMinutes: number;
}

const BAKE_GUIDANCE: Partial<Record<string, BakeGuidance>> = {
  // No "rund-23" preset exists in PAN_PRESETS (18/20/22/24/26/28/30 only),
  // so the chart's Ø23 row has nothing to key to and is omitted here.
  "rund-24":              { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 30, timeMaxMinutes: 35 },
  "rund-26":              { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "rund-28":              { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "rund-30":              { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "liten-langpanne-20x30":{ tempMinC: 175, tempMaxC: 180, timeMinMinutes: 25, timeMaxMinutes: 30 },
  "langpanne-30x40":      { tempMinC: 160, tempMaxC: 170, timeMinMinutes: 35, timeMaxMinutes: 40 },
};
```

Exported as a function, not the raw object, so callers can't mutate the table
and the "no entry" case is a single, obvious check:

```ts
function bakeGuidanceFor(preset: PanPreset | null): BakeGuidance | null;
```

**Coverage gaps, deliberately left uncovered:**
- `rund-18`, `rund-20`, `rund-22` — smaller than the chart's smallest entry
  (Ø23); no safe interpolation, the chart doesn't imply a trend below Ø23.
- `brodform-12x22` — not a shape the chart addresses at all.
- `stor-langpanne-40x50` — the chart's langpanne rows are 20×30 and 30×40
  only; 40×50 is a different, larger pan the source doesn't speak to.
- `muffins-12` — the chart has no muffin-tin row.

There is **no Ø33 preset** in `PAN_PRESETS` today, so that chart row has
nothing to attach to; it is simply unused by this feature (not an error, not
added as a new preset — out of scope, see below).

Note the reference chart's own `rund-33` band (160-170°C, 50-55 min) is
included above only in the id comment for traceability; it is omitted from
the table itself since no preset exists to key it to.

### UI Changes

**`FormVelger`** ([FormVelger.tsx](../../frontend/src/components/FormVelger.tsx)) —
computes `bakeGuidanceFor(selected)` (the currently *selected* preset, not the
source) alongside the existing `warning = conversionWarning(source, selected)`.
Render precedence:

1. If `bakeGuidanceFor(selected)` returns an entry, render it in place of the
   qualitative warning block — same position, own `data-testid`
   (`form-velger-bake-guidance`), styled as informational rather than amber
   ("watch out") since this is a fact, not a caution. Text form:
   `"175–180°C i 30–35 min"`.
2. Otherwise, fall back to today's `warning &&` block unchanged.

Only one of the two ever renders — the guidance text already implies "this
will be different from the original," so stacking both is redundant, not
additive.

### Out of Scope

- Adding a `rund-33`, `brodform`, `stor-langpanne`, or `muffins` row to the
  table by extrapolation — only the source chart's actual entries are
  encoded, per the Requirements above.
- Auto-adjusting `Recipe.CookTimeMinutes` or any backend field. This is
  reader-facing display only.
- A UI for the recipe author to author their own per-pan guidance — the table
  is a single shared reference, not per-recipe data.
- Interpolating a range for pan sizes between table entries.

## Open Questions

None. The fallback-to-qualitative-warning behavior for uncovered presets, and
the decision to key guidance to the *selected* pan rather than the source,
were the two decisions worth pinning down explicitly; both are settled above.
