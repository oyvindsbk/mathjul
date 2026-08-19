# Tasks: Tilbehør inline i oppskrift

## Tasks

- [x] Task 1: Datamodell og migrering — `DisplayMode` på `RecipeSideDish`, konstantklasse
      `SideDishDisplayModes` (`Link`/`Inline`), EF-konfigurasjon med default `'Link'`, og
      generert migrering. Gate: `dotnet build` + `dotnet test`.

- [x] Task 2: Skrivevei — `InlineSideDishIds` på `UpdateRecipeRequest` og
      `SaveExtractedRecipeRequest`, persistering av `DisplayMode`, og validering av at
      lista er en delmengde av `SideDishIds`. Tester for delmengde-regelen og for at
      utelatt felt gir `Link`. Gate: `dotnet build` + `dotnet test`.

- [x] Task 3: Flettehjelper — privat hjelper som bygger de sammenfletta
      `IngredientSections`/`InstructionSections`, inkludert flat→seksjon-konvertering av
      hovedretten og hopp over tomme tilbehør. Tester: flat hovedrett beholder egne
      ingredienser, seksjonsbasert hovedrett beholder sine, rekkefølge følger `SortOrder`,
      `Link`-tilbehør flettes ikke. Gate: `dotnet build` + `dotnet test`.

- [x] Task 4: Lesevei — `DisplayMode` på `RecipeRefDto`, fletting i
      `RecipesController.GetRecipe` og i `PublicRecipesController` (der `SideDishes`-
      titlene filtreres til kun `Link`). Gate: `dotnet build` + `dotnet test`.

- [x] Task 5: `RecipeForm` — Lenke/Innflettet-bryter per valgt tilbehør, `inlineSideDishIds`
      i skjemaets tilstand og i lagringskallet. Gate: `npm run lint` + `tsc --noEmit` +
      `npm run build`.

- [x] Task 6: Visning og edit-populering — `RecipeBody` filtrerer chips til `Link`, og
      redigeringssiden populerer `inlineSideDishIds` fra detaljresponsen så valget
      overlever lagring. Gate: `npm run lint` + `tsc --noEmit` + `npm run build`.

- [x] Task 7: E2E og sluttverifisering — Playwright-dekning for innflettet tilbehør på
      detaljsiden, gjennomgang i matlagingsmodus og på delt lenke, review-agentene, og
      visuell sjekk i browser. Gate: full inner loop for begge stacker.

## Notes fra implementeringen

- **Task 4 vokste med `?merged=false`.** Redigeringsskjemaet leser de samme
  `ingredientSections` / `instructionSections` som detaljsiden, og skriver dem rett tilbake
  ved lagring. Uten en umerget lesevei ville første lagring etter innfletting kopiert
  tilbehørets innhold permanent inn i hovedretten — og for en flat hovedrett ville
  flat→seksjon-konverteringen i tillegg spist de flate listene. Dekket av
  `EditRoundTrip_ThroughTheUnmergedView_DoesNotAbsorbTheSideDish`.

- **Playwright fikk to dev-servere.** De nye testene stubber API-svar med `page.route`, og
  det krever at `getRecipeById` faktisk gjør et kall — med `NEXT_PUBLIC_MOCK_DATA=true`
  kortslutter den mot `mockRecipes` før noen request sendes. Resten av suiten leser derimot
  nettopp de mock-dataene. Løsningen er to servere i `playwright.config.ts`: `:3000` med mock
  på for de eksisterende testene, `:3001` med mock av for de stubbede, og et eget
  `chromium-stubbed`-prosjekt som kjører sistnevnte. Begge setter `NEXT_PUBLIC_MOCK_DATA`
  eksplisitt, så en lokal `.env.local`-override ikke lenger kan velte suiten i stillhet.

- **Task 7 fulgte husets E2E-konvensjon.** Suiten kjører mot en frontend-only dev-server
  uten backend, så de nye testene stubber API-svarene slik `del-oppskrift.spec.ts` gjør.
  Selve flettingen er dekket av backend-testene; E2E dekker frontend-kontrakten rundt den
  (chip-filtrering, bryteren, edit-populering, matlagingsmodus, delt lenke).

- **Verifisert mot ekte SQL Server** i tillegg til testene: migreringen kjørte rent, og
  detalj-, edit- og oppdateringsveiene ble sjekket i browser på levende data.
