<!-- AI Copilot Instructions for Food Recipes Application -->

# Food Recipes Application - Copilot Instructions

Full-stack recipe management app: ASP.NET Core backend, Next.js frontend, Azure deployment with AI-powered recipe extraction.

## Architecture Overview

**Frontend** (Next.js 15, `standalone` output mode):
- Server-side middleware (`middleware.ts`) validates `auth_token` cookie before rendering
- Public routes: `/login`, `/api/auth/*`, `/.auth/*`
- Protected routes redirect to `/login` if unauthenticated
- Dynamic rendering (`force-dynamic`) for recipe detail page to avoid build-time API calls

**Backend** (ASP.NET Core 9, vertical slicing):
- Features grouped by domain: `Features/Recipes/`, `Features/Auth/`
- `Program.cs` orchestrates Aspire (dev) or Docker (production) connections
- Email whitelist middleware caches approved emails (5min TTL) from Key Vault or config

**Authentication Flow**:
1. User clicks login button → redirects to `/login` page
2. In dev: "🚀 Dev Login (Fake)" button sets `auth_token` cookie instantly via `/api/auth/token`
3. In prod: Google auth via `/.auth/login/google` → `/api/auth/callback` → backend `/api/auth/token`
4. Backend extracts email from `X-MS-CLIENT-PRINCIPAL` header (Base64-encoded JSON from Static Web Apps)
5. `TokenService` generates 24-hour JWT with email claim
6. Frontend stores JWT in both localStorage (state) and cookie (middleware)

## Key Patterns & Conventions

### Frontend Cookie/Token Management
- **Middleware checks**: `auth_token` cookie (set by `AuthContext.setToken()`)
- **localStorage fallback**: `jwt_token` for state persistence across sessions
- **Fake login**: `NEXT_PUBLIC_ALLOW_UNAUTHENTICATED=true` enables dev mode with instant login
- **Service layer**: `recipeService` singleton in `/lib/services/recipe.service.ts` handles all API calls with mock fallback

### Backend Token Generation
- `ITokenService.GenerateToken(email)` creates JWT with claims: `email`, `emails`, `sub`, `jti`
- Email whitelist checked in `EmailWhitelistMiddleware` (skips `/health`, `/.auth`, `/api/auth/token`)
- `AllowUnauthenticated` config skips auth entirely in dev mode

### Database & Aspire
- Development: Aspire injects SQL connection via `AddSqlServerDbContext("recipedb")`
- Fallback logic in `Program.cs` handles environment-specific connection strings
- Database auto-recreates in dev mode (`EnsureDeletedAsync` then `EnsureCreatedAsync`)
- 10-retry startup logic with 2-second backoff for container timing issues

## Development Workflows

**Start everything**:
```bash
cd /Users/oyvind/git/mathjul
# Option 1: Use VS Code tasks (Cmd+Shift+P > Tasks: Run Task)
# - start:aspire (includes SQL, API, Aspire dashboard)
# - start:frontend (Next.js on 3002, port 3000 busy)
# Option 2: Manual
dotnet run --project aspire/FoodRecipesApp/FoodRecipesApp.csproj
cd frontend && npm run dev
```

**Feature Branch Workflow** (ALWAYS use feature branches):
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Make changes, test thoroughly (see Testing section below)
# Commit with descriptive messages
git add .
git commit -m "feat: description of changes"

# Push to remote
git push origin feature/your-feature-name

# Create pull request on GitHub (do NOT push directly to main)
```

**Testing Before Push** (REQUIRED):
1. **Frontend**: Test locally at `http://localhost:3002`
   - Use Chrome DevTools (F12) to inspect network requests, console errors, cookies
   - Clear browser cache/cookies: DevTools > Application > Clear site data
   - Test both dev fake login and production auth flow
2. **Backend**: Check Aspire dashboard at `http://localhost:15112` for errors
3. **Run linter/tests** before committing:
   ```bash
   cd frontend && npm run lint
   cd ../backend && dotnet test
   ```

**Debugging with Chrome DevTools**:
- **Network tab**: Check API calls to `/api/auth/token`, recipe endpoints
- **Application tab**: Verify `auth_token` cookie and `jwt_token` localStorage
- **Console**: Look for auth errors, token validation failures
- **DevTools for backend**: Use `dotnet` logging configuration in `appsettings.Development.json`

**Test fake login locally**:
1. Navigate to `http://localhost:3002`
2. Middleware redirects to `/login` (no token cookie)
3. Click "🚀 Dev Login (Fake)" → instant login → home page
4. Verify: Check browser cookies for `auth_token`

**Clear cached state**: Delete `localStorage.jwt_token` and cookie `auth_token` in DevTools

## Important Gotchas

1. **Next.js output mode**: Changed from `export` (static) to `standalone` to enable middleware
   - `generateStaticParams` removed from recipe detail page (dynamic rendering only)
   - Build uses `.next/standalone`, not `out/`

2. **Middleware vs Authentication**: Middleware runs server-side, protects routes before pages load
   - Development mode (`NEXT_PUBLIC_ALLOW_UNAUTHENTICATED=true`) no longer bypasses auth; was fixed to enforce it

3. **Cookie vs localStorage**: Middleware reads cookies only
   - `AuthContext.setToken()` sets BOTH `auth_token` cookie AND `jwt_token` localStorage
   - Frontend uses localStorage for client-side state; middleware uses cookie for routing

4. **Public routes whitelist**: `/login`, `/api/auth/callback`, `/.auth`, `/api/auth/token`, `/api/auth/fake-callback`
   - Adding new auth endpoints? Add to middleware matcher config

5. **Aspire connection string**: Named `"recipedb"` (lowercase, not `RecipeDb`)
   - Production falls back to `CONNECTION_STRING_RECIPEDB` env var

## File Reference Map

| Pattern | Files |
|---------|-------|
| Middleware protection | `frontend/middleware.ts` |
| Auth context & state | `frontend/src/lib/context/AuthContext.tsx` |
| Login page (fake + real) | `frontend/src/app/login/page.tsx` |
| Token endpoints | `frontend/src/app/api/auth/{token,fake-callback}/` |
| Auth callbacks | `frontend/src/app/api/auth/callback/page.tsx` |
| Backend token generation | `backend/RecipeApi/Features/Auth/TokenService.cs` |
| Email whitelist | `backend/RecipeApi/Infrastructure/EmailWhitelistMiddleware.cs` |
| Startup & DB setup | `backend/RecipeApi/Program.cs` |
| Recipe service (mock fallback) | `frontend/src/lib/services/recipe.service.ts` |