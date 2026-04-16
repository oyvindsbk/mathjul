# Implementation Plan: Breadcrumb Navigation

## Approach
Build a global `BreadcrumbBar` component driven by `usePathname()` that maps routes to crumb labels. Place it in `layout.tsx` as a sticky bar below the `h-16` header (`top-16`). For recipe pages, read `sessionStorage.lastListPage` to show a context-aware parent. Track the "last list page" via a small addition to the existing `NavigationProgress` component or a new `NavigationTracker`.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Global bar in layout, not per-page**: Avoids repetition and keeps pages clean. Route-to-label mapping lives in one place.
- **`sessionStorage` for referrer**: Survives navigation within the tab, reset on new tab/session. Simple and no API needed.
- **`sticky top-16 z-40`**: Header is `sticky top-0 z-50 h-16`. Breadcrumb bar sits right below it.
- **Remove per-page `<Breadcrumb>` usages**: After global bar is in place, remove duplicate `<Breadcrumb>` calls from `favoritter/page.tsx`, `grupper/page.tsx`, `last-opp-oppskrift/page.tsx`, and any others.
- **Hidden on mobile**: `hidden md:block` — breadcrumbs are desktop-only per the requirement.
- **Home page returns null**: No crumb bar on `/`.

## Risks
- Recipe detail pages need the recipe title for a nice crumb — but fetching it in the breadcrumb bar adds complexity. Use "Oppskrift" as the static label to keep it simple.
- Group detail pages: same approach — use static "Gruppe" label.
