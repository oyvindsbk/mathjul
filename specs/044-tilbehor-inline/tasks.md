# Tasks: Tilbehør inline i oppskrift

## Tasks

- [ ] Task 1: Datamodell og migrering — `DisplayMode` på `RecipeSideDish`, konstantklasse
      `SideDishDisplayModes` (`Link`/`Inline`), EF-konfigurasjon med default `'Link'`, og
      generert migrering. Gate: `dotnet build` + `dotnet test`.

- [ ] Task 2: Skrivevei — `InlineSideDishIds` på `UpdateRecipeRequest` og
      `SaveExtractedRecipeRequest`, persistering av `DisplayMode`, og validering av at
      lista er en delmengde av `SideDishIds`. Tester for delmengde-regelen og for at
      utelatt felt gir `Link`. Gate: `dotnet build` + `dotnet test`.

- [ ] Task 3: Flettehjelper — privat hjelper som bygger de sammenfletta
      `IngredientSections`/`InstructionSections`, inkludert flat→seksjon-konvertering av
      hovedretten og hopp over tomme tilbehør. Tester: flat hovedrett beholder egne
      ingredienser, seksjonsbasert hovedrett beholder sine, rekkefølge følger `SortOrder`,
      `Link`-tilbehør flettes ikke. Gate: `dotnet build` + `dotnet test`.

- [ ] Task 4: Lesevei — `DisplayMode` på `RecipeRefDto`, fletting i
      `RecipesController.GetRecipe` og i `PublicRecipesController` (der `SideDishes`-
      titlene filtreres til kun `Link`). Gate: `dotnet build` + `dotnet test`.

- [ ] Task 5: `RecipeForm` — Lenke/Innflettet-bryter per valgt tilbehør, `inlineSideDishIds`
      i skjemaets tilstand og i lagringskallet. Gate: `npm run lint` + `tsc --noEmit` +
      `npm run build`.

- [ ] Task 6: Visning og edit-populering — `RecipeBody` filtrerer chips til `Link`, og
      redigeringssiden populerer `inlineSideDishIds` fra detaljresponsen så valget
      overlever lagring. Gate: `npm run lint` + `tsc --noEmit` + `npm run build`.

- [ ] Task 7: E2E og sluttverifisering — Playwright-dekning for innflettet tilbehør på
      detaljsiden, gjennomgang i matlagingsmodus og på delt lenke, review-agentene, og
      visuell sjekk i browser. Gate: full inner loop for begge stacker.
