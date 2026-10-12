# Tasks: Matbeholdning, handleliste og forslag

## Tasks

- [x] Task 1: Datamodell. Legg til `StockItem` og `ShoppingListItem` i `Features/Stock/`,
      registrer i `RecipeDbContext` (indeks på `(GroupId, NormalizedName)`, kaskadesletting
      med gruppe), lag EF-migrering. Konstanter for gyldige `Location`/`Source`/`Status`.
      Verifisering: `dotnet build` + `dotnet test`.

- [x] Task 2: `IngredientMatcher`. Ren statisk klasse: `Normalize(string)` og
      `Match(string ingredient, IReadOnlyList<StockItem> stock)` → `har | kanskje | mangler`
      + matchet vare. Tester: parentes, komma, tilberedningsord, eksakt treff, helt-ord-treff,
      sammensatt ord (prefiks/suffiks), 4-tegnsgrensen («ris»/«kapris» gir ikke treff),
      basisvare gir alltid «har», tom beholdning.
      Verifisering: `dotnet build` + `dotnet test`.

- [x] Task 3: Beholdning-API. `StockController` på `api/groups/{groupId}/stock`:
      GET, POST, PUT, DELETE. Gruppemedlemskap (403), validering av `Location`, lengder,
      ikke-negativ mengde. `NormalizedName` settes via `IngredientMatcher.Normalize`.
      Tester: CRUD, 403 for ikke-medlem, 404 for vare i annen gruppe, ugyldig plassering.
      Verifisering: `dotnet build` + `dotnet test`.

- [x] Task 4: Handleliste-API. `ShoppingListController` på `api/groups/{groupId}/shopping-list`:
      GET (statusfilter), POST (én eller flere, sammenslåing på normalisert navn + enhet),
      PATCH, DELETE, DELETE `?status=kjopt`, POST `move-to-stock`. Sammenslåing som ren
      funksjon. Tester: sammenslåing lik/ulik enhet, kjøpt-vare slås ikke sammen med ny,
      move-to-stock oppretter beholdning og fjerner fra liste, 403.
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 5: Ukeplan-dekning og forslag. `StockCoverageService` med
      `GetWeekCoverage(groupId, weekStart)` og `GetSuggestions(groupId, limit)`. Ingredienser
      fra `Ingredients` + `IngredientSections` + tilbehør. Matkasse/egendefinert merkes
      `utenIngredienser`. Samlet «mangler» slått sammen på normalisert navn, mengde summert
      ved lik enhet. Forslag: score (har=1, kanskje=0,5, ekskl. basisvarer), best-før-boost,
      minst ett ikke-basis-treff. Endepunkter `GET stock/week-coverage` og
      `GET stock/suggestions`. Tester for begge, inkludert seksjonsingredienser og tilbehør.
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 6: Skann-backend. `IStockScanProcessor` + `StockScanProcessor` +
      `DisabledStockScanProcessor`, DI i `Program.cs` med samme betingede mønster.
      JSON-schema-output, skalering til 1536 px, maks 4 bilder / 10 MB, filtypesjekk.
      Endepunkter `POST stock/scan` og `POST stock/scan/apply` (modus `legg-til` / `erstatt`,
      `keepIds`). Apply-logikken som ren funksjon med tester: ny vare, oppdatert mengde,
      erstatt sletter usette, `keepIds` beholdes, andre plasseringer urørt.
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 7: Korreksjon-backend. `IStockCorrectionProcessor` + implementasjon + Disabled,
      DI. Schema for endringer (`add` / `remove` / `update` med indeks). Validering og
      anvendelse som ren funksjon: ukjent indeks, tomt navn, negativ mengde, to endringer på
      samme indeks, remove + update på samme rad. Endepunkt `POST stock/scan/correct`
      (valgfrie bilder). Grenser: 100 rader, 500 tegn.
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 8: Frontend — beholdning-fanen. `stock.service.ts` (typer uten `any`), side
      `/beholdning` med gruppevelger (`?groupId=`, mønster fra ukesplanleggeren), faner,
      liste gruppert på plassering, best-før-markering, legg til / endre / slett, basisvare.
      Nav-oppføring i `Sidebar` og `BottomNav`. Playwright-test `beholdning.spec.ts`.
      Verifisering: lint + tsc + build + playwright.

- [ ] Task 9: Frontend — handleliste- og forslagsfanene. Handleliste: legg til, kryss av,
      slett, tøm kjøpte, «Legg kjøpte i beholdningen» med plasseringsvalg. Forslag: topp 10
      med dekningsgrad og manglende ingredienser, lenke til oppskrift.
      Playwright-tester for begge.
      Verifisering: lint + tsc + build + playwright.

- [ ] Task 10: Frontend — skann-flyt. Velg plassering → last opp/ta bilde
      (`capture="environment"`) → gjennomgang: redigerbart utkast, merker
      ny / finnes / fjernes, modusvalg, behold-avkrysning, korreksjonsboks med
      «Se på bildet igjen» og visning av avviste endringer → «Lagre». Bildene holdes kun i
      minnet. Playwright-test med mocket skann- og korreksjonssvar.
      Verifisering: lint + tsc + build + playwright.

- [ ] Task 11: Frontend — ukeplan-integrasjon. `DayDetailModal` viser ingrediensstatus for
      oppskriften (har / kanskje / mangler). Knapp «Hva mangler denne uka?» i
      ukesplanleggeren åpner panel med samlet liste, «mangler» forhåndsavkrysset,
      «Legg på handlelisten». Playwright-test.
      Verifisering: lint + tsc + build + playwright.

- [ ] Task 12: Sluttverifisering. Full indre løkke for frontend og backend, review-agenter,
      gjennomgang av hele flyten med Playwright MCP, start appen for manuell test.
