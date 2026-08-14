# Tasks: Min oppskriftsprofil

## Tasks

- [x] Task 1: Legg til delt hjelpefunksjon for visningsnavn (`Nickname → Name → DisplayName → Email`) i `Features/Auth`, med xUnit-test for fallback-rekkefølgen
- [x] Task 2: Utvid `RecipeDto` og `RecipeDetailDto` med `OwnerDisplayName` og `OwnerUserId`, og fyll dem i eksisterende endepunkter (`GetAllRecipes`, `GetRecipeById`, `GetNewestRecipes`, `GetLikedRecipes`)
- [x] Task 3: Implementer `GET /api/recipes/mine` — oppskrifter eid av innlogget bruker, nyeste først. xUnit-test: returnerer kun egne
- [x] Task 4: Implementer `GET /api/recipes/by-user/{userId:int}` med `ApplyVisibilityFilter` på kallerens tilgang. xUnit-test: bruker A ser ikke bruker Bs private oppskrifter
- [x] Task 5: Implementer `GET /api/user/{id:int}` — offentlig profil med `displayName` og `recipeCount`, uten e-post. xUnit-test: 404 ved ukjent id, ingen e-post i respons
- [x] Task 6: Trekk ut oppskriftskortet fra `/favoritter` til delt `components/RecipeGridCard.tsx`, og ta den i bruk i `/favoritter` uendret (ren refaktorering, ingen visuell endring)
- [x] Task 7: Legg til `getMyRecipes` og `getRecipesByUser` i `recipe.service.ts`, og `getUserProfile` i en ny `user.service.ts`
- [x] Task 8: Bygg om `/profil` til Min side — header med navn og telling, seksjonene Favoritter og Mine oppskrifter
- [x] Task 8b: Flytt profilredigering til egen side `/profil/rediger`, nådd fra «Rediger profil»-knapp i headeren
- [x] Task 9: Legg til `/profil/[userId]` — read-only profil med navn, antall og brukerens synlige oppskrifter; redirect til `/profil` hvis det er deg selv; "Fant ikke brukeren" ved ukjent id
- [x] Task 10: Gjør "Lagt til av" på oppskriftssiden til visningsnavn som lenker til `/profil/[ownerUserId]` (uten lenke når `ownerUserId` er null)
- [x] Task 11: Fjern `/favoritter` — slett ruten, bytt sidebar-lenken til "Min side" → `/profil`, oppdater breadcrumb, og grep hele repoet for gjenværende referanser
- [ ] Task 12: Legg til Playwright e2e-test for Min side og andres profil, og oppdater eventuelle eksisterende tester som peker på `/favoritter`
- [ ] Task 13: Full inner loop for begge stacks + review-agenter + Playwright MCP-gjennomgang av feature
