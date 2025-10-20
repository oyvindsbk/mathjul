"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import type { Recipe } from "@/lib/mock-data";

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const data = await recipeService.getAllRecipes(token || undefined);
        setRecipes(data);
      } catch (err) {
        console.error('Error fetching recipes:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Laster inn oppskrifter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-8">
          <AuthButton />
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Matoppskrifter
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Oppdag deilige oppskrifter fra hele verden. Fra raske hverdagsmiddager til spesielle anledninger.
          </p>
          {error && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
              <p className="text-sm">
                API-tilkobling mislyktes, viser eksempeldata. {error}
              </p>
            </div>
          )}
          
          {/* Add Upload Button */}
          <div className="mt-6">
            <a 
              href="/upload"
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Last opp oppskrift fra bilde
            </a>
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="recipe-grid">
            {recipes.map((recipe) => (
              <div key={recipe.id} data-testid={`recipe-card-${recipe.id}`} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">Oppskrift bilde</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {recipe.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {recipe.description || 'Ingen beskrivelse'}
                </p>
                <Link 
                  href={`/recipes/${recipe.id}`}
                  className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center"
                >
                  Vis oppskrift
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
