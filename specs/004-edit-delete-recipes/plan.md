# Implementation Plan: Edit and Delete Recipes

## Approach
Add PUT and DELETE endpoints to the existing `RecipesController`, following the same patterns used by `SaveExtractedRecipe` and `GetRecipeById`. On the frontend, extract the recipe editing form from the upload page into a shared `RecipeForm` component, then build an edit page that reuses it. Add edit/delete buttons to the recipe detail page.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions
- **PUT (full replace) over PATCH**: The form always sends all fields, so PUT semantics are simpler and match the existing save pattern
- **Hard delete over soft delete**: This is a simple personal recipe app — no need for trash/restore complexity
- **Separate edit page over inline editing**: The detail page is 244 lines of read-only display; mixing in a form would be messy. A dedicated `/recipes/[id]/edit` page is cleaner
- **Shared RecipeForm component**: Avoids duplicating ~180 lines of form JSX between upload and edit pages
- **Reuse SaveExtractedRecipeRequest shape**: The UpdateRecipeRequest DTO has the same fields, keeping the API consistent
- **window.confirm() for delete**: Simple and effective — no need for a custom modal component

## Risks
- **RecipeForm extraction may break upload page**: Mitigated by running full inner loop after extraction and testing both flows
- **Ingredients change tracking**: EF Core needs a new list instance (not mutation) to detect changes via the custom ValueComparer. Mitigated by using `.Select().ToList()` pattern from SaveExtractedRecipe
- **CookTime/CookTimeMinutes dual fields**: Must derive the string from the int, same as SaveExtractedRecipe (line 168)
