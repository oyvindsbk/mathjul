"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recipeService } from "@/lib/services/recipe.service";
import { HeartButton } from "@/components/HeartButton";
import { MatlagingsmodusButton } from "@/components/MatlagingsmodusButton";
import { MatlagingsmodusOverlay } from "@/components/matlagingsmodus/MatlagingsmodusOverlay";
import { useAuth } from "@/lib/context/AuthContext";
import { useCookingProgress } from "@/hooks/useCookingProgress";
import type { InstructionStep, Recipe } from "@/lib/mock-data";
import { formatIngredientParts } from "@/lib/recipe-format";
import { ServingsStepper } from "@/components/matlagingsmodus/ServingsStepper";
import RecipeDetailLoading from "./loading";

export default function RecipeDetailClient({ id }: { id: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desiredServings, setDesiredServings] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);

  // Called once here and shared with matlagingsmodus, so ticking a step in
  // either surface is reflected in the other.
  const {
    checkedIngredients,
    checkedSteps,
    toggleIngredient,
    toggleStep,
    reset: resetProgress,
    hasProgress,
  } = useCookingProgress(recipe?.id, recipe?.updatedAt);

  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm('Er du sikker på at du vil slette denne oppskriften? Dette kan ikke angres.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await recipeService.deleteRecipe(id, token || undefined);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette oppskriften');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const data = await recipeService.getRecipeById(id, token || undefined);
        if (!data) {
          setError('Oppskrift ikke funnet');
          setRecipe(null);
        } else {
          setRecipe(data);
          setDesiredServings(data.servings ?? 0);
        }
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError(err instanceof Error ? err.message : 'Kunne ikke hente oppskriften');
      } finally {
        setLoading(false);
      }
    };

    if (authLoading || !id) return;
    fetchRecipe();
  }, [id, authLoading, token]);

  if (loading) {
    return <RecipeDetailLoading />;
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            data-testid="back-link"
            className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tilbake til oppskrifter
          </Link>
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">Feil</p>
            <p>{error || 'Oppskrift ikke funnet'}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasMeta = Boolean(
    recipe.ownerEmail || recipe.sourceUrl || (recipe.categories && recipe.categories.length > 0)
  );

  const metaContent = (
    <>
      {(recipe.ownerEmail || recipe.sourceUrl) && (
        <div className="text-sm text-gray-500 mb-4 flex flex-col gap-1">
          {recipe.ownerEmail && (
            <span>Lagt til av {recipe.ownerEmail}</span>
          )}
          {recipe.sourceUrl && (
            <span>Kilde: <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{recipe.sourceUrl}</a></span>
          )}
        </div>
      )}

      {recipe.categories && recipe.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.categories.map((cat) => (
            <span key={cat.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              {cat.name}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6 md:mb-8">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full max-h-56 md:max-h-96 object-contain bg-gray-100"
            />
          ) : null}

          <div className="p-4 md:p-8">
            <div className="flex items-start gap-2 md:gap-3 mb-4">
                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 flex-1">{recipe.title}</h1>
                {hasMeta && (
                  <button
                    onClick={() => setShowMeta((v) => !v)}
                    aria-label="Vis detaljer"
                    aria-expanded={showMeta}
                    data-testid="recipe-meta-toggle"
                    className={`md:hidden mt-1 flex items-center justify-center transition-colors hover:scale-110 active:scale-95 ${showMeta ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
                <HeartButton
                  recipeId={recipe.id}
                  initialLiked={recipe.isLikedByMe ?? false}
                  token={token}
                  className="mt-1"
                />
                <Link
                  href={`/recipes/${id}/edit`}
                  aria-label="Rediger oppskrift"
                  className="mt-1 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors hover:scale-110 active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  aria-label="Slett oppskrift"
                  className="mt-1 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
            </div>

            <p className="text-sm md:text-lg text-gray-600 mb-4">{recipe.description}</p>

            {/* Mobile reaches matlagingsmodus through the floating button; on
                desktop a floating pill would be out of place, so it lives here. */}
            <button
              type="button"
              onClick={() => setCookingMode(true)}
              data-testid="matlagingsmodus-open"
              className="hidden md:inline-flex items-center gap-2 mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3c0 1.2-1 1.6-1 2.5S9 7 9 7M13 3c0 1.2-1 1.6-1 2.5S13 7 13 7M17 3c0 1.2-1 1.6-1 2.5S17 7 17 7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16M5 11v5a4 4 0 004 4h6a4 4 0 004-4v-5M19 12h2v3h-2M5 12H3v3h2" />
              </svg>
              Start matlagingsmodus
            </button>

            {hasMeta && (
              <>
                {/* Mobile: hidden behind the info icon in the title row */}
                {showMeta && (
                  <div className="md:hidden mb-4" data-testid="recipe-meta-mobile">{metaContent}</div>
                )}

                {/* Desktop: always visible */}
                <div className="hidden md:block" data-testid="recipe-meta-desktop">{metaContent}</div>
              </>
            )}

            {recipe.sideDishes && recipe.sideDishes.length > 0 && (
              <div className="mb-6" data-testid="side-dishes">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Tilbehør</h2>
                <div className="flex flex-wrap gap-2">
                  {recipe.sideDishes.map((side) => (
                    <Link
                      key={side.id}
                      href={`/recipes/${side.id}`}
                      className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm hover:bg-emerald-200 transition-colors"
                    >
                      {side.title}
                    </Link>
                  ))}
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-1" id="ingredients-section">
            <div className="bg-white rounded-lg shadow-md p-4 md:p-8">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4" data-testid="ingredients-heading">Ingredienser</h2>
              {recipe.servings ? (
                <div className="mb-5 pb-4 border-b border-gray-100">
                  <ServingsStepper
                    value={desiredServings}
                    onChange={setDesiredServings}
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
                        {section.ingredients.map((ingredient, iIdx) => {
                          const { qtyUnit, name } = formatIngredientParts(ingredient, recipe.servings, desiredServings);
                          return (
                            <li key={iIdx} className="flex items-baseline gap-1.5">
                              {qtyUnit && <span className="font-semibold text-gray-900 shrink-0">{qtyUnit}</span>}
                              <span className="text-gray-600">{name}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    recipe.ingredients.map((ingredient, index) => {
                      const { qtyUnit, name } = formatIngredientParts(ingredient, recipe.servings, desiredServings);
                      return (
                        <li key={index} className="flex items-baseline gap-1.5">
                          {qtyUnit && <span className="font-semibold text-gray-900 shrink-0">{qtyUnit}</span>}
                          <span className="text-gray-600">{name}</span>
                        </li>
                      );
                    })
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
                {hasProgress && (
                  <button
                    onClick={resetProgress}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Begynn på nytt
                  </button>
                )}
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
                            const num = stepCounter;
                            const checked = checkedSteps.has(num);
                            return (
                              <li
                                key={num}
                                className="flex items-start gap-3 cursor-pointer"
                                onClick={() => toggleStep(num)}
                              >
                                <input
                                  type="checkbox"
                                  id={`section-step-${num}`}
                                  checked={checked}
                                  onChange={() => toggleStep(num)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="sr-only"
                                  aria-label={`Trinn ${num}: ${step.text}`}
                                />
                                <label
                                  htmlFor={`section-step-${num}`}
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
                                  <p className={`transition-colors ${checked ? 'line-through text-gray-400 truncate' : 'text-gray-700'}`}><span className={`font-semibold ${checked ? 'text-gray-400' : 'text-gray-900'}`}>{num}.</span> {step.text}</p>
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
                          })}
                        </ol>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <ol className="space-y-6">
                  {recipe.instructionSteps && recipe.instructionSteps.length > 0 ? (
                    recipe.instructionSteps.map((step: InstructionStep, index: number) => {
                      const num = index + 1;
                      const checked = checkedSteps.has(num);
                      return (
                        <li
                          key={index}
                          className="flex items-start gap-3 cursor-pointer"
                          onClick={() => toggleStep(num)}
                        >
                          <input
                            type="checkbox"
                            id={`step-${num}`}
                            checked={checked}
                            onChange={() => toggleStep(num)}
                            onClick={(e) => e.stopPropagation()}
                            className="sr-only"
                            aria-label={`Trinn ${num}: ${step.text}`}
                          />
                          <label
                            htmlFor={`step-${num}`}
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
                            <p className={`transition-colors ${checked ? 'line-through text-gray-400 truncate' : 'text-gray-700'}`}><span className={`font-semibold ${checked ? 'text-gray-400' : 'text-gray-900'}`}>{num}.</span> {step.text}</p>
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
                    })
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

        {recipe.usedAsSideDishIn && recipe.usedAsSideDishIn.length > 0 && (
          <div className="mt-8" data-testid="used-as-side-dish-in">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Brukes som tilbehør til</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.usedAsSideDishIn.map((main) => (
                <Link
                  key={main.id}
                  href={`/recipes/${main.id}`}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                >
                  {main.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <MatlagingsmodusButton
        onClick={() => setCookingMode(true)}
        ingredientsSectionId="ingredients-section"
      />

      <MatlagingsmodusOverlay
        open={cookingMode}
        onClose={() => setCookingMode(false)}
        recipe={recipe}
        desiredServings={desiredServings}
        onServingsChange={setDesiredServings}
        checkedIngredients={checkedIngredients}
        checkedSteps={checkedSteps}
        onToggleIngredient={toggleIngredient}
        onToggleStep={toggleStep}
        onReset={resetProgress}
        hasProgress={hasProgress}
      />
    </div>
  );
}
