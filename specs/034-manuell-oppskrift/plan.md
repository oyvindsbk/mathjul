# Implementation Plan: Manuell oppskrift

## Approach
All changes are in `frontend/src/app/last-opp-oppskrift/page.tsx`. No backend or infrastructure changes needed.

1. Extend `InputMode` to include `'manual'`
2. Add `handleStartManual()` that sets `extractedRecipe` to a blank `RecipeFormData` (no AI call)
3. Update `handleSwitchMode` to call `handleStartManual()` when mode is `'manual'`
4. Add the third "Manuelt" tab button in the tab toggle row
5. Ensure no extraction UI (image/url areas) renders when `inputMode === 'manual'`

The save flow (`handleSaveRecipe`) is reused as-is — it already handles `extractedRecipe` regardless of origin.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- Reuse `extractedRecipe` state with an empty default rather than introducing a separate state: keeps the form/save path identical
- The "Manuelt" tab sets the recipe immediately on tab click, so the form appears without a button press

## Risks
- None significant — isolated to one file, no new APIs
