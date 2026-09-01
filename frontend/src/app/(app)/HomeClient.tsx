"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { HeartButton } from "@/components/HeartButton";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { groupsService } from "@/lib/services/groups.service";
import { appConfig } from "@/lib/config";
import type { Category, Recipe } from "@/lib/mock-data";
import { recipeHref } from "@/lib/recipe-url";
import HomeLoading from "./loading";

type VisibilityTab = "all" | "public" | "myGroups" | "private" | "favoritter";

const VALID_VISIBILITY_TABS: VisibilityTab[] = ["public", "myGroups", "private", "favoritter"];

export default function HomeClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [visibilityTab, setVisibilityTab] = useState<VisibilityTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [backendEnv, setBackendEnv] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { token, isLoading: authLoading } = useAuth();
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasReadUrlRef = useRef(false);

  // Read initial state from the URL once on mount
  useEffect(() => {
    if (hasReadUrlRef.current) return;
    hasReadUrlRef.current = true;

    const q = searchParams.get("q");
    const cat = searchParams.get("cat");
    const vis = searchParams.get("vis");

    if (q) {
      setSearchTerm(q);
    }
    if (cat) {
      const ids = cat
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n));
      if (ids.length > 0) setSelectedCategoryIds(ids);
    }
    if (vis && VALID_VISIBILITY_TABS.includes(vis as VisibilityTab)) {
      setVisibilityTab(vis as VisibilityTab);
    }
    if (cat || vis) {
      setFilterOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stay in sync when the URL's `q` changes from elsewhere (e.g. the header search box)
  useEffect(() => {
    if (!hasReadUrlRef.current) return;
    const q = searchParams.get("q") ?? "";
    setSearchTerm((prev) => (prev === q ? prev : q));
  }, [searchParams]);

  // Mirror filter state back to the URL after changes
  useEffect(() => {
    if (!hasReadUrlRef.current) return;

    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (selectedCategoryIds.length > 0) params.set("cat", selectedCategoryIds.join(","));
    if (visibilityTab !== "all") params.set("vis", visibilityTab);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchTerm, selectedCategoryIds, visibilityTab, router, pathname]);

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

    const requestId = ++requestIdRef.current;

    const fetchRecipes = async () => {
      try {
        const data = await recipeService.getAllRecipes(
          token || undefined,
          selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          undefined,
          searchTerm || undefined
        );
        if (requestId !== requestIdRef.current) return;
        setRecipes(data);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Error fetching recipes:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch recipes");
      } finally {
        if (requestId !== requestIdRef.current) return;
        hasLoadedOnceRef.current = true;
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [authLoading, token, selectedCategoryIds, searchTerm]);

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

  if (loading && !hasLoadedOnceRef.current) {
    return <HomeLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
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

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="text-sm">Kunne ikke laste oppskrifter: {error}</p>
          </div>
        )}

        {availableCategories.length > 0 && (() => {
          const groups = Array.from(new Set(availableCategories.map((c) => c.group)));
          const activeFilterCount = selectedCategoryIds.length + (visibilityTab !== "all" ? 1 : 0);
          return (
            <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                data-testid="filter-toggle"
                onClick={() => setFilterOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  <span>Filtre</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {activeFilterCount}
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
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setSelectedCategoryIds([]); setVisibilityTab("all"); setLoading(true); }}
                        className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Fjern alle filtre
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-gray-400 w-28 shrink-0">Synlighet</span>
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
                          className={`px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
                            visibilityTab === key
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
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

        {filteredRecipes.length === 0 ? (
          <div className="text-center py-16 px-4" data-testid="empty-state">
            <p className="text-gray-600 mb-4">Ingen oppskrifter matcher søket</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategoryIds([]);
                setVisibilityTab("all");
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm cursor-pointer"
            >
              Nullstill søk og filtre
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6" data-testid="recipe-grid">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} data-testid={`recipe-card-${recipe.id}`} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
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
                <div className="absolute top-2 right-2 bg-white/80 rounded-full p-1 shadow">
                  <HeartButton
                    recipeId={recipe.id}
                    initialLiked={recipe.isLikedByMe ?? false}
                    token={token}
                  />
                </div>
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
                  href={recipeHref(recipe.id, recipe.title)}
                  className="block w-full bg-blue-600 text-white py-2 px-2 md:px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center mt-auto text-xs md:text-sm min-h-[44px] flex items-center justify-center"
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
