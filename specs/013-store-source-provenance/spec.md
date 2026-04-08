# Feature: Store Recipe Source Provenance

## Summary
When a recipe is imported (from URL or image), store the original source URL and/or the original source image in blob storage for future reference. This data is stored but not displayed anywhere yet.

## Motivation
Recipes should retain a provenance trail — where they came from and what the original source material looked like. This enables future features like "view original source", deduplication, and attribution.

## Requirements

- When a recipe is extracted from a **URL**, store the source URL on the recipe (`SourceUrl`).
- When a recipe is extracted from an **image**, store the original uploaded image in blob storage and record its URL on the recipe (`SourceImageUrl`).
- Both fields are optional (null for manually created recipes or recipes created before this feature).
- The data is stored in the database but **not exposed in any UI** at this time.
- The `save-extracted` endpoint must accept `sourceUrl` and `sourceImageUrl` from the frontend.
- The frontend must pass the source URL when saving a URL-extracted recipe.
- The frontend must pass the source image blob URL when saving an image-extracted recipe (the original image, not the AI-cropped dish photo).

## Design

### Data Model

Add two nullable string columns to `Recipe`:

| Column | Type | Description |
|---|---|---|
| `SourceUrl` | `string?` | URL the recipe was extracted from (URL mode) |
| `SourceImageUrl` | `string?` | Blob URL of the original uploaded image (image mode) |

### API Changes

**`POST /api/recipes/save-extracted`** — extend `SaveExtractedRecipeRequest`:
- Add `SourceUrl?: string`
- Add `SourceImageUrl?: string`

**`POST /api/recipes/from-image`** — after extracting the dish photo, also upload the original image to blob storage:
- Blob path: `recipes/pending/source-{guid}.jpg` (or matching extension)
- Return `sourceImageUrl` in `ExtractedRecipeResponse`

**`POST /api/recipes/from-url`** — return `sourceUrl` in `ExtractedRecipeResponse` (just echo the input URL back).

### UI Changes

- `from-url` response: capture `sourceUrl` from the response (or use the input `recipeUrl` directly) and pass it through to `save-extracted`.
- `from-image` response: capture `sourceImageUrl` and pass it through to `save-extracted`.
- No display changes required.

## Out of Scope
- Displaying `SourceUrl` or `SourceImageUrl` in any UI
- Deduplication logic
- Attribution display
- Migrating existing recipes

## Open Questions
- None — fields are additive and nullable; no breaking changes.
