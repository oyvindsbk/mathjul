/**
 * Fraction parsing and formatting for ingredient quantities.
 *
 * Quantities are stored as decimals — fractions are notation, not data. This
 * module is the single place that converts between the two, so the recipe form
 * (input) and the recipe views (display) agree on which fractions exist.
 */

/** Unicode fraction characters that show up when pasting from a web recipe. */
const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

/**
 * Common kitchen fractions, used for display. Deliberately not a general
 * decimal-to-fraction algorithm: that renders 0.35 as 7/20, which reads worse
 * than 0,35. Ordered so smaller denominators win when two entries are within
 * tolerance of the same value.
 */
const DISPLAY_FRACTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1 / 2, label: "1/2" },
  { value: 1 / 3, label: "1/3" },
  { value: 2 / 3, label: "2/3" },
  { value: 1 / 4, label: "1/4" },
  { value: 3 / 4, label: "3/4" },
  { value: 1 / 8, label: "1/8" },
  { value: 3 / 8, label: "3/8" },
  { value: 5 / 8, label: "5/8" },
  { value: 7 / 8, label: "7/8" },
];

/**
 * Scaling servings introduces float noise (a third of 3 servings scaled to 4
 * gives 0.4444…), and thirds are not exactly representable anyway. Comparing
 * within an epsilon keeps 2/3 rendering as 2/3.
 */
const TOLERANCE = 0.005;

/** Parse a decimal written with either separator: "1.5" and "1,5" both work. */
function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^\d*\.?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Parse "3/4" into 0.75. Returns null for a zero or missing denominator. */
function parseSimpleFraction(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Split a trailing unicode fraction off a string: "1½" becomes ["1", 0.5].
 * Returns null when the string does not end in one.
 */
function splitUnicodeFraction(raw: string): [string, number] | null {
  const last = raw.trim().slice(-1);
  const value = UNICODE_FRACTIONS[last];
  if (value === undefined) return null;
  return [raw.trim().slice(0, -1).trim(), value];
}

/**
 * Parse what the user typed into a quantity field.
 *
 * Accepts integers ("4"), decimals with either separator ("0.25", "1,5"),
 * simple fractions ("1/4"), mixed numbers ("1 1/2"), and unicode fractions
 * ("¼", "1½"). Returns null for anything else — including partial input like
 * "1/" — so the caller can tell valid input from an incomplete edit.
 */
export function parseQuantityInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Unicode fraction, alone ("½") or trailing a whole number ("1½").
  const unicodeSplit = splitUnicodeFraction(trimmed);
  if (unicodeSplit) {
    const [wholePart, fractionValue] = unicodeSplit;
    if (wholePart === "") return fractionValue;
    const whole = parseDecimal(wholePart);
    return whole === null ? null : whole + fractionValue;
  }

  const decimal = parseDecimal(trimmed);
  if (decimal !== null) return decimal;

  const simple = parseSimpleFraction(trimmed);
  if (simple !== null) return simple;

  // Mixed number: "1 1/2".
  const mixed = trimmed.match(/^(\d+)\s+(\d+\s*\/\s*\d+)$/);
  if (mixed) {
    const fraction = parseSimpleFraction(mixed[2]);
    if (fraction === null) return null;
    return Number(mixed[1]) + fraction;
  }

  return null;
}

/**
 * Render a value as a common kitchen fraction: 0.25 becomes "1/4", 1.5 becomes
 * "1 1/2". Returns null when no common fraction is close enough, leaving the
 * caller to fall back to decimal formatting.
 */
export function toFractionString(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;

  const whole = Math.floor(value);
  const remainder = value - whole;

  // A whole number is not a fraction — the caller renders it as-is.
  if (remainder < TOLERANCE) return null;

  // Just below the next integer (2.999) is a rounding artefact, not a fraction.
  if (remainder > 1 - TOLERANCE) return null;

  const match = DISPLAY_FRACTIONS.find(
    (candidate) => Math.abs(candidate.value - remainder) < TOLERANCE
  );
  if (!match) return null;

  return whole === 0 ? match.label : `${whole} ${match.label}`;
}
