"use client";

import { useState, useEffect, useRef } from "react";
import { IngredientsSheet } from "./IngredientsSheet";
import type { IngredientSection, StructuredIngredient } from "@/lib/mock-data";

interface FloatingIngredientsButtonProps {
  ingredients?: StructuredIngredient[];
  ingredientSections?: IngredientSection[];
  servings?: number;
  quantityType?: string;
  customUnit?: string | null;
  desiredServings: number;
  onServingsChange: (n: number) => void;
  ingredientsSectionId: string;
}

export function FloatingIngredientsButton({
  ingredients,
  ingredientSections,
  servings,
  quantityType,
  customUnit,
  desiredServings,
  onServingsChange,
  ingredientsSectionId,
}: FloatingIngredientsButtonProps) {
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.getElementById(ingredientsSectionId);
    if (!target) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    observerRef.current.observe(target);

    return () => observerRef.current?.disconnect();
  }, [ingredientsSectionId]);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Vis ingredienser"
        className={`md:hidden fixed z-30 transition-all duration-300 ${
          visible ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-4"
        }`}
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.75rem)", left: "50%", transform: `translateX(-50%) translateY(${visible ? "0" : "1rem"})` }}
      >
        <span className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg font-medium text-sm min-h-[44px]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ingredienser
        </span>
      </button>

      <IngredientsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ingredients={ingredients}
        ingredientSections={ingredientSections}
        servings={servings}
        quantityType={quantityType}
        customUnit={customUnit}
        desiredServings={desiredServings}
        onServingsChange={onServingsChange}
      />
    </>
  );
}
