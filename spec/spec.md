# Matoppskrifter -- Norwegian Recipe Discovery App

## Goal

A personal recipe discovery and management app where authenticated users can browse recipes, upload recipe images for AI-powered extraction, and randomly select what to cook. The UI is entirely in Norwegian (Bokmal).

## Scope

### In scope

- Recipe browsing and viewing (gallery + detail pages)
- AI-powered recipe extraction from uploaded photos
- Spin-the-wheel random recipe selection
- Email-whitelisted authentication (Google OAuth + dev fake login)
- Azure cloud deployment through Github Actions
- Norwegian-language UI

### Out of scope

- Multi-language / i18n support
- User self-registration (admin adds emails to whitelist)
- Recipe sharing or social features
- Meal planning or shopping lists
- Offline / PWA support

---

# Part 1: Functional Specification

## F1: Recipe Browsing -- DONE

User opens the home page and sees a grid gallery of recipe cards.

**User flow:**
1. User lands on home page (`/`)
2. Sees responsive grid of recipe cards (1-4 columns depending on screen)
3. Each card shows: title, description, and "Vis oppskrift" link
4. A green "Upload recipe from image" button is visible
5. If recipes fail to load, a yellow warning appears with fallback to sample data

**Acceptance criteria:**
- Cards display title and description from the database
- Grid is responsive across screen sizes
- Loading spinner shown while fetching
- Error state falls back to mock data in development

---

## F2: Recipe Detail View -- DONE

User clicks a recipe card to see the full recipe.

**User flow:**
1. User clicks "Vis oppskrift" on a recipe card
2. Detail page shows:
   - Hero image area (placeholder for now)
   - Recipe title with difficulty badge (Easy = green, Medium = yellow, Hard = red)
   - Info grid: prep time, cook time, servings, last updated date
   - Ingredients list with interactive checkboxes (user can mark off items)
   - Numbered step-by-step instructions
3. "Back" link returns to home

**Acceptance criteria:**
- Ingredients are split from newline-separated string into individual items
- Instructions are numbered automatically
- Checkboxes are interactive (client-side only, not persisted)
- 404 page shown for non-existent recipe IDs

---

## F3: AI Recipe Extraction -- DONE

User uploads a photo of a recipe and AI extracts structured data.

**User flow:**
1. User navigates to upload page (`/upload`)
2. Drags and drops an image (or clicks to browse) -- max 10MB, image files only
3. Image preview appears with "Extract Recipe" button
4. Clicks extract -- loading spinner while AI processes
5. Extracted recipe appears in editable form:
   - Title (text input)
   - Description (textarea)
   - Servings, prep time, cook time (number inputs)
   - Ingredients list (add/remove individual items)
   - Instructions list (add/remove individual steps)
6. User reviews, edits if needed, clicks "Save Recipe"
7. Recipe saved to database, user redirected to home page

**Acceptance criteria:**
- Drag-and-drop with visual feedback (blue border on drag-over)
- File validation: image types only, max 10MB
- All extracted fields are editable before saving
- User can add/remove individual ingredients and instructions
- 403 redirect if user is not authorized
- Error messages shown for extraction failures

---

## F4: Spin the Wheel -- DONE

User spins an animated wheel to randomly select a recipe.

**User flow:**
1. User navigates to spin page (`/spin`)
2. Sees a colorful wheel with all recipe names
3. Below the wheel: list of available recipes with colored borders
4. Clicks "Snurr!" (Spin!) button
5. Wheel animates for ~4 seconds with easing deceleration
6. Result card appears: "Du fikk:" (You got:) with recipe title
7. Link to view the selected recipe ("Vis oppskrift")
8. Can spin again

**Acceptance criteria:**
- Wheel shows all recipes from database
- Spin animation is smooth (cubic-bezier easing)
- Button disabled during spin
- Random selection is fair
- Empty state if no recipes exist

---

## F5: Authentication -- DONE

Users must log in with an approved email to access the app.

**User flow -- Production:**
1. User visits any page without being logged in
2. Automatically redirected to login page (`/login`)
3. Clicks "Login with Google"
4. Google OAuth flow completes
5. If email is on the approved whitelist: logged in, redirected to home
6. If email is NOT approved: sees 403 forbidden page

**User flow -- Development:**
1. User visits login page
2. Clicks "Dev Login (Fake)" button
3. Instantly logged in with test credentials
4. Redirected to home

**Acceptance criteria:**
- Unauthenticated users cannot see any page except login
- Login persists across page refreshes (token in cookie + localStorage)
- Logout clears all stored tokens and redirects to login
- Auth button in top-right shows user email when logged in

---

## F6: Navigation -- DONE

Fixed sidebar provides navigation between app sections.

**Elements:**
- App title: "Matoppskrifter" with subtitle "Oppskrift Utforsker"
- Home link (house icon) -- `/`
- Spin Wheel link (circular icon) -- `/spin`
- Active route highlighted with blue background

---

## Future Features (not yet built)

- **F7: Edit Recipe** -- Modify title, ingredients, instructions of existing recipes
- **F8: Delete Recipe** -- Remove recipes from the collection
- **F9: Search & Filter** -- Find recipes by keyword, ingredient, difficulty, or cook time
- **F10: Recipe Images** -- Store and display actual recipe images (not placeholders)
- **F11: Recipe Categories/Tags** -- Organize recipes by cuisine, meal type, dietary needs
- **F12: User Collections** -- Personal recipe collections per user

---

# Part 2: Non-Functional Specification

## NF1: Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, standalone output), React 19, TypeScript, Tailwind CSS 4 |
| Backend | ASP.NET Core 9, C# |
| Database | SQL Server via EF Core 9 |
| AI | Azure OpenAI GPT-4 Vision |
| Auth | JWT (HS256), Azure Static Web Apps + Google OAuth |
| Infrastructure | Azure Container Apps, Static Web Apps, SQL Database, Key Vault |
| CI/CD | GitHub Actions, GitHub Container Registry |
| Local Dev | .NET Aspire orchestration, Docker (SQL Server) |

---

## NF2: Data Model

### Recipe

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| Id | int | PK, auto-increment | |
| Title | string | Required, max 200 | |
| Description | string | Max 1000 | |
| Ingredients | string | Newline-separated | Split to array in API response |
| Instructions | string | Newline-separated | Split to array in API response |
| PrepTime | int? | Minutes | |
| CookTime | string | Max 50 | Display format, e.g. "20 minutes" |
| CookTimeMinutes | int? | Minutes | Numeric value |
| Servings | int? | | |
| Difficulty | string | Max 20 | "Easy", "Medium", "Hard" |
| ImageUrl | string | | Placeholder for now |
| CreatedAt | DateTime | Required, UTC | |
| UpdatedAt | DateTime | Required, UTC | |

### Seed Data

4 pre-loaded recipes (Spaghetti Carbonara, Chicken Tikka Masala, Chocolate Chip Cookies, Caesar Salad).

---

## NF3: API Contracts

### GET /api/recipes

Response 200:
```json
[
  {
    "id": 1,
    "title": "Classic Spaghetti Carbonara",
    "description": "A traditional Italian pasta dish...",
    "cookTime": "20 minutes",
    "difficulty": "Medium",
    "imageUrl": "/api/placeholder/300/200"
  }
]
```

### GET /api/recipes/{id}

Response 200:
```json
{
  "id": 1,
  "title": "...",
  "description": "...",
  "cookTime": "20 minutes",
  "cookTimeMinutes": 20,
  "prepTime": 10,
  "difficulty": "Medium",
  "servings": 4,
  "ingredients": ["400g spaghetti", "200g pancetta"],
  "instructions": ["Boil pasta...", "Fry pancetta..."],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

Response 404: `{ "message": "Recipe not found" }`

### POST /api/recipes/from-image

Multipart form upload. Field: `image`. Max 10MB. Types: jpeg, jpg, png, webp.

Response 200:
```json
{
  "success": true,
  "extractedRecipe": {
    "title": "...",
    "description": "...",
    "ingredients": ["..."],
    "instructions": ["..."],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4
  }
}
```

Response 400: `{ "success": false, "errorMessage": "No image file provided" }`

### POST /api/recipes/save-extracted

Request:
```json
{
  "title": "...",
  "description": "...",
  "ingredients": ["..."],
  "instructions": ["..."],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "Medium"
}
```

Response 201: Saved recipe object.

### POST /api/auth/token

Requires `X-MS-CLIENT-PRINCIPAL` header (Base64 JSON from Azure Static Web Apps).

Response 200: `{ "token": "eyJ...", "email": "user@example.com", "expiresIn": 86400 }`
Also sets `auth_token` HttpOnly cookie.

### POST /api/auth/logout

Response 200: `{ "message": "Logged out successfully" }`
Deletes `auth_token` cookie.

---

## NF4: Security

- **JWT tokens**: HS256, 24-hour expiry, claims: email, emails, sub, jti
- **Email whitelist**: Approved emails stored in Azure Key Vault (`approved-users` secret), cached 5 minutes
- **Middleware skip-paths**: `/health`, `/.auth/*`, `/api/auth/token`, OPTIONS requests
- **Frontend middleware**: Server-side cookie check, redirects unauthenticated to `/login`
- **Public routes**: `/login`, `/api/auth/*`, `/.auth/*`
- **HttpOnly cookies**: Server-set, Secure, SameSite=Lax

---

## NF5: Infrastructure & Deployment

| Resource | SKU | Cost |
|----------|-----|------|
| Azure SQL Database | Basic, 5 DTU, 2GB | ~$5/mo |
| Azure Container Apps | 0.25 vCPU, 0.5GB, scale 0-1 | ~$0-2/mo |
| Azure Key Vault | Standard, 7-day soft delete | Free tier |
| Azure Static Web Apps | Free | $0 |
| Log Analytics Workspace | 30-day retention | ~$0-1/mo |

**CI/CD:**
- `infrastructure.yml`: Manual dispatch, deploys Bicep templates
- `deploy.yml`: On push to main -- build Docker image, push to GHCR, deploy backend, migrate DB, deploy frontend, update CORS

---

## NF6: Development Experience

- **Mock fallback**: Frontend uses mock recipe data when API is unavailable (dev only)
- **Aspire orchestration**: `dotnet run --project aspire/FoodRecipesApp` starts SQL + API + dashboard
- **Feature flags**: `enableRecipeDetails`, `enableSpinWheel` in frontend config
- **Dev database**: Drops and recreates on every startup (auto-seeds)
- **Connection string resolution**: Aspire (`recipedb`) -> appsettings -> env var

---

## NF7: Testing Strategy

### Current state
- No backend unit tests
- Frontend: Playwright E2E scaffolded but minimal
- Inner loop relies on build/lint/typecheck only

### Target state
- **Backend**: xUnit + Moq + EF Core InMemory provider
- **Frontend**: Vitest + React Testing Library + jsdom
- **E2E**: Playwright (already scaffolded)
- **CI/CD**: Tests run before deployment in `deploy.yml`

### Backend test cases

| Area | Test | Expected |
|------|------|----------|
| TokenService | GenerateToken returns valid JWT | JWT with email claim, 24h expiry |
| TokenService | Includes all required claims | email, emails, sub, jti present |
| Middleware | Skip-path bypasses auth | `/health` returns 200 |
| Middleware | OPTIONS bypasses auth | Returns 200 |
| Middleware | Approved email passes | 200 |
| Middleware | Unapproved email blocked | 403 |
| Middleware | No auth header | 401 |
| Middleware | AllowUnauthenticated config | All requests pass |
| Controller | GET /api/recipes | 200 with array |
| Controller | GET /api/recipes/{id} | 200 with recipe |
| Controller | GET /api/recipes/999 | 404 |
| Controller | POST from-image (no file) | 400 |

### Frontend test cases

| Area | Test | Expected |
|------|------|----------|
| RecipeService | API returns data | Array of recipes |
| RecipeService | Mock fallback (dev) | Mock data returned |
| RecipeService | getRecipeById | Correct recipe |
| AuthContext | Initial state | isAuthenticated = false |
| AuthContext | setToken | isAuthenticated = true |
| AuthContext | logout | State cleared |
| AuthButton | Unauthenticated | Shows login state |
| AuthButton | Authenticated | Shows logout + email |
| ProtectedRoute | No token | Redirects to /login |
| ProtectedRoute | Has token | Renders children |
| Sidebar | Renders | Contains nav links |

---

## NF8: Error Handling

| Condition | Status | Response |
|-----------|--------|----------|
| No image file uploaded | 400 | `{ success: false, errorMessage: "No image file provided" }` |
| Image exceeds 10MB | 400 | `{ success: false, errorMessage: "Image file size exceeds..." }` |
| Invalid image type | 400 | `{ success: false, errorMessage: "Invalid file type..." }` |
| OpenAI extraction fails | 400 | `{ success: false, errorMessage: "Error processing image: ..." }` |
| Recipe not found | 404 | `{ message: "Recipe not found" }` |
| No auth header | 401 | `{ error: "Authentication required" }` |
| Email not whitelisted | 403 | `{ error: "Access denied", email: "..." }` |
| Invalid auth header | 400 | `{ error: "Invalid authentication header format" }` |
