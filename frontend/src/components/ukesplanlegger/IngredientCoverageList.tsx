"use client";

import type { CoverageStatus, EntryCoverage } from "@/lib/services/stock.service";
import { formatAmount } from "@/components/beholdning/stockDisplay";

const STATUS_STYLE: Record<CoverageStatus, { label: string; className: string }> = {
  har: { label: "har", className: "bg-green-100 text-green-800" },
  kanskje: { label: "kanskje", className: "bg-amber-100 text-amber-800" },
  mangler: { label: "mangler", className: "bg-red-100 text-red-700" },
};

/** Which of a planned recipe's ingredients the household has at home. */
export function IngredientCoverageList({ coverage }: { coverage: EntryCoverage }) {
  if (coverage.withoutIngredients) {
    return (
      <p data-testid="coverage-none" className="mt-2 text-xs text-gray-500 italic">
        Ingen ingrediensliste å sammenligne med.
      </p>
    );
  }
  if (coverage.ingredients.length === 0) return null;

  const count = (status: CoverageStatus) => coverage.ingredients.filter((i) => i.status === status).length;

  return (
    <details data-testid="ingredient-coverage" className="mt-2 text-xs">
      <summary className="cursor-pointer text-gray-700 font-medium min-h-[32px] flex items-center">
        Har {count("har")} av {coverage.ingredients.length}
        {count("kanskje") > 0 && `, kanskje ${count("kanskje")}`}
        {count("mangler") > 0 && `, mangler ${count("mangler")}`}
      </summary>
      <ul className="mt-1 space-y-1">
        {coverage.ingredients.map((ingredient, i) => {
          const style = STATUS_STYLE[ingredient.status];
          const amount = formatAmount(ingredient.quantity, ingredient.unit);
          return (
            <li key={i} data-testid="coverage-ingredient" className="flex items-start gap-2">
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full ${style.className}`}>{style.label}</span>
              <span className="text-gray-700 break-words">
                {ingredient.name}
                {amount && ` (${amount})`}
                {ingredient.sideDishTitle && <span className="text-gray-400"> · til {ingredient.sideDishTitle}</span>}
                {ingredient.status === "kanskje" && ingredient.stockName && (
                  <span className="text-gray-400"> · kanskje {ingredient.stockName}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
