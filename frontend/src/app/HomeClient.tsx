"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { HeartButton } from "@/components/HeartButton";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { groupsService } from "@/lib/services/groups.service";
import { appConfig } from "@/lib/config";
import type { Category, Recipe } from "@/lib/mock-data";
import HomeLoading from "./loading";

type VisibilityTab = "all" | "public" | "myGroups" | "private" | "favoritter";

export default function HomeClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [visibilityTab, setVisibilityTab] = useState<VisibilityTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [backendEnv, setBackendEnv] = useState<string | null>(null);
  const { token, isLoading: authLoading } = useAuth();

  // Best-effort: fetch backend environment for dev banner only
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    fetch(`${appConfig.api.baseUrl}/health`)
      .then((r) => r.json())
      .then((data) => setBackendEnv(data.environment ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading) return;
    recipeService.getAllCategories(token || undefined).then(setAvailableCategories).catch(() => {});
    groupsService.getMyGroups(token || undefined).catch(() => {});
  }, [authLoading, token]);

  // Wait for auth to resolve before fetching — avoids a spurious 401 on first render
  useEffect(() => {
    if (authLoading) return;

    const fetchRecipes = async () => {
      try {
        // For "My groups", fetch per group and merge (or use first group as filter)
        // Simple approach: fetch all and filter client-side by visibility field
        const data = await recipeService.getAllRecipes(token || undefined, selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined);
        setRecipes(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching recipes:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch recipes");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [authLoading, token, selectedCategoryIds]);

  const filteredRecipes = recipes.filter((r) => {
    const rec = r as Recipe & { visibility?: string };
    if (visibilityTab === "all") return true;
    if (visibilityTab === "public") return rec.visibility === "Public" || !rec.visibility;
    if (visibilityTab === "private") return rec.visibility === "Private";
    if (visibilityTab === "myGroups") return rec.visibility === "Group";
    if (visibilityTab === "favoritter") return rec.isLikedByMe === true;
    return true;
  });

  const handleToggleFilter = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    setLoading(true);
  };

  const showDevBanner =
    process.env.NODE_ENV !== "production" &&
    (appConfig.mocking.enabled || backendEnv === "Development");

  if (loading) {
    return <HomeLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {showDevBanner && (
          <div className="mb-4 p-3 bg-amber-100 border border-amber-400 text-amber-800 rounded-md text-sm flex gap-4">
            <span className="font-semibold">DEV</span>
            {appConfig.mocking.enabled && (
              <span>Frontend mock aktiv (NEXT_PUBLIC_MOCK_DATA=true)</span>
            )}
            {backendEnv === "Development" && (
              <span>Backend: Development (seed-data)</span>
            )}
          </div>
        )}

        <div className="flex justify-end mb-8">
          <AuthButton />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Matoppskrifter
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Oppdag deilige oppskrifter fra hele verden. Fra raske hverdagsmiddager til spesielle anledninger.
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <p className="text-sm">Kunne ikke laste oppskrifter: {error}</p>
            </div>
          )}

        </div>

        {/* Visibility filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(
            [
              { key: "all", label: "Alle" },
              { key: "public", label: "🌍 Offentlig" },
              { key: "myGroups", label: "👥 Mine grupper" },
              { key: "private", label: "🔒 Privat" },
              { key: "favoritter", label: "❤️ Favoritter" },
            ] as { key: VisibilityTab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setVisibilityTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                visibilityTab === key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {availableCategories.length > 0 && (() => {
          const groups = Array.from(new Set(availableCategories.map((c) => c.group)));
          return (
            <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  <span>Filtrer etter kategori</span>
                  {selectedCategoryIds.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {selectedCategoryIds.length}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${filterOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {filterOpen && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="flex justify-end pt-2 mb-2">
                    {selectedCategoryIds.length > 0 && (
                      <button
                        onClick={() => { setSelectedCategoryIds([]); setLoading(true); }}
                        className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Fjern alle filtre
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div key={group} className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-gray-400 w-28 shrink-0">{group}</span>
                        {availableCategories.filter((c) => c.group === group).map((cat) => {
                          const active = selectedCategoryIds.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              onClick={() => handleToggleFilter(cat.id)}
                              className={`px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
                                active
                                  ? "bg-blue-500 text-white border-blue-500"
                                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                              }`}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="recipe-grid">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} data-testid={`recipe-card-${recipe.id}`} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
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
                  <HeartButton
                    recipeId={recipe.id}
                    initialLiked={recipe.isLikedByMe ?? false}
                    token={token}
                  />
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {recipe.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  {recipe.description || "Ingen beskrivelse"}
                </p>
                {recipe.categories && recipe.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {recipe.categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedCategoryIds([cat.id]); setLoading(true); setFilterOpen(true); }}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200 transition-colors cursor-pointer"
                      >
                        {cat.name}
                      </button>
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
      </div>
    </div>
  );
}
