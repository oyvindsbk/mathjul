# Tasks: Søk i "Alle oppskrifter" + kompakt filtrering

## Tasks

- [x] Task 1: Backend — `search`-parameter i `GET /api/recipes`.
      Utvid `GetAllRecipes` i `Features/Recipes/RecipesController.cs` med
      `[FromQuery] string? search = null`. Trim, ignorer blank, avkort til 100 tegn,
      escape `%`/`_`/`[` og filtrer med `EF.Functions.Like` på `Title` etter
      synlighets- og kategorifiltrering.
      Verifisering: `cd backend/RecipeApi && dotnet build`.

- [x] Task 2: Backend-tester for søk.
      xUnit-tester i `backend/RecipeApi.Tests/` som dekker: treff på delstreng,
      case-insensitivitet, ingen treff, blank `search` gir alle, `%` i søketekst
      behandles som literal, og søk kombinert med `categories` filtrerer på begge.
      Verifisering: `cd backend/RecipeApi && dotnet test`.

- [x] Task 3: Frontend service — `search`-argument i `getAllRecipes`.
      Utvid signaturen til `getAllRecipes(token?, categoryIds?, groupId?, search?)` i
      `lib/services/recipe.service.ts` og sett `search` query param når den er oppgitt.
      Mock-grenen filtrerer `mockRecipes` på tittel så mock-modus oppfører seg likt.
      Verifisering: `cd frontend && npm run lint && npx tsc --noEmit`.

- [x] Task 4: Frontend — søkefelt med debounce og backend-kall.
      Legg søkefeltet over trekkspillet i `HomeClient.tsx`: `searchInput` (umiddelbar) +
      `searchTerm` (debounced 300 ms), tøm-knapp, kobling mot `getAllRecipes`.
      Søkeoppdateringer skal ikke trigge full skjelettvisning. `AbortController` eller
      id-vakt mot utdaterte svar. Tom-tilstand ved null treff.
      Verifisering: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`.

- [x] Task 5: Frontend — flytt synlighetspillene inn i trekkspillet.
      Fjern pill-raden over listen. Rendre «Synlighet» som første rad inne i
      trekkspillet med samme etikett/pill-layout som kategorigruppene. Endre
      knappe-etiketten til «Filtre», la teller-badgen summere kategorier + synlighet ≠ «Alle»,
      og la «Fjern alle filtre» nullstille begge.
      Verifisering: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`.

- [x] Task 6: Frontend — URL-state for søk og filtre.
      Les `q`, `cat` og `vis` fra `useSearchParams` ved montering (én gang, `useRef`-vakt),
      og speil state tilbake med `router.replace` etter debounce. Utelat tomme parametre.
      Åpne trekkspillet automatisk når `cat` eller `vis` er satt ved lasting.
      Verifisering: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`.

- [x] Task 7: Frontend — nedtrekksliste med søkeforslag.
      Vis maks 8 treff fra `filteredRecipes` under søkefeltet ved fokus og ≥2 tegn,
      med miniatyrbilde + tittel og «Viser 8 av N treff» ved flere. Klikk navigerer til
      `/recipes/[id]`. Tastaturnavigasjon (↓/↑/Enter/Escape), lukking ved klikk utenfor,
      og kombobox-ARIA (`role="listbox"`/`option`, `aria-expanded`, `aria-activedescendant`).
      Bruk `onMouseDown` så blur ikke stjeler klikket.
      Verifisering: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`.

- [x] Task 8: Playwright E2E-tester.
      Tester i `frontend/tests/e2e/`: søk filtrerer rutenettet; nedtrekkslisten viser treff
      og navigerer ved klikk; synlighetsvalg inne i trekkspillet filtrerer; teller-badgen
      viser riktig antall; delt URL med `?q=`/`?cat=`/`?vis=` gjenoppretter tilstanden og
      åpner trekkspillet; tom-tilstand ved null treff.
      Verifisering: `cd frontend && npx playwright test`.
