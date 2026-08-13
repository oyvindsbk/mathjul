# Tasks: Matlagingsmodus

## Tasks

- [x] Task 1: Extract formatQuantity, formatIngredientParts and servingsLabel into src/lib/recipe-format.ts and update both call sites
- [x] Task 2: Add quantityType and customUnit to the shared Recipe interface and slim down the RecipeDetail shadow interface
- [x] Task 3: Add src/lib/cooking-progress.ts with key derivation, SSR-safe read/write/clear, and key pruning
- [x] Task 4: Add the useCookingProgress hook with post-mount hydration and write-through on toggle
- [x] Task 5: Replace the detail page's in-memory checkedSteps with useCookingProgress and wire "Begynn på nytt" to reset
- [x] Task 6: Add the useWakeLock hook with feature detection and visibilitychange re-acquire
- [x] Task 7: Extract ServingsStepper and use it on the detail page and in the ingredients sheet
- [x] Task 8: Add IngredientsTab with checkboxes, wrapping text, and flat/sectioned shape handling
- [x] Task 9: Add InstructionsTab with checkboxes, step images, and continuous cross-section numbering
- [x] Task 10: Add MatlagingsmodusOverlay shell with accessible tabs, focus trap, scroll lock, and all four dismissal paths
- [x] Task 11: Add MatlagingsmodusButton and the desktop inline entry point, and mount the overlay on the detail page
- [x] Task 12: Delete IngredientsSheet.tsx and FloatingIngredientsButton.tsx
- [x] Task 13: Add Playwright E2E coverage for matlagingsmodus at 375px including the persistence and shared-state assertions
- [x] Task 14: Inner loop — frontend lint, typecheck, build, Playwright
