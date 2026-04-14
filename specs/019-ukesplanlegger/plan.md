# Implementation Plan: Ukesplanlegger

## Approach
Build backend first (entity, migration, controller), then frontend (service, page, calendar components). The AI plan endpoint uses random selection from the user's recipe library (no external AI call needed — "AI" here means the system picks varied recipes automatically).

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure (no changes needed)

## Key Decisions

- **AI = smart random selection**: "Planlegg uke for meg" picks 7 distinct recipes from the user's recipe library at random. No external LLM call. This is fast, free, and good enough for v1.
- **Date stored as DateOnly in DB**: `MealPlan.Date` stored as `date` column (SQL Server), no time component. API accepts `yyyy-MM-dd` string in route/query params.
- **PUT semantics for set/update**: A single PUT `/api/mealplans/{date}` upserts — inserts if no plan exists for that date, updates if one does. Clean and idempotent.
- **Month view with week rows**: Calendar shows the current month by default, with prev/next month navigation. Each week row (Mon–Sun) is right-clickable.
- **RecipePickerModal reuses existing recipe list**: Fetches all user-visible recipes, provides search filter, shows title + image thumbnail.
- **No drag-and-drop in v1**: Keeping interactions simple — click to assign, right-click week for bulk actions.

## Risks
- **EF migration conflicts**: Adding `MealPlan` entity to `RecipeDbContext` requires a new migration. Low risk — isolated entity with no FK changes to existing tables.
- **Context menu on touch devices**: Right-click doesn't work on mobile. Mitigation: also provide a "..." button per week row as fallback (v1 can be desktop-first).
