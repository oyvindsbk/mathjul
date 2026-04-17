'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { recipeService } from '@/lib/services/recipe.service';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import type { Category } from '@/lib/mock-data';
import { useAuth } from '@/lib/context/AuthContext';
import RecipeForm from '@/components/RecipeForm';
import MainPhotoUpload from '@/components/MainPhotoUpload';
import VisibilitySelector, { type Visibility } from '@/components/VisibilitySelector';
import EditRecipeLoading from './loading';

export default function EditRecipeClient({ id }: { id: string }) {
  const [initialData, setInitialData] = useState<RecipeFormData | null>(null);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentMainImageUrl, setCurrentMainImageUrl] = useState<string | null>(null);
  const [isUploadingMainImage, setIsUploadingMainImage] = useState(false);
  const [mainImageError, setMainImageError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('Public');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const [data, categories] = await Promise.all([
          recipeService.getRecipeById(id, token || undefined),
          recipeService.getAllCategories(token || undefined),
        ]);
        if (!data) {
          setError('Oppskrift ikke funnet');
          return;
        }
        setAvailableCategories(categories);
        const detail = data as {
          title: string;
          description?: string;
          ingredients?: { quantity: number | null; unit: string | null; name: string }[];
          instructionSteps?: { text: string; imageUrl?: string | null }[];
          ingredientSections?: { heading: string; ingredients: { quantity: number | null; unit: string | null; name: string }[] }[];
          instructionSections?: { heading: string; steps: { text: string; imageUrl?: string | null }[] }[];
          prepTime?: number;
          cookTimeMinutes?: number;
          servings?: number;
          categories?: Category[];
          imageUrl?: string | null;
          visibility?: string;
          groups?: { id: number; name: string }[];
          tips?: string[];
        };
        setCurrentMainImageUrl(detail.imageUrl ?? null);
        setVisibility((detail.visibility as Visibility) ?? 'Public');
        setGroupIds(detail.groups?.map((g) => g.id) ?? []);
        setInitialData({
          title: detail.title,
          description: detail.description,
          ingredients: detail.ingredients ?? [],
          instructionSteps: detail.instructionSteps ?? [],
          ingredientSections: detail.ingredientSections ?? [],
          instructionSections: detail.instructionSections ?? [],
          prepTime: detail.prepTime ?? null,
          cookTime: detail.cookTimeMinutes ?? null,
          servings: detail.servings ?? null,
          categoryIds: detail.categories?.map((c) => c.id) ?? [],
          tips: detail.tips ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke hente oppskriften');
      } finally {
        setLoading(false);
      }
    };

    if (authLoading || !id) return;
    fetchRecipe();
  }, [id, authLoading, token]);

  const handleMainImageSelected = async (file: File) => {
    setMainImageError(null);
    setIsUploadingMainImage(true);
    try {
      const updated = await recipeService.uploadMainImage(id, file, token || undefined);
      setCurrentMainImageUrl((updated as { imageUrl?: string | null }).imageUrl ?? null);
    } catch (err) {
      setMainImageError(err instanceof Error ? err.message : 'Kunne ikke laste opp bilde');
    } finally {
      setIsUploadingMainImage(false);
    }
  };

  const handleMainImageRemove = async () => {
    setMainImageError(null);
    setIsUploadingMainImage(true);
    try {
      await recipeService.deleteMainImage(id, token || undefined);
      setCurrentMainImageUrl(null);
    } catch (err) {
      setMainImageError(err instanceof Error ? err.message : 'Kunne ikke fjerne bilde');
    } finally {
      setIsUploadingMainImage(false);
    }
  };

  const handleSave = async (data: RecipeFormData) => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await recipeService.updateRecipe(id, { ...data, visibility, groupIds } as RecipeFormData & { visibility: Visibility; groupIds: number[] }, token || undefined);
      router.push(`/recipes/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunne ikke oppdatere oppskriften';
      setSaveError(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            ← Tilbake til oppskrift
          </Link>
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            <p className="font-semibold">Feil</p>
            <p>{error || 'Oppskrift ikke funnet'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Rediger oppskrift</h1>
          <Link
            href={`/recipes/${id}`}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            ← Tilbake til oppskrift
          </Link>
        </div>

        {saveError && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            <p className="font-semibold mb-1">Kunne ikke lagre</p>
            <p>{saveError}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <MainPhotoUpload
            currentImageUrl={currentMainImageUrl}
            onFileSelected={handleMainImageSelected}
            onRemove={handleMainImageRemove}
            isUploading={isUploadingMainImage}
            error={mainImageError}
          />
          <div className="mb-6 mt-4">
            <VisibilitySelector
              value={visibility}
              groupIds={groupIds}
              onChange={(v, ids) => { setVisibility(v); setGroupIds(ids); }}
            />
          </div>
          <RecipeForm
            initialData={initialData}
            onSave={handleSave}
            onCancel={() => router.push(`/recipes/${id}`)}
            isSaving={isSaving}
            submitLabel="Lagre endringer"
            availableCategories={availableCategories}
            onStepPhotoSelected={async (index, file) => {
              const updated = await recipeService.uploadStepImage(id, index, file, token || undefined);
              return (updated as { imageUrl?: string | null }).imageUrl ?? null;
            }}
            onStepPhotoRemove={async (index) => {
              await recipeService.deleteStepImage(id, index, token || undefined);
            }}
          />
        </div>
      </main>
    </div>
  );
}
