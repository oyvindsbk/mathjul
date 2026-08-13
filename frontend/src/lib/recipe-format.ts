/**
 * Formatting helpers for recipe quantities and servings.
 *
 * These were duplicated verbatim between the recipe detail page and the
 * ingredients sheet. Extracted so matlagingsmodus reuses them rather than
 * becoming a third copy.
 */

import type { StructuredIngredient } from "@/lib/mock-data";

/** Format a scaled quantity: integers stay bare, fractions get up to 2 decimals with trailing zeros trimmed. */
export function formatQuantity(quantity: number): string {
  if (quantity % 1 === 0) return quantity.toString();
  return parseFloat(quantity.toFixed(2)).toString();
}

/**
 * Split an ingredient into its bolded quantity+unit prefix and its name.
 *
 * Scaling is applied only when the recipe declares a base serving count;
 * otherwise the authored quantity is shown as-is.
 */
export function formatIngredientParts(
  ingredient: StructuredIngredient,
  baseServings: number | null | undefined,
  desiredServings: number
): { qtyUnit: string; name: string } {
  let qtyStr = "";
  if (ingredient.quantity != null) {
    const scaled =
      baseServings && baseServings > 0
        ? (ingredient.quantity * desiredServings) / baseServings
        : ingredient.quantity;
    qtyStr = formatQuantity(scaled);
  }
  const qtyUnit = [qtyStr, ingredient.unit].filter(Boolean).join(" ");
  return { qtyUnit, name: ingredient.name };
}

/** Label for the servings stepper, driven by the recipe's quantity type. */
export function servingsLabel(quantityType?: string, customUnit?: string | null): string {
  if (quantityType === "antall") return "stk";
  if (quantityType === "custom" && customUnit) return customUnit;
  return "porsjoner";
}
