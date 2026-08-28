'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { recipeService } from '@/lib/services/recipe.service';
import { useAuth } from '@/lib/context/AuthContext';
import type { Recipe, Category } from '@/lib/mock-data';
import SnurrLoading from './loading';
import FilterPanel from './FilterPanel';

const MAX_SEGMENTS = 20;

const SEGMENT_COLORS = [
  '#FF6B6B', '#FF9F43', '#FFEAA7', '#A8E063', '#4ECDC4',
  '#45B7D1', '#96C93D', '#F7971E', '#FDA7DF', '#D980FA',
  '#9980FA', '#00B5FF', '#00FFCC', '#FFB8B8', '#B8FFD9',
  '#FFD6B8', '#B8D9FF', '#FFB8FF', '#D9FFB8', '#FFFBB8',
];

const SPIN_DURATION = 3500; // ms

function recipeHasIngredient(recipe: Recipe, name: string): boolean {
  const term = name.toLowerCase();
  if (recipe.ingredients?.some(i => i.name.toLowerCase().includes(term))) {
    return true;
  }
  return !!recipe.ingredientSections?.some(section =>
    section.ingredients.some(i => i.name.toLowerCase().includes(term))
  );
}

export default function SnurrClient() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const { token, isLoading: authLoading } = useAuth();

  // Track cumulative rotation so each spin builds on the last, preventing rollback
  const cumulativeRotation = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    const fetchData = async () => {
      try {
        const [recipesData, categoriesData] = await Promise.all([
          recipeService.getAllRecipes(token || undefined),
          recipeService.getAllCategories(token || undefined),
        ]);
        setAllRecipes(recipesData);
        setCategories(categoriesData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke laste oppskrifter');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, token]);

  function toggleCategory(id: number) {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    setSelectedRecipe(null);
  }

  function toggleIngredient(name: string) {
    setSelectedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
    setSelectedRecipe(null);
  }

  function clearAllFilters() {
    setSelectedCategoryIds([]);
    setSelectedIngredients([]);
    setSelectedRecipe(null);
  }

  const allIngredientNames = useMemo(() => {
    const names = new Set<string>();
    for (const recipe of allRecipes) {
      for (const ingredient of recipe.ingredients ?? []) {
        const trimmed = ingredient.name.trim();
        if (trimmed) names.add(trimmed);
      }
      for (const section of recipe.ingredientSections ?? []) {
        for (const ingredient of section.ingredients) {
          const trimmed = ingredient.name.trim();
          if (trimmed) names.add(trimmed);
        }
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [allRecipes]);

  const filteredRecipes = allRecipes.filter(r => {
    const categoryOk =
      selectedCategoryIds.length === 0 ||
      r.categories?.some(c => selectedCategoryIds.includes(c.id));
    const ingredientsOk =
      selectedIngredients.length === 0 ||
      selectedIngredients.every(name => recipeHasIngredient(r, name));
    return categoryOk && ingredientsOk;
  });

  const recipes = filteredRecipes.slice(0, MAX_SEGMENTS);

  const segments = recipes;
  const segmentAngle = segments.length > 0 ? 360 / segments.length : 0;

  const hasActiveFilters = selectedCategoryIds.length > 0 || selectedIngredients.length > 0;

  function spin() {
    if (spinning || segments.length < 2) return;

    // Pick a random winner
    const winnerIndex = Math.floor(Math.random() * segments.length);

    // Angle to bring winner segment to the top (pointer at 0°/top)
    // Segment i occupies [i*segmentAngle, (i+1)*segmentAngle]
    // We want the center of segment i to land at 0° (top)
    // The wheel rotates clockwise; top corresponds to 0°.
    // Center of segment i (in wheel coords) = i * segmentAngle + segmentAngle / 2
    // We need: cumulativeRotation + extraSpin ≡ 360 - centerAngle (mod 360)
    const centerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetAngle = 360 - centerAngle;

    // Add 5 full rotations for drama, then land on target
    const fullRotations = 5 * 360;
    const currentMod = cumulativeRotation.current % 360;
    let delta = (targetAngle - currentMod + 360) % 360;
    if (delta === 0) delta = 360; // ensure at least one full segment move even if already aligned
    const totalDelta = fullRotations + delta;

    cumulativeRotation.current += totalDelta;
    setSpinning(true);
    setSelectedRecipe(null);
    setRotation(cumulativeRotation.current);

    setTimeout(() => {
      setSpinning(false);
      setSelectedRecipe(segments[winnerIndex]);
    }, SPIN_DURATION + 50);
  }

  if (loading) {
    return <SnurrLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline">← Tilbake til oppskrifter</Link>
        </div>
      </div>
    );
  }

  if (segments.length < 2) {
    const reason = hasActiveFilters
      ? 'Ingen oppskrifter matcher filtrene dine. Prøv å fjerne noen filtre.'
      : 'Du trenger minst 2 oppskrifter som matcher filtrene dine for å snurre mathjulet.';
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              ← Tilbake til oppskrifter
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
            Snurr mathjulet 🎡
          </h1>
          <p className="text-gray-600 text-center mb-6">
            Usikker på hva det skal bli i kveld? Snurr mathjulet og la tilfeldighetene bestemme middagen — eller bruk filtrene for å styre litt selv.
          </p>
          <FilterPanel
            categories={categories}
            selectedCategoryIds={selectedCategoryIds}
            onToggleCategory={toggleCategory}
            allIngredientNames={allIngredientNames}
            selectedIngredients={selectedIngredients}
            onToggleIngredient={toggleIngredient}
            onClearAll={clearAllFilters}
          />
          <div className="text-center">
            <p className="text-2xl mb-2">🍽️</p>
            <p className="text-gray-700 mb-4">{reason}</p>
          </div>
        </div>
      </div>
    );
  }

  // Build conic-gradient stops
  const gradientStops = segments
    .map((_, i) => {
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      return `${color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            ← Tilbake til oppskrifter
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          Snurr mathjulet 🎡
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Usikker på hva det skal bli i kveld? Snurr mathjulet og la tilfeldighetene bestemme middagen — eller bruk filtrene for å styre litt selv.
        </p>

        <FilterPanel
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          onToggleCategory={toggleCategory}
          allIngredientNames={allIngredientNames}
          selectedIngredients={selectedIngredients}
          onToggleIngredient={toggleIngredient}
          onClearAll={clearAllFilters}
        />

        {/* Wheel container */}
        <div className="flex flex-col items-center gap-8">
          <div className="relative" style={{ width: 320, height: 320 }}>
            {/* Pointer */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-10"
              style={{ top: -16 }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderTop: '24px solid #1f2937',
                }}
              />
            </div>

            {/* The wheel */}
            <div
              style={{
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: `conic-gradient(${gradientStops})`,
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 1.0)`
                  : 'none',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              {/* Center circle */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {segments.map((recipe, i) => (
              <div key={recipe.id} className="flex items-center gap-2 min-w-0">
                <span
                  className="shrink-0 rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
                <span className="text-sm text-gray-700 truncate">{recipe.title}</span>
              </div>
            ))}
          </div>

          {/* Spin button */}
          {!selectedRecipe && (
            <button
              onClick={spin}
              disabled={spinning}
              className="px-10 py-4 bg-blue-600 text-white font-bold text-xl rounded-full shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {spinning ? 'Snurrer...' : 'Snurr! 🎲'}
            </button>
          )}

          {/* Result card */}
          {selectedRecipe && (
            <div className="w-full bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
              <p className="text-gray-500 text-sm mb-2 uppercase tracking-wide">Dagens oppskrift</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{selectedRecipe.title}</h2>
              {selectedRecipe.description && (
                <p className="text-gray-600 mb-6">{selectedRecipe.description}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={`/recipes/${selectedRecipe.id}`}
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Se oppskrift →
                </Link>
                <button
                  onClick={spin}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Snurr igjen 🎡
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
