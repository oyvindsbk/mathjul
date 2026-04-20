# Implementation Plan: PWA Support

## Approach
Add PWA infrastructure in three phases: (1) manifest + icons + meta tags so the app is installable, (2) service worker with cache strategies for offline support, (3) update prompt UX. Verify with a local production build and Lighthouse after each phase.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **`@ducanh2912/next-pwa` over manual workbox:** Handles SW registration, workbox config, and standalone output compatibility. The original `next-pwa` is unmaintained; this fork is the community standard for Next.js 13+.
- **`NetworkOnly` for `/api/*`:** Auth tokens and recipe data must always come from the network. Caching any auth endpoint risks serving stale credentials or session state, which would cause hard-to-debug auth failures.
- **`StaleWhileRevalidate` for recipe pages:** A user mid-cook gets an instant response from cache; the SW refreshes the cache in the background. If they reload, they get the latest version.
- **Static `offline.html` (not a React page):** The service worker must be able to serve the offline fallback without the Next.js runtime. A plain HTML file in `public/` is reliable across all cache miss scenarios.
- **`skipWaiting: true` + update toast:** Without this, a new SW waits for all tabs to close before activating — users could run stale code indefinitely. The toast lets them opt-in to the update immediately.

## Risks
- **`next-pwa` + standalone output path:** The generated `sw.js` must end up at the correct public URL. Verify the output dir after build (`out/standalone/public/sw.js` or `.next/static/`). Mitigation: test with `node .next/standalone/server.js` locally before declaring done.
- **iOS Safari PWA quirks:** iOS has partial PWA support — no push, limited SW scope. `apple-mobile-web-app-capable` meta tag is required for standalone mode on iOS. Test on Safari iOS simulator.
- **Cache-busting after deploy:** If a user has a cached app shell from a previous deploy, the new SW version triggers the update prompt. Ensure `skipWaiting` + `clientsClaim` are both set so new SW takes over cleanly.
