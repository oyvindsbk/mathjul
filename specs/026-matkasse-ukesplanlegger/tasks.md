# Tasks: Matkasse i ukesplanlegger

## Tasks

### Backend

- [ ] Task 1: Opprett `MatkasseRecipe`-entitet og EF-migrasjon
  - Ny `MatkasseRecipe.cs` i `Features/Matkasse/`
  - Legg til `DbSet<MatkasseRecipe> MatkasseRecipes` i `RecipeDbContext`
  - Legg til nullable `MatkasseRecipeId` + `MatkasseRecipe?`-navigasjon i `MealPlan`
  - Generer EF-migrasjon: `dotnet ef migrations add AddMatkasseRecipes`
  - Verifiser: `dotnet build`

- [ ] Task 2: Implementer `MatkasseController` med GET og DELETE
  - `GET /api/matkasse?groupId=&weekStart=` — hent oppskrifter for uke/gruppe
  - `DELETE /api/matkasse/{id}` — slett én matkasseoppskrift
  - Group membership-sjekk (samme mønster som `MealPlansController`)
  - Verifiser: `dotnet build && dotnet test`

- [ ] Task 3: Implementer `POST /api/matkasse/from-images` med AI-ekstraksjon
  - Multipart: `images[]`, `leverandor`, `groupId`, `weekStart`
  - Gjenbruk bildeopplastings-logikk fra `RecipesController.ExtractRecipeFromImages`
  - Ny system prompt som instruerer AI til å returnere `{ "oppskrifter": [{ "tittel", "beskrivelse", "ingredienser", "instruksjoner" }] }`
  - Lagre alle returnerte oppskrifter som `MatkasseRecipe`-rader
  - Response: array av lagrede matkasseoppskrifter (med Id-er)
  - Verifiser: `dotnet build && dotnet test`

- [ ] Task 4: Oppdater `MealPlanDto` til å støtte matkasseoppskrifter
  - Legg til nullable `MatkasseRecipe`-felt i `MealPlanDto`
  - Oppdater GET-spørringen i `MealPlansController` til å inkludere `MatkasseRecipe`
  - Verifiser: `dotnet build && dotnet test`

### Frontend

- [ ] Task 5: Opprett `matkasse.service.ts`
  - `uploadImages(files, leverandor, groupId, weekStart, token)` → POST `/api/matkasse/from-images`
  - `getMatkasseRecipes(groupId, weekStart, token)` → GET `/api/matkasse?groupId=&weekStart=`
  - `deleteMatkasseRecipe(id, token)` → DELETE `/api/matkasse/{id}`
  - TypeScript-typer: `MatkasseRecipe`, `Leverandor`
  - Verifiser: `npm run lint && npx tsc --noEmit`

- [ ] Task 6: Opprett `MatkasseRecipeCard.tsx`
  - Viser tittel, beskrivelse (avkortet), leverandørbadge med farge
  - Leverandørfarger: Hellofresh=oransje, Kokkeløren=grønn, Godt Levert=rød
  - "Legg til dag"-knapp (trigger `onSelect`-callback)
  - Slett-knapp
  - Verifiser: `npm run lint && npx tsc --noEmit`

- [ ] Task 7: Opprett `MatkassePanelSidebar.tsx`
  - Leverandørvelger (3 knapper/tabs)
  - Ukevelger (mandag-dato, standard = aktiv uke fra `activeDayDate`)
  - Bildeopplastingssone (dra-og-slipp, maks 5 filer, gjenbruk UX fra `last-opp-oppskrift`)
  - "Analyser bilder"-knapp → kaller `uploadImages` → viser liste med `MatkasseRecipeCard`
  - "Legg til i uke"-knapp: fordeler oppskrifter på dag 1–N i valgt uke
  - Laster eksisterende matkasseoppskrifter for valgt uke ved mount
  - Verifiser: `npm run lint && npx tsc --noEmit`

- [ ] Task 8: Integrer matkasse-panel i `UkesplanleggerClient.tsx`
  - Ny fane "Matkasse" øverst i sidebar (ved siden av oppskriftspicker)
  - Tab-state: "oppskrifter" | "matkasse"
  - `MatkassePanelSidebar` vises i "matkasse"-tab
  - `handleMatkasseAdd(matkasseRecipe, date)`: oppretter MealPlan med matkasseRecipeId via eksisterende `mealPlanService.createMealPlan` (backend Task 4 gir ny overload)
  - "Legg til i uke": beregn mandag–onsdag (evt. fredag) fra valgt uke, kall `handleMatkasseAdd` for hver
  - Oppdater `MealPlan`-type i `mealplan.service.ts` til å inkludere nullable `matkasseRecipe`
  - Oppdater `DayCell.tsx` til å vise matkasseoppskrift-tittel og leverandørbadge
  - Verifiser: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] Task 9: E2E Playwright-test for matkasse-upload-flow
  - Test: velg leverandør, last opp bilde (mock), verifiser at oppskriftskort vises
  - Test: "Legg til i uke" legger til oppskrifter i kalenderen
  - Verifiser: `npx playwright test`
