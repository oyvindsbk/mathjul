<!-- SETUP GATE: If any {{PLACEHOLDER}} values remain in this file, do NOT start
     implementing tasks. Instead, ask the user to provide values for each unfilled
     placeholder. Once all placeholders are resolved, proceed normally. -->

# mathjul -- Food Recipes Application

Full-stack recipe management app with AI-powered recipe extraction. ASP.NET Core 9 backend, Next.js 15 frontend, Azure deployment with Bicep IaC.

## Spec & Plan

- **Spec:** `spec/spec.md` -- full technical specification for the current feature
- **Tasks:** `spec/tasks.md` -- implementation tasks, one per iteration
- **Build prompt:** `PROMPT.md` -- drives the autonomous loop

Read the spec before starting any task. Don't guess -- read the spec.

## Commands

### Frontend (Next.js)

| Action     | Command                                  |
|------------|------------------------------------------|
| Install    | `cd frontend && npm install`             |
| Lint       | `cd frontend && npm run lint`            |
| Typecheck  | `cd frontend && npx tsc --noEmit`        |
| Build      | `cd frontend && npm run build`           |
| Test (E2E) | `cd frontend && npx playwright test`     |

### Backend (ASP.NET Core)

| Action     | Command                                          |
|------------|--------------------------------------------------|
| Build      | `cd backend/RecipeApi && dotnet build`            |
| Test       | `cd backend/RecipeApi && dotnet test`             |

### Infrastructure (Bicep)

| Action     | Command                                                        |
|------------|----------------------------------------------------------------|
| Validate   | `az bicep build --file infrastructure/main.bicep`              |

## Agent Inner Loop

Run verification after every meaningful change. Cheapest checks first.

### Frontend changes

| Step | What      | Command                                | When                     |
|------|-----------|----------------------------------------|--------------------------|
| 1    | Lint      | `cd frontend && npm run lint`          | After every change       |
| 2    | Typecheck | `cd frontend && npx tsc --noEmit`      | After editing source     |
| 3    | Build     | `cd frontend && npm run build`         | After implementing logic |

### Backend changes

| Step | What      | Command                                        | When                     |
|------|-----------|------------------------------------------------|--------------------------|
| 1    | Build     | `cd backend/RecipeApi && dotnet build`          | After every change       |

### Infrastructure changes

| Step | What      | Command                                              | When                     |
|------|-----------|------------------------------------------------------|--------------------------|
| 1    | Validate  | `az bicep build --file infrastructure/main.bicep`    | After editing .bicep     |

**Rules:**
- All steps for the affected stack must pass before marking a task complete
- If a step fails: read the error, fix it, re-run from that step -- don't skip ahead
- Run the full check for the relevant stack as the gate at the end of each task

## Project Structure

```
frontend/                        # Next.js 15 (App Router, standalone output)
  src/
    app/                         # Pages and API routes
      login/page.tsx             # Login page (fake + Google auth)
      recipes/[id]/              # Recipe detail (dynamic rendering)
      upload/page.tsx            # AI recipe upload
      api/auth/                  # Auth API routes
    components/                  # React components
    lib/
      context/AuthContext.tsx    # Auth state management
      services/recipe.service.ts # API service with mock fallback
      config.ts                  # API configuration
    hooks/                       # Custom React hooks
  middleware.ts                  # Server-side auth middleware

backend/RecipeApi/               # ASP.NET Core 9 Web API
  Features/
    Auth/                        # Authentication (TokenService, AuthController)
    Recipes/                     # Recipe CRUD + AI extraction
  Infrastructure/                # DbContext, middleware, utilities

infrastructure/                  # Azure Bicep IaC
  main.bicep                     # Orchestration
  modules/                       # Key Vault, SQL, Container Apps, Static Web Apps

aspire/                          # .NET Aspire (local dev orchestration)
scripts/                         # Azure deployment scripts
.github/workflows/               # CI/CD pipelines
```

## Architecture

### Authentication Flow
1. Dev: Fake login button -> `/api/auth/token` -> JWT in cookie + localStorage
2. Prod: Google OAuth via `/.auth/login/google` -> Azure Static Web Apps -> `/api/auth/callback` -> JWT
3. `EmailWhitelistMiddleware` checks approved emails (Key Vault in prod, config in dev)
4. Frontend `middleware.ts` validates `auth_token` cookie server-side before rendering

### Key Patterns
- **Vertical slicing:** Backend features grouped by domain (`Features/Recipes/`, `Features/Auth/`)
- **Mock fallback:** Frontend recipe service falls back to mock data when API unavailable (dev only)
- **Standalone output:** Next.js uses `standalone` output mode to enable server-side middleware
- **Aspire orchestration:** Local dev uses .NET Aspire for SQL Server + API + dashboard
- **Feature branches:** ALWAYS create feature branches, never commit to main directly

### Database
- Entity Framework Core 9 with SQL Server
- Recipe model: Title, Description, CookTime, Ingredients, Instructions, Difficulty, Servings, ImageUrl
- Auto-seed with 4 default recipes in dev mode
- Connection string: `"recipedb"` (Aspire) or `CONNECTION_STRING_RECIPEDB` env var (prod)

## DO

- Read `spec/spec.md` before starting any task
- Use strict TypeScript in frontend (`strict: true` in tsconfig)
- Follow existing patterns and conventions in the codebase
- Keep the inner loop -- every task must leave checks green
- Use feature branches for all changes
- Test auth flows: both dev fake login and production Google auth
- Handle both Aspire (Debug) and Docker (Release) database configurations

## DON'T

- Don't add unnecessary dependencies
- Don't suppress lint or type errors with comments
- Don't skip the inner loop -- every task must leave checks green
- Don't use `any` type in TypeScript -- use proper types throughout
- Don't push directly to main
- Don't modify `middleware.ts` public routes without updating the whitelist
- Don't use `export` output mode in Next.js (breaks server-side middleware)
- Don't hardcode connection strings or secrets

## Testing

### Frontend
- Playwright E2E tests in `frontend/tests/e2e/`
- Manual testing: dev fake login flow, recipe browsing, upload flow
- Check browser DevTools: cookies (`auth_token`), localStorage (`jwt_token`), network requests

### Backend
- Build verification (no unit test framework set up yet)
- Manual testing via Aspire dashboard at `http://localhost:15112`

## Anti-Patterns

- **Guessing formats** -- always reference the spec
- **Giant functions** -- break complex logic into focused pieces
- **Skipping verification** -- run checks after every change
- **Static export** -- never switch Next.js to `export` mode
- **Hardcoded secrets** -- use Key Vault / env vars / user-secrets
