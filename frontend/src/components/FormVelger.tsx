"use client";

import { useId } from "react";
import {
  PAN_PRESETS,
  volumeToPreset,
  conversionWarning,
  bakeGuidanceFor,
  findPreset,
  groupedPresets,
  presetVolume,
  type PanPreset,
  type PanShape,
} from "@/lib/pan-size";

interface FormVelgerProps {
  /**
   * The tin the recipe was authored for. Used to mark the source in the list and
   * to decide whether a conversion warrants a warning.
   */
  sourceShape?: PanShape | string | null;
  sourceDiameter?: number | null;
  sourceLength?: number | null;
  sourceWidth?: number | null;
  /**
   * The recipe's own stored base volume (`recipe.servings`) — the exact
   * number `formatIngredientParts` scales against. Selecting the source tin
   * must reproduce this value exactly; recomputing it from `PAN_PRESETS`
   * instead can disagree by a rounding error (the stored value may have been
   * rounded on save), which would silently drift every ingredient amount on
   * a round trip back to the original tin.
   */
  sourceVolume?: number | null;
  /**
   * Author-curated subset of preset ids to offer. Empty/undefined means no
   * restriction — every preset is shown, today's behavior.
   */
  availablePanPresetIds?: readonly string[] | null;
  /**
   * Currently selected volume in cm³ — the same `desiredServings` value the
   * servings stepper owns, so the recipe page needs no second piece of state.
   */
  value: number;
  /** Receives the selected tin's volume, ready to use as `desiredServings`. */
  onChange: (area: number) => void;
  /** Larger touch targets for the cooking overlay, matching `ServingsStepper`. */
  size?: "default" | "large";
}

/**
 * Resolve the recipe's source tin.
 *
 * Prefers the stored shape and dimensions over the stored volume, since two
 * different tins can share a volume. Falls back to matching on the stored
 * volume alone for recipes saved before the pan columns existed, or for a tin
 * whose dimensions were entered by hand.
 */
function resolveSource(
  shape: PanShape | string | null | undefined,
  diameter: number | null | undefined,
  length: number | null | undefined,
  width: number | null | undefined,
  volume: number
): PanPreset | null {
  return findPreset(shape, { diameter, length, width }) ?? volumeToPreset(volume);
}

/**
 * Pan picker for cake recipes (`quantityType === "form"`).
 *
 * Replaces the servings stepper entirely: a cake has no portion count to nudge
 * up and down, only a tin it is baked in. Picking a tin sets `desiredServings`
 * to that tin's volume, and the existing scaling pipeline divides the two
 * volumes exactly as it would two portion counts.
 *
 * A `select` rather than a row of chips: fourteen tins in four groups is a
 * taller block than the ingredient list it sits above, which pushed the amounts
 * — the thing you actually read while baking — off the screen in the recipe
 * page's narrow column. The shape groups survive as `optgroup`s.
 */
export function FormVelger({
  sourceShape,
  sourceDiameter,
  sourceLength,
  sourceWidth,
  sourceVolume,
  availablePanPresetIds,
  value,
  onChange,
  size = "default",
}: FormVelgerProps) {
  const selectId = useId();
  const source = resolveSource(sourceShape, sourceDiameter, sourceLength, sourceWidth, value);
  // The source tin is always offered, even if the author's subset excludes it —
  // a recipe must always be convertible back to the tin it was written for.
  const allowedIds =
    availablePanPresetIds && availablePanPresetIds.length > 0 && source
      ? Array.from(new Set([...availablePanPresetIds, source.id]))
      : availablePanPresetIds;
  const groups = groupedPresets(allowedIds);

  // The selected tin is derived from the area rather than held in state, so the
  // picker cannot disagree with the amounts rendered beside it.
  const selected = volumeToPreset(value);
  const guidance = bakeGuidanceFor(selected);
  // The published chart's exact numbers are strictly more useful than the
  // qualitative warning, so they replace it rather than stack alongside it —
  // whichever pan is selected, only one of the two ever renders.
  const warning = guidance ? null : conversionWarning(source, selected);

  const select =
    size === "large"
      ? "px-4 py-2.5 text-base min-h-[44px]"
      : "px-3 py-2 text-sm";

  return (
    <div data-testid="form-velger">
      <label
        className="block text-sm font-semibold text-gray-700 mb-2"
        htmlFor={selectId}
      >
        Bakeform
      </label>

      <select
        id={selectId}
        value={selected?.id ?? ""}
        onChange={(e) => {
          const preset = PAN_PRESETS.find((p) => p.id === e.target.value);
          if (!preset) return;
          // Re-selecting the source tin must reproduce the exact stored base,
          // not a value recomputed from PAN_PRESETS math that can disagree
          // with it by a rounding error — see `sourceVolume` above.
          const volume =
            source?.id === preset.id && typeof sourceVolume === "number" && sourceVolume > 0
              ? sourceVolume
              : presetVolume(preset);
          onChange(volume);
        }}
        className={`${select} w-full rounded-lg border border-gray-300 bg-white font-medium text-gray-900`}
      >
        {/* Only reachable for a stored area that matches no preset — a tin
            entered by hand, or one whose dimensions have since changed. */}
        {!selected && <option value="">Velg form</option>}
        {groups.map((group) => (
          <optgroup key={group.shape} label={group.label}>
            {group.presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
                {/* The source tin stays marked even while another is selected,
                    so the baker can always find their way back to the original. */}
                {source?.id === preset.id ? " (original)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {guidance && (
        <p
          className="mt-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2"
          role="status"
          data-testid="form-velger-bake-guidance"
        >
          {guidance.tempMinC}–{guidance.tempMaxC}°C i {guidance.timeMinMinutes}–{guidance.timeMaxMinutes} min
        </p>
      )}

      {warning && (
        <p
          className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          role="status"
          data-testid="form-velger-warning"
        >
          {warning}
        </p>
      )}
    </div>
  );
}
