"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { groupJulRecipes } from "@/lib/jul";
import type { Recipe } from "@/lib/mock-data";
import { JulSection } from "@/components/jul/JulSection";
import JulLoading from "./loading";

/** Every recipe tagged Jul, grouped into Christmas sections (feature 066). */
export default function JulPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    recipeService
      .getJulRecipes(token ?? undefined)
      .then((result) => {
        if (!cancelled) setRecipes(result);
      })
      .catch(() => {
        if (!cancelled) setError("Kunne ikke laste juleoppskriftene. Prøv igjen senere.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, token]);

  const sections = useMemo(() => groupJulRecipes(recipes), [recipes]);

  if (authLoading || loading) return <JulLoading />;

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900">Jul på mathjul</h1>
          <p className="mt-3 text-gray-600">Julebakst, julemiddag og alt det andre som hører desember til.</p>
        </header>

        {error ? (
          <div
            role="alert"
            data-testid="jul-error"
            className="max-w-xl mx-auto bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-center"
          >
            {error}
          </div>
        ) : sections.length === 0 ? (
          <div
            data-testid="jul-empty"
            className="max-w-xl mx-auto bg-white rounded-lg border border-dashed border-gray-300 py-10 px-6 text-center"
          >
            <p className="text-lg font-semibold text-gray-900 mb-2">Ingen juleoppskrifter ennå</p>
            <p className="text-gray-600 text-sm mb-6">
              Åpne en oppskrift, velg Rediger og huk av for <strong>Jul</strong> under Anledning.
              Da dukker den opp her.
            </p>
            <Link
              href="/alle-oppskrifter"
              className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Gå til Alle oppskrifter
            </Link>
          </div>
        ) : (
          sections.map((section) => <JulSection key={section.key} section={section} token={token} />)
        )}
      </div>
    </div>
  );
}
