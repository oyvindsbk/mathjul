/**
 * Normalizes the two shapes a recipe's ingredients and instructions can take.
 *
 * Recipes carry either a flat list (`ingredients` / `instructionSteps`) or a
 * sectioned one (`ingredientSections` / `instructionSections`). The detail page
 * handles this by duplicating its whole render branch per shape; these helpers
 * collapse it to one list so callers write the row markup once.
 */

import type {
  IngredientSection,
  InstructionSection,
  InstructionStep,
  StructuredIngredient,
} from "@/lib/mock-data";

export interface NormalizedSection<T> {
  /** Absent for a flat list, which renders without a heading. */
  heading?: string;
  items: T[];
}

/** Ingredient plus the identity used for its persisted checkbox state. */
export interface KeyedIngredient {
  ingredient: StructuredIngredient;
  /** "sectionIdx:ingredientIdx" — stable for as long as the recipe is unedited. */
  key: string;
}

/** Step plus its 1-based number, continuous across sections. */
export interface NumberedStep {
  step: InstructionStep;
  number: number;
}

export function normalizeIngredients(
  flat: StructuredIngredient[] | undefined,
  sections: IngredientSection[] | undefined
): NormalizedSection<KeyedIngredient>[] {
  if (sections && sections.length > 0) {
    return sections.map((section, sIdx) => ({
      heading: section.heading,
      items: section.ingredients.map((ingredient, iIdx) => ({
        ingredient,
        key: `${sIdx}:${iIdx}`,
      })),
    }));
  }
  if (flat && flat.length > 0) {
    return [
      {
        items: flat.map((ingredient, iIdx) => ({ ingredient, key: `0:${iIdx}` })),
      },
    ];
  }
  return [];
}

/**
 * Step numbering runs continuously across sections, matching the recipe detail
 * page — persisted step numbers must mean the same thing in both surfaces.
 */
export function normalizeInstructions(
  flat: InstructionStep[] | undefined,
  sections: InstructionSection[] | undefined
): NormalizedSection<NumberedStep>[] {
  if (sections && sections.length > 0) {
    let counter = 0;
    return sections.map((section) => ({
      heading: section.heading,
      items: section.steps.map((step) => ({ step, number: ++counter })),
    }));
  }
  if (flat && flat.length > 0) {
    return [{ items: flat.map((step, idx) => ({ step, number: idx + 1 })) }];
  }
  return [];
}
