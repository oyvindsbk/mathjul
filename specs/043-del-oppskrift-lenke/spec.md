# Feature: Del oppskrift med lenke

## Summary

An authenticated owner can create a secret share link (and matching QR code) for a single recipe.
Anyone holding the link reads that one recipe on a bare page — no sidebar, no navigation, no login —
and gets access to nothing else in the app. The owner can copy the link, show the QR code, and turn
sharing off again.

## Motivation

Today a recipient needs an account on the approved-users whitelist to see a recipe at all. That
makes the ordinary case — sending a recipe to family, a friend, or a dinner guest — impossible
without granting them the whole app. A per-recipe share link decouples "read this one recipe" from
"be a user of mathjul".

## Requirements

### Sharing (owner, authenticated)

- The owner of a recipe can create a share link for it from the recipe detail page.
- The same view shows a QR code encoding the share URL, rendered on screen.
- The link can be copied to the clipboard in one action.
- The owner can turn sharing off, which makes the existing link stop working immediately.
- A recipe has **at most one active share link**. Creating a share when one already exists returns
  the existing link rather than minting a second token — so a link already sent to someone keeps
  working, and the owner never has to reason about which of several links they handed out.
- Turning sharing off and on again produces a **new** token. The old link stays dead; "off" is a
  real revocation, not a pause.
- The link is permanent until the owner turns it off. There is no automatic expiry.
- The UI states plainly that anyone with the link can open the recipe without logging in.
- Only the recipe's owner (or an admin) can create, read, or revoke a share for it.

### Public view (recipient, unauthenticated)

- Opening the share URL renders the recipe without any login step.
- The page shows no sidebar, no bottom navigation, no breadcrumb bar, and no links into the rest of
  the app.
- The share grants access to exactly one recipe. The token is not a session: it cannot be used to
  list recipes, read a different recipe, or reach any other endpoint.
- Content shown: title, description, image, prep/cook time, servings and quantity type,
  ingredients (including sections), instructions (including sections and step images), tips,
  side dishes (as plain text, **not** as links — following a link would be access to a second
  recipe), and the owner's display name.
- Content **withheld**: the owner's email address, likes, group membership, visibility, and every
  editing affordance.
- A revoked, unknown, or malformed token renders a friendly Norwegian "denne delingen finnes ikke
  lenger" page — not a stack trace, and not a redirect to `/login`.
- The page sends `noindex, nofollow` and is excluded in `robots.txt`. The link's secrecy depends on
  it not being indexed.
- Works on mobile and desktop.

### Security

- The share endpoint deliberately **overrides the recipe's own visibility**: a `Private` recipe
  becomes readable by anyone holding the token. That is the point of the feature, and it is the
  owner's explicit act. It is stated here so the behaviour is a decision on record, not a surprise.
- Tokens are 32 bytes from a cryptographic RNG (`RandomNumberGenerator`), base64url-encoded, so a
  token cannot be guessed or enumerated.
- The public read endpoint lives under the `/api/public/` prefix, which `EmailWhitelistMiddleware`
  already exempts. Nothing about the existing whitelist behaviour changes.
- The public endpoint is read-only. No write verb accepts a share token.

## Design

### Data Model

New entity `RecipeShare`:

| Field | Type | Notes |
|---|---|---|
| `Id` | `int` | PK |
| `RecipeId` | `int` | FK → `Recipe`, cascade delete |
| `Token` | `string(64)` | base64url of 32 random bytes; **unique index** |
| `CreatedByEmail` | `string(200)` | who shared it |
| `CreatedAt` | `DateTime` | UTC |
| `RevokedAt` | `DateTime?` | null = active |
| `ExpiresAt` | `DateTime?` | always null for now; present so expiry can be switched on later without a migration |
| `LastAccessedAt` | `DateTime?` | updated on public read, best-effort |

"Active" means `RevokedAt == null && (ExpiresAt == null || ExpiresAt > now)`.

Filtered unique index on `(RecipeId) WHERE RevokedAt IS NULL` enforces the one-active-share rule in
the database, so a double-click cannot create two active shares.

`Recipe` gets **no new column**. Whether a recipe is shared is derived from `RecipeShare`; a
duplicated flag could only ever disagree with it.

Revoked rows are kept rather than deleted, so a dead token stays known-dead instead of becoming an
unknown token that could in principle be reissued.

### API Changes

Paths are English, matching the rest of the API (`/api/recipes/...`); UI copy is Norwegian.

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| `GET` | `/api/recipes/{id}/share` | owner/admin | Active share status: `{ isShared, token?, shareUrl?, createdAt? }` |
| `POST` | `/api/recipes/{id}/share` | owner/admin | Creates a share, or returns the existing active one (idempotent) |
| `DELETE` | `/api/recipes/{id}/share` | owner/admin | Sets `RevokedAt`; 204 also when nothing was active |
| `GET` | `/api/public/recipes/shared/{token}` | none | The shared recipe as `SharedRecipeDto`; 404 if the token is not active |

`shareUrl` is built from a configured public base URL (`Sharing:PublicBaseUrl`, falling back to the
request origin) so the copied link is correct in both local dev and Azure.

`SharedRecipeDto` is a **separate DTO**, not `RecipeDetailDto`. A field added to the detail DTO
later must not silently start leaking onto public pages; the public shape is opt-in per field.

### UI Changes

**Recipe detail page** — a "Del oppskrift" button opens a modal (`ShareRecipeModal`) that:
- creates/loads the share on open,
- shows the URL in a read-only field with a "Kopier lenke" button and copied-confirmation,
- renders the QR code on screen,
- offers "Slå av deling" with a confirm step, since it breaks links already sent.

The button is visible only to the owner/admin — the same condition the edit button already uses.

**Public share page** — `/delt/[token]`, placed in a route group that does not inherit the app
chrome. The current root layout wraps everything in `ProtectedRoute` + `Sidebar` + `BottomNav`, so
the app pages move into a `(app)` route group keeping today's layout, and the share page gets its
own minimal layout with the same fonts and global CSS but no chrome, no `AuthProvider` dependency,
and `robots: { index: false, follow: false }`. Moving pages between route groups does not change
their URLs.

`middleware.ts` adds `/delt` to the public routes so it renders without an `auth_token`.

The recipe body rendering is extracted from `recipes/[id]/client.tsx` into a shared presentational
component used by both the authenticated detail page and the share page, so the two cannot drift
apart.

**QR code** — generated client-side, no new runtime dependency and no image ever leaving the
browser. A small self-contained QR encoder module (`lib/qrcode.ts`) renders to SVG. Rendered on
screen only; downloading it as an image is out of scope.

## Out of Scope

- Sharing several recipes at once, or sharing meal plans, favourites, or groups.
- Editing, commenting, or reacting to a shared recipe.
- A public index or search of shared recipes.
- Time-limited or password-protected shares (`ExpiresAt` exists but stays null).
- Multiple simultaneous active links per recipe.
- Downloading the QR code as a file.
- Any analytics beyond the single `LastAccessedAt` timestamp.

## Open Questions

Resolved before implementation:

- **Permanent or expiring?** Permanent until revoked. `ExpiresAt` is in the schema, unused.
- **Revoke without editing the recipe?** Yes — `DELETE .../share` touches only `RecipeShare`.
- **Several active links per recipe?** No, exactly one.
- **Full content or reduced?** Full recipe content plus the owner's display name; email, likes,
  groups, and visibility withheld.
- **QR on screen or downloadable?** On screen only.
- **Indexable?** No — `noindex, nofollow` plus `robots.txt`.
