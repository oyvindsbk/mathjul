"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HeartButton } from "@/components/HeartButton";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import type { Recipe } from "@/lib/mock-data";
import { recipeHref } from "@/lib/recipe-url";

function RecipeCard({ recipe, token }: { recipe: Recipe; token: string | null }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
      <div className="h-48 bg-gray-200 flex items-center justify-center overflow-hidden relative">
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
        <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow">
          <HeartButton
            recipeId={recipe.id}
            initialLiked={recipe.isLikedByMe ?? false}
            token={token}
          />
        </div>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          <Link
            href={recipeHref(recipe.id, recipe.title)}
            className="hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            {recipe.title}
          </Link>
        </h3>
        <p className="text-gray-600 text-sm mb-3 flex-1">
          {recipe.description || "Ingen beskrivelse"}
        </p>
        <Link
          href={recipeHref(recipe.id, recipe.title)}
          className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center mt-auto"
        >
          Vis oppskrift
        </Link>
      </div>
    </div>
  );
}

function RecipeSection({
  title,
  recipes,
  loading,
  emptyMessage,
  token,
}: {
  title: string;
  recipes: Recipe[];
  loading: boolean;
  emptyMessage: string;
  token: string | null;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="py-8 text-center bg-white rounded-lg border border-gray-200">
          <p className="text-gray-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} token={token} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomeDashboard() {
  const { token, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [newest, setNewest] = useState<Recipe[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingNewest, setLoadingNewest] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    recipeService
      .getFavoriteRecipes(token || undefined)
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setLoadingFavorites(false));

    recipeService
      .getNewestRecipes(token || undefined, 8)
      .then(setNewest)
      .catch(() => setNewest([]))
      .finally(() => setLoadingNewest(false));
  }, [authLoading, token]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        <RecipeSection
          title="❤️ Favoritter"
          recipes={favorites}
          loading={loadingFavorites}
          emptyMessage="Du har ikke likt noen oppskrifter ennå. Utforsk Alle oppskrifter og trykk hjertet!"
          token={token}
        />

        <RecipeSection
          title="Nyeste oppskrifter"
          recipes={newest}
          loading={loadingNewest}
          emptyMessage="Ingen oppskrifter er lagt til ennå."
          token={token}
        />

        <div className="mt-4">
          <Link
            href="/alle-oppskrifter"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            Se alle oppskrifter
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
