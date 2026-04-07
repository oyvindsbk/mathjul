# Feature: Recipe Sections

## Summary
Recipes can have ingredients and instruction steps organized into named sections with headings (e.g. "Sauce", "Marinade", "Dough"). The AI extraction automatically detects and preserves section structure from source recipes.

## Motivation
Many recipes—especially baked goods, composite dishes, and recipes with multiple components—are naturally organized into sections (e.g. "For the crust:", "For the filling:"). Without section support, these recipes lose their structure and become harder to follow. Storing and displaying sections makes the app more useful for complex recipes.

## Requirements

### Data model
- Both `Ingredients` and `InstructionSteps` can optionally be grouped into named sections
- A section has a `heading` string and a list of items
- A flat list (no sections) remains valid and backward-compatible — existing recipes are unaffected
- The data model uses a `IngredientSection` / `InstructionSection` approach stored as JSON (same pattern as current `Ingredients`/`InstructionSteps` columns)

### AI extraction
- The system prompt instructs the AI to detect ingredient sections and instruction sections from source content
- When sections exist (detected by headings like "For the sauce:", "Marinade:", etc.), the AI returns sectioned data
- When no sections exist, the AI returns a flat structure (backward-compatible)

### Backend
- `Recipe` model gains `IngredientSections` and `InstructionSections` JSON columns (alongside existing flat columns for backward compatibility)
- If `IngredientSections` is non-empty, it takes precedence over the flat `Ingredients` list
- If `InstructionSections` is non-empty, it takes precedence over the flat `InstructionSteps` list
- All DTOs, request/response classes, and controller actions are updated to support sections
- EF migration added for the two new JSON columns

### Frontend
- Recipe detail view renders sections with headings when sections are present; falls back to flat list when not
- Recipe edit form supports adding/removing sections and moving ingredients/steps between sections
- Upload (save-extracted) flow passes sections through to the backend
- `RecipeFormData` and mock types updated to include sections
- Ingredient scaling (servings multiplier) works correctly across sections

## Design

### Data Model

New C# types:
```csharp
public class IngredientSection
{
    public string Heading { get; set; } = string.Empty;
    public List<StructuredIngredient> Ingredients { get; set; } = new();
}

public class InstructionSection
{
    public string Heading { get; set; } = string.Empty;
    public List<InstructionStep> Steps { get; set; } = new();
}
```

`Recipe` gains:
```csharp
public List<IngredientSection> IngredientSections { get; set; } = new();
public List<InstructionSection> InstructionSections { get; set; } = new();
```

### AI JSON schema (when sections exist)
```json
{
  "ingredientSections": [
    { "heading": "Saus", "ingredients": [...] },
    { "heading": "Kjøtt", "ingredients": [...] }
  ],
  "instructionSections": [
    { "heading": "Forberedelser", "steps": ["step 1", "step 2"] },
    { "heading": "Steking", "steps": ["step 3"] }
  ]
}
```

When no sections, flat arrays continue to work:
```json
{
  "ingredients": [...],
  "instructions": [...]
}
```

### API Changes
- `RecipeDetailDto` gains `IngredientSections` and `InstructionSections`
- `ExtractedRecipeResponse`, `SaveExtractedRecipeRequest`, `UpdateRecipeRequest` gain section fields
- `MapToExtractedResponse` maps section data through

### UI Changes
- Recipe detail: when `ingredientSections` is non-empty, render each section with a bold heading followed by its ingredient list; otherwise render flat list as before
- Recipe detail: same for instruction sections
- Recipe edit form: sections editor — add section, rename heading, move items, add items to section

## Out of Scope
- Reordering sections via drag-and-drop (can be added later)
- Mixing flat and sectioned data in the same recipe (sections take precedence when present)
- Per-section images

## Open Questions
- None — approach is clear from existing patterns
