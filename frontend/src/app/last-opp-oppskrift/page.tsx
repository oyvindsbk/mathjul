'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthButton } from '@/components/AuthButton';
import { useApiToken } from '@/hooks/useApiToken';
import RecipeForm from '@/components/RecipeForm';
import MainPhotoUpload from '@/components/MainPhotoUpload';
import VisibilitySelector, { type Visibility } from '@/components/VisibilitySelector';
import { recipeService } from '@/lib/services/recipe.service';
import { consumeSseStream } from '@/lib/sseStream';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import type { Category } from '@/lib/mock-data';

type ExtractedRecipe = RecipeFormData;

type ApiExtractedRecipe = Omit<RecipeFormData, 'categoryIds' | 'instructionSteps'> & {
  suggestedCategoryIds?: number[];
  instructionSteps?: RecipeFormData['instructionSteps'];
  sourceUrl?: string | null;
  sourceImageUrl?: string | null;
  mainImageUrl?: string | null;
};

type InputMode = 'image' | 'url' | 'manual';

export default function UploadRecipe() {
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  // Provenance: original source URL or source image blob URL
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  // Main photo state for the extracted recipe
  const [currentMainImageUrl, setCurrentMainImageUrl] = useState<string | null>(null);
  const [pendingMainImageFile, setPendingMainImageFile] = useState<File | null>(null);
  const [isUploadingMainImage, setIsUploadingMainImage] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('Public');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  // Step photos: map from object URL → File, for pending upload after recipe creation
  const pendingStepPhotosRef = useRef<Map<string, File>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { token, loading: tokenLoading, error: tokenError } = useApiToken();

  useEffect(() => {
    if (tokenLoading) return;
    recipeService.getAllCategories(token || undefined).then(setAvailableCategories).catch(() => {});
  }, [tokenLoading, token]);

  const handleFilesSelect = (files: File[]) => {
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Alle filer må være bilder');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`Filen "${file.name}" er større enn 10 MB`);
        return;
      }
      validFiles.push(file);
    }

    const combined = [...selectedFiles, ...validFiles].slice(0, 5);
    setSelectedFiles(combined);
    setError(null);
    setExtractedRecipe(null);

    const newUrls = combined.map((f) => URL.createObjectURL(f));
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls(newUrls);
  };

  const handleRemoveFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFilesSelect(files);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesSelect(files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const images = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (images.length > 0) handleFilesSelect(images);
  };

  const emptyRecipe = (): ExtractedRecipe => ({
    title: '',
    description: '',
    ingredients: [],
    instructionSteps: [],
    ingredientSections: [],
    instructionSections: [],
    prepTime: null,
    cookTime: null,
    servings: null,
    categoryIds: [],
    tips: [],
    mainImageUrl: null,
    sourceUrl: null,
    sourceImageUrl: null,
  });

  const handleSwitchMode = (mode: InputMode) => {
    setInputMode(mode);
    setError(null);
    setExtractedRecipe(null);
    setSourceUrl(null);
    setSourceImageUrl(null);
    setCurrentMainImageUrl(null);
    setPendingMainImageFile(null);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setSelectedFiles([]);
    setPreviewUrls([]);
    if (mode === 'manual') {
      setExtractedRecipe(emptyRecipe());
    }
  };

  const stageMessages: Record<string, string> = {
    reading_images: 'Leser bilder...',
    ai_processing: 'Analyserer med AI...',
    uploading_images: 'Laster opp bilder...',
    fetching_url: 'Henter nettsiden...',
    downloading_image: 'Laster ned bilde...',
  };

  const handleExtractFromImage = async () => {
    if (selectedFiles.length === 0) return;

    if (!token) {
      setError('Autentiseringstoken ikke tilgjengelig. Prøv å logge inn igjen.');
      return;
    }

    setIsExtracting(true);
    setProgressMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append('images', file);
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error('API base URL is not set. Please define NEXT_PUBLIC_API_BASE_URL in your environment variables.');
      }
      const response = await fetch(`${apiBaseUrl}/api/recipes/from-images/stream`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 403) {
        throw new Error('Tilgang nektet. Kontoen din er ikke autorisert. Kontakt en administrator.');
      }
      if (!response.ok) {
        throw new Error('Kunne ikke hente oppskriften');
      }

      await new Promise<void>((resolve, reject) => {
        consumeSseStream(response, {
          onStage: (stage) => setProgressMessage(stageMessages[stage] ?? null),
          onDone: (result) => {
            const data = result as { success: boolean; errorMessage?: string; extractedRecipe?: ApiExtractedRecipe };
            if (!data.success || !data.extractedRecipe) {
              reject(new Error(data.errorMessage || 'Kunne ikke hente oppskriften'));
              return;
            }
            const { suggestedCategoryIds, mainImageUrl, sourceImageUrl: extractedSourceImageUrl, instructionSteps, ...rest } = data.extractedRecipe;
            setCurrentMainImageUrl(mainImageUrl ?? null);
            setSourceImageUrl(extractedSourceImageUrl ?? null);
            setSourceUrl(null);
            setPendingMainImageFile(null);
            setExtractedRecipe({
              ...rest,
              instructionSteps: instructionSteps ?? [],
              categoryIds: suggestedCategoryIds ?? [],
              mainImageUrl: mainImageUrl ?? null,
            });
            resolve();
          },
          onError: (message) => reject(new Error(message || 'Kunne ikke hente oppskriften')),
        });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke hente oppskriften';
      setError(errorMessage);
      if (errorMessage.includes('Tilgang nektet')) {
        setTimeout(() => router.push('/403'), 2000);
      }
    } finally {
      setIsExtracting(false);
      setProgressMessage(null);
    }
  };

  const handleExtractFromUrl = async () => {
    if (!recipeUrl.trim()) {
      setError('Skriv inn en URL');
      return;
    }

    if (!token) {
      setError('Autentiseringstoken ikke tilgjengelig. Prøv å logge inn igjen.');
      return;
    }

    setIsExtracting(true);
    setProgressMessage(null);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error('API base URL is not set. Please define NEXT_PUBLIC_API_BASE_URL in your environment variables.');
      }
      const response = await fetch(`${apiBaseUrl}/api/recipes/from-url/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: recipeUrl.trim() }),
      });

      if (response.status === 403) {
        throw new Error('Tilgang nektet. Kontoen din er ikke autorisert. Kontakt en administrator.');
      }
      if (!response.ok) {
        throw new Error('Kunne ikke hente oppskriften');
      }

      const capturedUrl = recipeUrl.trim();
      await new Promise<void>((resolve, reject) => {
        consumeSseStream(response, {
          onStage: (stage) => setProgressMessage(stageMessages[stage] ?? null),
          onDone: (result) => {
            const data = result as { success: boolean; errorMessage?: string; extractedRecipe?: ApiExtractedRecipe };
            if (!data.success || !data.extractedRecipe) {
              reject(new Error(data.errorMessage || 'Kunne ikke hente oppskriften'));
              return;
            }
            const { suggestedCategoryIds, mainImageUrl, sourceUrl: extractedSourceUrl, instructionSteps, ...rest } = data.extractedRecipe;
            setCurrentMainImageUrl(mainImageUrl ?? null);
            setSourceUrl(extractedSourceUrl ?? capturedUrl ?? null);
            setSourceImageUrl(null);
            setPendingMainImageFile(null);
            setExtractedRecipe({
              ...rest,
              instructionSteps: instructionSteps ?? [],
              categoryIds: suggestedCategoryIds ?? [],
              mainImageUrl: mainImageUrl ?? null,
            });
            resolve();
          },
          onError: (message) => reject(new Error(message || 'Kunne ikke hente oppskriften')),
        });
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunne ikke hente oppskriften';
      setError(errorMessage);
      if (errorMessage.includes('Tilgang nektet')) {
        setTimeout(() => router.push('/403'), 2000);
      }
    } finally {
      setIsExtracting(false);
      setProgressMessage(null);
    }
  };

  const handleSaveRecipe = async (data: RecipeFormData) => {
    if (!token) {
      setError('Autentiseringstoken ikke tilgjengelig. Prøv å logge inn igjen.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      // Strip blob: URLs from steps before saving (server doesn't know about them)
      const cleanedSteps = data.instructionSteps.map((s) => ({
        ...s,
        imageUrl: s.imageUrl?.startsWith('blob:') ? null : (s.imageUrl ?? null),
      }));
      // Include the current main image URL and provenance fields
      const payload: RecipeFormData & { visibility: Visibility; groupIds: number[] } = {
        ...data,
        instructionSteps: cleanedSteps,
        mainImageUrl: currentMainImageUrl,
        sourceUrl: sourceUrl ?? undefined,
        sourceImageUrl: sourceImageUrl ?? undefined,
        visibility,
        groupIds,
      };
      const response = await fetch(`${apiBaseUrl}/api/recipes/save-extracted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Kunne ikke lagre oppskriften');
      }

      const saved = await response.json() as { id: number };

      // Upload pending main image
      if (pendingMainImageFile) {
        setIsUploadingMainImage(true);
        await recipeService.uploadMainImage(saved.id, pendingMainImageFile, token);
        setIsUploadingMainImage(false);
      }

      // Upload pending step images (keyed by blob: URL, matched by position in final step list)
      const pendingMap = pendingStepPhotosRef.current;
      if (pendingMap.size > 0) {
        await Promise.all(
          data.instructionSteps.map(async (step, index) => {
            if (step.imageUrl && step.imageUrl.startsWith('blob:')) {
              const file = pendingMap.get(step.imageUrl);
              if (file) {
                await recipeService.uploadStepImage(saved.id, index, file, token);
              }
            }
          })
        );
        pendingMap.clear();
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre oppskriften');
    } finally {
      setIsSaving(false);
      setIsUploadingMainImage(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-8 sm:p-8 sm:pb-20 lg:p-20">
      <main className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-4">
          <AuthButton />
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
            Last opp bilde
          </button>
          <button
            onClick={() => handleSwitchMode('url')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              inputMode === 'url'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Lim inn URL
          </button>
          <button
            onClick={() => handleSwitchMode('manual')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              inputMode === 'manual'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Manuelt
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
            onPaste={handlePaste}
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />

            {previewUrls.length === 0 ? (
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
                  <span className="hidden sm:inline">Dra og slipp bilder her, eller </span>
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 px-5 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors min-h-[44px]"
                >
                  Velg bilder
                </button>
                <p className="mt-2 text-xs text-gray-500">eller lim inn bilde (Ctrl+V)</p>
                <p className="mt-0.5 text-xs text-gray-500">PNG, JPG, WEBP opptil 10 MB per bilde · maks 5 bilder</p>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap gap-3 justify-center mb-4">
                  {previewUrls.map((url, i) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Bilde ${i + 1}`}
                        className="h-32 w-32 object-cover rounded-lg shadow"
                      />
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        aria-label={`Fjern bilde ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 justify-center">
                  {selectedFiles.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      + Legg til bilde
                    </button>
                  )}
                  {!extractedRecipe && (
                    <button
                      onClick={handleExtractFromImage}
                      disabled={isExtracting}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isExtracting ? 'Henter oppskrift...' : 'Hent oppskrift'}
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
              Lim inn URL-en til en oppskriftsside, så henter vi oppskriften automatisk.
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isExtracting) handleExtractFromUrl(); }}
                placeholder="https://www.example.com/recipe/chocolate-cake"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-base"
              />
              {!extractedRecipe && (
                <button
                  onClick={handleExtractFromUrl}
                  disabled={isExtracting || !recipeUrl.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isExtracting ? 'Henter...' : 'Hent oppskrift'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Progress Message */}
        {isExtracting && progressMessage && (
          <div className="mb-4 flex items-center justify-center gap-2 animate-fade-in">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            <span
              key={progressMessage}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium tracking-wide animate-pulse-once"
            >
              {progressMessage}
            </span>
          </div>
        )}

        {/* Token Loading State */}
        {tokenLoading && (
          <div className="mb-8 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400">
            Forbereder autentisering...
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
            <h2 className="text-2xl font-bold mb-4">{inputMode === 'manual' ? 'Ny oppskrift' : 'Hentet oppskrift'}</h2>
            {inputMode !== 'manual' && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Kontroller og rediger informasjonen før lagring
              </p>
            )}
            <MainPhotoUpload
              currentImageUrl={currentMainImageUrl}
              pendingFile={pendingMainImageFile}
              onFileSelected={(file) => {
                setPendingMainImageFile(file);
                setCurrentMainImageUrl(null);
              }}
              onRemove={() => {
                setPendingMainImageFile(null);
                setCurrentMainImageUrl(null);
              }}
              isUploading={isUploadingMainImage}
            />
            <div className="mb-6">
              <VisibilitySelector
                value={visibility}
                groupIds={groupIds}
                onChange={(v, ids) => { setVisibility(v); setGroupIds(ids); }}
              />
            </div>
            <RecipeForm
              initialData={extractedRecipe}
              onSave={handleSaveRecipe}
              onCancel={() => setExtractedRecipe(null)}
              isSaving={isSaving}
              submitLabel="Lagre oppskrift"
              availableCategories={availableCategories}
              onStepPhotoSelected={async (_, file) => {
                const url = URL.createObjectURL(file);
                pendingStepPhotosRef.current.set(url, file);
                return url;
              }}
              onStepPhotoRemove={async () => {
                // The form will clear imageUrl from the step; nothing else needed here
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
