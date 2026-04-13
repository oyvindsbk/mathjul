# Implementation Plan: Recipe Tips

## Approach
Follow the same JSON-column pattern already used for `Ingredients`, `InstructionSteps`, etc. No new database tables — tips are a `nvarchar(max)` JSON column on the `Recipes` table.

1. Backend first: add `Tips` to the model, wire up EF Core mapping, generate migration, update DTOs and controller, update AI extraction prompt.
2. Frontend second: add `tips` to TypeScript types and `RecipeFormData`, add tips editor to `RecipeForm`, render tips section in recipe detail view.

## Stacks Affected
- [x] Backend (C#)
- [x] Frontend (Next.js / TypeScript)
- [ ] Infrastructure (no changes needed)

## Key Decisions
- **JSON column, not separate table:** consistent with all other list fields on `Recipe`. No join overhead, schema stays simple.
- **`List<string>` (not objects):** tips are plain text strings. No need for a wrapper type.
- **Tips displayed below instructions:** matches the screenshot layout where tips appear after the step list.

## Risks
- EF Core migration needs to run before the API accepts tips — in dev this is automatic (Aspire auto-migrates); in prod the migration runs on startup via `MigrateAsync`.
