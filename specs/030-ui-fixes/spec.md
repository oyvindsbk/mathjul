# Feature: UI Fixes (030)

## Summary
Four minor mobile UI fixes: bug reporter z-index conflict, floating ingredients trigger threshold, M logo in tab bar, and matkasse provider icons on calendar cards.

## Motivation
Small polish issues discovered during mobile use that affect usability and visual clarity.

## Requirements

### 1. Bug reporter button z-index on mobile
- The red bug report button (`BugReporter.tsx`) has `z-40`, same as `BottomNav` (`z-40`)
- On mobile, the bug button overlaps the bottom nav menu
- Fix: raise bug button z-index to `z-50` so it appears above the nav bar, OR reposition it above the bottom nav

### 2. Floating ingredients shows earlier on scroll
- `FloatingIngredientsButton.tsx` uses `IntersectionObserver` with `threshold: 0`
- The button only appears after the ingredients section has fully scrolled out of view
- Fix: use `rootMargin` to make the button appear sooner — before the ingredients section is fully off-screen (e.g. `rootMargin: "0px 0px -100px 0px"` triggers when the section is 100px above the viewport bottom)

### 3. M logo icon in tab bar
- `BottomNav.tsx` uses generic inline SVG icons for all 5 tabs
- The app has a mathjul "M" logo (white M on navy) in `/public/icons/icon-192.png`
- Replace the home tab icon (currently a house SVG) with an inline SVG "M" monogram matching the app brand, OR use the PNG icon as an `<img>` tag
- The home tab is the most appropriate placement for the brand logo

### 4. Matkasse provider icons on calendar day cards
- `DayCell.tsx` currently shows a generic 🥡 emoji for all matkasse entries
- The `MealPlan` object has `matkasseRecipe.leverandor` which is one of: `Hellofresh`, `Kokkeloren`, `GodtLevert`
- Each provider has brand colors defined in `LEVERANDOR_COLORS` in `matkasse.service.ts`
- Fix: replace 🥡 with provider-specific icons — small colored badges/pills showing the provider abbreviation (e.g. "HF", "KL", "GL") with the provider's brand color, or emoji logos for each provider

## Design

### Bug reporter z-index
- Change `z-40` to `z-50` on the bug button in `BugReporter.tsx:88`
- Also raise z-index on menu popup at `BugReporter.tsx:96` to `z-50` (already is)

### Floating ingredients trigger
- In `FloatingIngredientsButton.tsx`, change IntersectionObserver options:
  - Add `rootMargin: "0px 0px 200px 0px"` — this means the observer fires when the target is 200px before leaving the viewport bottom, making the button appear earlier

### M icon in tab bar
- In `BottomNav.tsx`, replace the home tab's SVG house icon with an `<img>` tag pointing to `/icons/icon-192.png` (32x32, rounded)

### Provider icons on calendar cards
- In `DayCell.tsx`, instead of always using 🥡 for matkasse entries, import `LEVERANDOR_COLORS` and `LEVERANDOR_LABELS` from `matkasse.service`
- Render a small colored badge showing provider abbreviation instead of the emoji
- The badge should use the provider's border/bg/text colors from `LEVERANDOR_COLORS`

## Out of Scope
- Redesigning the tab bar layout
- Adding new providers
- Changing the bug reporter workflow

## Open Questions
- None — all decisions resolved above
