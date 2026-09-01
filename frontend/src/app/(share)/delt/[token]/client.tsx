"use client";

import { useEffect, useState } from "react";
import { recipeService, type SharedRecipe } from "@/lib/services/recipe.service";
import { RecipeBody } from "@/components/RecipeBody";
import { MatlagingsmodusButton } from "@/components/MatlagingsmodusButton";
import { MatlagingsmodusOverlay } from "@/components/matlagingsmodus/MatlagingsmodusOverlay";
import { useCookingProgress } from "@/hooks/useCookingProgress";
import { recipeHref } from "@/lib/recipe-url";

/**
 * The public share page. Reads one recipe through its share token and renders the
 * recipe itself without navigation into the rest of the app — side dishes stay
 * plain text, and the owner is not a profile link.
 *
 * The single exception is the "full recipe" link at the bottom. It is labelled as
 * requiring login because it does: /recipes/[id] is guarded both by the server
 * middleware and by ProtectedRoute, so a recipient without an account ends up at
 * /login. The label sets that expectation up front rather than letting the click
 * be a surprise.
 *
 * It is a plain <a>, not next/link, so the recipient leaves the token-scoped share
 * context through a full page load instead of a client-side transition into an app
 * shell this layout never renders.
 *
 * Matlagingsmodus is offered here too: it is a cooking surface over the recipe the
 * recipient already holds, needs no account, and reaches nothing else in the app.
 * Progress is kept in localStorage under the recipe's own id, so a recipient who
 * later logs in and opens /recipes/[id] finds the same ticks.
 */
export default function SharedRecipeClient({ shareToken }: { shareToken: string }) {
  const [shared, setShared] = useState<SharedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [desiredServings, setDesiredServings] = useState<number>(0);
  // A revoked, unknown, or malformed token is not an error to explain — it is
  // just a link that no longer works, so both cases show the same friendly page.
  const [dead, setDead] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);

  // Same hook as the detail page, keyed by the same recipe id — ticking a step
  // here and reading the recipe logged in later show the same progress.
  const {
    checkedIngredients,
    checkedSteps,
    toggleIngredient,
    toggleStep,
    reset: resetProgress,
    hasProgress,
  } = useCookingProgress(shared?.recipe.id, shared?.recipe.updatedAt);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await recipeService.getSharedRecipe(shareToken);
        if (cancelled) return;
        if (!data) {
          setDead(true);
        } else {
          setShared(data);
          setDesiredServings(data.recipe.servings ?? 0);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching shared recipe:", err);
        setDead(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500">Henter oppskriften…</p>
      </div>
    );
  }

  if (dead || !shared) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div
          className="max-w-md text-center bg-white rounded-lg shadow-lg p-8"
          data-testid="delt-oppskrift-utlopt"
        >
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Denne delingen finnes ikke lenger
          </h1>
          <p className="text-gray-600">
            Lenken er slått av eller har aldri virket. Spør den som delte oppskriften om en ny
            lenke.
          </p>
        </div>
      </div>
    );
  }

  const { recipe, ownerDisplayName } = shared;

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div
          className="bg-white rounded-lg shadow-lg overflow-hidden mb-6 md:mb-8"
          data-testid="delt-oppskrift"
        >
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full max-h-56 md:max-h-96 object-contain bg-gray-100"
            />
          ) : null}

          <div className="p-4 md:p-8">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">{recipe.title}</h1>

            {recipe.description && (
              <p className="text-sm md:text-lg text-gray-600 mb-4">{recipe.description}</p>
            )}

            {ownerDisplayName && (
              // Plain text, not a profile link: the share is one recipe, not a
              // way into the app.
              <p className="text-sm text-gray-500 mb-4">Lagt til av {ownerDisplayName}</p>
            )}

            <RecipeBody
              recipe={recipe}
              desiredServings={desiredServings}
              onServingsChange={setDesiredServings}
              sideDishesAsLinks={false}
            />
          </div>
        </div>

        <div className="text-center pb-6">
          <a
            href={recipeHref(recipe.id, recipe.title)}
            className="inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
            data-testid="delt-full-oppskrift-lenke"
          >
            Gå til full oppskrift{" "}
            <span className="text-gray-500 font-normal">(krever innlogging)</span>
          </a>
          <p className="text-xs text-gray-400 mt-4">Delt fra Mathjul</p>
        </div>
      </div>

      {/* No bottom nav on this layout, so the button sits lower than in the app. */}
      <MatlagingsmodusButton onClick={() => setCookingMode(true)} bottomOffset="0rem" />

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
