# Feature: Mobile Responsiveness

## Summary
Fix the mobile experience across all pages so the app is fully usable on 375px screens with a bottom navigation bar and touch-friendly layouts.

## Motivation
The app is primarily used while cooking — phone in hand at the stove. The current hamburger dropdown nav and several pages that overflow or have tiny touch targets make this painful on mobile.

## Requirements

- **R1** All pages usable on 375px width without horizontal scroll
- **R2** Replace hamburger dropdown with a persistent bottom navigation bar on mobile (< md)
- **R3** Simplified top bar on mobile: logo left, profile icon right — no hamburger
- **R4** Recipe detail page: touch-friendly ingredient and instruction layout
- **R5** Floating ingredient button on recipe detail: when scrolling down past the ingredient list, a button appears at bottom-center of the screen that opens an ingredient sheet/modal so the user never loses access to ingredients while reading instructions
- **R6** Meal planner week grid: horizontally scrollable on mobile with abbreviated day names
- **R7** Alle oppskrifter: 2-column recipe card grid on mobile
- **R8** Recipe upload form: tap-to-upload fallback on touch devices
- **R9** All interactive elements ≥ 44×44px touch targets
- **R10** `BreadcrumbBar` is already hidden on mobile — no change needed there

## Design

### Bottom Navigation Bar
New component `BottomNav.tsx` — fixed bottom, full width, `md:hidden`. Five tabs:
- Hjem (house icon) → `/`
- Oppskrifter (grid icon) → `/alle-oppskrifter`
- Planlegger (calendar icon) → `/ukesplanlegger`
- Last opp (plus icon) → `/last-opp-oppskrift`
- Profil (person icon) → `/profil`

Active tab highlighted. `<main>` in `layout.tsx` gets `pb-16 md:pb-0` to avoid content hiding behind the bar.

### Floating Ingredients Button (Recipe Detail)
On mobile only (`md:hidden`), a floating action button (FAB) fixed at `bottom-20 left-1/2 -translate-x-1/2` (above the bottom nav). It appears after the user scrolls past the ingredient section (tracked via `IntersectionObserver` on the ingredient list element). Tapping it opens a bottom sheet/drawer showing the full ingredient list. The sheet can be dismissed by tapping outside or swiping down.

## Out of Scope
- Desktop layout changes
- Groups pages (low traffic, defer)
- Feature Planner page (internal tool)
- PWA / service worker (separate feature 029)

## Open Questions
- None — requirements are clear.
