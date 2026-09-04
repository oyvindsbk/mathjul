/**
 * Formatting helpers for recipe quantities and servings.
 *
 * These were duplicated verbatim between the recipe detail page and the
 * ingredients sheet. Extracted so matlagingsmodus reuses them rather than
 * becoming a third copy.
 */

import type { StructuredIngredient } from "@/lib/mock-data";
import { toFractionString } from "@/lib/fraction";

/**
 * Format a scaled quantity. Common kitchen fractions render as fractions
 * (0.25 becomes "1/4"), since that is how recipes are read; integers stay bare,
 * and anything else falls back to up to 2 decimals with trailing zeros trimmed.
 */
export function formatQuantity(quantity: number): string {
  if (quantity % 1 === 0) return quantity.toString();
  const fraction = toFractionString(quantity);
  if (fraction !== null) return fraction;
  return parseFloat(quantity.toFixed(2)).toString();
}

/**
 * Units whose amounts are counted rather than measured, so a fractional result
 * is meaningless — you cannot use 2.65 eggs. The empty string covers an
 * ingredient with no unit at all ("3 egg"), which is the common case.
 */
const COUNTABLE_UNITS: ReadonlySet<string> = new Set(["", "stk", "plate", "plater", "egg"]);

/**
 * Units measured in grams, where 5 g is finer than any kitchen scale needs.
 *
 * Several spellings, because the unit field is free text from AI extraction:
 * the same recipe can carry "g" on one ingredient and "gr" on the next, and a
 * spelling missing here falls through to the unrounded fallback and renders
 * amounts like "306.02 gr".
 */
const GRAM_UNITS: ReadonlySet<string> = new Set(["g", "gr", "gram", "grams", "grammer"]);

/**
 * Bulk units where the number is already small, so two decimals is precise
 * enough and rounding harder would distort the recipe (0.5 kg must not
 * become 1 kg).
 */
const BULK_UNITS: ReadonlySet<string> = new Set(["kg", "kilo", "l", "liter", "litre"]);

/**
 * Units a cook measures with a spoon or a decilitre cup. These have no
 * intermediate values — you reach for the 1/2 ts spoon — so they round to the
 * kitchen fractions `toFractionString` already knows.
 */
const SPOON_UNITS: ReadonlySet<string> = new Set(["dl", "ts", "ss"]);

/**
 * The fractions a measuring spoon or dl-cup can actually produce. Quarters and
 * eighths only: a Norwegian spoon set is 1/4, 1/2 and 1, so there is no way to
 * measure 2/3 ts even though it is the arithmetically nearer value to 0.65.
 */
const SPOON_STEPS: readonly number[] = [1 / 8, 1 / 4, 1 / 2, 3 / 4, 1];

/**
 * Round a scaled quantity to a value a cook can actually measure.
 *
 * Scaling by pan area produces amounts like 2.6533 egg or 530.66 g, which are
 * arithmetically right and practically useless. Each amount is rounded
 * independently against its own unit — the true factor is never rounded, so
 * errors do not compound across the ingredient list.
 *
 * Unknown units are returned unchanged: the unit field is free text filled in
 * by AI extraction, so the set of units seen in practice is open-ended, and
 * silently rounding something we do not recognise is worse than leaving it.
 */
export function roundForUnit(quantity: number, unit: string | null | undefined): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return quantity;

  const key = (unit ?? "").trim().toLowerCase();

  if (COUNTABLE_UNITS.has(key)) {
    // Clamped to 1: scaling a single egg down by 0.56 rounds to 0, which would
    // drop the ingredient from the recipe entirely.
    return Math.max(1, Math.round(quantity));
  }

  if (GRAM_UNITS.has(key)) {
    // Below 10 g the ingredient is a spice or a leavening agent, where 5 g of
    // slack is the whole amount — keep those at 1 g resolution.
    if (quantity < 10) return Math.round(quantity);
    return Math.round(quantity / 5) * 5;
  }

  if (BULK_UNITS.has(key)) {
    return parseFloat(quantity.toFixed(2));
  }

  if (SPOON_UNITS.has(key)) {
    const whole = Math.floor(quantity);
    const remainder = quantity - whole;

    // Snap the fractional part to the nearest measurable step. A remainder
    // close to 1 rounds up into the whole number rather than rendering "2 1/1".
    let nearest = SPOON_STEPS[0];
    for (const step of SPOON_STEPS) {
      if (Math.abs(step - remainder) < Math.abs(nearest - remainder)) nearest = step;
    }
    const snapped = remainder < SPOON_STEPS[0] / 2 ? 0 : nearest;

    const rounded = whole + snapped;
    // Never round a real amount away to nothing.
    return rounded > 0 ? rounded : SPOON_STEPS[0];
  }

  // Unknown unit: the field is free text, so we cannot pick a sensible kitchen
  // step. Still round to one decimal — the raw ratio of two pan volumes is
  // never round, and "306.02" reads as a bug even when the arithmetic is right.
  return parseFloat(quantity.toFixed(1));
}

/**
 * Split an ingredient into its bolded quantity+unit prefix and its name.
 *
 * Scaling is applied only when the recipe declares a base serving count;
 * otherwise the authored quantity is shown as-is.
 *
 * `quantityType` opts into unit-aware rounding. Only cakes (`"form"`) use it:
 * their factor is a ratio of two pan areas and is almost never a round number,
 * so the raw result needs rounding to be usable. Portion-count recipes scale by
 * tidy ratios already and keep their existing exact behaviour.
 */
export function formatIngredientParts(
  ingredient: StructuredIngredient,
  baseServings: number | null | undefined,
  desiredServings: number,
  quantityType?: string
): { qtyUnit: string; name: string } {
  let qtyStr = "";
  if (ingredient.quantity != null) {
    let scaled =
      baseServings && baseServings > 0
        ? (ingredient.quantity * desiredServings) / baseServings
        : ingredient.quantity;
    if (quantityType === "form") {
      scaled = roundForUnit(scaled, ingredient.unit);
    }
    qtyStr = formatQuantity(scaled);
  }
  const qtyUnit = [qtyStr, ingredient.unit].filter(Boolean).join(" ");
  return { qtyUnit, name: ingredient.name };
}

/** Label for the servings stepper, driven by the recipe's quantity type. */
export function servingsLabel(quantityType?: string, customUnit?: string | null): string {
  // Cakes measure in pan area, which the pan picker names itself ("Rund Ø24"),
  // so there is no unit to append after the number.
  if (quantityType === "form") return "";
  if (quantityType === "antall") return "stk";
  if (quantityType === "custom" && customUnit) return customUnit;
  return "porsjoner";
}
