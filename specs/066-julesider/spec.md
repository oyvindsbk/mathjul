# Feature: Julesider — a festive Christmas section

## Summary
A new page at `/jul` that shows every recipe tagged **Jul**, grouped into festive sections, with a full Christmas mood: its own palette, a Christmas title font, falling snow, a twinkling lights border and a countdown to julaften. Recipes get the tag through a new **Jul** category. A link to the page shows in the navigation during the Christmas season.

## Motivation
Christmas cooking (julebakst, julemiddag, gløgg) is the most seasonal and most revisited part of the family's recipe collection. Today those recipes are scattered across Søtbakst, Middag and Drikke, with nothing tying them together. A dedicated, festive section makes them easy to find every December and makes the site feel alive in the season.

## Current state (verified in code, 2026-11-18)

| Piece | Status |
|---|---|
| Christmas category / tag | ❌ none. Categories are seeded via `HasData` (ids 1–17, groups Måltidstype / Vanskelighetsgrad / Tilberedningstid) |
| `GET /api/recipes?categories=…` filter (OR within group, AND across groups) | ✅ exists, so the page needs no new endpoint |
| Precedent for a well-known category page query | ✅ `recipeService.getTilbehorRecipes()` → `getAllRecipes(token, [TILBEHOR_CATEGORY_ID])` |
| `RecipeDto.categories` returned in list | ✅ so sections can be computed client-side |
| Jev classifier skips groups with < 2 options (`JevRequest.cs`) | ✅ a single-option "Anledning" group is never auto-suggested by Jev |
| LLM extraction prompt gets the full category list (`BuildCategoryListJsonAsync`) | ⚠️ Jul must be excluded, or the LLM will suggest it |
| Theme | Tailwind v4, plain `--background`/`--foreground` tokens in `globals.css`, Geist via `next/font/google` |
| Nav | `Sidebar.tsx` (desktop, 5 main links), `BottomNav.tsx` (mobile, 5 items, full) |

## Requirements

### Tagging
- R1: New seeded category **Jul** (id `18`) in a new group **Anledning** (occasion). It appears in the recipe form and in the category filter on Alle oppskrifter automatically, since groups render from the API.
- R2: Jul is **not** auto-suggested during AI extraction (v1). It is excluded from the category list sent to the LLM. Jev already skips it as a single-option group, and a test locks that in.
- R3: Tagging is done by hand, by ticking Jul in the recipe form like any category. No bulk-tagging tool.

### The /jul page
- R4: Route `/jul` (inside the `(app)` group, so the same auth as the rest of the site). Lists every Jul recipe visible to the user, through the existing visibility rules.
- R5: Recipes are grouped into sections by their Måltidstype category. Each recipe appears **once**, in the first matching section in this order:
  1. **Julebakst og kaker** — Søtbakst (6), Kake (17)
  2. **Julemiddag** — Middag (3)
  3. **Tilbehør** — Tilbehør (16)
  4. **Desserter** — Dessert (4)
  5. **Drikke** — Drikke (8)
  6. **Mer jul** — everything else

  Empty sections are hidden. Within a section, recipes sort by title.
- R6: Cards reuse `RecipeGridCard` (link, image, heart/like) inside a festive frame, without forking the card.
- R7: **Empty state** (no Jul recipes): festive message explaining how to tag a recipe with Jul, with a link to Alle oppskrifter.
- R8: Loading and error states follow existing page patterns. The mock fallback includes a few Jul-tagged mock recipes.

### Christmas mood (page-only; the rest of the site is unchanged)
- R9: **Palette** scoped to a `.jul-theme` wrapper: deep red, pine green, gold and snow white as CSS variables, with a dark-mode variant (night sky). Text contrast must meet WCAG AA.
- R10: **Title font**: a Christmas display font (e.g. *Mountains of Christmas*) via `next/font/google`, used for the page heading and section headings only. Body text stays Geist. No new npm dependency.
- R11: **Snow**: CSS/lightweight animated snowflakes over the page, `aria-hidden`, `pointer-events: none`, ≤ ~40 flakes, GPU-friendly (transform/opacity only).
- R12: **Twinkling lights** border/garland across the page header, CSS-only.
- R13: **Countdown** to julaften (24 Dec, Europe/Oslo):
  - before 24 Dec: "N dager til julaften" (and "I morgen er det julaften!" on the 23rd)
  - 24–26 Dec: "God jul! 🎄"
  - 27 Dec – 6 Jan: "Godt nytt år!"
  - outside the season: days to next julaften
- R14: **Motion safety**: with `prefers-reduced-motion: reduce`, snow and twinkling are off (static decorations remain). A visible "Snø av/på" toggle also exists, remembered in `localStorage` (try/catch, default on).

### Seasonal navigation
- R15: Between **1 Nov and 6 Jan** (inclusive, Europe/Oslo), the desktop `Sidebar` shows a "Jul 🎄" main link to `/jul`.
- R16: Mobile: `BottomNav` is full (5 items), so during the season the home page (`HomeDashboard`) shows a festive "Jul på mathjul" card linking to `/jul` instead of a 6th nav item.
- R17: Outside the season the links are hidden, but `/jul` still works by direct URL.
- R18: Season logic lives in one pure helper (`lib/jul.ts`: `isJulSeason(date)`, `julCountdown(date)`) with unit coverage through Playwright clock control or a small pure test.

## Design

### Data Model
- `Category { Id = 18, Name = "Jul", Group = "Anledning" }` added to `HasData`.
- `RecipeCategories.JulId = 18`, `JulName = "Jul"`, `OccasionGroup = "Anledning"`.
- EF migration `AddJulCategory` (insert seed row, Down deletes it).
- Frontend: `JUL_CATEGORY_ID = 18` next to `TILBEHOR_CATEGORY_ID`, plus a mock category and mock recipes.

### API Changes
- None new. `BuildCategoryListJsonAsync` excludes `RecipeCategories.JulId`.

### UI Changes
- `frontend/src/app/(app)/jul/page.tsx` (+ `loading.tsx`) loads recipes, groups them and renders the themed page.
- `frontend/src/components/jul/`: `JulTheme` (wrapper + palette), `Snowfall`, `JulLights`, `JulCountdown`, `JulSection`.
- `frontend/src/lib/jul.ts` holds the season and countdown helpers and the section grouping (pure functions).
- `recipeService.getJulRecipes(token)`.
- `Sidebar.tsx` gets the seasonal link. `HomeDashboard.tsx` gets the seasonal card.

## Out of Scope
- AI auto-suggesting Jul (possible later, with a classifier description like Tilbehør's).
- Site-wide Christmas theme (snow on every page, logo hat, etc.).
- Other occasions (påske, 17. mai, bursdag). The "Anledning" group makes them easy to add later.
- Bulk-tagging existing recipes. They are tagged by hand via edit.
- Christmas meal-plan templates or a julemeny builder.
- Music/sound.

## Open Questions
- ~~Tagging model~~: decided, new category Jul in group Anledning (2026-11-18).
- ~~Nav visibility~~: decided, seasonal 1 Nov – 6 Jan (2026-11-18).
- ~~Mood~~: decided, full festive (snow, countdown, lights, sections) (2026-11-18).
- Mobile entry point: **proposed** home-page card instead of a 6th BottomNav item. Confirm at review.
- Should recipes tagged Jul also show a small 🎄 badge elsewhere (cards on Alle oppskrifter)? **Proposed:** no, out of scope for v1.
