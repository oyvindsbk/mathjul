# Tasks: Store Recipe Source Provenance

## Tasks

- [x] Task 1: Add `SourceUrl` and `SourceImageUrl` to the `Recipe` entity, EF config, and generate + apply a migration
- [x] Task 2: Extend `SaveExtractedRecipeRequest` with `SourceUrl`/`SourceImageUrl` and persist them in `save-extracted`
- [x] Task 3: In `from-image`, upload original source image to blob and return `sourceImageUrl` in `ExtractedRecipeResponse`
- [x] Task 4: In `from-url`, return `sourceUrl` in `ExtractedRecipeResponse`
- [x] Task 5: Frontend — capture `sourceImageUrl` from image extraction response and pass it through to `save-extracted`
- [x] Task 6: Frontend — pass `sourceUrl` (from `recipeUrl` state) through to `save-extracted` when saving a URL-extracted recipe
