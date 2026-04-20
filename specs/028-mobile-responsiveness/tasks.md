# Tasks: Mobile Responsiveness

## Tasks

- [x] **T1** Simplify `Sidebar.tsx` on mobile: show logo left + profile icon right only, remove hamburger button and dropdown. Add `pb-16 md:pb-0` to `<main>` in `layout.tsx`.
- [x] **T2** Create `BottomNav.tsx`: fixed bottom bar (`md:hidden`) with five tabs — Hjem, Oppskrifter, Planlegger, Last opp, Profil. Active tab highlighted. iOS safe-area inset applied via `env(safe-area-inset-bottom)`.
- [x] **T3** Add `BottomNav` to `layout.tsx` (rendered inside `ProtectedRoute`, below `<main>`).
- [x] **T4** Fix `/alle-oppskrifter` recipe grid: 2-column on mobile (`grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Verify card touch targets ≥ 44px.
- [x] **T5** Fix `/recipes/[id]` recipe detail: ingredient list and instruction steps readable at 375px. Check image aspect ratio. Verify no horizontal overflow.
- [x] **T6** Create `FloatingIngredientsButton.tsx`: FAB at `bottom-20 left-1/2 -translate-x-1/2` (`md:hidden`, `z-30`). Uses `IntersectionObserver` on the ingredient section to show/hide. Tapping opens an `IngredientsSheet.tsx` bottom drawer with the full ingredient list.
- [x] **T7** Create `IngredientsSheet.tsx`: slide-up bottom sheet with backdrop, dismissible by tap-outside or swipe-down gesture. Renders ingredient list from props. Smooth `translate-y` transition.
- [x] **T8** Integrate `FloatingIngredientsButton` + `IngredientsSheet` into the recipe detail page (`/recipes/[id]`).
- [x] **T9** Fix meal planner (`/ukesplanlegger`) week grid: wrap in `overflow-x-auto` container on mobile, set `min-w-[700px]` on the grid. Show abbreviated day names (Man, Tir, Ons…) on mobile.
- [x] **T10** Fix `/last-opp-oppskrift` upload form: drag-drop zones show tap-to-upload (`<input type="file">` trigger) on touch devices. Verify form fields usable with mobile keyboard (no zooming on focus).
- [x] **T11** Audit remaining pages at 375px (Chrome DevTools): `/`, `/favoritter`, `/profil`, `/spin-the-wheel`, `/grupper`. Fix any overflow or tiny touch targets found.
- [x] **T12** Final verification: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
