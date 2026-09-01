# Feature: Readable recipe URLs (slug)

## Summary

Recipe detail (and edit) URLs currently look like `/recipes/7790`. Add the recipe
name to the URL, e.g. `/recipes/7790-lasagne-med-sopp`, so links are more
readable and shareable, while keeping the numeric id as the source of truth for
lookups and keeping old numeric-only links (`/recipes/7790`) working unchanged.

## Motivation

Numeric-only URLs give no indication of what a link points to when shared (chat,
bookmarks, browser history). Sites like godt.no put the recipe name in the URL.
We want the same readability without introducing a second identifier or a
database migration — the id remains authoritative, the slug is a purely
cosmetic, generated-on-the-fly suffix.

## Requirements

- Recipe detail page URL becomes `/recipes/{id}-{slug}`, where `{slug}` is a
  URL-safe, lowercase, hyphenated version of the recipe title (Norwegian
  characters æøå transliterated, e.g. "Lasagne med sopp" → `lasagne-med-sopp`).
- `/recipes/{id}` (no slug) must keep working exactly as before — it must not
  redirect, error, or break any existing bookmark, share, or integration
  (weekly planner, groups, likes, etc. all reference recipes by bare id today).
- `/recipes/{id}-{anything}` resolves to the same recipe as `/recipes/{id}` —
  the slug is never validated or used for lookup, only for display/readability.
  This means a stale slug (after a recipe is renamed) still resolves correctly.
- The recipe edit page (`/recipes/{id}/edit`) gets the same treatment for
  consistency, e.g. `/recipes/7790-lasagne-med-sopp/edit`.
- All places in the app that construct a link to a recipe (recipe cards, home
  dashboard, breadcrumbs, sidebar navigation, side-dish references, weekly
  planner day modal, shared-recipe page, snurr-mathjulet, group detail) build
  the slugged URL instead of the bare id.
- No backend changes: the API continues to key recipes by `{id:int}` only. The
  frontend extracts the leading numeric id from the URL param before calling
  the API.

## Design

### URL format

`/recipes/{id}-{slug}` — single path segment, hyphen-joined, no subfolders.
The numeric id is always the leading part up to the first hyphen, so parsing is
a simple `parseInt` on the route param.

### Slug generation

A shared `slugify(title: string): string` helper:
- lowercase
- transliterate æ→ae, ø→o, å→a (and common accented Latin chars)
- replace runs of non-alphanumeric characters with a single hyphen
- trim leading/trailing hyphens
- empty result (e.g. title is only symbols) falls back to no slug — link is
  just `/recipes/{id}`

A shared `recipeHref(id: number, title: string): string` helper builds
`/recipes/{id}-{slug}` (or `/recipes/{id}` if slug is empty), used by every
recipe link site in the app.

### Route handling

`/recipes/[id]/page.tsx` and `/recipes/[id]/edit/page.tsx` parse the numeric id
out of the `id` route param (`param.match(/^\d+/)`) before passing it to
`recipeService.getRecipeById`. If the param doesn't start with digits, treat as
not-found (existing "Oppskrift ikke funnet" state).

## Out of Scope

- Changing the id to a slug-based primary key, or adding a `slug` column to the
  database.
- Canonical redirects from `/recipes/{id}` to the slugged URL (both forms are
  treated as equally valid, permanently).
- SEO metadata / sitemap changes.

## Open Questions

None — resolved during planning.
