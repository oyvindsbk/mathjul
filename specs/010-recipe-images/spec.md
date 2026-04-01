# Feature: Recipe Images

## Summary
Allow users to upload a main photo for each recipe and an optional photo for each instruction step. Images are stored in Azure Blob Storage. When extracting a recipe from an uploaded image, the AI attempts to crop the dish photo automatically; if it isn't confident, no main photo is set.

## Motivation
Recipes are more appealing and useful with photos. A main photo provides visual identity, and per-step photos help users follow along during cooking.

## Requirements

### Main Recipe Photo
- A recipe can have one main photo stored in Azure Blob Storage
- The existing `ImageUrl` field is repurposed to point to blob storage (no longer editable as a raw URL from the frontend — remove that UI)
- Users can upload or replace the main photo on both the create (upload) page and the edit page
- Accepted formats: JPEG, PNG, WEBP; max 10 MB
- When a recipe is extracted from an image:
  - The AI inspects the source image and, if it is confident a dish photo is present, crops or extracts it
  - The cropped image is stored in blob storage and set as the main photo
  - If the AI is not confident (e.g., pure text, no recognizable food), no main photo is set
  - User can always upload/replace the main photo afterward

### Per-Step Instruction Photos
- Each instruction step can have an optional photo stored in Azure Blob Storage
- Accepted formats: JPEG, PNG, WEBP; max 10 MB
- Photos can be added, replaced, or removed per step on both the create and edit pages
- Steps without a photo show no image (no placeholder)

### Storage
- Azure Blob Storage account added to infrastructure (Bicep)
- Container: `recipe-images`
- Blobs named by a deterministic path: `recipes/{recipeId}/{type}/{filename}` where type is `main` or `steps/{stepIndex}`
- Public read access on the container (images served directly via blob URL)
- Managed Identity used by the backend to write/delete blobs (no storage account keys in config)
- Old blobs are deleted when replaced or when a recipe is deleted

### Data Model Changes
- `Recipe.ImageUrl` remains but is now always a blob URL (or null) — remove editable URL input from frontend
- `Recipe.Instructions` (newline-separated string) is replaced by `Recipe.InstructionSteps` — a JSON-serialized list of `InstructionStep` objects
- `InstructionStep`: `{ Text: string, ImageUrl: string? }`
- EF Core migration required; existing instruction data is migrated (split on newline, no image URLs)

### API Changes
- `PUT /api/recipes/{id}/main-image` — upload/replace main photo (multipart/form-data)
- `DELETE /api/recipes/{id}/main-image` — remove main photo
- `PUT /api/recipes/{id}/steps/{stepIndex}/image` — upload/replace step photo
- `DELETE /api/recipes/{id}/steps/{stepIndex}/image` — remove step photo
- `RecipeDetailDto` and `SaveExtractedRecipeRequest` updated to use `InstructionSteps` instead of `Instructions`
- `PUT /api/recipes/{id}` updated to accept `InstructionSteps`

### UI Changes
- **Upload page**: After extraction, show a main photo upload zone (pre-filled if AI extracted one, replaceable)
- **Edit page**: Show main photo upload zone + per-step photo upload zones inline in the instruction list
- **Recipe detail page**: Display main photo (if present) and per-step photos (if present) inline with each step

## Out of Scope
- Image resizing/thumbnails beyond what is already done in `RecipeImageProcessor`
- CDN or caching layer
- Bulk image import
- Video support

## Open Questions
- None — all resolved above.
