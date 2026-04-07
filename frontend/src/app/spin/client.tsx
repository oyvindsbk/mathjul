'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { recipeService } from '@/lib/services/recipe.service';
import { useAuth } from '@/lib/context/AuthContext';
import type { Recipe, Category } from '@/lib/mock-data';
import SpinLoading from './loading';

const MAX_SEGMENTS = 20;

const SEGMENT_COLORS = [
  '#FF6B6B', '#FF9F43', '#FFEAA7', '#A8E063', '#4ECDC4',
  '#45B7D1', '#96C93D', '#F7971E', '#FDA7DF', '#D980FA',
  '#9980FA', '#00B5FF', '#00FFCC', '#FFB8B8', '#B8FFD9',
  '#FFD6B8', '#B8D9FF', '#FFB8FF', '#D9FFB8', '#FFFBB8',
];

const SPIN_DURATION = 3500; // ms

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export default function SpinClient() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
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

  function clearCategories() {
    setSelectedCategoryIds([]);
    setSelectedRecipe(null);
  }

  const filteredRecipes = selectedCategoryIds.length === 0
    ? allRecipes
    : allRecipes.filter(r =>
        selectedCategoryIds.every(id => r.categories?.some(c => c.id === id))
      );

  const recipes = filteredRecipes.slice(0, MAX_SEGMENTS);

  const segments = recipes;
  const segmentAngle = segments.length > 0 ? 360 / segments.length : 0;


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
    return <SpinLoading />;
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
    const reason = selectedCategoryIds.length > 0
      ? 'Ingen oppskrifter matcher de valgte kategoriene. Prøv å fjerne noen filtre.'
      : 'Du trenger minst 2 oppskrifter for å bruke hjulet.';
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              ← Tilbake til oppskrifter
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
            Spin the Wheel 🎡
          </h1>
          <p className="text-gray-600 text-center mb-6">
            Kan ikke bestemme deg? La hjulet velge for deg!
          </p>
          {categories.length > 0 && (
            <div className="mb-8">
              <button
                onClick={() => setFilterOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
              >
                <span>Filtrer kategorier</span>
                {selectedCategoryIds.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {selectedCategoryIds.length}
                  </span>
                )}
                <span className="ml-1 text-gray-400">{filterOpen ? '▲' : '▼'}</span>
              </button>
              {filterOpen && (
                <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  {Object.entries(
                    categories.reduce<Record<string, Category[]>>((acc, cat) => {
                      (acc[cat.group] ??= []).push(cat);
                      return acc;
                    }, {})
                  ).map(([group, cats]) => (
                    <div key={group} className="mb-4 last:mb-0">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                      <div className="flex flex-wrap gap-2">
                        {cats.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
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
                  {selectedCategoryIds.length > 0 && (
                    <button
                      onClick={clearCategories}
                      className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Fjern alle filtre
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
          Spin hjulet 🎡
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Kan ikke bestemme deg? La hjulet velge for deg!
        </p>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <span>Filtrer kategorier</span>
              {selectedCategoryIds.length > 0 && (
                <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {selectedCategoryIds.length}
                </span>
              )}
              <span className="ml-1 text-gray-400">{filterOpen ? '▲' : '▼'}</span>
            </button>

            {filterOpen && (
              <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                {Object.entries(
                  categories.reduce<Record<string, Category[]>>((acc, cat) => {
                    (acc[cat.group] ??= []).push(cat);
                    return acc;
                  }, {})
                ).map(([group, cats]) => (
                  <div key={group} className="mb-4 last:mb-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {cats.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
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
                {selectedCategoryIds.length > 0 && (
                  <button
                    onClick={clearCategories}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Fjern alle filtre
                  </button>
                )}
              </div>
            )}
          </div>
        )}

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
              {/* Segment labels */}
              {segments.map((recipe, i) => {
                const midAngle = i * segmentAngle + segmentAngle / 2;
                // Place text ~35% from center toward edge
                const r = 110; // px from center
                const rad = ((midAngle - 90) * Math.PI) / 180;
                const x = 160 + r * Math.cos(rad);
                const y = 160 + r * Math.sin(rad);
                return (
                  <div
                    key={recipe.id}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#1f2937',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                      maxWidth: 90,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {truncate(recipe.title, 14)}
                  </div>
                );
              })}

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
