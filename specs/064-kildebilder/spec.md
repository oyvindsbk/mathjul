# Feature: Kildebilder — keep and show the original photos a recipe was uploaded from

## Summary
When a recipe is created from uploaded photos (AI image extraction), keep **all** of the original photos and show them on the recipe detail page as "Kilde", with the ability to view full-size and download — the image-mode equivalent of the "Kilde: <url>" link shown for URL-imported recipes.

## Motivation
AI extraction is not perfect. When a recipe was imported from a URL, the user can click "Kilde" to check the original. For recipes imported from photos (cookbook pages, handwritten notes) there is no way back to the original, so OCR/extraction mistakes cannot be verified and the original (often a family recipe card) is effectively lost.

## Current state (verified in code, 2026-11-17)
Much of the plumbing already exists — this feature closes the gaps rather than starting fresh:

| Piece | Status |
|---|---|
| `POST /api/recipes/from-image`, `/from-images`, `/from-images/stream` upload originals to blob `recipes/pending/source-{guid}{ext}` | ✅ exists |
| `ExtractedRecipeResponse.SourceImageUrl` returned to frontend | ✅ exists |
| Upload page (`last-opp-oppskrift/page.tsx`) holds `sourceImageUrl` and sends it on save | ✅ exists |
| `Recipe.SourceImageUrl` (single string) persisted on create | ✅ exists |
| **Multi-image:** all photos uploaded, but only the *first* URL kept — the rest are orphaned blobs | ❌ gap |
| **`RecipeDetailDto` does not expose `SourceImageUrl`** | ❌ gap |
| **Recipe detail page does not show source images** | ❌ gap |
| **Recipe delete only removes `recipes/{id}/`** — source blobs in `recipes/pending/` are never deleted | ❌ gap |

## Requirements
- R1: Every photo uploaded for an image-mode extraction is kept and linked to the saved recipe, in upload order (max 5, as today).
- R2: The recipe detail API returns the list of source image URLs.
- R3: The recipe detail page shows a "Kilde" section with thumbnails of the source images when the recipe has any. Placed next to the existing "Kilde: <url>" metadata.
- R4: Clicking a thumbnail shows the image full-size (new tab). A download action saves the original file.
- R5: Existing recipes with a single `SourceImageUrl` keep working (migrated into the new list).
- R6: Deleting a recipe deletes its source image blobs.
- R7: Recipes with no source images render exactly as today (no empty section).
- R8: Extraction failure/discard still behaves as today (no new orphan-cleanup obligations beyond today's).
- R9: On the upload page, each selected image can optionally be cropped before extraction, e.g. to pick one recipe out of a page holding several. Cropping is never forced.
- R10: The cropped image is what is sent for AI extraction **and** what is stored as the source image, so the "Kilde" photo matches the recipe.
- R11: Re-cropping starts from the original file, not from the previous crop, and the user can reset to the uncropped original.

## Design

### Data Model
- Replace `Recipe.SourceImageUrl : string?` with `Recipe.SourceImageUrls : List<string>` stored as a JSON column, same converter/comparer pattern as `Tips` / `AvailablePanPresetIds` in `RecipeDbContext`.
- EF migration `AddSourceImageUrls`:
  1. Add `SourceImageUrls` (nvarchar(max), non-null, default `'[]'`).
  2. Backfill: `UPDATE Recipes SET SourceImageUrls = '["' + <escaped SourceImageUrl> + '"]' WHERE SourceImageUrl IS NOT NULL` (blob URLs contain no quotes/backslashes, but use `STRING_ESCAPE(..., 'json')` to be safe).
  3. Drop `SourceImageUrl`.
  - Down: re-add column, copy `JSON_VALUE(SourceImageUrls, '$[0]')`, drop list column.

### API Changes
- `ExtractedRecipeResponse`: replace `SourceImageUrl` with `SourceImageUrls: List<string>`. All three image endpoints collect every uploaded URL (single-image endpoint returns a one-element list). Extract the duplicated upload loop into one private helper.
- `SaveExtractedRecipeRequest`: replace `SourceImageUrl` with `SourceImageUrls: List<string>?`.
  - **Validation:** each URL must be a blob URL in our container under `recipes/pending/source-` (prevents a client from attaching arbitrary external URLs that we'd then render and, on delete, try to delete). Max 5. Invalid entries → 400. *Implemented as* `IBlobStorageService.GetBlobPathFromUrl(url)`, which compares scheme, host and container path against the real container client, so it works for Azurite and prod and also rejects a foreign host.
- `RecipeDetailDto`: add `SourceImageUrls: List<string>`.
- `DELETE /api/recipes/{id}`: additionally `DeleteAsync(GetBlobPathFromUrl(url))` for each source image (best-effort, log on failure, like other blob deletes).
- **New** `GET /api/recipes/{id}/source-images/{index}`: authorized like `GET /api/recipes/{id}` (same visibility check, shared `CanView` helper). 403 if the recipe is not visible (same as the detail endpoint), 404 if the recipe, the index or the blob is missing. Content type is echoed only for allowed image types, otherwise `application/octet-stream`. Reads the blob via a new `IBlobStorageService.OpenReadAsync(blobPath)` → `(Stream, ContentType)` and returns `File(stream, contentType, fileDownloadName)` so the response carries `Content-Disposition: attachment`. File name: `<slugified-title>-kilde-<index+1><ext>` (ext from blob path, default `.jpg`).
- `UpdateRecipeRequest` / `PUT`: **unchanged** — source images are immutable provenance, not editable.
- `PublicRecipesController` (share links): **not** exposed — see Out of Scope.

### UI Changes
- `recipe.service.ts`: `RecipeDetail.sourceImageUrls?: string[]`; save payload `sourceImageUrls`.
- `last-opp-oppskrift/page.tsx`: `sourceImageUrl` state → `sourceImageUrls: string[]`; reset to `[]` on URL mode / reset.
- **Crop before extraction** (`last-opp-oppskrift/page.tsx` + `CropModal.tsx`):
  - Reuse the existing `CropModal` (canvas, corner handles, outputs a JPEG `File`). Changes to it:
    - New prop `initialCrop?: 'square' | 'full'`, default `'square'` (today's behavior for the main photo). The upload page uses `'full'`, because a recipe page is portrait and a centered square would cut it.
    - Optional `confirmLabel` / `skipLabel` props. The upload page uses "Beskjær" / "Avbryt", and Avbryt there means "leave the image as it was".
    - Remove the existing `eslint-disable-next-line react-hooks/exhaustive-deps` while touching the file (CLAUDE.md: no suppressions). Keep `handleCrop` stable in a ref or reorder it so the keyboard effect can list its deps.
  - The upload page's state changes from `File[]` to `{ original: File; current: File }[]`. Preview URLs are derived from `current`.
  - Each preview thumbnail gets a "Beskjær" button (crop icon) that opens `CropModal` on `original`. Confirm sets `current` to the cropped file and regenerates that preview URL. Cancel changes nothing.
  - Cropped thumbnails show a small "Beskjært" badge and a "Tilbakestill" action (`current = original`).
  - Extraction sends `current` for every slot. No backend change is needed: the cropped image is just a smaller JPEG.
  - Changing a crop after extraction clears the extracted recipe (same as adding or removing a file today), so the extracted recipe always matches the photos that will be saved.
- `recipes/[id]/client.tsx`: new `SourceImages` component in the metadata area:
  - Label "Kildebilder" with a row of small thumbnails (`<img>`, `loading="lazy"`, object-cover, ~64px).
  - Thumbnail is a link to the full image, `target="_blank" rel="noopener noreferrer"`.
  - A "Last ned" icon button per image. `recipe.service.ts` gets `downloadSourceImage(recipeId, index)`: fetch the endpoint with the Bearer token → `blob()` → object URL → temporary `<a download>` click → revoke. Filename taken from `Content-Disposition` (expose the header via CORS `WithExposedHeaders` if the API CORS policy doesn't already), falling back to `kilde-<n>.jpg`. Show an error message if it fails.
  - Section hidden when list empty.
  - Hidden in print view if the page has one (check existing print styles).
- Mock data: add `sourceImageUrls` to one mock recipe so the dev fallback shows the section.

## Out of Scope
- Adding/removing source images after the recipe is saved (edit page).
- Showing source images on public share links.
- Moving blobs out of `recipes/pending/` to `recipes/{id}/source/` (no rename/copy in `IBlobStorageService` today; explicit delete covers lifecycle).
- Cleaning up orphan blobs from extractions that were never saved (pre-existing issue, also affects main images).
- Backfilling the orphaned 2nd–5th images of past multi-image uploads (no link from recipe to them exists).
- Lightbox/gallery viewer — new tab is enough for v1.
- Keeping the uncropped original as well as the crop. Only the cropped image is stored, because the original may hold other people's recipes or unrelated content.
- Rotate, perspective correction or several crops from one image (e.g. splitting one page into 4 recipes in one go). To extract several recipes from one page, upload the page once per recipe with a different crop.
- Cropping in URL mode.

## Decisions (resolved 2026-11-17)
- **Q1 — Download mechanism → (b) backend endpoint.** Blob URLs are cross-origin, so `<a download>` would just open the image. The API streams the blob with `Content-Disposition: attachment` and enforces recipe visibility. No storage CORS / Bicep change.
- **Q2 — Privacy → same as existing images for display.** The API authenticates with a `Bearer` header, which `<img>` cannot send, so thumbnails / "open full size" still use the public blob URLs (unguessable GUIDs, same exposure as main/step images today). Only *download* goes through the authorized endpoint. Moving all image display behind auth is a separate, app-wide change.
