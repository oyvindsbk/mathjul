'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeService } from '@/lib/services/recipe.service';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import { useAuth } from '@/lib/context/AuthContext';
import RecipeForm from '@/components/RecipeForm';
import EditRecipeLoading from './loading';

export default function EditRecipeClient({ id }: { id: string }) {
  const [initialData, setInitialData] = useState<RecipeFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const data = await recipeService.getRecipeById(id, token || undefined);
        if (!data) {
          setError('Recipe not found');
          return;
        }
        const detail = data as {
          title: string;
          description?: string;
          ingredients?: { quantity: number | null; unit: string | null; name: string }[];
          instructions?: string[];
          prepTime?: number;
          cookTimeMinutes?: number;
          servings?: number;
          difficulty?: string;
        };
        setInitialData({
          title: detail.title,
          description: detail.description,
          ingredients: detail.ingredients ?? [],
          instructions: detail.instructions ?? [],
          prepTime: detail.prepTime ?? null,
          cookTime: detail.cookTimeMinutes ?? null,
          servings: detail.servings ?? null,
          difficulty: detail.difficulty ?? 'Medium',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch recipe');
      } finally {
        setLoading(false);
      }
    };

    if (authLoading || !id) return;
    fetchRecipe();
  }, [id, authLoading, token]);

  const handleSave = async (data: RecipeFormData) => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await recipeService.updateRecipe(id, data, token || undefined);
      router.push(`/recipes/${id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update recipe');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <EditRecipeLoading />;
  }

  if (error || !initialData) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/recipes/${id}`}
            className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            ← Back to Recipe
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
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Edit Recipe</h1>
          <Link
            href={`/recipes/${id}`}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            ← Back to Recipe
          </Link>
        </div>

        {saveError && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {saveError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <RecipeForm
            initialData={initialData}
            onSave={handleSave}
            onCancel={() => router.push(`/recipes/${id}`)}
            isSaving={isSaving}
            submitLabel="Save Changes"
          />
        </div>
      </main>
    </div>
  );
}
