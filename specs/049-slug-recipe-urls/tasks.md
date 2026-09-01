# Tasks: Readable recipe URLs (slug)

## Tasks

- [x] Task 1: Add `slugify`/`recipeHref` helper (new module, e.g.
      `frontend/src/lib/recipe-url.ts`) with unit-level coverage for
      transliteration (æøå), symbol stripping, and empty-title fallback.
      (No unit test framework exists in this project yet — covered instead by
      lint/typecheck/build plus the Task 5 Playwright verification.)
- [x] Task 2: Update `/recipes/[id]/page.tsx` and `/recipes/[id]/edit/page.tsx`
      (and their client components) to parse the leading numeric id out of the
      route param before calling `recipeService`, and to build the edit/back
      links using `recipeHref`.
- [x] Task 3: Update `BreadcrumbBar.tsx`'s `getRecipeIdFromPath` to extract the
      leading numeric id from the path segment, and verify breadcrumbs still
      resolve on both slugged and bare-id URLs.
- [x] Task 4: Update all remaining recipe-link sites to use `recipeHref`
      instead of `/recipes/${id}`: `RecipeGridCard.tsx`, `RecipeBody.tsx`
      (side dish links), `Sidebar.tsx`, `HomeClient.tsx`, `HomeDashboard.tsx`,
      `ukesplanlegger/DayDetailModal.tsx`, `snurr-mathjulet/client.tsx`,
      `grupper/[id]/page.tsx`, `(share)/delt/[token]/client.tsx`,
      `recipes/[id]/client.tsx` (side-dish and self links).
- [x] Task 5: Manual verification with Playwright MCP — visit a recipe via a
      slugged link from the recipe list, confirm the URL shows the slug,
      confirm a bare `/recipes/{id}` URL still loads the same recipe, confirm
      edit page and breadcrumbs work on both forms.
