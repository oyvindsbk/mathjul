import type { MealPlan } from "@/lib/services/mealplan.service";
import type { Leverandor } from "@/lib/services/matkasse.service";
import { MEAL_TYPE_ICONS } from "./MealTypeFilter";

export const LEVERANDOR_LOGOS: Record<Leverandor, string> = {
  Hellofresh: "/icons/logo-hellofresh.png",
  Kokkeloren: "/icons/logo-kokkeloren.png",
  GodtLevert: "/icons/logo-godtlevert.png",
};

export interface EntryDisplay {
  title: string;
  /** Emoji to show, or null when a matkasse logo takes its place. */
  icon: string | null;
  /** Matkasse provider logo, or null for recipe and custom entries. */
  matkasseLogo: string | null;
  sideDishTitles: string[];
  isCustom: boolean;
  isMatkasse: boolean;
}

/**
 * Resolves how an entry should be shown. The three entry kinds (recipe, matkasse,
 * custom card) are mutually exclusive but each carries its title in a different
 * field, so every surface rendering an entry needs this same fan-out.
 */
export function resolveEntryDisplay(plan: MealPlan): EntryDisplay {
  const isCustom = plan.isCustom;
  const isMatkasse = plan.matkasseRecipe != null;

  const title = isCustom
    ? (plan.customTitle ?? "")
    : isMatkasse
      ? plan.matkasseRecipe!.tittel
      : (plan.recipe?.title ?? "");

  const iconCategory = isMatkasse
    ? null
    : (plan.recipe?.mealTypeCategories?.find((c) => MEAL_TYPE_ICONS[c]) ?? plan.recipe?.mealTypeCategory ?? null);

  const icon = isCustom
    ? "✏️"
    : isMatkasse
      ? null
      : (iconCategory ? (MEAL_TYPE_ICONS[iconCategory] ?? "🍴") : "🍴");

  const matkasseLogo = isMatkasse
    ? LEVERANDOR_LOGOS[plan.matkasseRecipe!.leverandor as Leverandor]
    : null;

  const sideDishTitles = isCustom || isMatkasse ? [] : (plan.recipe?.sideDishTitles ?? []);

  return { title, icon, matkasseLogo, sideDishTitles, isCustom, isMatkasse };
}

/** "mandag 17. august" — capitalize at the call site where it heads a block. */
export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
}

/** yyyy-MM-dd in local time. Date.toISOString() would shift across the UTC boundary. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Inverse of formatDate. Built field by field on purpose: new Date("2026-08-17")
 * parses a bare date string as UTC midnight, which resolves to the previous day
 * in any negative-offset zone.
 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
