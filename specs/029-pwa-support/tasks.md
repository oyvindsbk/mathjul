# Tasks: PWA Support

## Tasks

- [x] **T1** Install `serwist` and `@serwist/next`. Verify `npm run build` still succeeds with standalone output.
- [x] **T2** Create `public/icons/icon-192.png` and `public/icons/icon-512.png`. Simple "M" lettermark on `#0f172a` (slate-900) background.
- [x] **T3** Create `public/manifest.json`: `name: "Matoppskrifter"`, `short_name: "Matjul"`, `display: "standalone"`, `start_url: "/"`, `lang: "no"`, `theme_color: "#0f172a"`, `background_color: "#ffffff"`, icons array (192 + 512).
- [x] **T4** Update `layout.tsx` metadata: add `manifest`, `appleWebApp`, viewport `themeColor`. Add `<link rel="apple-touch-icon">` pointing to icon-192.
- [x] **T5** Configure `@serwist/next` in `next.config.ts`: `swSrc: "src/app/sw.ts"`, `swDest: "public/sw.js"`, `disable: process.env.NODE_ENV === "development"`.
- [x] **T6** Create `src/app/sw.ts` with Serwist runtime caching rules:
  - `/api/*` → `NetworkOnly`
  - `/recipes/*` → `StaleWhileRevalidate`
  - `/*.png`, `/icons/*` → `CacheFirst` (maxAgeSeconds: 30 days)
  - `/*` fallback → `NetworkFirst`
  - Offline document fallback → `/offline.html`
- [x] **T7** Create `public/offline.html`: static HTML page with "Du er offline" message and app branding.
- [x] **T8** Create `UpdatePrompt.tsx` client component: listens for SW `waiting` event via `navigator.serviceWorker`, shows a fixed toast "Ny versjon tilgjengelig" with a "Last inn på nytt" button that posts `SKIP_WAITING` to the waiting SW and reloads.
- [x] **T9** Add `<UpdatePrompt />` to `layout.tsx` (outside `ProtectedRoute`).
- [x] **T10** Remove `--turbopack` from `build` script in `package.json` (Serwist webpack plugin incompatible with Turbopack). Dev script keeps Turbopack.
- [x] **T11** Final verification: `cd frontend && npm run lint && npx tsc --noEmit && npm run build` — all pass. `public/sw.js` generated (40KB).
