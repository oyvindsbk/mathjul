# Tasks: PWA Support

## Tasks

- [ ] **T1** Install `@ducanh2912/next-pwa`. Verify `npm run build` still succeeds with standalone output.
- [ ] **T2** Create `public/icons/icon-192.png` and `public/icons/icon-512.png`. Simple "M" lettermark on `#0f172a` (slate-900) background is acceptable.
- [ ] **T3** Create `public/manifest.json`: `name: "Matoppskrifter"`, `short_name: "Matjul"`, `display: "standalone"`, `start_url: "/"`, `lang: "no"`, `theme_color: "#0f172a"`, `background_color: "#ffffff"`, icons array (192 + 512).
- [ ] **T4** Update `layout.tsx` metadata: add `manifest`, `themeColor`, `appleWebApp` fields. Add `<link rel="apple-touch-icon">` pointing to icon-192.
- [ ] **T5** Configure `@ducanh2912/next-pwa` in `next.config.ts`: enable SW, set `dest: "public"`, configure `skipWaiting: true`, `clientsClaim: true`, `disable: process.env.NODE_ENV === "development"`.
- [ ] **T6** Configure workbox runtime caching rules in `next.config.ts`:
  - `/api/*` → `NetworkOnly`
  - `/_next/static/*` → `CacheFirst`
  - `/recipes/*` → `StaleWhileRevalidate`
  - `/*.png`, `/icons/*` → `CacheFirst` (maxAgeSeconds: 30 days)
  - `/*` fallback → `NetworkFirst`
- [ ] **T7** Create `public/offline.html`: static HTML page with "Du er offline" message and app branding. Referenced as `fallbackRoutes.document` in workbox config.
- [ ] **T8** Create `UpdatePrompt.tsx` client component: listens for SW `waiting` event via `navigator.serviceWorker`, shows a fixed toast "Ny versjon tilgjengelig" with a "Last inn på nytt" button that calls `skipWaiting` on the waiting SW and reloads.
- [ ] **T9** Add `<UpdatePrompt />` to `layout.tsx` (outside `ProtectedRoute` so it renders on all pages including login).
- [ ] **T10** Verify PWA: build with `npm run build`, serve with `node .next/standalone/server.js`, open in Chrome → DevTools → Application → check manifest loads, SW registers, cache is populated. Run Lighthouse PWA audit — score must be ≥ 90.
- [ ] **T11** Final verification: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`
