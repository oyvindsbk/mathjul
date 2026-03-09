# Tasks: Matoppskrifter

**Spec:** Read `spec/spec.md` before starting any task. Focus on Part 2 (NF7: Testing Strategy) for test cases.

---

## Backpressure loop

After completing each task, run the relevant **check command** to verify. Every task must leave the check green before moving on.

**Backend:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
```

**Frontend:**
```bash
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```

If any step fails, fix it before marking the task done.

---

## Task 0: Backend test project scaffolding

Set up the xUnit test project so the backpressure loop works from the start.

**Stack:** Backend

**Do:**
- Create `backend/RecipeApi.Tests/RecipeApi.Tests.csproj` with xUnit, Moq, EF Core InMemory, and a reference to RecipeApi
- Create a placeholder test file `backend/RecipeApi.Tests/SmokeTest.cs` with a single passing test
- Verify `dotnet test` passes from `backend/RecipeApi.Tests/`

**Verify:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
```
Build succeeds, 1 test passes.

---

## Task 1: TokenService unit tests

Test JWT token generation logic.

**Stack:** Backend

**Do:**
- Create `backend/RecipeApi.Tests/Features/Auth/TokenServiceTests.cs`
- Test: `GenerateToken` returns a valid JWT with email, emails, sub, jti claims
- Test: Token has 24-hour expiry
- Test: Token uses configured issuer and audience
- Mock `IConfiguration` to provide JWT settings

**Verify:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
```
All TokenService tests pass.

---

## Task 2: EmailWhitelistMiddleware unit tests

Test the authorization middleware logic.

**Stack:** Backend

**Do:**
- Create `backend/RecipeApi.Tests/Features/Auth/EmailWhitelistMiddlewareTests.cs`
- Test: Skip-paths (`/health`, `/.auth/*`, `/api/auth/token`) bypass auth
- Test: OPTIONS requests bypass auth
- Test: Approved email in JWT passes through
- Test: Unapproved email returns 403
- Test: Missing auth header returns 401
- Test: `AllowUnauthenticated` config bypasses all checks
- Use `DefaultHttpContext` and mock `RequestDelegate`

**Verify:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
```
All middleware tests pass.

---

## Task 3: RecipesController unit tests

Test recipe API endpoint logic.

**Stack:** Backend

**Do:**
- Create `backend/RecipeApi.Tests/Features/Recipes/RecipesControllerTests.cs`
- Test: `GET /api/recipes` returns all recipes from in-memory DB
- Test: `GET /api/recipes/{id}` returns a specific recipe
- Test: `GET /api/recipes/{id}` returns 404 for non-existent recipe
- Test: `POST /api/recipes/from-image` returns 400 without file
- Use EF Core InMemory provider for `RecipeDbContext`

**Verify:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
```
All controller tests pass.

---

## Task 4: Frontend test scaffolding with Vitest

Set up Vitest for the Next.js frontend so the check command works.

**Stack:** Frontend

**Do:**
- Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, `jsdom`
- Create `frontend/vitest.config.ts` with jsdom environment and `src/**/*.test.{ts,tsx}` includes
- Create a placeholder test `frontend/src/smoke.test.ts` with a single passing test
- Add `"test"` script to `package.json`: `"vitest run"`
- Verify `npx vitest run` passes

**Verify:**
```bash
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```
Lint clean, typecheck clean, 1 test passes.

---

## Task 5: Recipe service unit tests

Test the API service layer and mock fallback behavior.

**Stack:** Frontend

**Do:**
- Create `frontend/src/lib/services/recipe.service.test.ts`
- Test: `getRecipes` returns data when API responds
- Test: `getRecipes` falls back to mock data when enabled and API fails
- Test: `getRecipeById` returns correct recipe
- Mock `fetch` globally in tests

**Verify:**
```bash
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```
All service tests pass.

---

## Task 6: AuthContext unit tests

Test authentication state management.

**Stack:** Frontend

**Do:**
- Create `frontend/src/lib/context/AuthContext.test.tsx`
- Test: Initial state is unauthenticated
- Test: `setToken` updates state to authenticated
- Test: `logout` clears authentication state
- Test: Token persists from localStorage on mount
- Use `renderHook` from React Testing Library

**Verify:**
```bash
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```
All AuthContext tests pass.

---

## Task 7: Component tests (AuthButton, ProtectedRoute, Sidebar)

Test key UI components.

**Stack:** Frontend

**Do:**
- Create `frontend/src/components/AuthButton.test.tsx`
  - Test: Shows login state when unauthenticated
  - Test: Shows logout state when authenticated
- Create `frontend/src/components/ProtectedRoute.test.tsx`
  - Test: Redirects to /login when unauthenticated
  - Test: Renders children when authenticated
- Create `frontend/src/components/Sidebar.test.tsx`
  - Test: Renders navigation links

**Verify:**
```bash
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```
All component tests pass.

---

## Task 8: Update CLAUDE.md inner loop and CI/CD pipeline

Integrate tests into the verification loop and deployment pipeline.

**Stack:** All

**Do:**
- Update `CLAUDE.md` backend inner loop to include `dotnet test` step
- Update `CLAUDE.md` frontend inner loop to include `npx vitest run` step
- Update `.github/workflows/deploy.yml` to run backend tests before deployment
- Update `.github/workflows/deploy.yml` to run frontend tests before deployment
- Both test suites must pass before deployment proceeds

**Verify:**
```bash
cd backend/RecipeApi && dotnet build && cd ../RecipeApi.Tests && dotnet test
cd frontend && npm run lint && npx tsc --noEmit && npx vitest run
```
All tests pass. CI/CD pipeline YAML is valid.

---

<!-- FUTURE TASKS: Append new feature tasks below this line -->
<!-- When implementing a future feature from spec.md (F7-F12), add tasks here:

## Task N: [Feature Name]

**Stack:** Backend | Frontend | All
**Spec ref:** F7 / F8 / etc.

**Do:**
- ...

**Verify:**
```bash
[relevant check command]
```
-->
