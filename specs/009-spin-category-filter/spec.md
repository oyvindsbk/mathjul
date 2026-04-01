# Feature: Category Filter for Spin the Wheel

## Summary
Allow users to filter recipes by category before spinning the wheel, so only recipes matching the selected categories appear as wheel segments.

## Motivation
Users may want dinner suggestions only, or only quick meals (under 30 min), etc. Without filtering, all recipes go into the wheel regardless of type.

## Requirements
- Show a category filter panel on the spin page, above the wheel
- Categories are grouped (Måltidstype, Vanskelighetsgrad, Tilberedningstid) — same as home page
- User can toggle one or more categories; only recipes matching ALL selected categories appear on the wheel
- When no categories are selected, all recipes are shown (current behavior)
- If the filtered set has fewer than 2 recipes, show a "not enough recipes" message and disable spin
- If the filtered set exceeds MAX_SEGMENTS (20), truncate to the first 20 (current behavior)
- Filter state does not persist between page visits (session-only)
- Show a badge on the filter toggle button indicating how many categories are active

## Design

### Data Model
No changes — categories already exist on recipes.

### API Changes
No new endpoints — reuse `GET /api/recipes?categories=1,3` (existing AND-filter) and `GET /api/categories`.

### UI Changes
- Collapsible "Filtrer kategorier" panel above the wheel (same pattern as HomeClient.tsx)
- Category chips grouped by `group`, togglable
- Badge on toggle button showing count of active filters
- "Fjern alle filtre" clear button when filters are active
- Wheel and spin button only use the filtered recipe list

## Out of Scope
- Persisting filter selection across page visits
- OR-logic (any-match) filtering — AND-logic is consistent with home page
- Backend changes

## Open Questions
- None — pattern is already established on the home page
