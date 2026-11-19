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
import { useSnowLevel } from "@/components/jul/useSnowLevel";
import { SnowLevelSlider } from "@/components/jul/SnowLevelSlider";
import { JulMusicToggle, JulNowPlaying } from "@/components/jul/JulMusicToggle";
import { useJulMusic } from "@/components/jul/useJulMusic";

/** Every recipe tagged Jul, grouped into Christmas sections (feature 066). */
export default function JulPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snowLevel, setSnowLevel] = useSnowLevel();
  const music = useJulMusic();

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
      <Snowfall level={snowLevel} />
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
              <SnowLevelSlider level={snowLevel} onChange={setSnowLevel} />
              <JulMusicToggle music={music} />
            </div>
            <JulNowPlaying music={music} />
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
