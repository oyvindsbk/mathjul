"use client";

import type { IngredientSection, StructuredIngredient } from "@/lib/mock-data";
import { formatIngredientParts } from "@/lib/recipe-format";
import { normalizeIngredients } from "@/lib/recipe-sections";
import { CheckCircle } from "./CheckCircle";
import { ServingsStepper } from "./ServingsStepper";

interface IngredientsTabProps {
  ingredients?: StructuredIngredient[];
  ingredientSections?: IngredientSection[];
  servings?: number | null;
  quantityType?: string;
  customUnit?: string | null;
  desiredServings: number;
  onServingsChange: (n: number) => void;
  checkedIngredients: Set<string>;
  onToggleIngredient: (key: string) => void;
}

export function IngredientsTab({
  ingredients,
  ingredientSections,
  servings,
  quantityType,
  customUnit,
  desiredServings,
  onServingsChange,
  checkedIngredients,
  onToggleIngredient,
}: IngredientsTabProps) {
  const sections = normalizeIngredients(ingredients, ingredientSections);

  if (sections.length === 0) {
    return <p className="text-gray-500 px-1 py-4">Ingen ingredienser tilgjengelig</p>;
  }

  return (
    <div>
      {servings ? (
        <div className="pb-4 mb-4 border-b border-gray-100">
          <ServingsStepper
            value={desiredServings}
            onChange={onServingsChange}
            quantityType={quantityType}
            customUnit={customUnit}
            size="large"
          />
        </div>
      ) : null}

      <div className="space-y-5">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.heading && (
              <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">
                {section.heading}
              </h3>
            )}
            <ul className="space-y-2">
              {section.items.map(({ ingredient, key }) => {
                const { qtyUnit, name } = formatIngredientParts(ingredient, servings, desiredServings);
                const checked = checkedIngredients.has(key);
                const label = [qtyUnit, name].filter(Boolean).join(" ");
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onToggleIngredient(key)}
                      aria-pressed={checked}
                      aria-label={label}
                      className="w-full flex items-baseline gap-3 text-left rounded-lg border border-gray-200 bg-white px-4 py-3 min-h-[44px] hover:border-gray-300 active:bg-gray-50 transition-colors"
                    >
                      {/* Nudged down so the circle sits on the first text line rather than the baseline. */}
                      <span className="translate-y-0.5">
                        <CheckCircle checked={checked} />
                      </span>
                      <span className={`flex-1 ${checked ? "line-through text-gray-400" : ""}`}>
                        {qtyUnit && (
                          <span className={`font-semibold ${checked ? "" : "text-gray-900"}`}>{qtyUnit} </span>
                        )}
                        <span className={checked ? "" : "text-gray-600"}>{name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
