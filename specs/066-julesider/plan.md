# Implementation Plan: Julesider

## Approach
Add a seeded **Jul** category (group *Anledning*) on the backend and keep it out of AI extraction. Everything else is frontend. A new `/jul` page fetches recipes with the existing category filter (`getAllRecipes(token, [JUL_CATEGORY_ID])`, same as Tilbehør), groups them client-side into festive sections, and renders them inside a page-scoped `.jul-theme` wrapper with snow, lights and a countdown. Seasonal entry points go in the desktop Sidebar and on the mobile home page.

Order: backend category → frontend data plumbing + pure helpers → page with plain layout → festive theme → seasonal nav → E2E + manual check.

## Stacks Affected
- [x] Frontend: `/jul` page, components, helpers, nav and home card
- [x] Backend: seed category + migration, exclusion from extraction list
- [ ] Infrastructure: none

## Key Decisions
- **Category, not a flag:** reuses the form, filter, API and visibility as they are. The new "Anledning" group leaves room for påske / 17. mai later.
- **New group rather than Måltidstype:** the category filter ORs within a group, so Jul in Måltidstype would make "Middag + Jul" mean "Middag OR Jul". As its own group, it ANDs correctly ("Christmas dinners").
- **No new endpoint:** the existing `categories` filter returns exactly what's needed, with categories included for client-side sectioning.
- **Excluded from LLM suggestions:** avoids "anything with cinnamon is Christmas" false positives. Jev skips single-option groups already, and a test pins that so a future second Anledning category doesn't silently enable it.
- **Page-scoped theme:** CSS variables under `.jul-theme` mean no risk of leaking festive styles into the rest of the site, and dark mode is handled inside the wrapper.
- **No new dependencies:** snow and lights are CSS (plus a tiny client component that renders N flakes with randomised CSS vars). The font comes via `next/font/google`, self-hosted at build.
- **Season logic as pure functions in `lib/jul.ts`,** evaluated in Europe/Oslo, so the window and countdown are testable with Playwright's clock API.
- **Mobile entry via home card:** the BottomNav already has 5 items, and a 6th would cramp every tap target all season.

## Risks
- **Seed id collision:** confirm id 18 is free in prod before the migration (ids 1–17 are seeded; categories are only created via HasData, but verify there's no runtime insert path).
- **Hydration mismatch** from random snow positions or date-based countdown: render snow and countdown client-only (mount effect), with stable server output.
- **Performance on low-end phones:** cap flakes, animate transform/opacity only, honour reduced-motion, and offer the toggle.
- **Contrast on festive colours:** check red/green/gold text pairs against AA in both modes.
- **Timezone edge at season boundaries:** compute the date in Europe/Oslo (`Intl.DateTimeFormat` with `timeZone`), not the browser's local time or UTC.
- **Font loading flash:** `display: swap` with a serif fallback. Headings only, so impact is small.
