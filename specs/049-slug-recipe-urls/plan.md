# Implementation Plan: Readable recipe URLs (slug)

## Approach

Purely frontend, additive change:

1. Add a `slugify`/`recipeHref` helper module.
2. Update the two dynamic route pages to parse the leading numeric id out of
   the `id` param instead of using it verbatim.
3. Update every link-construction site (grep found ~14 files) to use
   `recipeHref(id, title)` instead of `/recipes/${id}`.
4. Update `BreadcrumbBar`'s `getRecipeIdFromPath` to extract the leading digits
   instead of taking the whole segment (it already refetches the recipe by id).

No backend or infrastructure changes — the API is unaffected, it always
received (and still receives) a bare numeric id.

## Stacks Affected

- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **Id-prefix format (`{id}-{slug}`) over `{slug}-{id}` or nested folders**:
  keeps parsing trivial (`match(/^\d+/)`), matches the requirement of "no
  subfolders", and is a common, well-understood pattern (e.g. Trello, YouTube
  playlists).
- **No redirects, no canonicalization**: both `/recipes/7790` and
  `/recipes/7790-anything` resolve identically. Simpler than 301-style
  redirects, avoids extra round trips, and matches "must keep old numeric-only
  links working" without adding failure modes (e.g. a redirect loop bug).
  Stale slugs after a rename are harmless since the slug is never checked.
- **Slug computed client-side from `title`, not stored**: avoids a DB
  migration/backfill and keeps the slug always in sync with the current title.

## Risks

- **Missed link site**: a link still built with bare `/recipes/${id}` would
  still work (per the "old links keep working" requirement) — just less
  pretty. Low risk, not a correctness bug. Mitigated by grepping for all
  `/recipes/` link construction before finishing.
- **BreadcrumbBar id parsing**: must switch from "whole segment" to "leading
  digits" carefully so it still matches `/recipes/[id]/edit` correctly.
