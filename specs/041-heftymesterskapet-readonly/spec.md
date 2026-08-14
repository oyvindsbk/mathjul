# Feature: Heftymesterskapet — offentlig visning, redigering bak innlogging

## Summary

Split Heftymesterskapet into a public read-only view that anyone with the link can see, and an
edit mode restricted to a dedicated list of editor emails — separate from the recipe app's
`approved-users` whitelist. The split is enforced server-side: `GET` stays public, all writes
move behind authentication.

## Motivation

Today every part of Heftymesterskapet is public. `wwwroot/heftymesterskapet.html` is served before
the auth middleware, and its API sits under the `/api/public/` prefix that
`EmailWhitelistMiddleware` exempts wholesale. Anyone holding the link can add participants, edit
results, or press "Nullstill denne konkurransen" and wipe the competition — and anyone who finds
the endpoint can do the same with `curl`, no browser needed.

The competition should be shareable for viewing (that is the point of the page) without handing
every viewer the ability to rewrite the scoreboard. Scorekeepers are a small, known group and are
not the same set of people as the recipe app's users, so they need their own list.

## Requirements

### Access control

- Reading a competition (`GET`) remains fully public and unauthenticated.
- Creating, updating, and deleting competitions requires an authenticated editor.
- Editor authorization is checked against a **separate** list of emails, independent of
  `approved-users`. Being a recipe-app user grants no edit rights, and being an editor grants no
  recipe-app access.
- Enforcement is server-side. Hiding controls in the browser is presentation only and must never
  be the sole protection.
- The editor list is read from Key Vault secret `heftymesterskapet-editors` in production and from
  the `HeftyMesterskapetEditors` configuration section locally, mirroring how `approved-users`
  works today. Emails compare case-insensitively; the list is cached with the same 5-minute expiry.
- An empty or unreadable editor list denies edit access; it never falls open.

### Page behaviour

- One page in two modes, not two pages. The ranking and totals rendering is the bulk of the file
  and must not be duplicated.
- **Read-only mode (default, unauthenticated):** the participant list, per-event results, and the
  combined standings are all visible. The "legg til deltaker" row, per-participant remove buttons,
  the result input fields, and the reset button are absent. Results appear as text.
- **Edit mode (authenticated editor):** the page behaves exactly as it does today.
- The page shows a "Logg inn for å redigere" affordance in read-only mode, and an indication of
  who is signed in (plus a way to sign out) in edit mode.
- A signed-in user who is *not* on the editor list is told they lack access, and stays in
  read-only mode rather than seeing controls that would fail on save.
- If the session expires while editing, a save attempt returns 401 and the page reports it as an
  auth problem rather than a generic "Kunne ikke lagre", keeping the unsaved state so nothing is
  lost.

## Design

### Data Model

No schema changes. `HeftyMesterskapetCompetition` and `HeftyMesterskapetState` are unchanged, and
no migration is required.

### API Changes

The write endpoints move out of the `/api/public/` prefix so the existing middleware stops
exempting them. Read endpoints stay where they are, so nothing about the public path changes.

| Method | Before | After | Access |
|---|---|---|---|
| GET | `/api/public/heftymesterskapet/competitions` | unchanged | public |
| GET | `/api/public/heftymesterskapet/competitions/{slug}` | unchanged | public |
| POST | `/api/public/heftymesterskapet/competitions` | `/api/heftymesterskapet/competitions` | editor |
| PUT | `/api/public/heftymesterskapet/competitions/{slug}/state` | `/api/heftymesterskapet/competitions/{slug}/state` | editor |
| DELETE | `/api/public/heftymesterskapet/competitions/{slug}` | `/api/heftymesterskapet/competitions/{slug}` | editor |

New endpoint:

- `GET /api/heftymesterskapet/me` — returns `{ email, isEditor }` for the current caller, or a
  signed-out result. The page calls this on load to decide which mode to render. It must not
  require editor rights itself, or a non-editor could not be told they lack them.

The controller splits into a public read controller and an editor-only write controller. Editor
authorization lives in a dedicated service consulted by the write controller, rather than being
bolted into `EmailWhitelistMiddleware` — the middleware answers "may this person use the recipe
app", which is a different question with a different list.

Because the write paths leave `/api/public/`, `EmailWhitelistMiddleware` will now challenge them
with the recipe-app whitelist before the editor check ever runs. The new paths must therefore be
exempted from that middleware and authorized by the editor service instead, so the two lists stay
genuinely independent.

### Authentication flow

The page is a static file served from the **backend** origin. Google OAuth runs in the **frontend**
Next.js app on a **different** origin. The two do not share cookies, and the existing callback
obtains the app JWT server-to-server (`api/auth/google/callback/route.ts` calls
`/api/auth/google-token` from the server), so the backend's `Set-Cookie` never reaches the browser
— the browser's `auth_token` is set by the frontend, on the frontend origin.

The JWT must therefore be handed to the backend-origin page explicitly:

1. The page sends the editor to the frontend login with a return target pointing back at the page.
2. The frontend completes Google OAuth exactly as it does today.
3. On success the frontend redirects back to the page with a **one-time, short-lived handoff code**
   in the URL, rather than the JWT itself — a token in a URL lands in history, logs, and the
   `Referer` header.
4. The page exchanges that code at the backend for the JWT, stores it, strips the code from the
   URL, and sends the JWT as a `Bearer` header on writes.

Only return targets on a known-safe origin are accepted, so the login cannot be turned into an
open redirect that forwards a handoff code to an attacker.

### UI Changes

Confined to `wwwroot/heftymesterskapet.html`. Rendering functions take the current mode into
account: `renderChips` omits remove buttons, `renderEventPanel` renders results as text instead of
`<input>`, and the participant-add row, reset button, and save/status line are hidden when
read-only. No frontend React changes beyond honouring the return target on the login page.

## Out of Scope

- Per-editor attribution (who entered which result).
- An admin UI for managing the editor list — it is edited in Key Vault, like `approved-users`.
- Rewriting the page as a Next.js route.
- Changing the scoring rules, events, or the competition data model.
- Rate limiting the public read endpoints.

## Open Questions

- None blocking. Editor list seeding in production (which emails) is an operational step to
  confirm with the user before deploy.
