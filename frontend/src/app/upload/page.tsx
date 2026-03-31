'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton } from '@/components/AuthButton';
import { useApiToken } from '@/hooks/useApiToken';
import RecipeForm from '@/components/RecipeForm';
import { recipeService } from '@/lib/services/recipe.service';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import type { Category } from '@/lib/mock-data';

type ExtractedRecipe = RecipeFormData;

type InputMode = 'image' | 'url';

export default function UploadRecipe() {
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { token, loading: tokenLoading, error: tokenError } = useApiToken();

  useEffect(() => {
    recipeService.getAllCategories().then(setAvailableCategories).catch(() => {});
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setExtractedRecipe(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSwitchMode = (mode: InputMode) => {
    setInputMode(mode);
    setError(null);
    setExtractedRecipe(null);
  };

  const handleExtractFromImage = async () => {
    if (!selectedFile) return;

    if (!token) {
      setError('Authentication token not available. Please try logging in again.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error('API base URL is not set. Please define NEXT_PUBLIC_API_BASE_URL in your environment variables.');
      }
      const response = await fetch(`${apiBaseUrl}/api/recipes/from-image`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const text = await response.text();
      if (!text) throw new Error('No response from server. The request may have timed out.');
      const data = JSON.parse(text);

      if (!response.ok || !data.success) {
        if (response.status === 403) {
          throw new Error('Access denied. Your account is not authorized. Please contact an administrator.');
        }
        throw new Error(data.errorMessage || 'Failed to extract recipe');
      }

      setExtractedRecipe(data.extractedRecipe);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract recipe';
      setError(errorMessage);
      if (errorMessage.includes('Access denied')) {
        setTimeout(() => router.push('/403'), 2000);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractFromUrl = async () => {
    if (!recipeUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!token) {
      setError('Authentication token not available. Please try logging in again.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error('API base URL is not set. Please define NEXT_PUBLIC_API_BASE_URL in your environment variables.');
      }
      const response = await fetch(`${apiBaseUrl}/api/recipes/from-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: recipeUrl.trim() }),
      });

      const text = await response.text();
      if (!text) throw new Error('No response from server. The request may have timed out.');
      const data = JSON.parse(text);

      if (!response.ok || !data.success) {
        if (response.status === 403) {
          throw new Error('Access denied. Your account is not authorized. Please contact an administrator.');
        }
        throw new Error(data.errorMessage || 'Failed to extract recipe');
      }

      setExtractedRecipe(data.extractedRecipe);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract recipe';
      setError(errorMessage);
      if (errorMessage.includes('Access denied')) {
        setTimeout(() => router.push('/403'), 2000);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveRecipe = async (data: RecipeFormData) => {
    if (!token) {
      setError('Authentication token not available. Please try logging in again.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/api/recipes/save-extracted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save recipe');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Import Recipe</h1>
          <div className="flex items-center gap-4">
            <AuthButton />
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              ← Back to Recipes
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex mb-6 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden w-fit">
          <button
            onClick={() => handleSwitchMode('image')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              inputMode === 'image'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Upload Image
          </button>
          <button
            onClick={() => handleSwitchMode('url')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              inputMode === 'url'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Paste URL
          </button>
        </div>

        {/* Image Upload Area */}
        {inputMode === 'image' && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center mb-8 transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!previewUrl ? (
              <div>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop an image here, or
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Select File
                </button>
                <p className="mt-2 text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
              </div>
            ) : (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-96 mx-auto rounded-lg shadow-lg mb-4"
                />
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Change Image
                  </button>
                  {!extractedRecipe && (
                    <button
                      onClick={handleExtractFromImage}
                      disabled={isExtracting}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isExtracting ? 'Extracting Recipe...' : 'Extract Recipe'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL Input Area */}
        {inputMode === 'url' && (
          <div className="border-2 border-gray-300 dark:border-gray-700 rounded-lg p-8 mb-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Paste the URL of a recipe page and we&apos;ll extract the recipe automatically.
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isExtracting) handleExtractFromUrl(); }}
                placeholder="https://www.example.com/recipe/chocolate-cake"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
              {!extractedRecipe && (
                <button
                  onClick={handleExtractFromUrl}
                  disabled={isExtracting || !recipeUrl.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isExtracting ? 'Extracting...' : 'Extract Recipe'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Token Loading State */}
        {tokenLoading && (
          <div className="mb-8 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400">
            Preparing authentication...
          </div>
        )}

        {/* Error Message */}
        {(error || tokenError) && (
          <div className="mb-8 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error || tokenError}
          </div>
        )}

        {/* Extracted Recipe */}
        {extractedRecipe && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">Extracted Recipe</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Review and edit the extracted information before saving
            </p>
            <RecipeForm
              initialData={extractedRecipe}
              onSave={handleSaveRecipe}
              onCancel={() => setExtractedRecipe(null)}
              isSaving={isSaving}
              submitLabel="Save Recipe"
              availableCategories={availableCategories}
            />
          </div>
        )}
      </main>
    </div>
  );
}
