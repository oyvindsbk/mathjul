"use client";

import Link from "next/link";
import { HeartButton } from "@/components/HeartButton";
import type { Recipe } from "@/lib/mock-data";
import { recipeHref } from "@/lib/recipe-url";

interface RecipeGridCardProps {
  recipe: Recipe;
  /** Auth token, passed to the heart button. Null hides the heart. */
  token: string | null;
  /** Set false on lists where liking makes no sense. Defaults to true. */
  showHeart?: boolean;
}

/**
 * Recipe card used by the grid listings (favourites, profile pages).
 *
 * Extracted from the favourites page so the profile sections render identical
 * cards rather than a second copy of the same markup.
 */
export function RecipeGridCard({ recipe, token, showHeart = true }: RecipeGridCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
      <div className="h-28 md:h-48 bg-gray-200 flex items-center justify-center overflow-hidden relative">
        <Link
          href={recipeHref(recipe.id, recipe.title)}
          aria-label={recipe.title}
          className="w-full h-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-contain bg-gray-100 transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <span className="text-gray-500">Oppskrift bilde</span>
          )}
        </Link>
        {showHeart && token && (
          <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow">
            <HeartButton
              recipeId={recipe.id}
              initialLiked={recipe.isLikedByMe ?? false}
              token={token}
            />
          </div>
        )}
      </div>
      <div className="p-3 md:p-6 flex flex-col flex-1">
        <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-1 md:mb-2 line-clamp-2">
          <Link
            href={recipeHref(recipe.id, recipe.title)}
            className="hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {recipe.title}
          </Link>
        </h3>
        <p className="text-gray-600 text-xs md:text-sm mb-2 md:mb-3 line-clamp-2 hidden md:block">
          {recipe.description || "Ingen beskrivelse"}
        </p>
        {recipe.categories && recipe.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recipe.categories.map((cat) => (
              <span
                key={cat.id}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
        <Link
          href={recipeHref(recipe.id, recipe.title)}
          className="block w-full bg-blue-600 text-white py-2 px-2 md:px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center mt-auto text-xs md:text-sm min-h-[44px] flex items-center justify-center"
        >
          Vis oppskrift
        </Link>
      </div>
    </div>
  );
}
