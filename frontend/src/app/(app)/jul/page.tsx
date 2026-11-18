"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import { groupJulRecipes } from "@/lib/jul";
import type { Recipe } from "@/lib/mock-data";
import { JulSection } from "@/components/jul/JulSection";
import { JulTheme } from "@/components/jul/JulTheme";
import { JulGarland } from "@/components/jul/JulGarland";
import { JulCountdown } from "@/components/jul/JulCountdown";
import { Snowfall } from "@/components/jul/Snowfall";
import { useSnowPreference } from "@/components/jul/useSnowPreference";

/** Every recipe tagged Jul, grouped into Christmas sections (feature 066). */
export default function JulPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snowOn, toggleSnow] = useSnowPreference();

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
  const busy = authLoading || loading;

  return (
    <JulTheme>
      <Snowfall enabled={snowOn} />
      <JulGarland />

      <div className="relative py-4 md:py-10 px-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8 md:mb-12">
            <h1 className="jul-display jul-title text-5xl md:text-7xl">Jul på mathjul</h1>
            <p className="jul-muted mt-3">
              Julebakst, julemiddag og alt det andre som hører desember til.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <JulCountdown />
              <button
                type="button"
                onClick={toggleSnow}
                aria-pressed={snowOn}
                data-testid="jul-snow-toggle"
                className="jul-toggle rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {snowOn ? "❄ Snø av" : "❄ Snø på"}
              </button>
            </div>
          </header>

          {busy ? (
            <div
              className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6"
              data-testid="jul-loading"
              aria-busy="true"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="jul-panel h-48 md:h-72 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              data-testid="jul-error"
              className="jul-panel max-w-xl mx-auto rounded-xl p-6 text-center"
            >
              {error}
            </div>
          ) : sections.length === 0 ? (
            <div data-testid="jul-empty" className="jul-panel max-w-xl mx-auto rounded-xl py-10 px-6 text-center">
              <p className="jul-display jul-title text-3xl mb-3">Ingen juleoppskrifter ennå</p>
              <p className="jul-muted text-sm mb-6">
                Åpne en oppskrift, velg Rediger og huk av for <strong>Jul</strong> under Anledning.
                Da dukker den opp her.
              </p>
              <Link
                href="/alle-oppskrifter"
                className="jul-button inline-block px-5 py-2 rounded-lg transition text-sm font-medium"
              >
                Gå til Alle oppskrifter
              </Link>
            </div>
          ) : (
            sections.map((section) => <JulSection key={section.key} section={section} token={token} />)
          )}
        </div>
      </div>
    </JulTheme>
  );
}
