# Feature: Matlagingsmodus

## Summary

A full-screen overlay on the recipe detail page that presents ingredients and instructions as two tabs, each with tick-off checkboxes, portion scaling, and a screen wake lock. Progress is persisted to `localStorage` so it survives a refresh or an app-switch mid-cook.

## Motivation

The app is used phone-in-hand at the stove — `specs/028-mobile-responsiveness/spec.md` states this explicitly — but the current mobile cooking experience is split and lossy in three ways:

1. The floating **Ingredienser** button opens `IngredientsSheet`, which shows ingredients only and offers no way to tick them off. You lose your place in a long list every time you look away from the phone.
2. Instruction checkboxes exist on the page but are held in plain `useState` (`recipes/[id]/client.tsx:91`), so they **reset on every navigation and every refresh**. Cooking is exactly the situation where the phone locks, an app-switch happens, or the page reloads — the state is lost precisely when it matters.
3. Ingredients and instructions cannot be seen in the same surface. Reading a step, then checking an amount, means closing the sheet, scrolling, and scrolling back.

Matlagingsmodus consolidates these into one purpose-built surface for the act of cooking, separate from the browsing/reading view of the recipe.

## Requirements

- A **Matlagingsmodus** entry point on the recipe detail page opens a full-screen overlay; the existing "Ingredienser" floating button is replaced by it.
- The overlay has two tabs: **Ingredienser** and **Slik gjør du**.
- Every ingredient row has a checkbox; ticking it strikes the row through. Ingredient text wraps rather than truncating.
- Every instruction step has a checkbox, at cooking-friendly type size, with step images shown.
- Step numbering is continuous across instruction sections, matching the recipe page.
- Both tabs render correctly for the flat shape (`ingredients` / `instructionSteps`) and the sectioned shape (`ingredientSections` / `instructionSections`).
- A portions stepper (−/+/direct input) inside the Ingredienser tab scales quantities live; the value stays in sync with the recipe page behind the overlay.
- The screen is kept awake while the overlay is open, and the lock is re-acquired after the tab is backgrounded and returns.
- Checked ingredients and checked steps persist to `localStorage`, surviving refresh and navigation, and are cleared by a **Begynn på nytt** action.
- Persisted progress is scoped so that editing the recipe invalidates it rather than mismatching against changed content.
- Instruction checkboxes on the recipe detail page share the same persisted state as the overlay — ticking in one is reflected in the other.
- The overlay closes via the X button, backdrop click, swipe down, and `Escape`; focus is trapped while open and restored to the trigger on close.
- Mobile-first layout, but usable at every viewport — desktop gets a centered max-width panel rather than edge-to-edge full-bleed.
- Touch targets are at least 44px, and the safe-area inset is respected (per `028` R9).

## Design

### Data Model

No backend or database changes. `RecipeDetailDto` already carries everything needed: structured ingredients (`quantity` / `unit` / `name`), instruction steps, both section shapes, `servings`, `quantityType`, `customUnit`, and `updatedAt`.

Client-side progress shape, stored as JSON in `localStorage`:

```
CookingProgress {
  ingredients: string[]   // "sectionIdx:ingredientIdx"; flat list uses section 0
  steps:       number[]   // 1-based continuous step numbers
}
```

Storage key: `matlagingsmodus:v1:{recipeId}:{updatedAt ?? "0"}`

`StructuredIngredient` has no stable id, so index-based keys are the only option available. Including `updatedAt` in the storage key is what makes that safe: an edited recipe produces a different key, so stale progress is abandoned rather than silently mismatched against reordered or changed ingredients. The `v1` segment allows the shape to change later without colliding with existing stored data.

### API Changes

None. Progress is deliberately client-only — cross-device sync would require a new table, endpoint, and per-user scoping, and is out of scope.

### UI Changes

**New component tree** under `frontend/src/components/matlagingsmodus/`:

- `MatlagingsmodusOverlay` — the shell: backdrop, `role="dialog" aria-modal="true"`, tab bar, body scroll lock, dismissal handling, focus trap.
- `IngredientsTab` — card-per-ingredient list with checkboxes and the portions stepper.
- `InstructionsTab` — step checklist with checkboxes, images, continuous numbering.
- `ServingsStepper` — the −/+/input control, extracted so it is defined once and used in three places.

`MatlagingsmodusButton` replaces `FloatingIngredientsButton`, keeping its `IntersectionObserver` reveal behaviour and safe-area-aware positioning but relabelled and available at all viewports. On desktop an additional inline entry button sits in the recipe title row, since a floating pill is a mobile idiom.

`IngredientsSheet.tsx` and `FloatingIngredientsButton.tsx` are deleted once the overlay covers their behaviour.

**Supporting modules:**

- `src/lib/recipe-format.ts` — `formatQuantity`, `formatIngredientParts`, `servingsLabel`, currently duplicated verbatim between `recipes/[id]/client.tsx:33-83` and `IngredientsSheet.tsx:18-40`. Extracted before the overlay is written so a third copy is never created.
- `src/lib/cooking-progress.ts` — `localStorage` read/write/clear plus key derivation, SSR-safe and wrapped in `try/catch` (private mode and quota-exceeded both throw).
- `src/hooks/useCookingProgress.ts` — hydrates after mount, writes through on toggle. Called **once** on the detail page and passed down, which is what makes state shared between page and overlay.
- `src/hooks/useWakeLock.ts` — `navigator.wakeLock`, with re-acquire on `visibilitychange` and a silent no-op where unsupported.

`quantityType` and `customUnit` are added to the shared `Recipe` interface in `mock-data.ts` — they exist on the backend DTO but are currently declared only on the local `RecipeDetail` shadow interface.

**Visual reference:** rounded-top sheet with a drag handle, underlined active tab, one card per ingredient with a hollow-circle checkbox and bolded amount ("**250 g** risottoris"). Checkbox styling reuses the existing instruction-step tokens verbatim (`w-5 h-5 rounded-full`, unchecked `border-gray-400 bg-white`, checked `bg-[#e8f1e1]` with the `#4a7c3f` polyline) so both tabs read as one system.

## Out of Scope

- Server-side or cross-device progress sync
- A one-step-at-a-time "big text" step view (considered and deferred in favour of a scrollable checklist)
- Cooking timers, voice control, hands-free gestures
- Unit conversion (metric/imperial)
- Any change to the recipe edit or upload flows

## Open Questions

- None
