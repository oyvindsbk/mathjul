"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/AuthButton";

interface Recipe {
  id: number;
  title: string;
  description: string;
  cookTime: string;
  difficulty: string;
  imageUrl: string;
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        // Use environment variable or fallback to localhost for development
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
        const response = await fetch(`${apiUrl}/api/recipes`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch recipes: ${response.statusText}`);
        }
        
        const data = await response.json();
        setRecipes(data);
      } catch (err) {
        console.error('Error fetching recipes:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
        
        // Fallback to mock data if API is not available
        setRecipes([
          {
            id: 1,
            title: "Classic Spaghetti Carbonara",
            description: "A traditional Italian pasta dish with eggs, cheese, and pancetta",
            cookTime: "20 minutes",
            difficulty: "Medium",
            imageUrl: "/api/placeholder/300/200"
          },
          {
            id: 2,
            title: "Chicken Tikka Masala", 
            description: "Creamy and flavorful Indian curry with tender chicken pieces",
            cookTime: "45 minutes",
            difficulty: "Medium",
            imageUrl: "/api/placeholder/300/200"
          },
          {
            id: 3,
            title: "Chocolate Chip Cookies",
            description: "Soft and chewy homemade cookies with chocolate chips",
            cookTime: "25 minutes",
            difficulty: "Easy",
            imageUrl: "/api/placeholder/300/200"
          },
          {
            id: 4,
            title: "Caesar Salad",
            description: "Fresh romaine lettuce with homemade caesar dressing and croutons",
            cookTime: "15 minutes",
            difficulty: "Easy",
            imageUrl: "/api/placeholder/300/200"
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Auth Button */}
        <div className="flex justify-end mb-8">
          <AuthButton />
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Food Recipes
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover delicious recipes from around the world. From quick weeknight dinners to special occasion treats.
          </p>
          {error && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
              <p className="text-sm">
                API connection failed, showing sample data. {error}
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
              Upload Recipe from Image
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="h-48 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">Recipe Image</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {recipe.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {recipe.description}
                </p>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {recipe.cookTime}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    recipe.difficulty === 'Easy' 
                      ? 'bg-green-100 text-green-800' 
                      : recipe.difficulty === 'Medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {recipe.difficulty}
                  </span>
                </div>
                <Link 
                  href={`/recipes/${recipe.id}`}
                  className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 text-center"
                >
                  View Recipe
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
