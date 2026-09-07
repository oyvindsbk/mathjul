'use client';

import type { Recipe } from '@/lib/mock-data';

export interface OptionCandidate {
  recipe: Recipe;
  color: string;
}

interface OptionListProps {
  candidates: OptionCandidate[];
  excludedRecipeIds: number[];
  onToggleRecipe: (id: number) => void;
  onIncludeAll: () => void;
}

export default function OptionList({
  candidates,
  excludedRecipeIds,
  onToggleRecipe,
  onIncludeAll,
}: OptionListProps) {
  const excludedCount = candidates.filter(c => excludedRecipeIds.includes(c.recipe.id)).length;
  const includedCount = candidates.length - excludedCount;

  if (candidates.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Alternativer på hjulet ({includedCount} av {candidates.length})
        </p>
        {excludedCount > 0 && (
          <button
            onClick={onIncludeAll}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Inkluder alle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {candidates.map(({ recipe, color }) => {
          const included = !excludedRecipeIds.includes(recipe.id);
          return (
            <label
              key={recipe.id}
              className="flex items-center gap-2 min-w-0 cursor-pointer py-0.5 group"
            >
              <input
                type="checkbox"
                checked={included}
                onChange={() => onToggleRecipe(recipe.id)}
                className="shrink-0 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 cursor-pointer"
              />
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: color,
                  opacity: included ? 1 : 0.3,
                }}
              />
              <span
                className={`text-sm truncate ${
                  included ? 'text-gray-700' : 'text-gray-400 line-through'
                }`}
              >
                {recipe.title}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
