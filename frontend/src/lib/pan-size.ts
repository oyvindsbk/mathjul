/**
 * Baking tin presets and volume math for cake recipes (`quantityType === "form"`).
 *
 * A cake is scaled by the ratio of two tin volumes rather than by a portion
 * count. The recipe's `servings` field holds the source tin's volume in cm³, so
 * the existing scaling pipeline — `formatIngredientParts(ingredient,
 * baseServings, desiredServings)` — works unchanged: it divides two volumes
 * instead of two portion counts, which is the same arithmetic.
 *
 * Volume rather than footprint, because depth is not constant across shapes: a
 * langpanne is roughly half the depth of a round tin, and scaling by area alone
 * overstates the batter by ~75% on a round→langpanne conversion. The published
 * Norwegian scaling charts all assume a 6,5 cm round form and are reproduced by
 * this module to one decimal.
 *
 * Presets live here rather than in the database because they are display
 * constants, never referenced by foreign key.
 */

/** Tin shapes. Matches `Recipe.PanShape` on the backend. */
export type PanShape = "rund" | "rektangulaer" | "muffins";

/** The dimensions a tin can carry. Which ones are set depends on the shape. */
export interface PanDimensions {
  /** cm — round tins. */
  diameter?: number | null;
  /** cm — rectangular tins. */
  length?: number | null;
  /** cm — rectangular tins. */
  width?: number | null;
  /**
   * cm. Part of the scaling factor: depth is what separates a langpanne from a
   * round tin of the same footprint. Optional — {@link panVolume} falls back to
   * the standard depth for the shape.
   */
  height?: number | null;
}

/** A named tin the user can pick from. */
export interface PanPreset extends PanDimensions {
  /** Stable identifier, safe to use as a React key or a select value. */
  id: string;
  /** Norwegian display name, e.g. "Rund Ø24" or "Langpanne 30×40". */
  label: string;
  shape: PanShape;
  /** Number of muffins — muffin tins only. */
  count?: number;
}

/**
 * Standard depth of a round tin, in cm. The Norwegian scaling charts this
 * module reproduces are all quoted from a 6,5 cm round form, and every
 * published factor falls out of that assumption.
 */
export const ROUND_HEIGHT_CM = 6.5;

/**
 * Batter volume of a single muffin, in cm³. Muffins are counted, not measured,
 * so they need a conversion onto the same axis as every other tin. 100 cm³ puts
 * a standard 12-stk tin at 1.2 litres, which is about what a dozen muffins
 * actually hold.
 */
export const MUFFIN_VOLUME_CM3 = 100;

/**
 * The tins offered by the picker, in the order they are shown within each
 * shape group. Areas are computed, never hardcoded, so a preset cannot drift
 * out of sync with its own dimensions.
 */
export const PAN_PRESETS: readonly PanPreset[] = [
  { id: "rund-18", label: "Rund Ø18", shape: "rund", diameter: 18, height: ROUND_HEIGHT_CM },
  { id: "rund-20", label: "Rund Ø20", shape: "rund", diameter: 20, height: ROUND_HEIGHT_CM },
  { id: "rund-22", label: "Rund Ø22", shape: "rund", diameter: 22, height: ROUND_HEIGHT_CM },
  { id: "rund-24", label: "Rund Ø24", shape: "rund", diameter: 24, height: ROUND_HEIGHT_CM },
  { id: "rund-26", label: "Rund Ø26", shape: "rund", diameter: 26, height: ROUND_HEIGHT_CM },
  { id: "rund-28", label: "Rund Ø28", shape: "rund", diameter: 28, height: ROUND_HEIGHT_CM },
  { id: "rund-30", label: "Rund Ø30", shape: "rund", diameter: 30, height: ROUND_HEIGHT_CM },
  {
    id: "brodform-12x22",
    label: "Brødform 12×22",
    shape: "rektangulaer",
    length: 22,
    width: 12,
    height: 7,
  },
  {
    id: "liten-langpanne-20x30",
    label: "Liten langpanne 20×30",
    shape: "rektangulaer",
    length: 30,
    width: 20,
    height: 5,
  },
  {
    id: "langpanne-30x40",
    label: "Langpanne 30×40",
    shape: "rektangulaer",
    length: 40,
    width: 30,
    height: 3.5,
  },
  {
    id: "stor-langpanne-40x50",
    label: "Stor langpanne 40×50",
    shape: "rektangulaer",
    length: 50,
    width: 40,
    height: 3.5,
  },
  { id: "muffins-12", label: "Muffins 12 stk", shape: "muffins", count: 12 },
] as const;

/** The shape groups, in picker display order. */
export const PAN_SHAPE_ORDER: readonly PanShape[] = [
  "rund",
  "rektangulaer",
  "muffins",
];

/** Norwegian heading for each shape group. */
export const PAN_SHAPE_LABELS: Record<PanShape, string> = {
  rund: "Runde former",
  rektangulaer: "Langpanner og brødformer",
  muffins: "Muffins",
};

/**
 * Batter volume of a tin in cm³, or null when the dimensions the shape needs
 * are missing or non-positive.
 *
 * Volume, not footprint: a langpanne is roughly half the depth of a round tin,
 * so scaling by area alone overstates the batter by ~75% on exactly the
 * conversion this feature exists for. The published Norwegian charts are all
 * reproduced to one decimal by this function — see the tests.
 *
 * A missing height falls back to the standard depth for the shape, so a recipe
 * saved before heights existed still scales sensibly.
 */
export function panVolume(
  shape: PanShape,
  dims: PanDimensions & { count?: number }
): number | null {
  const positive = (value: number | null | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

  switch (shape) {
    case "rund": {
      const diameter = positive(dims.diameter);
      if (diameter === null) return null;
      const height = positive(dims.height) ?? ROUND_HEIGHT_CM;
      return Math.PI * (diameter / 2) ** 2 * height;
    }
    case "rektangulaer": {
      const length = positive(dims.length);
      const width = positive(dims.width);
      if (length === null || width === null) return null;
      // Rectangular tins vary far more in depth than round ones, so an unknown
      // height falls back to the round standard rather than guessing shallower.
      const height = positive(dims.height) ?? ROUND_HEIGHT_CM;
      return length * width * height;
    }
    case "muffins": {
      const count = positive(dims.count) ?? 12;
      return count * MUFFIN_VOLUME_CM3;
    }
  }
}

/** Volume of a preset. Every preset is well-formed, so this never returns null. */
export function presetVolume(preset: PanPreset): number {
  // Non-null by construction: PAN_PRESETS carries the dimensions each shape needs.
  return panVolume(preset.shape, preset) ?? 0;
}

/**
 * Resolve a stored volume back to the preset that produced it.
 *
 * The recipe stores a volume, not a preset id, so the picker has to work
 * backwards to decide which entry to mark as selected. Nearest match rather
 * than exact: rounding on the way through the API can shift 2940.5… by a
 * fraction, and a picker that silently selects nothing is worse than one that
 * selects the tin the number is unmistakably closest to.
 *
 * `tolerance` is the fraction of the volume allowed to differ (default 2%);
 * beyond that the volume belongs to no preset and null is returned, so a custom
 * tin is not misreported as a standard one.
 */
export function volumeToPreset(
  volume: number | null | undefined,
  tolerance = 0.02
): PanPreset | null {
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume <= 0) return null;

  let best: PanPreset | null = null;
  let bestDelta = Infinity;

  for (const preset of PAN_PRESETS) {
    const delta = Math.abs(presetVolume(preset) - volume);
    if (delta < bestDelta) {
      best = preset;
      bestDelta = delta;
    }
  }

  if (best === null) return null;
  return bestDelta <= volume * tolerance ? best : null;
}

/**
 * Find the preset matching a recipe's stored shape and dimensions.
 *
 * Preferred over {@link volumeToPreset} when the shape is known, because two
 * different tins can share a volume and only the shape (and dimensions)
 * disambiguate them. Falls back to null when the recipe describes a tin not
 * in the list.
 */
export function findPreset(
  shape: PanShape | string | null | undefined,
  dims: PanDimensions
): PanPreset | null {
  if (!shape) return null;

  const sameNumber = (a: number | null | undefined, b: number | null | undefined): boolean =>
    typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.01;

  return (
    PAN_PRESETS.find((preset) => {
      if (preset.shape !== shape) return false;
      switch (preset.shape) {
        case "rund":
          return sameNumber(preset.diameter, dims.diameter);
        case "rektangulaer":
          return sameNumber(preset.length, dims.length) && sameNumber(preset.width, dims.width);
        case "muffins":
          return true;
      }
    }) ?? null
  );
}

/**
 * How far the area may drift before the cake's height and bake time change
 * enough to be worth warning about. 25% is roughly one preset step at the
 * small end (Ø22 → Ø24), so smaller adjustments stay quiet.
 */
/**
 * How far the batter depth may change before bake time is affected enough to
 * be worth a warning. 25% is about the gap between a 6,5 cm round tin and a
 * 5 cm liten langpanne, so ordinary size changes within a shape stay quiet.
 */
const DEPTH_WARNING_THRESHOLD = 0.25;

/** Shapes that behave alike in the oven, so switching between them is not a change. */
function shapeFamily(shape: PanShape): "rund" | "rektangulaer" | "muffins" {
  if (shape === "rund") return "rund";
  return shape === "muffins" ? "muffins" : "rektangulaer";
}

/** A preset's depth, falling back to the standard for its shape. */
function presetHeight(preset: PanPreset): number {
  return typeof preset.height === "number" && preset.height > 0
    ? preset.height
    : ROUND_HEIGHT_CM;
}

/**
 * The warning to show when converting between two tins, or null when the
 * conversion is uneventful.
 *
 * The amounts are already scaled by volume, so the cake is no longer the wrong
 * size — what changes is how deep the batter sits, and therefore how long it
 * bakes. Fires on a large depth change or on a shape change. Deliberately
 * advisory: the feature does not adjust bake time or temperature, it only tells
 * the baker to watch.
 */
export function conversionWarning(from: PanPreset | null, to: PanPreset | null): string | null {
  if (from === null || to === null) return null;
  if (from.id === to.id) return null;

  const fromHeight = presetHeight(from);
  const toHeight = presetHeight(to);
  if (fromHeight <= 0 || toHeight <= 0) return null;

  const depthChanged =
    Math.abs(toHeight - fromHeight) / fromHeight > DEPTH_WARNING_THRESHOLD;
  const shapeChanged = shapeFamily(from.shape) !== shapeFamily(to.shape);

  if (!depthChanged && !shapeChanged) return null;

  // Shallower batter bakes faster, deeper batter slower — say which, since that
  // is the only thing the baker has to act on.
  const thinner = toHeight < fromHeight ? "tynnere" : "tykkere";
  return `Kaken blir ${thinner} enn originalen. Følg med på steketiden.`;
}

/** A concrete oven temperature and bake-time range for one pan preset. */
export interface BakeGuidance {
  tempMinC: number;
  tempMaxC: number;
  timeMinMinutes: number;
  timeMaxMinutes: number;
}

/**
 * Temperature and bake-time ranges reproduced from a published Norwegian
 * baking chart ("Grader og steketider"), keyed by preset id.
 *
 * A lookup, not a formula: the chart's own bands are not a function of
 * volume — Ø26, Ø28 and Ø30 share one band, then Ø33 breaks the trend with
 * both a lower temperature and a longer time. No volume-ratio model
 * reproduces that, so only the chart's actual entries are encoded here.
 *
 * Deliberately partial. The chart's Ø23 and Ø33 rows have no matching entry
 * in {@link PAN_PRESETS} and are omitted; brødform, stor langpanne and
 * muffins aren't addressed by the chart at all. A preset missing here falls
 * back to {@link conversionWarning}'s qualitative guidance — see callers.
 */
const BAKE_GUIDANCE: Partial<Record<string, BakeGuidance>> = {
  "rund-24": { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 30, timeMaxMinutes: 35 },
  "rund-26": { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "rund-28": { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "rund-30": { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 35, timeMaxMinutes: 40 },
  "liten-langpanne-20x30": { tempMinC: 175, tempMaxC: 180, timeMinMinutes: 25, timeMaxMinutes: 30 },
  "langpanne-30x40": { tempMinC: 160, tempMaxC: 170, timeMinMinutes: 35, timeMaxMinutes: 40 },
};

/**
 * The chart's temperature and bake-time range for a pan, or null when the
 * chart doesn't address that preset.
 */
export function bakeGuidanceFor(preset: PanPreset | null): BakeGuidance | null {
  if (preset === null) return null;
  return BAKE_GUIDANCE[preset.id] ?? null;
}

/**
 * Presets grouped by shape, in display order. Empty groups are omitted.
 *
 * @param allowedIds When given a non-empty list, only presets whose id is in
 * it are included — the recipe author's curated subset. Omitted/empty means
 * no restriction, today's behavior of listing every preset.
 */
export function groupedPresets(allowedIds?: readonly string[] | null): ReadonlyArray<{
  shape: PanShape;
  label: string;
  presets: PanPreset[];
}> {
  const filter =
    allowedIds && allowedIds.length > 0
      ? (preset: PanPreset) => allowedIds.includes(preset.id)
      : () => true;

  return PAN_SHAPE_ORDER.map((shape) => ({
    shape,
    label: PAN_SHAPE_LABELS[shape],
    presets: PAN_PRESETS.filter((preset) => preset.shape === shape && filter(preset)),
  })).filter((group) => group.presets.length > 0);
}
