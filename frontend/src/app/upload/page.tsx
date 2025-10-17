'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton } from '@/components/AuthButton';

interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
}

export default function UploadRecipe() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleExtractRecipe = async () => {
    if (!selectedFile) return;

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
      });

      const data = await response.json();

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
      
      // If access denied, redirect to 403 page after showing error
      if (errorMessage.includes('Access denied')) {
        setTimeout(() => router.push('/403'), 2000);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!extractedRecipe) return;

    setIsSaving(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/api/recipes/save-extracted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractedRecipe),
      });

      if (!response.ok) {
        throw new Error('Failed to save recipe');
      }

      // Redirect to home page
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditField = (field: keyof ExtractedRecipe, value: string | string[] | number | null) => {
    if (!extractedRecipe) return;
    setExtractedRecipe({ ...extractedRecipe, [field]: value });
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Upload Recipe Image</h1>
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

        {/* File Upload Area */}
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
                    onClick={handleExtractRecipe}
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

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Extracted Recipe */}
        {extractedRecipe && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">Extracted Recipe</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Review and edit the extracted information before saving
            </p>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={extractedRecipe.title}
                  onChange={(e) => handleEditField('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={extractedRecipe.description || ''}
                  onChange={(e) => handleEditField('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  rows={2}
                />
              </div>

              {/* Servings, Prep Time, Cook Time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Servings</label>
                  <input
                    type="number"
                    value={extractedRecipe.servings || ''}
                    onChange={(e) => handleEditField('servings', parseInt(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Prep Time (min)</label>
                  <input
                    type="number"
                    value={extractedRecipe.prepTime || ''}
                    onChange={(e) => handleEditField('prepTime', parseInt(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Cook Time (min)</label>
                  <input
                    type="number"
                    value={extractedRecipe.cookTime || ''}
                    onChange={(e) => handleEditField('cookTime', parseInt(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ingredients ({extractedRecipe.ingredients.length})
                </label>
                <div className="space-y-2">
                  {extractedRecipe.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={ingredient}
                        onChange={(e) => {
                          const newIngredients = [...extractedRecipe.ingredients];
                          newIngredients[index] = e.target.value;
                          handleEditField('ingredients', newIngredients);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                      />
                      <button
                        onClick={() => {
                          const newIngredients = extractedRecipe.ingredients.filter((_, i) => i !== index);
                          handleEditField('ingredients', newIngredients);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditField('ingredients', [...extractedRecipe.ingredients, ''])}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    + Add Ingredient
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Instructions ({extractedRecipe.instructions.length} steps)
                </label>
                <div className="space-y-2">
                  {extractedRecipe.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg font-medium">
                        {index + 1}
                      </span>
                      <textarea
                        value={instruction}
                        onChange={(e) => {
                          const newInstructions = [...extractedRecipe.instructions];
                          newInstructions[index] = e.target.value;
                          handleEditField('instructions', newInstructions);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                        rows={2}
                      />
                      <button
                        onClick={() => {
                          const newInstructions = extractedRecipe.instructions.filter((_, i) => i !== index);
                          handleEditField('instructions', newInstructions);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditField('instructions', [...extractedRecipe.instructions, ''])}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    + Add Step
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSaveRecipe}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save Recipe'}
                </button>
                <button
                  onClick={() => setExtractedRecipe(null)}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
