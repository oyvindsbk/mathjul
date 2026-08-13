"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearProgress,
  emptyProgress,
  loadProgress,
  saveProgress,
  type CookingProgress,
} from "@/lib/cooking-progress";

export interface UseCookingProgress {
  checkedIngredients: Set<string>;
  checkedSteps: Set<number>;
  toggleIngredient: (key: string) => void;
  toggleStep: (stepNumber: number) => void;
  reset: () => void;
  hasProgress: boolean;
}

/**
 * Ticked ingredients and steps for one recipe, persisted to localStorage.
 *
 * Call this ONCE per recipe — on the detail page — and pass the result down to
 * both the page's instruction list and the matlagingsmodus overlay. Two callers
 * would mean two independent Sets disagreeing about the same recipe.
 *
 * Stored progress is read after mount rather than during render: touching
 * localStorage while rendering would desync server and client HTML and trip
 * React's hydration check.
 */
export function useCookingProgress(
  recipeId: number | string | undefined,
  updatedAt: string | null | undefined
): UseCookingProgress {
  const [progress, setProgress] = useState<CookingProgress>(emptyProgress);

  // Guards the write-back effect so the initial empty state can't clobber
  // stored progress before hydration has run.
  const hydrated = useRef(false);

  useEffect(() => {
    if (recipeId === undefined) return;
    hydrated.current = false;
    setProgress(loadProgress(recipeId, updatedAt));
    hydrated.current = true;
  }, [recipeId, updatedAt]);

  useEffect(() => {
    if (recipeId === undefined || !hydrated.current) return;
    saveProgress(recipeId, updatedAt, progress);
  }, [recipeId, updatedAt, progress]);

  const checkedIngredients = useMemo(() => new Set(progress.ingredients), [progress.ingredients]);
  const checkedSteps = useMemo(() => new Set(progress.steps), [progress.steps]);

  const toggleIngredient = useCallback((key: string) => {
    setProgress((prev) => {
      const has = prev.ingredients.includes(key);
      return {
        ...prev,
        ingredients: has ? prev.ingredients.filter((k) => k !== key) : [...prev.ingredients, key],
      };
    });
  }, []);

  const toggleStep = useCallback((stepNumber: number) => {
    setProgress((prev) => {
      const has = prev.steps.includes(stepNumber);
      return {
        ...prev,
        steps: has ? prev.steps.filter((n) => n !== stepNumber) : [...prev.steps, stepNumber],
      };
    });
  }, []);

  const reset = useCallback(() => {
    if (recipeId !== undefined) clearProgress(recipeId);
    setProgress({ ingredients: [], steps: [] });
  }, [recipeId]);

  return {
    checkedIngredients,
    checkedSteps,
    toggleIngredient,
    toggleStep,
    reset,
    hasProgress: progress.ingredients.length > 0 || progress.steps.length > 0,
  };
}
