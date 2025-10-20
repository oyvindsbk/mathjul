"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { recipeService } from "@/lib/services/recipe.service";
import type { Recipe } from "@/lib/mock-data";

interface RecipeDetail extends Recipe {
  cookTime?: string;
  cookTimeMinutes?: number;
  prepTime?: number;
  difficulty?: string;
  imageUrl?: string;
  servings?: number;
  ingredients?: string[];
  instructions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function RecipeDetailClient({ id }: { id: string }) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const data = await recipeService.getRecipeById(id);
        
        if (!data) {
          setError('Recipe not found');
          setRecipe(null);
        } else {
          setRecipe(data as RecipeDetail);
        }
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recipe');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRecipe();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laster inn oppskrift...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/"
            data-testid="back-link"
            className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tilbake til oppskrifter
          </Link>
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">Error</p>
            <p>{error || 'Recipe not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/"
          data-testid="back-link"
          className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 mb-8"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Recipes
        </Link>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="h-96 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500">Recipe Image</span>
          </div>
          
          <div className="p-8">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-4xl font-bold text-gray-900">{recipe.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                recipe.difficulty === 'Easy' 
                  ? 'bg-green-100 text-green-800' 
                  : recipe.difficulty === 'Medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {recipe.difficulty}
              </span>
            </div>

            <p className="text-lg text-gray-600 mb-6">{recipe.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-200">
              {recipe.prepTime && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{recipe.prepTime}</div>
                  <div className="text-sm text-gray-600">Forberedelsestid (min)</div>
                </div>
              )}
              {recipe.cookTimeMinutes && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{recipe.cookTimeMinutes}</div>
                  <div className="text-sm text-gray-600">Stektid (min)</div>
                </div>
              )}
              {recipe.servings && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{recipe.servings}</div>
                  <div className="text-sm text-gray-600">Porsjoner</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-sm text-gray-500">Sist oppdatert</div>
                <div className="text-sm text-gray-600">
                  {recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6" data-testid="ingredients-heading">Ingredienser</h2>
              <ul className="space-y-3">
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  recipe.ingredients.map((ingredient: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <input 
                        type="checkbox" 
                        className="mt-1 mr-3 w-4 h-4 text-blue-600 rounded cursor-pointer"
                        aria-label={`Ingredient: ${ingredient}`}
                      />
                      <span className="text-gray-700">{ingredient}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">Ingen ingredienser tilgjengelig</li>
                )}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6" data-testid="instructions-heading">Instruksjoner</h2>
              <ol className="space-y-4">
                {recipe.instructions && recipe.instructions.length > 0 ? (
                  recipe.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold mr-4 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 pt-1">{instruction}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">Ingen instruksjoner tilgjengelig</li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
