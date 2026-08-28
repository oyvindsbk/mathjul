'use client';

import { useState } from 'react';
import type { Category } from '@/lib/mock-data';

interface FilterPanelProps {
  categories: Category[];
  selectedCategoryIds: number[];
  onToggleCategory: (id: number) => void;
  allIngredientNames: string[];
  selectedIngredients: string[];
  onToggleIngredient: (name: string) => void;
  onClearAll: () => void;
}

const MAX_SUGGESTIONS = 8;

export default function FilterPanel({
  categories,
  selectedCategoryIds,
  onToggleCategory,
  allIngredientNames,
  selectedIngredients,
  onToggleIngredient,
  onClearAll,
}: FilterPanelProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [ingredientInput, setIngredientInput] = useState('');

  const activeFilterCount = selectedCategoryIds.length + selectedIngredients.length;

  const suggestions = ingredientInput.trim()
    ? allIngredientNames
        .filter(
          name =>
            name.toLowerCase().includes(ingredientInput.trim().toLowerCase()) &&
            !selectedIngredients.some(s => s.toLowerCase() === name.toLowerCase())
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function addIngredient(name: string) {
    onToggleIngredient(name);
    setIngredientInput('');
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = ingredientInput.trim();
    if (!trimmed) return;
    addIngredient(suggestions[0] ?? trimmed);
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setFilterOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
      >
        <span>Filtrer</span>
        {activeFilterCount > 0 && (
          <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            {activeFilterCount}
          </span>
        )}
        <span className="ml-1 text-gray-400">{filterOpen ? '▲' : '▼'}</span>
      </button>

      {filterOpen && (
        <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          {categories.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Kategorier
              </p>
              {Object.entries(
                categories.reduce<Record<string, Category[]>>((acc, cat) => {
                  (acc[cat.group] ??= []).push(cat);
                  return acc;
                }, {})
              ).map(([group, cats]) => (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="text-xs text-gray-400 mb-1.5">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {cats.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => onToggleCategory(cat.id)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                          selectedCategoryIds.includes(cat.id)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Ingredienser
            </p>
            {selectedIngredients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedIngredients.map(name => (
                  <button
                    key={name}
                    onClick={() => onToggleIngredient(name)}
                    className="px-3 py-1 rounded-full text-sm font-medium border bg-blue-500 text-white border-blue-500"
                  >
                    {name} ×
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={ingredientInput}
                onChange={e => setIngredientInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Søk etter ingrediens, f.eks. kylling"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map(name => (
                    <button
                      key={name}
                      onClick={() => addIngredient(name)}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Fjern alle filtre
            </button>
          )}
        </div>
      )}
    </div>
  );
}
