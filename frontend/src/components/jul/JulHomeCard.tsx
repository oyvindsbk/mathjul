"use client";

import Link from "next/link";
import { julFont } from "./julFont";
import { JulLights } from "./JulLights";
import { useJulSeason } from "./useJulSeason";
import "./jul.css";

/**
 * Seasonal "Jul på mathjul" card on the home page. It is the mobile way into
 * /jul, since the bottom nav is already full, and shows on desktop too.
 * Hidden outside 1 Nov – 6 Jan.
 */
export function JulHomeCard() {
  const inSeason = useJulSeason();
  if (!inSeason) return null;

  return (
    <Link
      href="/jul"
      data-testid="jul-home-card"
      className={`jul-theme jul-home-card ${julFont.variable} block rounded-2xl overflow-hidden mb-8 shadow-md hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
    >
      <JulLights />
      <div className="px-5 pb-5 pt-1 flex items-center justify-between gap-4">
        <div>
          <p className="jul-display jul-title text-3xl md:text-4xl">Jul på mathjul</p>
          <p className="jul-muted text-sm mt-1">Julebakst, julemiddag og gløgg samlet på ett sted.</p>
        </div>
        <span className="text-4xl md:text-5xl shrink-0" aria-hidden="true">🎄</span>
      </div>
    </Link>
  );
}
