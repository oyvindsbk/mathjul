# Feature: PWA Support

## Summary
Add Progressive Web App support so users can install the app to their home screen and access previously viewed recipes offline.

## Motivation
Cooking context means unreliable network (phone in pocket, screen locked, spotty kitchen wifi). PWA support allows the app to feel native, load instantly on repeat visits, and keep recipes readable even when offline.

## Requirements

- **P1** `manifest.json` with app name, icons, theme color, `display: standalone`, lang `no`
- **P2** App icons: 192×192 and 512×512 PNG
- **P3** Service worker registered via `@ducanh2912/next-pwa` (compatible with Next.js 15 standalone output)
- **P4** Cache strategies:
  - `/api/*` → `NetworkOnly` (never cache auth/data endpoints)
  - Recipe pages → `StaleWhileRevalidate`
  - Images → `CacheFirst` (30-day max-age)
  - App shell / static JS+CSS → `CacheFirst`
- **P5** Static offline fallback page shown when network unavailable and route not cached
- **P6** `layout.tsx` updated with PWA meta tags: `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `theme-color`, apple touch icon
- **P7** `UpdatePrompt.tsx` component: listens for service worker `waiting` event, shows "Ny versjon tilgjengelig — last inn på nytt" toast. User can dismiss or reload.
- **P8** Lighthouse PWA score ≥ 90 on production build

## Design

### Library Choice
`@ducanh2912/next-pwa` — the actively maintained fork of `next-pwa` that works with Next.js 15 and standalone output mode. Configured entirely in `next.config.ts`, no ejection needed.

### Cache Strategy Detail
| Route pattern | Strategy | Rationale |
|---|---|---|
| `/api/*` | NetworkOnly | Auth cookies and live data must never be stale |
| `/_next/static/*` | CacheFirst | Hashed filenames — safe to cache forever |
| `/icons/*`, `/*.png` | CacheFirst 30d | Static assets |
| `/recipes/*` | StaleWhileRevalidate | Show instantly, refresh in background |
| `/*` (other pages) | NetworkFirst | Fresh by default, cached as fallback |

### Offline Page
`public/offline.html` — static HTML (no React), shown by the SW when a navigation request fails. Minimal: app name, "Du er offline" message, and a note that previously visited recipes may still be available (user can navigate back).

## Out of Scope
- Push notifications
- Background sync for writes
- IndexedDB offline data store
- "Add to Home Screen" prompt logic (browser handles natively)

## Open Questions
- None.
