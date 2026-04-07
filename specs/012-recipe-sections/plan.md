# Implementation Plan: Recipe Sections

## Approach
Extend the existing JSON column pattern (used for `Ingredients` and `InstructionSteps`) to add two new JSON columns: `IngredientSections` and `InstructionSections`. The flat columns are kept for backward compatibility — sections take precedence when non-empty. The AI prompt is updated to produce section data when it detects headings. The frontend renders sections in the detail view and supports editing sections in the form.

## Stacks Affected
- [x] Backend
- [x] Frontend
- [ ] Infrastructure

## Key Decisions

- **Additive columns, not replacing existing ones**: `IngredientSections` and `InstructionSections` are new JSON columns. Existing `Ingredients`/`InstructionSteps` columns remain. This avoids a destructive migration and keeps all existing recipes intact. The rule "sections take precedence when non-empty" ensures backward compatibility.

- **AI prompt extended, not replaced**: The system prompt adds an optional `ingredientSections` / `instructionSections` field. When the AI sees a flat recipe, it still returns the old format. When it sees headings, it uses the new format. The parser handles both.

- **EF migration required**: Two new `nvarchar(max)` JSON columns on `Recipes`. Migration is additive (no existing data changes).

- **Section display is frontend-only logic**: The frontend checks `recipe.ingredientSections?.length > 0` to decide rendering. No API versioning needed.

## Risks

- **AI hallucinating sections**: The AI might invent section headings that weren't in the source. Mitigation: prompt says "only create sections if explicit headings are present in the source". Users can always edit the recipe to fix it.

- **Parser regression**: Changing `ParseResponseContent` could break existing flat recipes. Mitigation: the flat-first fallback path is unchanged; sections are parsed from new optional fields.
