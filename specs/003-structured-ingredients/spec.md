# Feature: Structured Ingredient Amounts & Portion Scaling

## Summary

Replace plain-text ingredient strings with structured objects (quantity, unit, name) and add a frontend portion adjuster that dynamically scales ingredient quantities based on desired servings.

## Motivation

Ingredients are currently stored as newline-separated strings (e.g., `"2 cups flour\n1 tsp salt"`). This makes it impossible to programmatically scale quantities when a user wants to cook for more or fewer people. Structured ingredient data unlocks portion adjustment and better display formatting.

## Requirements

- Ingredients are stored as structured objects with `quantity` (decimal?), `unit` (string?), and `name` (string)
- AI extraction (image + URL) returns structured ingredient data instead of plain strings
- Recipe detail page shows a portion adjuster (+/- buttons) that scales ingredient quantities
- Upload/edit page allows editing structured ingredient fields (quantity, unit, name separately)
- Existing recipes with legacy string ingredients are migrated to structured format
- Ingredients without a clear quantity (e.g., "salt to taste") are supported via nullable quantity/unit

## Design

### Data Model

**New class: `StructuredIngredient`**

| Field    | Type      | Notes                                    |
|----------|-----------|------------------------------------------|
| Quantity | decimal?  | Nullable for "salt to taste" style items |
| Unit     | string?   | Nullable for unitless items ("2 eggs")   |
| Name     | string    | Always required                          |

**Modified: `Recipe.Ingredients`**
- From: `string` (newline-separated text)
- To: `List<StructuredIngredient>` (JSON-serialized via EF Core value converter)
- Column type remains `nvarchar(max)` — only the data format changes

### API Changes

**`GET /api/recipes/{id}` — RecipeDetailDto**
- `Ingredients` changes from `List<string>` to `List<StructuredIngredientDto>`

**`POST /api/recipes/from-image` and `POST /api/recipes/from-url` — ExtractedRecipeResponse**
- `Ingredients` changes from `List<string>` to `List<StructuredIngredientDto>`

**`POST /api/recipes/save-extracted` — SaveExtractedRecipeRequest**
- `Ingredients` changes from `List<string>?` to `List<StructuredIngredientDto>?`

### UI Changes

**Recipe detail page (`/recipes/[id]`)**
- Portion adjuster: +/- buttons next to the "Porsjoner" metric
- Ingredients display scaled quantities based on `desiredServings / baseServings` ratio
- When servings or quantity is null, display ingredient as-is (no scaling)

**Upload page (`/upload`)**
- Ingredient editor: 3 fields per ingredient row (quantity, unit, name) instead of single text input

## Out of Scope

- Unit conversion (e.g., cups to ml)
- Fraction display (e.g., showing "1/2" instead of "0.5")
- Ingredient categorization or grouping
- Shopping list generation

## Open Questions

None — all decisions resolved during planning.
