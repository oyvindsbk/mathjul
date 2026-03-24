# Implementation Plan: Structured Ingredient Amounts & Portion Scaling

## Approach

Store structured ingredients as JSON in the existing `nvarchar(max)` column using an EF Core value converter. This avoids a new table, new FK relationships, and complex migrations — ingredients are always loaded/saved as a unit with their recipe.

The AI extraction prompt is updated to return structured objects. A parsing fallback handles cases where the AI returns plain strings.

The frontend portion adjuster is a pure client-side calculation — no backend calls needed.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **JSON value converter over separate table**: Ingredients don't need independent querying. A value converter keeps the schema simple and avoids joins.
- **In-place column reuse**: The `Ingredients` column stays `nvarchar(max)`. Only the data format changes from newline-separated text to JSON. A data migration script converts existing rows.
- **Nullable quantity/unit**: Supports ingredients like "salt to taste" (no quantity) and "2 eggs" (no unit).
- **Client-side scaling**: Portion adjustment is a display-only feature — the stored recipe always represents the base servings.

## Risks

- **AI extraction reliability**: The LLM may occasionally return plain strings instead of structured objects. Mitigation: add a fallback parser that wraps plain strings as `{quantity: null, unit: null, name: string}`.
- **Existing data**: Any recipes with non-empty newline-separated ingredients need migration. Mitigation: SQL migration converts legacy data to JSON with null quantity/unit.
