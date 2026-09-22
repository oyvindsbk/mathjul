# Tasks: Jev-basert kategori- og vanskelighetsklassifisering

## Tasks

- [x] Task 1: Kontrakt og konfigurasjon. Legg til `IJevClassifier`, `CategoryOption`,
      `JevOptions` (Endpoint, ApiKey, ModelName, ConfidenceThreshold, TimeoutSeconds) og
      `DisabledJevClassifier` som returnerer tom liste. Ingen HTTP ennå.
      Verifisering: `dotnet build`.

- [x] Task 2: `JevClassifier` — request-bygging. Bygg `questions`-objektet fra
      kategorilisten: gruppér på `Group`, én Choice per gruppe, `criteria` som
      `cat_<id>` → navn, sanerte spørsmålsnøkler. Ren funksjon, ingen nettverk.
      Enhetstester på gruppering, nøkkelsanering (norske tegn) og tom liste.
      Verifisering: `dotnet build` + `dotnet test`.

- [x] Task 3: `JevClassifier` — response-parsing. Dekod `answers`, map `choice`
      tilbake til id, filtrer på `ConfidenceThreshold`. Defensiv parsing: ukjent nøkkel,
      manglende felt og ugyldig JSON gir tom liste, ikke exception.
      Enhetstester inkludert terskel akkurat over/under og misformet respons.
      Verifisering: `dotnet build` + `dotnet test`.

- [x] Task 4: HTTP-kall og DI. Koble request/response sammen med `IHttpClientFactory`,
      bearer-auth, timeout. `try/catch` rundt hele kallet — feil logges og gir tom liste.
      Registrer i `Program.cs` med samme betingede mønster som `IRecipeUrlProcessor`.
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 5: Koble inn i uttrekksflyten. Kall klassifisereren i
      `RecipeUrlProcessor.ExtractRecipeFromUrlAsync` etter at `extractedDto` er satt, slik
      at både JSON-LD- og AI-grenen dekkes. Bygg klassifiseringstekst fra tittel,
      beskrivelse, ingredienser og instruksjoner, avkortet. Rapporter stegnavn via
      `reportStage`. Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 6: Fjern kategorilisten fra LLM-prompten når Jev er aktiv, så klassifisering
      ikke betales for to ganger. `BuildSystemPrompt` må fortsatt fungere uten
      kategoriliste (den har allerede en gren for det).
      Verifisering: `dotnet build` + `dotnet test`.

- [ ] Task 7: Dokumentasjon og hemmeligheter. Dokumentér `Jev:*`-nøklene, legg inn
      user-secrets-oppsett lokalt og Key Vault-referanse for prod. Ingen nøkler i kode
      eller i appsettings som sjekkes inn.
      Verifisering: `dotnet build`, og `az bicep build` hvis infra endres.
