# Feature: Edit and Delete Recipes

## Summary
Allow users to edit all fields of an existing recipe and delete recipes they no longer want.

## Motivation
Users can currently only create recipes via AI extraction (image or URL). There is no way to correct extraction errors, update a recipe after trying it, or remove unwanted recipes. This is a basic CRUD gap.

## Requirements
- Users can edit any field of an existing recipe (title, description, ingredients, instructions, prep time, cook time, servings, difficulty)
- Users can delete a recipe with a confirmation step
- Edit uses a dedicated page at `/recipes/[id]/edit` with a pre-populated form
- Delete is triggered from the recipe detail page with a confirmation dialog
- After successful edit, user is redirected back to the recipe detail page
- After successful delete, user is redirected to the home page
- The recipe form is shared between the upload (save-extracted) and edit flows

## Design

### Data Model
No changes to the Recipe entity. The existing model already has `UpdatedAt` which will be set on edit.

### API Changes
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/recipes/{id}` | Update all fields of an existing recipe. Returns updated `RecipeDetailDto`. |
| DELETE | `/api/recipes/{id}` | Hard-delete a recipe. Returns 204 No Content. |

**UpdateRecipeRequest DTO** (mirrors `SaveExtractedRecipeRequest`):
- `Title` (string, required)
- `Description` (string?)
- `Ingredients` (List<StructuredIngredientDto>?)
- `Instructions` (List<string>?)
- `PrepTime` (int?)
- `CookTime` (int?)
- `Servings` (int?)
- `Difficulty` (string?)

### UI Changes
1. **Edit page** (`/recipes/[id]/edit`) — server+client component pair, fetches recipe, renders shared `RecipeForm`
2. **RecipeForm component** — extracted from upload page form JSX, reusable for both upload and edit
3. **Edit/Delete buttons** on recipe detail page — Edit navigates to edit page, Delete shows `confirm()` dialog then calls API

## Out of Scope
- Soft delete / trash / undo
- Image upload or editing
- Recipe versioning or history
- Bulk edit/delete from recipe list
- Authorization per-recipe (all authenticated users can edit/delete any recipe)

## Open Questions
None — all design decisions resolved.
