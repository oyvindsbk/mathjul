# Feature: Breadcrumb Navigation

## Summary
Add a sticky breadcrumb bar that renders below the header on all pages, automatically derived from the current URL path, and supports context-aware parent crumbs for recipe detail pages (showing the page navigated from).

## Motivation
Users need orientation within the app hierarchy. Recipe detail pages especially benefit from a "back to" crumb showing where they came from (Alle oppskrifter, Favoritter, etc.) rather than always pointing to a fixed parent.

## Requirements
- Breadcrumb bar is sticky, positioned directly below the main header (below `z-50` header)
- Hidden on small/mobile devices (`hidden md:flex`)
- Automatically derived from the current URL path — no manual wiring per page
- Context-aware: recipe detail page (`/recipes/[id]`) shows the referring section as the parent crumb (e.g. "Alle oppskrifter > Oppskrift" or "Favoritter > Oppskrift")
- Falls back to "Hjem" as parent if no referrer context
- Home page (`/`) has no breadcrumb (it IS home)
- Route map for crumb labels:
  - `/` → Hjem
  - `/alle-oppskrifter` → Alle oppskrifter
  - `/favoritter` → Favoritter
  - `/ukesplanlegger` → Ukesplanlegger
  - `/grupper` → Grupper
  - `/grupper/[id]` → Grupper > [Group name or id]
  - `/spin-the-wheel` → Spin the Wheel
  - `/last-opp-oppskrift` → Last opp oppskrift
  - `/recipes/[id]` → [parent context] > Oppskrift
  - `/recipes/[id]/edit` → [parent context] > Oppskrift > Rediger
  - `/feature-planner` → Feature Planner

## Design

### UI Changes
- New `BreadcrumbBar` client component: reads `usePathname()` and a `referrer` context to build crumb items
- Rendered in `layout.tsx` between `<Sidebar />` and `<main>` — sticky below header using `sticky top-16 z-40`
- Uses `hidden md:block` so it's invisible on mobile
- Recipe detail referrer tracking: store last visited list-page in `sessionStorage` when navigating from a list page (e.g. clicking a recipe card). `BreadcrumbBar` reads this when on a recipe route
- Existing per-page `<Breadcrumb>` usages are removed from individual pages (avoid duplication)

### Referrer tracking approach
- A `NavigationTracker` client component (already has `NavigationProgress`) or integrated into existing one — on route change, if the current path is a "list" page, store it in `sessionStorage` as `lastListPage`
- `BreadcrumbBar` reads `sessionStorage.getItem("lastListPage")` when building crumbs for `/recipes/*`

## Out of Scope
- Breadcrumb on login, 403, API callback pages
- Dynamic group/recipe names in crumbs (use static labels or IDs)

## Open Questions
- None — approach is clear
