# Tasks: Del oppskrift med lenke

## Tasks

- [x] Task 1: Add the `RecipeShare` entity, `DbSet`, and EF configuration (unique index on `Token`,
      filtered unique index on `RecipeId WHERE RevokedAt IS NULL`, cascade delete from `Recipe`), and
      generate the migration. Gate: `dotnet build` + `dotnet test`.

- [x] Task 2: Add owner-side share endpoints to `RecipesController` — `GET`, `POST` (idempotent:
      returns the existing active share), `DELETE` (revoke) on `/api/recipes/{id}/share`. Tokens from
      `RandomNumberGenerator`, base64url. Ownership/admin check on all three, 404 for a missing
      recipe, 403 for a non-owner. `shareUrl` from `Sharing:PublicBaseUrl` with request-origin
      fallback. Gate: `dotnet build`.

- [x] Task 3: Add the public read endpoint `GET /api/public/recipes/shared/{token}` with its own
      `SharedRecipeDto` (recipe content + owner display name; no email, likes, groups, or
      visibility). Ignores the recipe's own visibility, resolves only active tokens, 404 otherwise,
      best-effort `LastAccessedAt` update. Gate: `dotnet build`.

- [x] Task 4: Backend xUnit tests in `backend/RecipeApi.Tests/Recipes/`: create returns a token;
      second create returns the same token; revoke makes the token 404; re-share after revoke yields
      a different token; non-owner gets 403 on all three owner endpoints; a `Private` recipe is
      readable through an active token; the public payload contains no email address. Gate:
      `dotnet test`.

- [x] Task 5: Frontend refactor — move the existing app pages into a `(app)` route group carrying
      today's root layout (`AuthProvider`, `ProtectedRoute`, `Sidebar`, `BreadcrumbBar`, `BottomNav`),
      leaving a minimal root layout with only fonts and global CSS. Pure refactor: no URL and no
      behaviour changes. Gate: `npm run lint`, `npx tsc --noEmit`, `npm run build`, plus the existing
      Playwright suite.

- [x] Task 6: Extract the recipe body rendering from `recipes/[id]/client.tsx` into a shared
      presentational component (ingredients incl. sections, instructions incl. sections and step
      images, tips, times, servings, side dishes), with a prop controlling whether side dishes render
      as links or plain text. Detail page keeps behaving exactly as today. Gate: lint, typecheck,
      build.

- [x] Task 7: Add `lib/qrcode.ts` — a self-contained QR encoder rendering an SVG for a URL-length
      ASCII string — and verify the generated matrix decodes back to the input. Gate: lint,
      typecheck, build.

- [x] Task 8: Add `ShareRecipeModal` and the "Del oppskrift" button on the recipe detail page, owner/
      admin only: creates or loads the share, shows the URL with a copy button and confirmation, the
      QR code on screen, wording that anyone with the link can open it, and "Slå av deling" behind a
      confirm step. Gate: lint, typecheck, build.

- [x] Task 9: Add the public `/delt/[token]` page with its own chrome-free layout, `noindex, nofollow`
      metadata, `robots.ts` excluding `/delt/`, the shared recipe body, the owner's display name, and
      a friendly Norwegian dead-link state. Add `/delt` to the `middleware.ts` public routes. Gate:
      lint, typecheck, build.

- [x] Task 10: Playwright E2E in `frontend/tests/e2e/del-oppskrift.spec.ts`: owner opens the modal and
      gets a link; the link opens in a fresh context with no cookies and shows the recipe; the page
      has no sidebar/bottom-nav; revoking makes the link show the dead-link state. Gate: lint,
      typecheck, build, `npx playwright test`.

- [x] Task 11: Final verification — full inner loop on both stacks, the review agents
      (arch/security/performance), and a Playwright MCP walkthrough of share → copy → open → revoke.
