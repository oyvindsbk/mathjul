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
        onClick={() => onChange(Math.max(0.5, value - 1))}
        className={`${button} rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold flex items-center justify-center`}
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
        onClick={() => onChange(value + 1)}
        className={`${button} rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold flex items-center justify-center`}
        aria-label="Flere"
      >
        +
      </button>
      <span className="text-gray-600 text-sm">{servingsLabel(quantityType, customUnit)}</span>
    </div>
  );
}
