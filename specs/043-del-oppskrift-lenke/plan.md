# Implementation Plan: Del oppskrift med lenke

## Approach

Backend first, then the frontend chrome split, then the UI. The riskiest structural change is the
route-group refactor on the frontend (moving every app page under `(app)` so the share page can
escape `ProtectedRoute`/`Sidebar`), so it gets its own task with a build gate before any share UI is
built on top of it.

Order:

1. `RecipeShare` entity + EF migration.
2. Owner-side endpoints (`GET`/`POST`/`DELETE /api/recipes/{id}/share`) with ownership checks.
3. Public read endpoint under the whitelist-exempt `/api/public/` prefix, with its own DTO.
4. Backend xUnit tests: token secrecy, idempotent create, revocation kills the token, non-owner
   rejected, private recipe readable via token, public DTO withholds email.
5. Frontend route-group split — pure refactor, URLs unchanged, no behaviour change.
6. Extract the recipe body into a shared presentational component.
7. QR encoder module + share modal on the detail page.
8. Public `/delt/[token]` page with `noindex` and a friendly dead-link state.
9. Playwright E2E: owner shares, copies, opens the link in a context with no cookies, revokes,
   link dies.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **`/api/public/` prefix for the public read** — `EmailWhitelistMiddleware` already exempts it and
  the exemption is documented in that file. Reusing it means no middleware change and no new hole.
- **Separate `SharedRecipeDto`** rather than reusing `RecipeDetailDto`. Reuse would mean any field
  added to the detail DTO in future automatically appears on an unauthenticated page. Opt-in per
  field is the only version of this that stays safe as the recipe model grows.
- **One active share, enforced by a filtered unique index** — not just by application logic, so
  concurrent requests cannot both insert.
- **Revoke mints a new token on re-share** rather than reactivating the old row. "Off" has to mean
  the link you already sent is dead.
- **Keep revoked rows** so a dead token is distinguishable from a never-existed token, and can never
  be reissued.
- **Route groups over a second layout hack** — Next's `(app)` / share-page split is the framework's
  own answer to "one page without the shell". URLs are unaffected.
- **Self-written QR encoder** instead of a dependency. CLAUDE.md says not to add unnecessary
  dependencies; QR generation for a short ASCII URL is a contained, well-specified algorithm and
  keeps the client free of a new package.
- **Side dishes as text, not links** on the public page — a link would hand the recipient a second
  recipe, breaking the one-recipe guarantee.
- **English API paths, Norwegian UI copy**, matching the existing codebase.

## Risks

- **Route-group refactor touches every page.** Mitigation: its own task, no logic changes in it, and
  `npm run build` plus the existing Playwright smoke suite as the gate before continuing.
- **Public endpoint leaking more than intended.** Mitigation: separate DTO, plus a test asserting
  the payload contains no email address.
- **The share page accidentally inheriting `AuthProvider`/`ProtectedRoute`** and bouncing anonymous
  visitors to `/login`. Mitigation: `middleware.ts` public-route entry, a dedicated layout, and an
  E2E test that loads the URL in a fresh browser context with no cookies.
- **Hand-rolled QR encoder producing unscannable codes.** Mitigation: verify the rendered matrix
  decodes back to the URL, and keep the module small enough to test directly.
- **Copied link wrong in production** if built from the request origin behind a proxy. Mitigation:
  `Sharing:PublicBaseUrl` config with an origin fallback.
