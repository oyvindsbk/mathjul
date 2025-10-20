"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { recipeService } from "@/lib/services/recipe.service";
import type { Recipe } from "@/lib/mock-data";

export default function SpinPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const data = await recipeService.getAllRecipes();
        setRecipes(data);
      } catch (err) {
        console.error('Error fetching recipes:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  const handleSpin = () => {
    if (isSpinning || recipes.length === 0) return;

    setIsSpinning(true);
    setSelectedRecipe(null);

  if (wheelRef.current) {
      // Reset to 0 with no transition
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'rotate(0deg)';

      // Force reflow to apply the reset
      void wheelRef.current.offsetWidth;

      // Now animate the spin
      setTimeout(() => {
        if (wheelRef.current) {
          // Random number of rotations (5-8) plus random offset
          const spins = 5 + Math.random() * 3;
          const randomIndex = Math.floor(Math.random() * recipes.length);
          const sectionDegrees = 360 / recipes.length;
          // Use +0.5 to target the middle of the slice so the pointer lands centered
          const finalRotation = spins * 360 + (randomIndex + 0.5) * sectionDegrees;

          wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;

          // Show result after animation completes
          setTimeout(() => {
            const randomRecipe = recipes[randomIndex];
            setSelectedRecipe(randomRecipe);
            setIsSpinning(false);
          }, 4000);
        }
      }, 0);
    } else {
      // If the wheel element isn't available, clear the spinning state so the UI doesn't hang
      setIsSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recipes...</p>
        </div>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">No recipes available</p>
            <p>There are no recipes to spin. Please add some recipes first.</p>
          </div>
        </div>
      </div>
    );
  }

  const sectionDegrees = 360 / recipes.length;
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-2">
          Snurr mathjulet
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Snurr hjulet og la skjebnen bestemme din neste oppskrift!
        </p>

        {error && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
          {/* Wheel Container */}
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-80 h-80">
              {/* Pointer */}
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
                <div className="w-0 h-0 border-l-8 border-r-8 border-t-12 border-l-transparent border-r-transparent border-t-red-600"></div>
              </div>

              {/* Wheel */}
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full shadow-2xl"
                style={{
                  background: `conic-gradient(${recipes
                    .map(
                      (recipe: Recipe, index: number) =>
                        `${colors[index % colors.length]} ${index * sectionDegrees}deg ${
                          (index + 1) * sectionDegrees
                        }deg`
                    )
                    .join(', ')})`,
                }}
              >
                {/* Recipe Labels */}
                <div className="w-full h-full relative rounded-full flex items-center justify-center">
                  {recipes.map((recipe: Recipe, index: number) => {
                    const angle = (index + 0.5) * sectionDegrees;
                    const radians = (angle * Math.PI) / 180;
                    const distance = 110;
                    const x = Math.cos(radians) * distance;
                    const y = Math.sin(radians) * distance;

                    return (
                      <div
                        key={recipe.id}
                        className="absolute text-white text-xs font-bold text-center max-w-16 px-2"
                        style={{
                          transform: `translate(${x}px, ${y}px) rotate(${angle + 90}deg)`,
                          width: '60px',
                        }}
                      >
                        <p className="line-clamp-3">{recipe.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              data-testid="spin-button"
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
            >
              {isSpinning ? '🎡 Spinner...' : '🎡 Start snurring!'}
            </button>
          </div>

          {/* Result Panel */}
          <div className="lg:min-h-80 flex flex-col justify-center gap-6">
            {selectedRecipe ? (
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm" data-testid="result-panel">
                <div className="text-center">
                  <div className="text-6xl mb-4">🍽️</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Du fikk:
                  </h2>
                  <p className="text-3xl font-bold text-blue-600 mb-6" data-testid="result-recipe-title">
                    {selectedRecipe.title}
                  </p>
                  <Link
                    href={`/recipes/${selectedRecipe.id}`}
                    data-testid="view-recipe-link"
                    className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Vis oppskrift →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm">
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">❓</div>
                  <p className="text-gray-600 text-lg">
                    Klikk spin-knappen for å oppdage din neste oppskrift!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recipe List */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Tilgjengelige oppskrifter ({recipes.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="recipes-list">
            {recipes.map((recipe: Recipe, index: number) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                data-testid={`recipe-list-item-${recipe.id}`}
                className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer border-l-4"
                style={{ borderColor: colors[index % colors.length] }}
              >
                <h4 className="font-semibold text-gray-900 line-clamp-2 hover:text-blue-600">
                  {recipe.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
