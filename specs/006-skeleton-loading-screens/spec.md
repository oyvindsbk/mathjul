# Feature: Skeleton Loading Screens

## Summary
Show instant visual feedback when navigating between pages — users see a loading overlay immediately when clicking a button, followed by skeleton content on the target page while data loads.

## Motivation
Currently, clicking a navigation button gives no immediate feedback, and then the user sees a blank page or spinner until the next page loads. This feels slow and unpolished. By showing a loading overlay on button click and skeletons on the target page, we provide immediate visual confirmation that navigation is happening.

## Requirements

- When a user clicks a navigation link or button, a loading overlay appears **immediately**.
- The overlay persists until the new page's pathname changes (route navigation completes).
- The target page displays a skeleton matching the final content layout while data is fetched (recipe grid, detail view, form, etc.).
- Skeletons use an animated shimmer effect (Tailwind `animate-pulse`).
- All pages with async data loading display skeletons:
  - **Home (`/`)** — recipe grid skeleton (8 card placeholders)
  - **Recipe Detail (`/recipes/[id]`)** — hero image, title, meta chips, ingredients, instructions
  - **Edit Recipe (`/recipes/[id]/edit`)** — form fields with input placeholders
  - **Upload (`/upload`)** — drop zone and form field skeletons
  - **Spin the Wheel (`/spin`)** — wheel circle and recipe list stubs
- Pages without async content (Login, 403) are excluded.
- A global `RouteChangeIndicator` component shows a loading overlay for all internal navigation.
- Optional inline skeletons on each page cover cases where data re-fetches while the user is already on the page.

## Design

### Data Model
No changes.

### API Changes
No changes.

### UI Changes

#### Global route change indicator
`components/RouteChangeIndicator.tsx` — listens for clicks on internal navigation links, shows an overlay with spinner until the pathname changes. Placed in the root layout so it's always active.

#### Skeleton primitive
`components/ui/Skeleton.tsx` — a reusable `animate-pulse` gray block component.

#### Per-route skeletons (optional)
`app/[route]/loading.tsx` files provide skeleton layouts for each route using the `Skeleton` primitive. These are fallbacks for async server components but also serve as reference layouts for inline skeletons in client components.

#### Inline client skeletons (optional)
Client components replace `if (loading) return <Spinner>` with `if (loading) return <SkeletonLayout>` to show consistent skeletons on data refetch.

## Out of Scope
- Skeleton animations for dark mode.
- Partial/incremental loading (e.g., paginated infinite scroll).
- Server-side streaming with `<Suspense>`.

## Open Questions
None.

## Implementation Notes
- The app uses client components (`"use client"`) with state-driven loading, so Next.js `loading.tsx` files don't auto-trigger during navigation.
- The `RouteChangeIndicator` global component solves this by intercepting link clicks and showing a loading overlay immediately.
- Skeleton layouts are defined in `loading.tsx` and composition skeletons in client components, keeping loading UI co-located with pages.
