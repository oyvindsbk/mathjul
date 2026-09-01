# Feature: Kaker — skalering etter formstørrelse

## Summary

Cake recipes scale by **pan volume**, not by portion count. A recipe authored for
a Ø24 round tin can be converted to a 30×40 langpanne by multiplying every
ingredient by the ratio of the two pans' volumes. This adds a fourth
`QuantityType` (`"form"`) that swaps the servings stepper for a pan picker.

## Motivation

"2 porsjoner kake" is meaningless. Cakes are described by the tin they are baked
in — *rund Ø24*, *langpanne 30×40*, *liten langpanne 20×30* — and bakers convert
between tins constantly. Today the only way to do this in mathjul is to enter a
fake serving count and do the arithmetic by hand.

## Requirements

- A recipe can declare its quantity as a **pan** rather than a portion count.
- The recipe detail page shows a **pan picker** in place of the servings stepper
  for such recipes; all ingredient amounts rescale on selection.
- Scaling factor is a **volume ratio**: `factor = targetVolume / sourceVolume`.
- Scaled amounts are **automatically rounded per unit** to kitchen-sensible
  values — the true factor is kept, each amount is rounded independently.
- A **warning** is shown when the selected pan differs enough from the source
  that bake time and cake height will change.
- Cakes are findable as a group: a seeded `Kake` category under `Måltidstype`.
- Existing recipes are untouched — `porsjoner` remains the default.

## Design

### Data Model

`Recipe` gains five nullable columns (EF Core migration, `Program.cs:265` already
runs `MigrateAsync()` on startup):

| Column | Type | Notes |
|---|---|---|
| `PanShape` | `string?` (20) | `"rund"` \| `"rektangulaer"` \| `"springform"` \| `"muffins"` |
| `PanDiameter` | `decimal?` | cm — round/springform |
| `PanLength` | `decimal?` | cm — rectangular |
| `PanWidth` | `decimal?` | cm — rectangular |
| `PanHeight` | `decimal?` | cm — **stored but unused**; reserved for future depth-aware scaling |

`QuantityType` gains a fourth legal value `"form"`. This value **is** the cake
marker — no separate entity, no separate table. A cake is a recipe with a
different portion unit.

`Servings` holds the **computed volume in cm³** for `form` recipes. This is the
key decision: it means `formatIngredientParts(ingredient, baseServings,
desiredServings)` and every downstream surface (matlagingsmodus, mentions,
ukesplanlegger, share, favoritter) keep working with no changes — they divide
volumes instead of portion counts, and the arithmetic is identical.

A verification pass over the frontend confirmed `servings` is never rendered as
a bare number; it reaches the UI only via `servingsLabel()` and as a divisor.
See **Risks** in `plan.md` for the two places this needed care.

#### Pan presets

Seeded as a static frontend lookup (not a DB table — they are display constants,
never referenced by FK):

| Preset | Shape | Dims | Depth | Volume |
|---|---|---|---|---|
| Rund Ø18 | rund | ⌀18 | 6,5 cm | 1654 cm³ |
| Rund Ø20 | rund | ⌀20 | 6,5 cm | 2042 cm³ |
| Rund Ø22 | rund | ⌀22 | 6,5 cm | 2471 cm³ |
| Rund Ø24 | rund | ⌀24 | 6,5 cm | 2941 cm³ |
| Rund Ø26 | rund | ⌀26 | 6,5 cm | 3451 cm³ |
| Rund Ø28 | rund | ⌀28 | 6,5 cm | 4002 cm³ |
| Rund Ø30 | rund | ⌀30 | 6,5 cm | 4595 cm³ |
| Springform Ø24 | springform | ⌀24 | 6,5 cm | 2941 cm³ |
| Springform Ø26 | springform | ⌀26 | 6,5 cm | 3451 cm³ |
| Brødform | rektangulaer | 12×22 | 7 cm | 1848 cm³ |
| Liten langpanne | rektangulaer | 20×30 | 5 cm | 3000 cm³ |
| Langpanne | rektangulaer | 30×40 | 3,5 cm | 4200 cm³ |
| Stor langpanne | rektangulaer | 40×50 | 3,5 cm | 7000 cm³ |
| Muffins 12 stk | muffins | 12 stk | — | 1200 cm³ |

Round volume = `π · (d/2)² · h`. Rectangular = `l · w · h`. Muffins are counted,
not measured: one muffin ≈ 100 cm³, so 12 stk ≈ 1,2 l. This keeps muffins on the
same single-number axis as every other pan.

**Why volume and not area.** Published Norwegian scaling charts quote 4,2 l for a
30×40 langpanne and 3 l for a 20×30, against a 6,5 cm round form — the depths
above reproduce those figures exactly. Depth is not constant across shapes: a
langpanne is roughly half as deep as a round tin, so a factor built on footprint
alone overstates the batter by ~75% on a round→langpanne conversion, which is
the conversion this feature exists for. Ø24 → langpanne 30×40 is **1,43** by
volume (the charts round it to 1,5); by area it would have been 2,65.

#### Category

Seed `new Category { Id = 17, Name = "Kake", Group = "Måltidstype" }` in
`RecipeDbContext.cs` (~line 352), and expose it from `RecipeCategories.cs` as a
named constant alongside `TilbehorId`, following the existing pattern of
referencing non-ASCII category names by stable id rather than by name.

### API Changes

No new endpoints. The five pan columns are added to the existing recipe
create/update/detail DTOs in `RecipesController` and flow through unchanged.

Backend validation: when `QuantityType == "form"`, `PanShape` is required and
the dimensions matching that shape must be present and positive.

### UI Changes

**Pan picker** (`FormVelger`) — new component, replaces `ServingsStepper` on the
detail page when `quantityType === "form"`. Renders the preset list grouped by
shape with the source pan marked. Selecting a pan sets `desiredServings` to that
pan's volume. **No ± stepper alongside it** — the picker is the only control.

**Conversion warning** — shown when the chosen pan's depth differs from the
source by more than 25%, or when shape changes between round and rectangular:

> *Kaken blir tynnere/tykkere enn originalen. Følg med på steketiden.*

**Unit-aware rounding** — new `roundForUnit(quantity, unit)` in
`recipe-format.ts`, applied after scaling, before `formatQuantity`:

| Unit class | Rule | Example (1.43×) |
|---|---|---|
| Countable (no unit, `stk`, `plate`, `egg`) | whole number | 3 → 4 |
| Weight `g` | nearest 5 g | 200 g → 285 g |
| Weight `kg`, volume `l` | 2 decimals | — |
| Volume `dl`, `ts`, `ss` | existing kitchen fractions via `toFractionString` | 2 ts → 2¾ ts |
| Unknown/other | unchanged (current behaviour) | — |

**RecipeForm** — the quantity-type picker (~line 1067) gains a fourth `Form`
option; choosing it swaps the numeric servings input for the same pan picker
plus an optional height field.

## Out of Scope

- A dedicated `/kaker` menu item or listing page. The `Kake` category makes this
  a later one-line addition; this feature does not add navigation.
- Per-recipe custom depths. Presets carry a standard depth for their shape, and
  a recipe's own `PanHeight` overrides it, but the picker offers no way to dial
  in an arbitrary depth.
- Adjusting bake time or temperature automatically — only a warning is shown.
- Freeform user-defined pans beyond the preset list.
- Backfilling existing Søtbakst recipes to `form`.

## Open Questions

None. Automatic per-unit rounding, picker-only UI, and the
category+`QuantityType` separation were settled with the user before this spec
was written.

Scaling was originally specified as **pure area**, and built that way. Published
Norwegian baking charts later showed that model to be wrong across shapes — it
overstated a round→langpanne conversion by ~75% — and the user chose to switch
to volume. The depths above reproduce every value in those charts to one
decimal.
