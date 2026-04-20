# Implementation Plan: Mobile Responsiveness

## Approach
Pure frontend CSS and component work — no backend or infrastructure changes. Work page by page, starting with the navigation shell (bottom nav + simplified top bar) since that unlocks layout space for everything else.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **Bottom nav over hamburger:** Persistent bottom nav is the standard mobile pattern for apps with 4–5 primary routes. One tap to any section, always visible. The hamburger dropdown is discarded entirely on mobile.
- **`pb-16 md:pb-0` on `<main>`:** Fixed bottom nav (h-16 = 64px) overlaps the last bit of page content. Adding matching padding to main prevents this without layout shifts.
- **IntersectionObserver for FAB visibility:** No scroll event listeners. `IntersectionObserver` on the ingredient list heading fires when it scrolls off-screen, toggling the FAB. Zero performance cost, works with Next.js client components.
- **Bottom sheet for ingredients:** A slide-up panel (translate-y animation) with backdrop is simpler than a modal and matches native mobile patterns. No library needed — pure Tailwind + CSS transition.
- **Horizontal scroll for meal planner:** The 7-column grid cannot compress to 375px meaningfully. Wrapping in `overflow-x-auto` with `min-w-[700px]` on the grid preserves the layout while making it swipe-navigable.

## Risks
- **Bottom nav z-index conflicts:** FAB and bottom nav both fixed. FAB must sit above content but below nav. Order: content (z-0), FAB (z-30), bottom nav (z-40).
- **iOS Safari bottom safe area:** Fixed bottom elements need `pb-safe` / `env(safe-area-inset-bottom)` padding to avoid the home indicator. Apply via CSS variable.
