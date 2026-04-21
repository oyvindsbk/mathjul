"use client";

import { useEffect, useRef } from "react";
import type { IngredientSection, StructuredIngredient } from "@/lib/mock-data";

interface IngredientsSheetProps {
  open: boolean;
  onClose: () => void;
  ingredients?: StructuredIngredient[];
  ingredientSections?: IngredientSection[];
  servings?: number;
  quantityType?: string;
  customUnit?: string | null;
  desiredServings: number;
  onServingsChange: (n: number) => void;
}

function formatQty(q: number): string {
  if (q % 1 === 0) return q.toString();
  return parseFloat(q.toFixed(2)).toString();
}

function ingParts(
  ing: StructuredIngredient,
  base: number | null | undefined,
  desired: number
): { qtyUnit: string; name: string } {
  let qtyStr = "";
  if (ing.quantity != null) {
    const scaled = base && base > 0 ? (ing.quantity * desired) / base : ing.quantity;
    qtyStr = formatQty(scaled);
  }
  return { qtyUnit: [qtyStr, ing.unit].filter(Boolean).join(" "), name: ing.name };
}

function servingsLabel(quantityType?: string, customUnit?: string | null): string {
  if (quantityType === 'antall') return 'stk';
  if (quantityType === 'custom' && customUnit) return customUnit;
  return 'porsjoner';
}

export function IngredientsSheet({
  open,
  onClose,
  ingredients,
  ingredientSections,
  servings,
  quantityType,
  customUnit,
  desiredServings,
  onServingsChange,
}: IngredientsSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const renderIngredient = (ing: StructuredIngredient, key: number | string) => {
    const { qtyUnit, name } = ingParts(ing, servings, desiredServings);
    return (
      <li key={key} className="flex items-baseline gap-1.5 min-h-[36px]">
        {qtyUnit && <span className="font-semibold text-gray-900 shrink-0">{qtyUnit}</span>}
        <span className="text-gray-600 text-sm">{name}</span>
      </li>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ingredienser"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 max-h-[80vh] flex flex-col ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (touchStartY.current !== null) {
            const delta = e.changedTouches[0].clientY - touchStartY.current;
            if (delta > 60) onClose();
            touchStartY.current = null;
          }
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 shrink-0 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Ingredienser</h2>
          <button
            onClick={onClose}
            aria-label="Lukk ingrediensliste"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {servings && (
          <div className="flex items-center gap-3 px-5 py-3 shrink-0 border-b border-gray-100">
            <button
              onClick={() => onServingsChange(Math.max(0.5, desiredServings - 1))}
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-lg flex items-center justify-center"
              aria-label="Færre"
            >
              −
            </button>
            <input
              type="number"
              step="any"
              min="0"
              value={desiredServings}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onServingsChange(v);
              }}
              className="text-xl font-bold text-gray-900 text-center w-16 border border-gray-200 rounded-lg px-1 py-0.5 bg-white focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Antall"
            />
            <button
              onClick={() => onServingsChange(desiredServings + 1)}
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-lg flex items-center justify-center"
              aria-label="Flere"
            >
              +
            </button>
            <span className="text-gray-600 text-sm">{servingsLabel(quantityType, customUnit)}</span>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4 flex-1">
          {ingredientSections && ingredientSections.length > 0 ? (
            <div className="space-y-5">
              {ingredientSections.map((section, sIdx) => (
                <div key={sIdx}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">{section.heading}</h3>
                  <ul className="space-y-2">
                    {section.ingredients.map((ing, iIdx) => renderIngredient(ing, iIdx))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {ingredients && ingredients.length > 0 ? (
                ingredients.map((ing, idx) => renderIngredient(ing, idx))
              ) : (
                <li className="text-gray-500 text-sm">Ingen ingredienser tilgjengelig</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
