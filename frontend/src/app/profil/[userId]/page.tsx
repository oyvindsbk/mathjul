"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { userService, type UserProfile } from "@/lib/services/user.service";
import { ProfileHeader } from "@/components/profil/ProfileHeader";
import { RecipeSection } from "@/components/profil/RecipeSection";
import type { Recipe } from "@/lib/mock-data";

export default function OtherUserProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const { token, userId: myUserId, isLoading: authLoading } = useAuth();

  const profileUserId = Number(params.userId);
  const isValidId = Number.isInteger(profileUserId) && profileUserId > 0;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Your own profile lives on /profil, where you also get favourites and settings.
  const isSelf = myUserId !== null && myUserId === profileUserId;

  useEffect(() => {
    if (isSelf) router.replace("/profil");
  }, [isSelf, router]);

  useEffect(() => {
    if (authLoading || isSelf) return;

    if (!token) {
      setLoading(false);
      return;
    }

    if (!isValidId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const loadedProfile = await userService.getUserProfile(profileUserId, token);
        if (cancelled) return;

        if (!loadedProfile) {
          setNotFound(true);
          return;
        }

        setProfile(loadedProfile);

        const loadedRecipes = await recipeService.getRecipesByUser(profileUserId, token);
        if (!cancelled) setRecipes(loadedRecipes);
      } catch {
        if (!cancelled) setError("Kunne ikke laste profilen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token, profileUserId, isValidId, isSelf]);

  if (authLoading || isSelf) {
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
          <p className="text-lg text-gray-600 mb-4">Du må være logget inn for å se profiler.</p>
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

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center" data-testid="profil-ikke-funnet">
          <p className="text-lg text-gray-600 mb-4">Fant ikke brukeren.</p>
          <Link
            href="/alle-oppskrifter"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Se alle oppskrifter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="mb-6 md:mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-56 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        ) : (
          profile && (
            <ProfileHeader displayName={profile.displayName} recipeCount={profile.recipeCount} />
          )
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <RecipeSection
          title={profile ? `Oppskrifter fra ${profile.displayName}` : "Oppskrifter"}
          testId="profil-brukers-oppskrifter"
          recipes={recipes}
          loading={loading}
          token={token}
          emptyText="Denne brukeren har ingen oppskrifter du kan se."
        />
      </div>
    </div>
  );
}
