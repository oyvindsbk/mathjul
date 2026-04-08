# Feature: Multi-Image Recipe Extraction

## Summary
Allow users to upload multiple images at once on the upload page. All images are sent together to the AI, which analyzes them collectively to produce a single extracted recipe.

## Motivation
A recipe is often spread across multiple photos — e.g. one image showing ingredients, another showing instructions, and a third showing the finished dish. Currently users can only upload one image and must pick the "best" one, losing context. Multi-image support lets the AI reason across all images simultaneously for higher extraction quality.

## Requirements

- Users can select or drag-and-drop **2–5 images** in the image upload mode (single image still valid)
- All selected images are shown as thumbnails with individual remove buttons
- A single "Hent oppskrift" button sends all images to the backend together
- The backend sends all images as separate content parts in one AI chat message
- The AI extracts one unified recipe from the set of images, treating images as unordered — the AI is explicitly instructed to synthesize a coherent recipe regardless of image sequence
- One of the uploaded images is used as the main dish photo (best candidate selected automatically, as today — first image with a detected dish)
- All source images are stored in blob storage for provenance
- The existing single-image flow is preserved as a subset (uploading 1 image works identically to before)
- Max 10 MB per file, max 5 files, max 50 MB total

## Design

### API Changes

**`POST /api/recipes/from-images`** (new endpoint, replaces `from-image` for multi-image)

- Accepts `multipart/form-data` with field name `images` (1–5 files)
- Returns same `RecipeExtractionResponse` shape as `from-image`
- The existing `from-image` endpoint is kept for backwards compatibility

Request:
```
Content-Type: multipart/form-data
images: [File, File, ...]   (1–5 files, each ≤ 10 MB)
```

Response: unchanged `RecipeExtractionResponse` JSON

### Backend Changes

- `IRecipeImageProcessor` gets a new method:
  ```csharp
  Task<RecipeExtractionResult> ExtractRecipeFromImagesAsync(
      IReadOnlyList<IFormFile> imageFiles,
      string? categoryListJson = null,
      CancellationToken cancellationToken = default);
  ```
- Implementation sends all images as `ChatMessageContentPart.CreateImagePart(...)` in a single user message
- Dish photo detection runs on the first image that returns a positive result
- All source images are uploaded to blob storage; only the first source URL is stored (primary provenance)

### UI Changes

- Replace single `<input type="file">` with `multiple` attribute
- Thumbnail grid: shows previews for each selected image with an ✕ remove button
- When ≥1 image is selected, show "Hent oppskrift" button
- Drag-and-drop zone accepts multiple files
- Existing single-preview `<img>` is replaced by a responsive thumbnail grid

## Out of Scope

- Reordering images after selection
- Image-by-image step attribution (e.g. "image 2 maps to step 3")
- Changing main photo selection after extraction (already handled by `MainPhotoUpload` component)

## Open Questions

- None — approach is clear.
