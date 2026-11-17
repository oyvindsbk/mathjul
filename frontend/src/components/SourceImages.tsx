'use client';

import { useState } from 'react';
import { recipeService } from '@/lib/services/recipe.service';

interface SourceImagesProps {
  recipeId: number;
  urls: string[];
  token?: string | null;
}

/**
 * The photos an image-mode recipe was extracted from: thumbnails that open the
 * full image in a new tab, each with a download button. Renders nothing when empty.
 */
export function SourceImages({ recipeId, urls, token }: SourceImagesProps) {
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (urls.length === 0) return null;

  const handleDownload = async (index: number) => {
    setDownloadingIndex(index);
    setError(null);
    try {
      await recipeService.downloadSourceImage(recipeId, index, token || undefined);
    } catch {
      setError('Kunne ikke laste ned kildebildet. Prøv igjen.');
    } finally {
      setDownloadingIndex(null);
    }
  };

  return (
    <div className="text-sm text-gray-500 mb-4" data-testid="kildebilder">
      <span className="block mb-2">Kildebilder</span>
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div key={`${i}-${url}`} className="flex flex-col items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Åpne kildebilde ${i + 1} i ny fane`}
              className="block rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
            >
              {/* Background image rather than <img>: blob URLs are arbitrary hosts, and this avoids next/image config. */}
              <span
                role="img"
                aria-label={`Kildebilde ${i + 1}`}
                className="block h-16 w-16 bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url("${url}")` }}
              />
            </a>
            <button
              type="button"
              onClick={() => handleDownload(i)}
              disabled={downloadingIndex !== null}
              aria-label={`Last ned kildebilde ${i + 1}`}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloadingIndex === i ? 'Laster ned…' : 'Last ned'}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
