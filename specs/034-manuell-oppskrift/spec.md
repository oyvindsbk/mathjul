# Feature: Manuell oppskrift

## Summary
Add a third "Manuelt" tab to the `last-opp-oppskrift` page so users can enter recipe details manually, without needing a photo or URL to extract from.

## Motivation
Some users have recipes in their head, on paper, or from a source they can't link or photograph. They need a quick way to enter a recipe directly.

## Requirements
- A third tab labeled **"Manuelt"** appears alongside "Last opp bilde" and "Lim inn URL"
- Selecting "Manuelt" bypasses the extraction step entirely and immediately shows the recipe form (same `RecipeForm` component used after extraction)
- The form is pre-populated with empty/default values (blank title, no ingredients/steps, etc.)
- All existing form features work: visibility selector, main photo upload, step photos, categories, save
- After saving, the user is redirected to `/` like the other modes
- No new API endpoints required — reuse `POST /api/recipes/save-extracted`

## Design

### Data Model
No changes.

### API Changes
No changes.

### UI Changes
- `InputMode` type extended: `'image' | 'url' | 'manual'`
- Third tab button "Manuelt" added to the tab toggle row
- When `inputMode === 'manual'`, skip extraction UI and set `extractedRecipe` to an empty default immediately so the form renders
- `handleSwitchMode` handles `'manual'` the same as others (reset state), then immediately calls `handleStartManual()` to set the empty recipe
- Progress/error UI remains unchanged

## Out of Scope
- Auto-save or draft persistence
- Backend changes
- Editing an existing recipe (that's the edit flow)

## Open Questions
- None
