# Implementation Plan: Store Recipe Source Provenance

## Approach

Additive changes only — two new nullable columns on `Recipe`, plumbed through the extraction and save flow. No existing behavior changes.

1. **Backend — data model**: Add `SourceUrl` and `SourceImageUrl` to `Recipe` entity and EF config.
2. **Backend — migration**: Generate and apply an EF migration for the two new columns.
3. **Backend — from-image**: Upload the original source image to blob storage (`recipes/pending/source-{guid}{ext}`) and return `sourceImageUrl` in `ExtractedRecipeResponse`.
4. **Backend — from-url**: Echo the input URL back as `sourceUrl` in `ExtractedRecipeResponse`.
5. **Backend — save-extracted**: Accept `sourceUrl` and `sourceImageUrl` on `SaveExtractedRecipeRequest` and persist them to the new columns.
6. **Frontend**: Capture `sourceUrl` / `sourceImageUrl` from extraction responses and pass them in the `save-extracted` payload.

## Stacks Affected
- [x] Backend
- [x] Frontend
- [ ] Infrastructure

## Key Decisions

- **Source image stored at pending path**: Consistent with the existing dish-photo pattern (`recipes/pending/{guid}.jpg`). No rename-on-save needed since it's storage-only.
- **SourceUrl echoed from response, not stored in client state separately**: The frontend already has `recipeUrl` in state — it can pass it directly when saving rather than needing the backend to echo it. Simpler.
- **No display in DTOs yet**: `SourceUrl` and `SourceImageUrl` are stored on the entity but not added to `RecipeDetailDto` — avoids touching read paths.

## Risks

- **Blob accumulation**: Source images in `recipes/pending/` are never cleaned up if the user abandons the flow. Low risk for now (same as existing dish photos); can be addressed with a future cleanup job.
