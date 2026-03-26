# Implementation Plan: Skeleton Loading Screens

## Approach

**Global route change indicator** + **Per-page skeleton layouts**

1. **RouteChangeIndicator component** — listens for clicks on internal navigation links and shows a loading overlay immediately. The overlay persists until `usePathname()` changes (indicating route navigation completed).

2. **Skeleton primitive** — a reusable `animate-pulse` block component for building layout-matched skeleton designs.

3. **Per-page skeletons** — `loading.tsx` files at each route segment (fallback pattern) + inline skeleton markup in client components for data refetch cases.

This approach works with the current client-side navigation architecture (all pages are `"use client"` with `useState` for loading). The `loading.tsx` convention alone doesn't work because it requires async server components and Suspense boundaries.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **Global route change indicator over `loading.tsx`**: Since pages are client components, `loading.tsx` doesn't auto-trigger. The global indicator intercepts navigation at the document level, providing immediate feedback for all link clicks.
- **RouteChangeIndicator uses `usePathname()`**: Automatically resets loading state when the pathname changes, indicating the new page has mounted.
- **Tailwind `animate-pulse`**: No new dependencies; matches existing design system.
- **Link click detection**: Intercepts clicks with `capturing` phase listener to catch all internal navigation clicks before they propagate.

## Risks

- **Router.push() calls not caught**: The RouteChangeIndicator catches link clicks but not programmatic `router.push()` calls. If pages use navigation buttons with `onClick` handlers that call `router.push()`, they won't show the overlay. → Mitigated by ensuring all nav buttons use `<Link>` or wrapping `router.push()` calls to set loading state.
- **Slow data loads after route change**: If the new page's data fetch takes >5 seconds, users might dismiss the overlay mentally before the page loads. → Acceptable trade-off; the inline skeletons on the target page provide continued feedback.

## Next Steps
- Monitor for any `router.push()` calls in the app and ensure they're wrapped or replaced with `<Link>`.
- Test with slow network conditions (DevTools throttle) to ensure the UX feels responsive.
