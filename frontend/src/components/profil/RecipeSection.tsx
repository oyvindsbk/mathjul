"use client";

import Link from "next/link";
import { RecipeGridCard } from "@/components/RecipeGridCard";
import type { Recipe } from "@/lib/mock-data";

interface RecipeSectionProps {
  title: string;
  recipes: Recipe[];
  loading: boolean;
  token: string | null;
  /** Shown in place of the grid when the list is empty. */
  emptyText: string;
  /** Optional call to action under the empty text. */
  emptyAction?: { href: string; label: string };
  testId?: string;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
          <div className="h-28 md:h-48 bg-gray-200" />
          <div className="p-3 md:p-6 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One titled block of recipe cards, with its own loading and empty states. */
export function RecipeSection({
  title,
  recipes,
  loading,
  token,
  emptyText,
  emptyAction,
  testId,
}: RecipeSectionProps) {
  return (
    <section className="mb-10" data-testid={testId}>
      <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">{title}</h2>

      {loading ? (
        <SkeletonGrid />
      ) : recipes.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 py-10 px-6 text-center">
          <p className="text-gray-500 text-sm mb-4">{emptyText}</p>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              {emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {recipes.map((recipe) => (
            <RecipeGridCard key={recipe.id} recipe={recipe} token={token} />
          ))}
        </div>
      )}
    </section>
  );
}
