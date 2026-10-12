"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { stockService, type Suggestion } from "@/lib/services/stock.service";

interface Props {
  groupId: number;
  token: string;
  onError: (message: string) => void;
}

export function SuggestionsTab({ groupId, token, onError }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    stockService
      .getSuggestions(groupId, token, 10)
      .then((data) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) onError(e instanceof Error ? e.message : "Kunne ikke hente forslag");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, token, onError]);

  if (loading) return <p className="text-gray-500 text-sm">Laster …</p>;

  if (suggestions.length === 0) {
    return (
      <p className="text-gray-500 text-sm" data-testid="suggestions-empty">
        Ingen forslag ennå. Legg inn det dere har hjemme, så foreslår vi oppskrifter.
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="suggestions-tab">
      {suggestions.map((s) => (
        <li key={s.recipeId} data-testid="suggestion" className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/recipes/${s.recipeId}`} className="font-semibold text-blue-700 hover:underline">
              {s.title}
            </Link>
            <span
              className="shrink-0 text-sm font-medium text-gray-700"
              aria-label={`Dekning ${Math.round(s.score * 100)} prosent`}
            >
              {Math.round(s.score * 100)} %
            </span>
          </div>

          <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-green-500" style={{ width: `${Math.round(s.score * 100)}%` }} />
          </div>

          <p className="mt-2 text-sm text-gray-600">
            Har {s.haveCount}
            {s.maybeCount > 0 && `, kanskje ${s.maybeCount}`}
            {s.missingCount > 0 ? `, mangler ${s.missingCount}` : ""}
          </p>

          {s.missing.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">Mangler: {s.missing.join(", ")}</p>
          )}
          {s.usesExpiring.length > 0 && (
            <p className="mt-1 text-sm text-amber-700">Bruker opp: {s.usesExpiring.join(", ")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
