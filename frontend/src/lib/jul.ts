/**
 * Season, countdown and grouping helpers for the /jul page (feature 066).
 *
 * Everything here is a pure function of its input, so the season window and
 * the countdown can be checked by pinning the clock in Playwright. Dates are
 * evaluated in Europe/Oslo: julaften starts at Norwegian midnight, not at the
 * browser's local midnight or at UTC.
 */

import { TILBEHOR_CATEGORY_ID, type Recipe } from './mock-data';

/** A calendar date in Europe/Oslo. `month` is 1–12. */
export interface OsloDate {
  year: number;
  month: number;
  day: number;
}

const osloFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Europe/Oslo calendar date of an instant. */
export function osloDate(now: Date = new Date()): OsloDate {
  const parts = osloFormatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** True from 1 November to 6 January, both inclusive. */
export function isJulSeason(date: OsloDate): boolean {
  return date.month === 11 || date.month === 12 || (date.month === 1 && date.day <= 6);
}

export type JulCountdown =
  | { kind: 'days'; days: number }
  | { kind: 'tomorrow' }
  | { kind: 'godJul' }
  | { kind: 'nyttAar' };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one calendar date to another, ignoring time of day and DST. */
function daysBetween(from: OsloDate, to: OsloDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / DAY_MS);
}

/**
 * Where we are relative to julaften: God jul on 24–26 Dec, Godt nytt år from
 * 27 Dec to 6 Jan, and otherwise the days left until the next 24 December.
 */
export function julCountdown(date: OsloDate): JulCountdown {
  const { year, month, day } = date;

  if (month === 12 && day >= 24 && day <= 26) return { kind: 'godJul' };
  if ((month === 12 && day >= 27) || (month === 1 && day <= 6)) return { kind: 'nyttAar' };

  const days = daysBetween(date, { year, month: 12, day: 24 });
  return days === 1 ? { kind: 'tomorrow' } : { kind: 'days', days };
}

/** The countdown as the line shown on the page. */
export function julCountdownText(countdown: JulCountdown): string {
  switch (countdown.kind) {
    case 'godJul':
      return 'God jul! 🎄';
    case 'nyttAar':
      return 'Godt nytt år!';
    case 'tomorrow':
      return 'I morgen er det julaften!';
    case 'days':
      return `${countdown.days} dager til julaften`;
  }
}

export interface JulSectionDef {
  key: string;
  title: string;
  /** Måltidstype categories that place a recipe here. Empty means "everything else". */
  categoryIds: readonly number[];
}

/** Section order: a recipe lands in the first section whose categories it carries. */
export const JUL_SECTIONS: readonly JulSectionDef[] = [
  { key: 'bakst', title: 'Julebakst og kaker', categoryIds: [6, 17] },
  { key: 'middag', title: 'Julemiddag', categoryIds: [3] },
  { key: 'tilbehor', title: 'Tilbehør', categoryIds: [TILBEHOR_CATEGORY_ID] },
  { key: 'dessert', title: 'Desserter', categoryIds: [4] },
  { key: 'drikke', title: 'Drikke', categoryIds: [8] },
  { key: 'mer', title: 'Mer jul', categoryIds: [] },
];

export interface JulSectionGroup {
  key: string;
  title: string;
  recipes: Recipe[];
}

/** The section a recipe belongs to; the catch-all when no listed category matches. */
function sectionKeyFor(recipe: Recipe): string {
  const ids = new Set(recipe.categories?.map((c) => c.id));
  const match = JUL_SECTIONS.find(
    (s) => s.categoryIds.length > 0 && s.categoryIds.some((id) => ids.has(id))
  );
  return match?.key ?? 'mer';
}

/**
 * Splits recipes into the ordered Jul sections. Each recipe appears once, empty
 * sections are dropped and recipes within a section are sorted by title.
 */
export function groupJulRecipes(recipes: readonly Recipe[]): JulSectionGroup[] {
  const byKey = new Map<string, Recipe[]>(JUL_SECTIONS.map((s) => [s.key, []]));
  const seen = new Set<number>();

  for (const recipe of recipes) {
    if (seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    byKey.get(sectionKeyFor(recipe))?.push(recipe);
  }

  return JUL_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    recipes: [...(byKey.get(s.key) ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'nb')),
  })).filter((s) => s.recipes.length > 0);
}
