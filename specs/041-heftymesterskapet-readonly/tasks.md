# Tasks: Heftymesterskapet — offentlig visning, redigering bak innlogging

## Tasks

- [x] Task 1: Editor list service. Add `HeftyMesterskapetEditorService` loading emails from Key
      Vault secret `heftymesterskapet-editors` (prod) or the `HeftyMesterskapetEditors` config
      section (local), with case-insensitive comparison, a 5-minute cache, and fail-closed
      behaviour on read failure or empty list. Register in DI; add the config section to
      `appsettings.Development.json`. Unit tests: known editor allowed, unknown denied, empty list
      denies, case-insensitivity, cache refresh. Verify: `dotnet build`, `dotnet test`.

- [x] Task 2: Split the controller. Keep the two `GET` endpoints on
      `/api/public/heftymesterskapet`. Move `POST`, `PUT /state`, and `DELETE` to
      `/api/heftymesterskapet`, rejecting non-editors with 401 (unauthenticated) or 403 (signed in,
      not an editor). Exempt the new prefix from `EmailWhitelistMiddleware` so the recipe-app
      whitelist does not shadow the editor check. Tests: anonymous can read; anonymous write gets
      401; recipe-app user who is not an editor gets 403; editor who is not a recipe-app user
      succeeds. Verify: `dotnet build`, `dotnet test`.

- [x] Task 3: Session endpoint. Add `GET /api/heftymesterskapet/me` returning `{ email, isEditor }`
      for the caller and a signed-out result when there is no valid token — reachable without
      editor rights so a non-editor can be told they lack them. Tests for all three states.
      Verify: `dotnet build`, `dotnet test`.

- [x] Task 4: Login handoff. Add the one-time, short-lived handoff code: an endpoint that issues a
      code for an authenticated editor and one that exchanges it for the JWT, single-use and
      expiring within minutes. Tests: exchange succeeds once, replay fails, expired code fails,
      unknown code fails. Verify: `dotnet build`, `dotnet test`.

- [x] Task 5: Frontend return target. Honour a validated return URL through the login and Google
      OAuth callback, redirecting back to the page with a handoff code on success. Reject return
      targets outside the allowlisted origin so the login cannot become an open redirect. Verify:
      `npm run lint`, `npx tsc --noEmit`, `npm run build`.

- [x] Task 6: Read-only page rendering. Thread a `canEdit` flag through `heftymesterskapet.html`:
      hide the add-participant row, remove buttons, reset button, and status line when read-only,
      and render results as text instead of inputs. Standings and per-event rankings stay fully
      visible in both modes. Verify: page loads signed-out with no editing controls.

- [x] Task 7: Login affordance on the page. Add "Logg inn for å redigere" in read-only mode, show
      the signed-in editor with a sign-out action in edit mode, and tell a signed-in non-editor
      they lack access while keeping them read-only. Consume the handoff code on load, exchange it,
      then strip it from the URL. Verify: full signed-out → login → edit round trip.

- [x] Task 8: Save-path auth handling. Treat 401/403 from the write endpoints as an auth problem
      with a clear message rather than a generic save failure, preserving unsaved local state and
      dropping back to read-only. Verify: expired session mid-edit loses nothing.

- [ ] Task 9: Documentation and deploy notes. Update the code comments that describe the endpoints
      as publicly writable (`HeftyMesterskapetCompetition`, `HeftyMesterskapetController`,
      `EmailWhitelistMiddleware:53`, `Program.cs:207`), and record the `heftymesterskapet-editors`
      secret as a deploy step alongside `approved-users`. Verify: `dotnet build`.

- [ ] Task 10: Final verification. Full inner loop on both stacks (`dotnet build`, `dotnet test`,
      `npm run lint`, `npx tsc --noEmit`, `npm run build`), security review of the new auth surface,
      and an end-to-end check of both modes.
