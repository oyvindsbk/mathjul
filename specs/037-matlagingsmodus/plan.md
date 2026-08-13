# Implementation Plan: Matlagingsmodus

## Approach

Frontend-only, built bottom-up so that no code is written twice: shared helpers are extracted first, then the storage layer, then the hooks, then the presentational components, and finally the overlay that composes them. The old ingredients sheet and its floating button are deleted only once the overlay fully covers their behaviour.

1. **Extract duplicated helpers** (`recipe-format.ts`) and widen the shared `Recipe` type. Pure refactor, no behaviour change — verifiable by typecheck and build alone.
2. **Storage layer** (`cooking-progress.ts`) — key derivation, SSR-safe read/write/clear, pruning.
3. **Hooks** (`useCookingProgress`, `useWakeLock`) — `useCookingProgress` is wired into the detail page's existing step checkboxes immediately, which fixes the reset-on-navigation bug on its own and proves persistence before any overlay exists.
4. **Presentational pieces** (`ServingsStepper`, `IngredientsTab`, `InstructionsTab`) — each usable and inspectable in isolation.
5. **Overlay shell** composing the tabs, with accessibility and dismissal handling.
6. **Entry point**, then deletion of `IngredientsSheet` / `FloatingIngredientsButton`.
7. **E2E coverage**, then the full inner loop.

## Stacks Affected

- [x] Frontend
- [ ] Backend (no changes needed — `RecipeDetailDto` already returns everything required)
- [ ] Infrastructure (no changes needed)

## Key Decisions

- **Overlay rather than a sub-route.** No URL change, no new page, and the recipe page's existing `desiredServings` state can be passed straight in, keeping scaling in sync between the two surfaces. The cost is that the browser back button closes the recipe rather than the overlay, so `Escape`, backdrop, swipe, and an explicit X are all wired up to compensate.
- **`updatedAt` in the storage key.** `StructuredIngredient` carries no stable id, so checkbox state must be index-keyed. Scoping the key by `updatedAt` means an edited recipe simply reads a different key and starts clean, instead of applying old indices to reordered content. Cheaper and less error-prone than a migration or a content hash.
- **Shared progress state between page and overlay.** `useCookingProgress` is called once on the detail page and passed down. This fixes the pre-existing bug where step checkboxes reset on navigation, and avoids two stores disagreeing about the same recipe. The cost is that the detail page's step rendering must be touched.
- **Extract helpers before building.** `formatQuantity` / `formatIngredientParts` / `servingsLabel` and the servings stepper markup are already duplicated across two files. Building the overlay first would make it three. Doing the refactor as task one is a small up-front cost that keeps the net line count down.
- **Replace the ingredients sheet rather than keeping both.** Two overlapping ways to view ingredients on mobile would be confusing, and `IngredientsSheet`'s rendering logic is subsumed by `IngredientsTab`. Deletion is deferred to its own task so the overlay can be verified against the old behaviour first.
- **Scrollable checklist for steps, not one-step-at-a-time.** Matches the ingredients tab structurally, reuses the existing checkbox pattern, and is a much smaller build. The big-text stepper view is recorded as out of scope rather than discarded.

## Risks

- **Wake Lock is unevenly supported** → the screen sleeps mid-cook on Firefox and older iOS Safari. *Mitigation:* feature-detect and treat absence as a silent no-op, never an error. The browser also drops the lock silently on backgrounding, so re-acquire on `visibilitychange` — without that the feature appears to work and then quietly stops after the first app-switch. Cannot be covered by Playwright; requires a manual check on a real device.
- **`localStorage` throws** in private browsing and on quota exhaustion. *Mitigation:* wrap every access in `try/catch` and degrade to in-memory state. A cooking overlay must never crash the recipe page.
- **Hydration mismatch** if stored progress is read during render. *Mitigation:* guard on `typeof window`, hydrate inside `useEffect` after mount. Next.js will surface this loudly in dev if it regresses.
- **Index-keyed ingredient state is inherently fragile** — an edit that reorders ingredients invalidates the mapping. *Mitigation:* the `updatedAt`-scoped key. Severity is low: worst case is a cleared checklist, never a wrong one.
- **Touching the detail page's step rendering risks regressing existing behaviour** (continuous numbering across sections, the "Begynn på nytt" button, step images hidden when checked). *Mitigation:* keep numbering semantics identical so persisted step numbers mean the same thing in both surfaces, and cover the shared-state claim explicitly in E2E.
- **Deleting two components in use** could strand an import. *Mitigation:* deletion is its own task, gated behind typecheck and build.
