# Implementation Plan: Jev-basert kategori- og vanskelighetsklassifisering

## Approach

Ny, frittstående `IJevClassifier` i `Features/Recipes/`, kalt fra
`RecipeUrlProcessor` på et punkt som er felles for begge uttrekksveier. Klassifisereren
kjenner ikke til oppskriftsuttrekk som sådan — den tar tekst og kategorialternativer, og
returnerer id-er. Det gjør den gjenbrukbar for bildeveien senere.

Rekkefølgen bygger nedenfra: kontrakt og DTO-er først, så HTTP-klienten, så DI-oppkobling,
og til slutt innkobling i uttrekksflyten. Hvert steg etterlater grønn build.

## Stacks Affected

- [ ] Frontend
- [x] Backend
- [ ] Infrastructure (kun hvis Key Vault-oppsett gjøres her — egen vurdering ved deploy)

## Key Decisions

- **Vanskelighetsgrad behandles som kategori, ikke eget felt.** `Recipe.Difficulty`
  finnes bare i gamle migrasjoner; dagens modell har `Vanskelighetsgrad` som
  kategorigruppe. Dette gjør begge brukerønskene til én mekanisme og sparer en migrasjon.
- **Én Choice-spørring per gruppe, ikke én samlet.** Jev evaluerer spørsmål parallelt og
  isolert. Gruppevis gir ett valg per gruppe — som er semantikken vi vil ha — og egen
  konfidens per gruppe.
- **`cat_<id>`-nøkler i `criteria`.** `criteria` er et map med nøkkel→beskrivelse. Å kode
  id-en i nøkkelen gir tapsfri tilbakemapping uten navneoppslag, som ellers ville vært
  sårbart for kollasjon og norske tegn.
- **Kall etter `extractedDto` er satt.** Ett innkoblingspunkt dekker både JSON-LD- og
  AI-grenen, i stedet for duplisert logikk i to grener.
- **`Disabled*`-mønsteret gjenbrukes.** Samme form som `DisabledRecipeUrlProcessor`, så
  manglende nøkkel gir degradert funksjon, ikke krasj ved oppstart.
- **Kategorilisten fjernes fra LLM-prompten når Jev er aktiv.** Ellers betaler vi for
  klassifisering to ganger.

## Risks

- **Udokumentert grense på antall kriterier / state-lengde.** Kvantifiser ikke;
  avkort oppskriftsteksten defensivt og logg avvisninger fra API-et.
- **Ingen .NET SDK.** Håndrullet klient må tåle uventet JSON — defensiv parsing,
  `try/catch` rundt deserialisering, aldri kast videre til brukeren.
- **Nye grupper i databasen gir automatisk nye spørsmål.** Ønsket oppførsel, men verdt å
  logge antall grupper så en utilsiktet gruppeeksplosjon blir synlig.
- **Kvalitetsregresjon mot dagens LLM-klassifisering.** Terskelen er konfigurerbar
  nettopp for å kunne justeres uten ny deploy av kode.

## Verification

Backend: `cd backend/RecipeApi && dotnet build` etter hver endring,
`dotnet test` etter logikk. Enhetstester i `backend/RecipeApi.Tests/Recipes/`.
