# Implementation Plan: Heftymesterskapet — offentlig visning, redigering bak innlogging

## Approach

Work from the server outward, so the security boundary is real before any UI depends on it.

1. **Editor list + authorization service.** A `HeftyMesterskapetEditorService` that loads emails
   from Key Vault (`heftymesterskapet-editors`) or configuration, caches them for 5 minutes, and
   answers "is this email an editor". Mirrors the loading strategy already proven in
   `EmailWhitelistMiddleware` without entangling the two lists.
2. **Split the controller.** Reads stay on `/api/public/heftymesterskapet`. Writes move to
   `/api/heftymesterskapet` and consult the editor service. Exempt the new prefix from
   `EmailWhitelistMiddleware` so the recipe-app whitelist does not shadow the editor check.
3. **Session endpoint + handoff.** `GET /api/heftymesterskapet/me` for mode detection, and the
   one-time code exchange that gets the JWT onto the backend-origin page.
4. **Frontend return target.** Teach the login flow to honour a validated return URL.
5. **Page modes.** Thread a single `canEdit` flag through the existing render functions.

Backend tests land with the code they cover rather than in a trailing task, so each step leaves
the suite green.

## Stacks Affected

- [x] Frontend — login return-target handling only
- [x] Backend — editor service, controller split, session/handoff endpoints, static page
- [ ] Infrastructure — no Bicep change; the Key Vault secret is created out-of-band, exactly as
      `approved-users` is today (see `modules/key-vault.bicep:35`)

## Key Decisions

- **Separate list, separate mechanism.** Editor rights are checked by a dedicated service, not by
  extending `EmailWhitelistMiddleware`. The middleware answers a different question against a
  different list; overloading it would make "recipe user" and "competition editor" drift into each
  other and is exactly the coupling the user asked to avoid.
- **Move writes off `/api/public/`.** The prefix is the middleware's exemption rule. Leaving writes
  under it and checking rights inside the controller would work, but the path would then advertise
  as public something that is not — a trap for the next change. The prefix should tell the truth.
- **Handoff code, not a token, in the URL.** Redirect URLs leak into browser history, server logs,
  and `Referer`. A single-use, short-lived code that is immediately exchanged and stripped keeps a
  24-hour JWT out of those places.
- **Validate the return target against an allowlist.** An unchecked return parameter turns the
  login into an open redirect that would forward the handoff code to any origin.
- **One page, two modes.** The ranking, totals, and table rendering are most of the 649 lines. A
  second read-only page would duplicate all of it and guarantee divergence.
- **Fail closed.** An unreadable or empty editor list denies editing. A read failure must not be a
  path to unauthenticated writes.
- **No schema change.** Nothing about the competition data model needs to differ.

## Risks

- **Middleware ordering.** `UseStaticFiles` runs before the whitelist middleware, and the new
  `/api/heftymesterskapet` prefix must be exempted from it or the recipe whitelist will reject
  editors who are not recipe users. Covered by an explicit test that a non-recipe-user editor can
  write.
- **Silently breaking the live page.** The page and API ship together, but a stale cached page
  could `PUT` to the old path. Mitigated by keeping the change atomic and verifying the deployed
  page after release; the old write paths are removed, so a stale page fails loudly rather than
  writing unprotected.
- **Cross-origin request from page to backend.** The page is same-origin with the API, so CORS is
  not involved for its own calls — but the login round trip crosses origins. Verify against the
  deployed CORS policy, not just locally.
- **Locking out the current scorekeepers.** Until the Key Vault secret is populated, nobody can
  edit. Confirm the editor emails with the user and seed the secret as part of deploy.
- **Local development.** `AllowUnauthenticated` short-circuits the whitelist middleware in dev; the
  editor check must behave predictably there, so dev mode is handled explicitly rather than
  inherited by accident.
