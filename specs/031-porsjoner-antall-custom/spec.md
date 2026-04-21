# Feature: Porsjoner, Antall og Custom Enhet

## Summary
Recipes can specify whether their quantity is measured in "porsjoner", "antall" (stk), or a custom unit (e.g. "rundstykker"). The quantity value supports decimals. Ingredients scale accordingly.

## Motivation
Some recipes yield a specific count of items (10 waffles, 12 rolls) rather than a number of servings for people. A flexible quantity type lets the recipe describe its yield accurately.

## Requirements
- Recipe stores a `quantityType`: `porsjoner | antall | custom`
- Recipe stores a `customUnit` string (only used when `quantityType = custom`)
- `servings` field changes from `int` to `double` on the backend
- On recipe create/edit form:
  - Radio/toggle to select porsjoner | antall | custom
  - When custom is selected: text input for the unit label
  - The servings number field supports decimal input
- On recipe detail page:
  - Label next to the `−`/`+` counter reflects the type: "porsjoner", "stk", or the custom unit string
- AI extraction attempts to detect quantityType and customUnit from recipe text; defaults to `porsjoner`

## Design

### Data Model
- `Recipe.QuantityType`: `string` (enum values: `"porsjoner"`, `"antall"`, `"custom"`) — nullable, defaults to `"porsjoner"`
- `Recipe.CustomUnit`: `string?` — only meaningful when `QuantityType = "custom"`
- `Recipe.Servings`: `double?` (was `int?`)
- EF migration: change column type + add two new columns

### API Changes
- `CreateRecipeRequest` / `UpdateRecipeRequest`: add `QuantityType` and `CustomUnit` fields
- `RecipeDto` / response: include `quantityType` and `customUnit`
- AI extraction prompt: updated to extract `quantityType` and `customUnit`

### UI Changes
- `RecipeForm.tsx`: add radio group (Porsjoner / Antall / Custom), conditional text input for custom unit, servings input uses `step="any"` / `type="number"`
- `client.tsx` (recipe detail): replace hardcoded "porsjoner" label with computed label from `quantityType` / `customUnit`
- `IngredientsSheet.tsx`: same label update

## Out of Scope
- Internationalisation / unit conversion
- Changing existing recipes that have no quantityType (they default to "porsjoner" display)

## Open Questions
- None — all resolved before implementation
