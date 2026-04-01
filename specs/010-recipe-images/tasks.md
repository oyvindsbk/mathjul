# Tasks: Recipe Images

## Tasks

### Infrastructure
- [x] Task 1: Add Azure Blob Storage account and container to Bicep (`infrastructure/modules/storage.bicep`), wire into `main.bicep`, assign Storage Blob Data Contributor role to backend Container App managed identity

### Backend — Data Model
- [x] Task 2: Add `InstructionStep` value object (`{ Text, ImageUrl? }`), add `InstructionSteps` JSON column to `Recipe`, write EF Core migration that populates `InstructionSteps` from existing `Instructions` string, keep `Instructions` column temporarily as nullable for rollback safety
- [x] Task 3: Update `RecipeDetailDto`, `SaveExtractedRecipeRequest`, `UpdateRecipeRequest`, and all mappings to use `InstructionSteps` instead of `Instructions`; update `RecipesController` accordingly; run `dotnet build` + `dotnet test`

### Backend — Blob Storage Service
- [x] Task 4: Add `IBlobStorageService` + `AzureBlobStorageService` using `Azure.Storage.Blobs` with `DefaultAzureCredential`; register in DI; add `BlobStorageOptions` (account name, container name) loaded from config; add Azurite connection string support for local dev

### Backend — Image API Endpoints
- [x] Task 5: Add `PUT /api/recipes/{id}/main-image` and `DELETE /api/recipes/{id}/main-image` endpoints; validate file type/size; store blob; update `Recipe.ImageUrl`; delete old blob on replace/delete
- [x] Task 6: Add `PUT /api/recipes/{id}/steps/{stepIndex}/image` and `DELETE /api/recipes/{id}/steps/{stepIndex}/image` endpoints; validate; store blob with UUID filename; update `InstructionStep.ImageUrl`; delete old blob on replace/delete
- [ ] Task 7: On `DELETE /api/recipes/{id}`, delete all blobs for that recipe (main + all step images)

### Backend — AI Dish Extraction
- [ ] Task 8: Extend `RecipeImageProcessor` with a `TryExtractDishPhotoAsync` method that sends the image to the vision model asking if a dish photo is present; if confident yes + full-frame, return the image as-is; if confident yes + crop region returned, crop with ImageSharp; if not confident, return null; integrate into `from-image` endpoint so the extracted/cropped image is saved to blob and `ImageUrl` set on the extracted recipe

### Frontend — Types & Service
- [ ] Task 9: Update TypeScript types (`Recipe`, instruction types) to use `InstructionStep[]` instead of `string[]`; update `recipe.service.ts` to call new image endpoints; update mock data

### Frontend — UI: Main Photo Upload
- [ ] Task 10: Add `MainPhotoUpload` component (drag-drop zone, preview, remove button); integrate into upload page (shown after extraction, pre-filled if AI extracted a photo) and edit page

### Frontend — UI: Per-Step Photo Upload
- [ ] Task 11: Add per-step photo upload zone inline in `RecipeForm`'s `SortableInstruction` component (small upload area below each step text, shows preview if photo exists, remove button); ensure photo URLs travel with step on reorder

### Frontend — UI: Recipe Detail Display
- [ ] Task 12: Update recipe detail page to display main photo (if present) at top and per-step photos (if present) inline with each step

### Cleanup
- [ ] Task 13: Drop old `Instructions` string column via a new EF Core migration (after confirming `InstructionSteps` is stable); remove `ImageUrl` raw-URL editing from any frontend form if it exists
