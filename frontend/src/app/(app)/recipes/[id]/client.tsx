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
import type { Recipe } from "@/lib/mock-data";
import { RecipeBody } from "@/components/RecipeBody";
import { ShareRecipeModal } from "@/components/ShareRecipeModal";
import { parseRecipeId, recipeHref } from "@/lib/recipe-url";
import RecipeDetailLoading from "./loading";

export default function RecipeDetailClient({ id: routeParam }: { id: string }) {
  const id = parseRecipeId(routeParam) ?? routeParam;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desiredServings, setDesiredServings] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [sharing, setSharing] = useState(false);

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

  // Falls back to the raw email only for recipes whose owner has no user record.
  const ownerLabel = recipe.ownerDisplayName || recipe.ownerEmail;

  const hasMeta = Boolean(
    ownerLabel || recipe.sourceUrl || (recipe.categories && recipe.categories.length > 0)
  );

  const metaContent = (
    <>
      {(ownerLabel || recipe.sourceUrl) && (
        <div className="text-sm text-gray-500 mb-4 flex flex-col gap-1">
          {ownerLabel && (
            <span>
              Lagt til av{" "}
              {recipe.ownerUserId ? (
                <Link
                  href={`/profil/${recipe.ownerUserId}`}
                  data-testid="oppskrift-eier-lenke"
                  className="text-blue-600 hover:underline"
                >
                  {ownerLabel}
                </Link>
              ) : (
                ownerLabel
              )}
            </span>
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
                <button
                  onClick={() => setSharing(true)}
                  aria-label="Del oppskrift"
                  data-testid="del-oppskrift-knapp"
                  className="mt-1 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors hover:scale-110 active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
                  </svg>
                </button>
                <Link
                  href={`${recipeHref(Number(id), recipe.title)}/edit`}
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

            <RecipeBody
              recipe={recipe}
              desiredServings={desiredServings}
              onServingsChange={setDesiredServings}
              checkedSteps={checkedSteps}
              onToggleStep={toggleStep}
              instructionsAction={
                hasProgress ? (
                  <button
                    onClick={resetProgress}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Begynn på nytt
                  </button>
                ) : null
              }
            />
          </div>
        </div>

        {recipe.usedAsSideDishIn && recipe.usedAsSideDishIn.length > 0 && (
          <div className="mt-8" data-testid="used-as-side-dish-in">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Brukes som tilbehør til</h2>
            <div className="flex flex-wrap gap-2">
              {recipe.usedAsSideDishIn.map((main) => (
                <Link
                  key={main.id}
                  href={recipeHref(main.id, main.title)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                >
                  {main.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <MatlagingsmodusButton onClick={() => setCookingMode(true)} />

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

      {sharing && (
        <ShareRecipeModal
          recipeId={id}
          recipeTitle={recipe.title}
          token={token}
          authLoading={authLoading}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
