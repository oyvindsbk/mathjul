# Feature: Recipe Tips

## Summary
Allow users to add one or more free-text tips to a recipe. Tips are displayed in a styled callout box on the recipe detail page, similar to "Tips fra kokken" shown in Norwegian recipe apps.

## Motivation
Recipes benefit from extra context — substitutions, serving suggestions, cook's notes — that doesn't fit naturally into ingredients or instruction steps. A dedicated tips field gives authors a structured place for this content.

## Requirements
- A recipe can have zero or more tips (list of strings)
- Tips are created, edited, and deleted in the recipe edit form
- Tips are displayed on the recipe detail page in a highlighted "Tips fra kokken" section
- Tips are included in AI extraction (the AI should populate them when present in source)
- Existing recipes with no tips show no tips section

## Design

### Data Model
Add `Tips` property to `Recipe` entity — stored as JSON in a `nvarchar(max)` column, same pattern as `Ingredients`, `InstructionSteps`, `IngredientSections`, `InstructionSections`.

```csharp
public List<string> Tips { get; set; } = new();
```

EF Core migration required to add the column.

### API Changes
- `RecipeDto` and `RecipeFormRequest` gain a `tips` field (`List<string>`)
- `GET /api/recipes/{id}` returns tips
- `POST /api/recipes` and `PUT /api/recipes/{id}` accept tips
- AI extraction prompt updated to include tips in the JSON schema

### UI Changes
- **Recipe detail page:** Show a "Tips fra kokken" callout section below instructions when tips are present. Each tip displayed as a separate item with a chef's hat / lightbulb icon.
- **Recipe edit form:** Tips editor — add/remove individual tip strings, similar to how instruction steps are managed.
- **RecipeFormData** and **mock-data `Recipe`** type get a `tips?: string[]` field.

## Out of Scope
- Tip ordering / drag-and-drop (tips are a flat list, order not critical)
- Per-tip headings or formatting
- AI-assisted tip generation (separate feature)

## Open Questions
- None — straightforward field addition following existing patterns.
