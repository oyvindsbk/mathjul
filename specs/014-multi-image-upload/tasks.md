# Tasks: Multi-Image Recipe Extraction

## Tasks

- [x] Task 1: Add `ExtractRecipeFromImagesAsync` to `IRecipeImageProcessor` and implement it in `RecipeImageProcessor`
  - New method accepts `IReadOnlyList<IFormFile>`, validates each file (type, size), resizes each, sends all as image parts in one user message with a prompt that explicitly states images may be unordered
  - Verify: `cd backend/RecipeApi && dotnet build`

- [x] Task 2: Add `POST /api/recipes/from-images` endpoint to `RecipesController`
  - Accepts `IFormFileCollection` named `images` (1–5 files), `[RequestSizeLimit(50 * 1024 * 1024)]`
  - Calls `ExtractRecipeFromImagesAsync`, runs dish photo detection on images in order (first positive wins), uploads all source images (store first URL as `sourceImageUrl`)
  - Returns same `RecipeExtractionResponse` shape
  - Verify: `cd backend/RecipeApi && dotnet build`

- [x] Task 3: Update frontend upload page to support multiple images
  - Replace `selectedFile: File | null` / `previewUrl: string | null` with `selectedFiles: File[]` / `previewUrls: string[]`
  - Update `handleFileSelect` → `handleFilesSelect(files: File[])` — validates each, appends to state
  - Update `<input type="file" multiple>` and drag-and-drop handler to pass all dropped files
  - Replace single preview `<img>` with thumbnail grid (each thumbnail has an ✕ remove button)
  - Update `handleExtractFromImage` to POST to `/api/recipes/from-images` with all files appended as `images`
  - Verify: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`

- [x] Task 4: Final verification — run full inner loop for both stacks
  - `cd backend/RecipeApi && dotnet build && dotnet test`
  - `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
