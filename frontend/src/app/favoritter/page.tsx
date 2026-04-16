"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { likesService } from "@/lib/services/likes.service";
import { HeartButton } from "@/components/HeartButton";
import type { Recipe } from "@/lib/mock-data";

export default function FavoritterPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setLoading(false);
      return;
    }

    likesService
      .getLikedRecipes(token)
      .then(setRecipes)
      .catch((err) => setError(err instanceof Error ? err.message : "Kunne ikke hente favoritter"))
      .finally(() => setLoading(false));
  }, [authLoading, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-gray-600 mb-4">Du må være logget inn for å se favoritter.</p>
          <Link href="/login" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Logg inn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="text-sm">Kunne ikke laste favoritter: {error}</p>
          </div>
        )}

        {recipes.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <p className="text-gray-500 text-lg mb-2">Ingen favoritter ennå</p>
            <p className="text-gray-400 text-sm mb-6">Klikk på hjertet på en oppskrift for å legge den til her.</p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Se alle oppskrifter
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col"
              >
                <div className="h-48 bg-gray-200 flex items-center justify-center overflow-hidden relative">
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-contain bg-gray-100"
                    />
                  ) : (
                    <span className="text-gray-500">Oppskrift bilde</span>
                  )}
                  <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow">
                    <HeartButton recipeId={recipe.id} initialLiked={true} token={token} />
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{recipe.title}</h3>
                  <p className="text-gray-600 text-sm mb-3">{recipe.description || "Ingen beskrivelse"}</p>
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
                    href={`/recipes/${recipe.id}`}
                    className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center mt-auto"
                  >
                    Vis oppskrift
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
