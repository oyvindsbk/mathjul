'use client';

import { useRef, useState } from 'react';

interface MainPhotoUploadProps {
  /** Currently saved image URL (from AI extraction or existing recipe). */
  currentImageUrl?: string | null;
  /** A locally selected file waiting to be uploaded (shown as preview). */
  pendingFile?: File | null;
  /** Called when the user selects a new file via drag-drop or file picker. */
  onFileSelected: (file: File) => void;
  /** Called when the user removes the photo. */
  onRemove: () => void;
  /** Show a loading spinner (e.g. while uploading in the edit page). */
  isUploading?: boolean;
  /** Error message to display below the zone. */
  error?: string | null;
}

export default function MainPhotoUpload({
  currentImageUrl,
  pendingFile,
  onFileSelected,
  onRemove,
  isUploading = false,
  error,
}: MainPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Prefer a pending file preview over the saved URL
  const pendingPreviewUrl = pendingFile ? URL.createObjectURL(pendingFile) : null;
  const hasImage = Boolean(pendingPreviewUrl ?? currentImageUrl);
  const displayUrl = pendingPreviewUrl ?? currentImageUrl ?? null;

  const validate = (file: File): string | null => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return 'Only JPEG, PNG, and WEBP images are accepted.';
    if (file.size > 10 * 1024 * 1024) return 'File must be smaller than 10 MB.';
    return null;
  };

  const handleFile = (file: File) => {
    const validationError = validate(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    onFileSelected(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected if removed
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
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const displayError = localError ?? error;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Main Photo
      </label>

      {hasImage ? (
        <div className="relative w-full max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl!}
            alt="Recipe main photo"
            className="w-full max-h-72 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
          />

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded-lg">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Replace photo
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={isUploading}
              className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
            >
              Remove photo
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          aria-label="Upload main photo"
        >
          <svg
            className="mx-auto h-10 w-10 text-gray-400 mb-2"
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag &amp; drop or <span className="text-blue-500 underline">choose a photo</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">JPEG, PNG, WEBP · max 10 MB</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      {displayError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{displayError}</p>
      )}
    </div>
  );
}
