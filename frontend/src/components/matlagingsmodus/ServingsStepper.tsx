"use client";

import { servingsLabel } from "@/lib/recipe-format";

interface ServingsStepperProps {
  /** Current desired servings. Owned by the recipe page so every surface agrees. */
  value: number;
  onChange: (n: number) => void;
  quantityType?: string;
  customUnit?: string | null;
  /** Larger touch targets for the cooking overlay. */
  size?: "default" | "large";
}

/** Half a portion is the smallest step; below that the amounts stop being useful. */
const MIN_SERVINGS = 0.5;

/**
 * Step down from the current value.
 *
 * Values snap back onto the whole-number grid rather than carrying an offset:
 * stepping down from 1.5 gives 1, not 0.5. Only 1 steps down to the half
 * portion, so + and − are inverses everywhere.
 */
export function stepDown(value: number): number {
  if (value <= 1) return MIN_SERVINGS;
  return Math.max(1, Math.ceil(value) - 1);
}

/**
 * Step up from the current value, snapping onto the whole-number grid: 0.5
 * goes to 1 (not 1.5), and 1.5 goes to 2.
 */
export function stepUp(value: number): number {
  if (value < 1) return 1;
  return Math.floor(value) + 1;
}

/**
 * The −/+/input control for scaling a recipe.
 *
 * Previously duplicated between the recipe detail page and the ingredients
 * sheet; extracted so matlagingsmodus is not a third copy.
 */
export function ServingsStepper({
  value,
  onChange,
  quantityType,
  customUnit,
  size = "default",
}: ServingsStepperProps) {
  const button =
    size === "large"
      ? "w-11 h-11 text-xl min-h-[44px] min-w-[44px]"
      : "w-8 h-8 text-lg";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(stepDown(value))}
        disabled={value <= MIN_SERVINGS}
        className={`${button} rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-100`}
        aria-label="Færre"
      >
        −
      </button>
      <input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v > 0) onChange(v);
        }}
        className="text-xl font-bold text-gray-900 text-center w-16 border border-gray-200 rounded-lg px-1 py-0.5 bg-white focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Antall"
      />
      <button
        type="button"
        onClick={() => onChange(stepUp(value))}
        className={`${button} rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold flex items-center justify-center`}
        aria-label="Flere"
      >
        +
      </button>
      <span className="text-gray-600 text-sm">{servingsLabel(quantityType, customUnit)}</span>
    </div>
  );
}
