---
name: code-security-review
description: "Reviews changed files for security vulnerabilities specific to this project. Checks authentication bypass, JWT handling, email whitelist enforcement, CORS misconfiguration, SSRF in URL processing, secret leakage, SQL injection, XSS, and infrastructure misconfigurations. Use when reviewing a PR, after implementing auth or API changes, before merging, or when asked to do a security review."
compatibility: Requires git and file system read access.
metadata:
  author: oyvind
  version: "1.0"
---

## Instructions

When asked to perform a security review, analyze changed files against the checklist below. Focus on files that have actually changed (use `git diff` against the base branch), but also check that existing security invariants are not broken.

### 1. Determine scope

```bash
git diff --name-only main...HEAD
```

If no branch diff is available (e.g., reviewing uncommitted work):

```bash
git diff --name-only HEAD
git diff --name-only --cached
```

Categorize changed files into: **backend**, **frontend**, **infrastructure**, **other**.

### 2. Backend security checks

#### 2.1 Authentication & authorization

- **EmailWhitelistMiddleware bypass** — Every new endpoint or route must be protected by the middleware registered in `Program.cs`. Verify:
  - New controllers do NOT add `[AllowAnonymous]` or bypass the middleware pipeline.
  - Any new paths added to the skip list in `EmailWhitelistMiddleware.InvokeAsync` (health, auth endpoints) are intentional and justified.
  - The middleware order in `Program.cs` is preserved: CORS → EmailWhitelistMiddleware → routes.
- **JWT handling** — Check `TokenService` and any code that reads/writes JWTs:
  - Secret key must come from configuration (`Jwt:SecretKey`), never hardcoded.
  - Token validation must check issuer, audience, lifetime, and signing key.
  - Tokens must not be logged at INFO level or returned in error messages.
- **Auth cookie settings** — When setting `auth_token` cookie:
  - `HttpOnly = true` (prevents XSS access)
  - `Secure = true` (HTTPS only)
  - `SameSite = Lax` or `Strict`
  - Reasonable expiry (currently 1 day)

#### 2.2 Input validation & injection

- **SQL injection** — EF Core parameterizes by default, but check for:
  - Raw SQL via `FromSqlRaw` or `ExecuteSqlRaw` with string concatenation.
  - Any `string.Format` or interpolation passed to SQL methods.
- **SSRF via URL processing** — The `from-url` endpoint accepts user-provided URLs:
  - Verify the URL processor validates/sanitizes the URL.
  - Check that internal/private network ranges (127.0.0.1, 10.x, 169.254.x, etc.) are blocked.
  - Check that the URL scheme is restricted to `http`/`https`.
- **File upload** — The `from-image` endpoint accepts file uploads:
  - Verify `RequestSizeLimit` is enforced (currently 10MB).
  - Check that file content is validated (not just the extension).
  - Ensure uploaded content is not written to disk in a user-controllable path.
- **XSS via stored data** — Recipe data (title, description, ingredients, instructions) is user-provided:
  - Verify the frontend sanitizes or escapes this data before rendering.
  - Check that API responses set `Content-Type: application/json`.

#### 2.3 Secrets & configuration

- **No hardcoded secrets** — Search changed files for:
  - Connection strings, API keys, JWT secrets, passwords.
  - Patterns: `password=`, `apikey`, `secret`, `bearer`, base64 blobs.
- **Key Vault usage** — In production, secrets must come from Key Vault:
  - Connection strings via `ConnectionStrings--RecipeDb` secret.
  - AI Foundry keys via configuration mapped from Key Vault.
  - Email whitelist via `approved-users` secret.
- **No secrets in logs** — Check `_logger.Log*` calls don't include tokens, keys, or connection strings.

#### 2.4 Error handling

- **No stack traces in responses** — The global exception handler must return generic messages, not exception details.
- **No sensitive data in error responses** — Check that 4xx/5xx responses don't leak internal paths, config values, or SQL errors.

### 3. Frontend security checks

#### 3.1 Authentication

- **middleware.ts public routes** — Check that any changes to `publicRoutes` are intentional:
  - New public routes must not expose authenticated content.
  - The `NEXT_PUBLIC_ALLOW_UNAUTHENTICATED` bypass must only apply in dev.
- **Token storage** — `auth_token` cookie + `jwt_token` in localStorage:
  - Cookie is set by the backend with `HttpOnly` flag (frontend can't read it via JS, used for SSR middleware).
  - localStorage token is used for API calls — verify it's only sent in `Authorization` headers, not in URLs.
- **Auth context** — Check `AuthContext.tsx` for:
  - Proper token cleanup on logout.
  - No token exposure in React state that persists after logout.

#### 3.2 XSS prevention

- **`dangerouslySetInnerHTML`** — Flag any usage. Recipe content must be rendered as text, not HTML.
- **User input rendering** — Verify recipe data from the API is escaped when rendered in components.
- **URL handling** — Check that user-provided URLs (recipe source URLs) are not used in `href` without validation.

#### 3.3 API communication

- **API base URL** — Must come from environment config (`lib/config.ts`), not hardcoded.
- **CORS alignment** — Frontend origin must match backend CORS `AllowedOrigins` configuration.

### 4. Infrastructure security checks

#### 4.1 Bicep / Azure

- **Managed identity** — Production database access must use `AzureAdTokenInterceptor`, not SQL auth passwords.
- **Key Vault access policies** — Only the necessary container apps should have `get` permission on secrets.
- **Container App ingress** — Check that `external: true` is only set for the frontend, not internal services.
- **SQL Server firewall** — Verify no `0.0.0.0/0` rules or overly broad IP ranges.
- **HTTPS enforcement** — Container Apps must enforce HTTPS (`allowInsecure: false`).

#### 4.2 CI/CD

- **No secrets in workflow files** — Use GitHub secrets references (`${{ secrets.X }}`), never plain text.
- **Dependency pinning** — Actions should use commit SHAs or version tags, not `@main`.

### 5. Cross-cutting checks

- **CORS** — If CORS config changed:
  - Production must use explicit `WithOrigins()`, never `AllowAnyOrigin()`.
  - `AllowCredentials()` must not be combined with `AllowAnyOrigin()`.
  - Dev localhost wildcard (`SetIsOriginAllowed`) must be gated behind `IsLocalDev()`.
- **Logging PII** — Check that email addresses are only logged at appropriate levels and not in production at INFO level.
- **Rate limiting** — Sensitive endpoints (auth, AI extraction) should have rate limiting or are protected by the email whitelist.

### 6. Report findings

Present findings in this format:

```
## Security Review: [branch or PR name]

### Critical (must fix before merge)
- [Finding]: [file:line] — [description and fix]

### Warning (should fix)
- [Finding]: [file:line] — [description and fix]

### Info (consider)
- [Finding]: [file:line] — [description]

### Passed
- [List of checks that passed]
```

**Severity guide:**
- **Critical**: Auth bypass, secret exposure, injection vulnerability, data leak
- **Warning**: Missing validation, overly permissive config, logging PII
- **Info**: Defense-in-depth suggestions, hardening opportunities

If no issues are found, confirm which checks were performed and that all passed.

## Validation

- [ ] All changed files were reviewed against relevant checklist sections
- [ ] Findings are tied to specific file paths and line numbers
- [ ] Each finding includes a concrete fix recommendation
- [ ] No false positives from dev-only code paths gated behind `IsLocalDev()`
