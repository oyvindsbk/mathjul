# Tasks: Upload Progress Feedback

## Tasks

- [x] Task 1: Add progress reporting to `RecipeImageProcessor` — thread `Action<string> reportStage` through `ExtractRecipeFromImagesAsync`, calling it at "reading_images", "ai_processing", "uploading_images"
- [x] Task 2: Add progress reporting to `RecipeUrlProcessor` — thread `Action<string> reportStage` through `ExtractRecipeFromUrlAsync`, calling it at "fetching_url", "ai_processing" (conditional), "downloading_image"
- [x] Task 3: Add SSE image-stream endpoint `POST /api/recipes/from-images/stream` to `RecipesController` — writes SSE frames, calls the updated processor with a progress reporter, emits `done`/`error` frame
- [x] Task 4: Add SSE URL-stream endpoint `POST /api/recipes/from-url/stream` to `RecipesController` — same pattern as Task 3 but for URL extraction
- [x] Task 5: Add frontend SSE consumer utility — small helper that reads a `fetch` response body as SSE lines and calls callbacks for `stage` and `done`/`error` events
- [x] Task 6: Wire up progress state and UI in the upload page — add `progressMessage` state, call the new stream endpoints, display the stage message below the extract button
- [x] Task 7: Run full inner loop (backend build + test, frontend lint + typecheck + build) and fix any issues
