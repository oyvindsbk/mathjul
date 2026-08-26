"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { ProfileHeader } from "@/components/profil/ProfileHeader";
import { RecipeSection } from "@/components/profil/RecipeSection";
import type { Recipe } from "@/lib/mock-data";

export default function ProfilPage() {
  const { token, name, nickname, isLoading: authLoading } = useAuth();

  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      setLoadingRecipes(false);
      setLoadingFavorites(false);
      return;
    }

    recipeService
      .getMyRecipes(token)
      .then(setMyRecipes)
      .catch(() => setLoadError("Kunne ikke laste oppskriftene dine"))
      .finally(() => setLoadingRecipes(false));

    recipeService
      .getFavoriteRecipes(token)
      .then(setFavorites)
      .catch(() => setLoadError("Kunne ikke laste favorittene dine"))
      .finally(() => setLoadingFavorites(false));
  }, [authLoading, token]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg text-gray-600 mb-4">Du må være logget inn for å se Min side.</p>
          <Link
            href="/login"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Logg inn
          </Link>
        </div>
      </div>
    );
  }

  // Falls back to "Min side" until the profile has loaded, so the heading is never blank.
  const displayName = nickname?.trim() || name?.trim() || "Min side";

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <ProfileHeader
          displayName={displayName}
          recipeCount={myRecipes.length}
          favoriteCount={favorites.length}
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/grupper"
                data-testid="nav-groups"
                className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Grupper
              </Link>
              <Link
                href="/profil/rediger"
                data-testid="rediger-profil"
                className="inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
              >
                Rediger profil
              </Link>
            </div>
          }
        />

        {loadError && (
          <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="text-sm">{loadError}</p>
          </div>
        )}

        <RecipeSection
          title="❤️ Favoritter"
          testId="profil-favoritter"
          recipes={favorites}
          loading={loadingFavorites}
          token={token}
          emptyText="Ingen favoritter ennå. Trykk hjertet på en oppskrift for å legge den til her."
          emptyAction={{ href: "/alle-oppskrifter", label: "Se alle oppskrifter" }}
        />

        <RecipeSection
          title="Mine oppskrifter"
          testId="profil-mine-oppskrifter"
          recipes={myRecipes}
          loading={loadingRecipes}
          token={token}
          emptyText="Du har ikke lagt til noen oppskrifter ennå."
          emptyAction={{ href: "/last-opp-oppskrift", label: "Last opp oppskrift" }}
        />

      </div>
    </div>
  );
}
