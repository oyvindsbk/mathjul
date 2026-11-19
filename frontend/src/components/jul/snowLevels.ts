/**
 * The five snow levels on /jul (feature 067), from none to a full storm.
 * Each level is a recipe for random flakes: how many, how big, how fast,
 * how far they drift and whether they fall or whirl.
 */

export type SnowLevel = 0 | 1 | 2 | 3 | 4;

export const DEFAULT_SNOW_LEVEL: SnowLevel = 2;
export const MAX_SNOW_LEVEL: SnowLevel = 4;

export type SnowMotion = "fall" | "whirl";

export interface SnowLevelConfig {
  label: string;
  count: number;
  /** Flake size range in px. */
  size: readonly [number, number];
  /** Seconds per pass across the screen. */
  duration: readonly [number, number];
  /** Maximum sideways drift in px, either way. */
  drift: number;
  motion: SnowMotion;
}

export const SNOW_LEVELS: Record<SnowLevel, SnowLevelConfig> = {
  0: { label: "Ingen snø", count: 0, size: [0, 0], duration: [0, 0], drift: 0, motion: "fall" },
  1: { label: "Små snøfnugg", count: 14, size: [10, 16], duration: [14, 22], drift: 40, motion: "fall" },
  2: { label: "Lett snøfall", count: 32, size: [18, 32], duration: [9, 19], drift: 50, motion: "fall" },
  3: { label: "Snøen laver ned", count: 80, size: [14, 30], duration: [5, 10], drift: 90, motion: "fall" },
  4: { label: "Snøstorm", count: 150, size: [10, 26], duration: [2.5, 5], drift: 0, motion: "whirl" },
};

/** Parses a stored or input value into a level, or null if it isn't one. */
export function toSnowLevel(value: unknown): SnowLevel | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_SNOW_LEVEL ? (n as SnowLevel) : null;
}
