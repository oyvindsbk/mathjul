"use client";

import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/mock-data";
import { recipeService } from "@/lib/services/recipe.service";

const MAX_SEGMENTS = 20;
const SPIN_DURATION = 3500;

const SEGMENT_COLORS = [
  '#FF6B6B', '#FF9F43', '#FFEAA7', '#A8E063', '#4ECDC4',
  '#45B7D1', '#96C93D', '#F7971E', '#FDA7DF', '#D980FA',
  '#9980FA', '#00B5FF', '#00FFCC', '#FFB8B8', '#B8FFD9',
  '#FFD6B8', '#B8D9FF', '#FFB8FF', '#D9FFB8', '#FFFBB8',
];

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

interface RecipePickerModalProps {
  token: string;
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

export function RecipePickerModal({ token, onSelect, onClose }: RecipePickerModalProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"search" | "spin">("search");

  // Spin state
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<Recipe | null>(null);
  const cumulativeRotation = useRef(0);

  useEffect(() => {
    recipeService
      .getAllRecipes(token)
      .then(setRecipes)
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  const segments = recipes.slice(0, MAX_SEGMENTS);
  const segmentAngle = segments.length > 0 ? 360 / segments.length : 0;

  function spin() {
    if (spinning || segments.length < 2) return;
    setSpinResult(null);

    const winnerIndex = Math.floor(Math.random() * segments.length);
    const centerAngle = winnerIndex * segmentAngle + segmentAngle / 2;
    const targetAngle = 360 - centerAngle;
    const fullRotations = 5 * 360;
    const currentMod = cumulativeRotation.current % 360;
    let delta = (targetAngle - currentMod + 360) % 360;
    if (delta === 0) delta = 360;
    const totalDelta = fullRotations + delta;

    cumulativeRotation.current += totalDelta;
    setSpinning(true);
    setRotation(cumulativeRotation.current);

    setTimeout(() => {
      setSpinning(false);
      setSpinResult(segments[winnerIndex]);
    }, SPIN_DURATION + 50);
  }

  const gradientStops = segments
    .map((_, i) => {
      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      return `${color} ${start}deg ${end}deg`;
    })
    .join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Velg oppskrift</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Lukk"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === "search"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("search")}
          >
            Søk
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === "spin"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("spin")}
          >
            <span>🎡</span> Snurr hjulet
          </button>
        </div>

        {/* Search tab */}
        {tab === "search" && (
          <>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Søk etter oppskrift..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 text-center text-gray-500 text-sm">Laster oppskrifter...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">Ingen oppskrifter funnet.</div>
              ) : (
                <ul>
                  {filtered.map((recipe) => (
                    <li key={recipe.id}>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                        onClick={() => onSelect(recipe)}
                      >
                        <div className="w-12 h-12 rounded-md bg-gray-100 flex-shrink-0 overflow-hidden">
                          {recipe.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="flex items-center justify-center h-full text-gray-400 text-xs">🍽️</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{recipe.title}</p>
                          {recipe.description && (
                            <p className="text-xs text-gray-500 truncate">{recipe.description}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Spin tab */}
        {tab === "spin" && (
          <div className="flex-1 overflow-y-auto flex flex-col items-center py-6 px-4 gap-5">
            {loading ? (
              <div className="text-gray-500 text-sm">Laster oppskrifter...</div>
            ) : segments.length < 2 ? (
              <div className="text-gray-500 text-sm text-center">
                Du trenger minst 2 oppskrifter for å bruke hjulet.
              </div>
            ) : (
              <>
                {/* Wheel */}
                <div className="relative flex-shrink-0" style={{ width: 280, height: 280 }}>
                  {/* Pointer */}
                  <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -14 }}>
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: '10px solid transparent',
                      borderRight: '10px solid transparent',
                      borderTop: '20px solid #1f2937',
                    }} />
                  </div>

                  <div
                    style={{
                      width: 280,
                      height: 280,
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
                    {segments.map((recipe, i) => {
                      const midAngle = i * segmentAngle + segmentAngle / 2;
                      const r = 95;
                      const rad = ((midAngle - 90) * Math.PI) / 180;
                      const x = 140 + r * Math.cos(rad);
                      const y = 140 + r * Math.sin(rad);
                      return (
                        <div
                          key={recipe.id}
                          style={{
                            position: 'absolute',
                            left: x, top: y,
                            transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#1f2937',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                            maxWidth: 80,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {truncate(recipe.title, 14)}
                        </div>
                      );
                    })}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </div>

                {/* Spin button */}
                <button
                  onClick={spin}
                  disabled={spinning}
                  className="px-8 py-3 bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {spinning ? 'Snurrer...' : 'Snurr! 🎲'}
                </button>

                {/* Result */}
                {spinResult && !spinning && (
                  <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Resultatet er...</p>
                    <p className="text-lg font-bold text-gray-900 mb-3">{spinResult.title}</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelect(spinResult)}
                        className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        Velg denne
                      </button>
                      <button
                        onClick={spin}
                        className="px-5 py-2 bg-white text-gray-700 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Snurr igjen 🎡
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
