# Implementation Plan: Notater

## Approach
Add two new projects to the monorepo, mirroring the recipe app's shape: `backend/NotesApi` (ASP.NET Core 10, its own `NotesDbContext`) and `frontend-notes` (Next.js 15, standalone). Both deploy as two new Container Apps in mathjul's resource group and connect to the same Azure SQL database, `RecipeDb`. All notes tables live in schema `notes`, with their own migrations history table, so the recipe app's migrations and the notes migrations never see each other.

The OneNote importer is a local tool, `tools/onenote-export`. It turns `.one` files into JSON, and a small script posts that JSON to `/api/import/onenote`.

## Stacks Affected
- [x] Frontend (new `frontend-notes`; mathjul's `frontend` is untouched)
- [x] Backend (new `backend/NotesApi` and `backend/NotesApi.Tests`; `RecipeApi` is untouched)
- [x] Infrastructure (new Bicep modules, wired into `main.bicep`)
- [x] CI (new `deploy-notes.yml`)
- [x] Local dev (Aspire `Program.cs`)

## Key Decisions
- **Separate DbContext and schema, same database.** `HasDefaultSchema("notes")` and `MigrationsHistoryTable("__EFMigrationsHistory", "notes")`. This needs no new SQL cost, and the recipe migrations can't touch notes tables.
- **Least-privilege database user.** NotesApi gets its own system-assigned managed identity and a contained database user, with `SELECT/INSERT/UPDATE/DELETE` on `SCHEMA::notes` only. NotesApi does **not** migrate at startup. Migrations run in CI with the admin connection string, as `migrate-database` already does for the recipe app.
- **Own secrets, not the whole vault.** NotesApi does not call `AddAzureKeyVault`, which would load every recipe secret. Its two secrets come from GitHub secrets (`NOTES_JWT_SECRET_KEY`, `NOTES_ALLOWED_EMAILS`), go through Bicep, and become Container App secrets, the same way the recipe frontend gets its Google secret. Key Vault references were dropped: they need a role assignment for the app's identity, which in this repo is a manual step (`key-vault-access.bicep`).
- **Reuse the existing Container Apps environment.** The backend module will output its environment id, and both notes apps run in it. That avoids two more environments and Log Analytics workspaces.
- **The frontend proxies every API call, and NotesApi is internal-only.** The browser calls `/api/proxy/*` on the Next.js app. That route reads the httpOnly `auth_token` cookie and forwards the request with a Bearer header to NotesApi, inside the Container Apps environment. So the JWT never reaches page JavaScript, no CORS is needed, and NotesApi gets `external: false` ingress. The importer goes through the same proxy with its own Bearer token.
- **ASP.NET auth instead of a custom middleware.** JwtBearer authentication plus an authorization fallback policy (authenticated *and* allowlisted email). Unlike mathjul, `google-token` checks the Google token's `aud`, and refuses to mint a token for an email that isn't allowlisted.
- **Scale to zero.** `minReplicas: 0` on both notes apps. A cold start of a few seconds is acceptable for one user, unlike the recipe API, which keeps a replica warm.
- **Copy the auth code, don't share it.** TokenService and the allowlist middleware are about 150 lines. Copying and trimming them avoids a shared project between two apps that should be able to change separately.
- **Carry-over happens when the day is created** (in a transaction, on `GET /api/days/{today}`), not in a scheduled job. There is nothing to schedule, and it is idempotent because the day row is unique.
- **Importer via Rust `onenote_parser`.** It is the only maintained parser that returns page → outline → paragraph structure with indentation and to-do tags. Task 1 is a spike that proves this before the data model is fixed.

## Risks
- **The local DB is dropped on every RecipeApi start** (`EnsureDeletedAsync`). In Aspire, NotesApi waits for RecipeApi (`WaitFor`) and then migrates its schema in local dev only. Local notes data is throwaway, and a dev seed gives a sample week.
- **The parser may not handle 2025–2026 files** (a different text encoding was seen). The spike checks one file per year. The fallback is the flat text import, accepted per year.
- **The managed identity's database user is a one-time manual T-SQL step** (like `key-vault-access.bicep`). It's in DEPLOYMENT.md, with the exact script.
- **Saves in flight are lost if the tab closes.** The editor saves each keystroke batch asynchronously. It warns before unload while saves are pending.
- **Google OAuth redirect URI.** The new frontend's callback URL has to be added to the existing OAuth client by hand.
- **Work notes in a private repo's database.** The import JSON stays out of git (gitignored `tools/onenote-export/out/`), and the API is allowlist-only.
