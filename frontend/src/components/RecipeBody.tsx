"use client";

import Link from "next/link";
import type { InstructionStep, Recipe, StructuredIngredient } from "@/lib/mock-data";
import { formatIngredientParts } from "@/lib/recipe-format";
import { ServingsStepper } from "@/components/matlagingsmodus/ServingsStepper";

/**
 * The recipe content shared by the authenticated detail page and the public
 * share page (`/delt/[token]`), so the two cannot drift apart.
 *
 * Two axes of variation, both driven by props rather than by branching on
 * "is this the share page":
 *
 * - `sideDishesAsLinks` — on the share page a side dish is rendered as plain
 *   text, because following the link would be access to a second recipe.
 * - step interactivity — the detail page ties steps to `useCookingProgress`;
 *   the share page passes nothing and gets plain, non-tickable steps.
 */
export interface RecipeBodyProps {
  recipe: Recipe;
  /** Current serving count driving ingredient scaling. */
  desiredServings: number;
  /** Omit to render the servings stepper read-only (no adjusting on a share). */
  onServingsChange?: (servings: number) => void;
  /** Render side dishes as links into the app. False renders them as plain text. */
  sideDishesAsLinks?: boolean;
  /** Step numbers currently ticked off. Omit for non-interactive steps. */
  checkedSteps?: Set<number>;
  /** Omit for non-interactive steps. */
  onToggleStep?: (step: number) => void;
  /** Rendered in the instructions header, e.g. the "Begynn på nytt" button. */
  instructionsAction?: React.ReactNode;
}

export function RecipeBody({
  recipe,
  desiredServings,
  onServingsChange,
  sideDishesAsLinks = true,
  checkedSteps,
  onToggleStep,
  instructionsAction,
}: RecipeBodyProps) {
  const interactive = Boolean(onToggleStep);

  const renderStep = (step: InstructionStep, num: number, idPrefix: string) => {
    const checked = checkedSteps?.has(num) ?? false;

    // Without a toggle handler the step is presentational: no checkbox, no
    // pointer affordance, and the image always shows since it cannot be
    // collapsed by ticking.
    if (!interactive) {
      return (
        <li key={num} className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">{num}.</span> {step.text}
            </p>
            {step.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={step.imageUrl}
                alt={`Trinn ${num}`}
                className="mt-3 rounded-lg max-h-48 object-cover border border-gray-200"
              />
            )}
          </div>
        </li>
      );
    }

    return (
      <li
        key={num}
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => onToggleStep?.(num)}
      >
        <input
          type="checkbox"
          id={`${idPrefix}-${num}`}
          checked={checked}
          onChange={() => onToggleStep?.(num)}
          onClick={(e) => e.stopPropagation()}
          className="sr-only"
          aria-label={`Trinn ${num}: ${step.text}`}
        />
        <label
          htmlFor={`${idPrefix}-${num}`}
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5 cursor-pointer transition-colors ${checked ? 'border-2 border-[#e8f1e1] bg-[#e8f1e1]' : 'border-2 border-gray-400 bg-white'}`}
        >
          {checked && (
            <svg viewBox="0 0 12 10" className="w-3 h-3" fill="none" stroke="#4a7c3f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,5 4,8 11,1" />
            </svg>
          )}
        </label>
        <div className={`flex-1 transition-all ${checked ? 'overflow-hidden' : ''}`}>
          <p className={`transition-colors ${checked ? 'line-through text-gray-400 truncate' : 'text-gray-700'}`}>
            <span className={`font-semibold ${checked ? 'text-gray-400' : 'text-gray-900'}`}>{num}.</span> {step.text}
          </p>
          {!checked && step.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={step.imageUrl}
              alt={`Trinn ${num}`}
              className="mt-3 rounded-lg max-h-48 object-cover border border-gray-200"
            />
          )}
        </div>
      </li>
    );
  };

  const renderIngredient = (
    ingredient: StructuredIngredient,
    key: number,
  ) => {
    const { qtyUnit, name } = formatIngredientParts(ingredient, recipe.servings, desiredServings);
    return (
      <li key={key} className="flex items-baseline gap-1.5">
        {qtyUnit && <span className="font-semibold text-gray-900 shrink-0">{qtyUnit}</span>}
        <span className="text-gray-600">{name}</span>
      </li>
    );
  };

  return (
    <>
      {recipe.sideDishes && recipe.sideDishes.length > 0 && (
        <div className="mb-6" data-testid="side-dishes">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Tilbehør</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.sideDishes.map((side) =>
              sideDishesAsLinks ? (
                <Link
                  key={side.id}
                  href={`/recipes/${side.id}`}
                  className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm hover:bg-emerald-200 transition-colors"
                >
                  {side.title}
                </Link>
              ) : (
                <span
                  key={side.id}
                  className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm"
                >
                  {side.title}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 md:py-4 border-y border-gray-200">
        {recipe.prepTime && (
          <div
            className="flex items-center gap-1.5 text-gray-900"
            title="Forberedelsestid"
            aria-label={`Forberedelsestid ${recipe.prepTime} minutter`}
          >
            {/* Clock */}
            <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 2" />
            </svg>
            <span className="text-lg font-semibold">{recipe.prepTime} min</span>
          </div>
        )}
        {recipe.cookTimeMinutes && (
          <div
            className="flex items-center gap-1.5 text-gray-900"
            title="Steketid"
            aria-label={`Steketid ${recipe.cookTimeMinutes} minutter`}
          >
            {/* Boiling pot */}
            <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3c0 1.2-1 1.6-1 2.5S9 7 9 7M13 3c0 1.2-1 1.6-1 2.5S13 7 13 7M17 3c0 1.2-1 1.6-1 2.5S17 7 17 7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16M5 11v5a4 4 0 004 4h6a4 4 0 004-4v-5M19 12h2v3h-2M5 12H3v3h2" />
            </svg>
            <span className="text-lg font-semibold">{recipe.cookTimeMinutes} min</span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 ml-auto">
          <span>Sist oppdatert</span>
          <span className="text-gray-600">
            {recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : '–'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mt-6 md:mt-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4" data-testid="ingredients-heading">Ingredienser</h2>
            {recipe.servings ? (
              <div className="mb-5 pb-4 border-b border-gray-100">
                <ServingsStepper
                  value={desiredServings}
                  onChange={onServingsChange ?? (() => {})}
                  quantityType={recipe.quantityType}
                  customUnit={recipe.customUnit}
                />
              </div>
            ) : null}
            {recipe.ingredientSections && recipe.ingredientSections.length > 0 ? (
              <div className="space-y-6">
                {recipe.ingredientSections.map((section, sIdx) => (
                  <div key={sIdx}>
                    <h3 className="text-base font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">{section.heading}</h3>
                    <ul className="space-y-2">
                      {section.ingredients.map(renderIngredient)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  recipe.ingredients.map(renderIngredient)
                ) : (
                  <li className="text-gray-500">Ingen ingredienser tilgjengelig</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900" data-testid="instructions-heading">Instruksjoner</h2>
              {instructionsAction}
            </div>
            {recipe.instructionSections && recipe.instructionSections.length > 0 ? (
              <div className="space-y-8">
                {(() => {
                  let stepCounter = 0;
                  return recipe.instructionSections!.map((section, sIdx) => (
                    <div key={sIdx}>
                      <h3 className="text-base font-semibold text-gray-700 mb-4 border-b border-gray-200 pb-1">{section.heading}</h3>
                      <ol className="space-y-6">
                        {section.steps.map((step: InstructionStep) => {
                          stepCounter++;
                          return renderStep(step, stepCounter, 'section-step');
                        })}
                      </ol>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <ol className="space-y-6">
                {recipe.instructionSteps && recipe.instructionSteps.length > 0 ? (
                  recipe.instructionSteps.map((step: InstructionStep, index: number) =>
                    renderStep(step, index + 1, 'step'),
                  )
                ) : (
                  <li className="text-gray-500">Ingen instruksjoner tilgjengelig</li>
                )}
              </ol>
            )}
          </div>
        </div>
      </div>

      {recipe.tips && recipe.tips.length > 0 && (
        <div className="mt-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👨‍🍳</span>
              <h2 className="text-lg font-semibold text-amber-800">Tips fra kokken</h2>
            </div>
            <ul className="space-y-3">
              {recipe.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  <p className="text-amber-900 text-sm leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
