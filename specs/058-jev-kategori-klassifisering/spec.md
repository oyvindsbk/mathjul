# Feature: Jev-basert kategori- og vanskelighetsklassifisering

## Summary

Bruk TypeSafe AI sin Jev-modell (System One) til å foreslå kategorier — inkludert
vanskelighetsgrad — ved oppskriftsuttrekk, i stedet for å la den store språkmodellen
gjøre klassifiseringen som en del av fritekst-uttrekket.

## Motivation

To problemer i dagens flyt:

1. **JSON-LD-sider får ingen kategoriforslag.** `RecipeUrlProcessor` kortslutter til
   JSON-LD når siden har strukturerte data, og hopper da over AI-kallet helt. Resultatet
   er at `SuggestedCategoryIds` blir tom, og brukeren må huke av alt selv — på nøyaktig
   de sidene som ellers gir best uttrekk.
2. **Klassifisering er dyr som fritekst.** Kategorivalg er et lukket valg fra en kjent
   liste. Å be en stor språkmodell om det koster fullt tokenbudsjett og gir ingen
   konfidens tilbake.

Jev er bygget for nettopp lukkede valg: den svarer med valgt alternativ, konfidens og
sannsynlighetsfordeling, til en brøkdel av kost og latens.

## Background: hva Jev kan og ikke kan

Jev har tre primitiver: **Choice** (velg fra lukket liste), **Score** (rubrikk) og
**Noul** (sannhetsgrad 0–1). Den har *ingen* primitiv for åpen strukturert uttrekking.

Derfor erstatter denne featuren **ikke** fritekst-uttrekket i `RecipeUrlProcessor`
(tittel, ingredienser, instruksjoner osv.) — det blir liggende på `gpt-5.4-mini`.
Jev overtar kun klassifiseringsdelen.

## Key insight: vanskelighetsgrad *er* en kategori

`Recipe.Difficulty` finnes kun i historiske migrasjoner og er ikke et felt på entiteten
i dag. Vanskelighetsgrad er en **kategorigruppe** (`Vanskelighetsgrad`: Enkel / Middels /
Avansert), på lik linje med `Måltidstype`.

Både kategori- og vanskelighetsforslag går altså gjennom samme mekanisme:
`ExtractedRecipeDto.SuggestedCategoryIds`. Ingen nye felter på `Recipe`.

## Requirements

- Én Jev **Choice**-spørring per kategorigruppe, med gruppens rader som alternativer.
- Alternativlisten bygges per request fra databasen, slik `BuildCategoryListJsonAsync`
  gjør i dag. Kategorier er databaserader, ikke en enum.
- `Tilbehør` (id 16) holdes fortsatt utenfor AI-en — det er et bevisst brukervalg.
- Jev kjører på **begge** uttrekksveier, også JSON-LD-veien.
- Forslag under en konfigurerbar konfidensterskel forkastes (start: 0.6).
- Ved feil eller timeout mot Jev: uttrekket lykkes uten kategoriforslag. Logg, ikke kast.
- Manglende API-nøkkel skal ikke kunne velte oppstart — mønsteret med `Disabled*`-
  implementasjon følges.

## Design

### Data Model

Ingen endringer på `Recipe`. Ingen migrasjon.

`ExtractedRecipeDto.SuggestedCategoryIds` (finnes allerede) er det eneste utdatafeltet.

### Ny komponent: `IJevClassifier`

```csharp
public interface IJevClassifier
{
    Task<IReadOnlyList<int>> SuggestCategoryIdsAsync(
        string recipeText,
        IReadOnlyList<CategoryOption> categories,
        CancellationToken cancellationToken = default);
}

public sealed record CategoryOption(int Id, string Name, string Group);
```

To implementasjoner, valgt i `Program.cs` etter om `Jev:ApiKey` finnes:

- `JevClassifier` — ekte HTTP-kall via `IHttpClientFactory`.
- `DisabledJevClassifier` — returnerer tom liste. Speiler `DisabledRecipeUrlProcessor`.

### Jev API-kontrakt

`POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`.

Request:

```json
{
  "state": "<oppskriftstekst>",
  "model": "jev-latest",
  "questions": {
    "gruppe_maltidstype": {
      "type": "choice",
      "instructions": "Hvilken måltidstype passer denne oppskriften best",
      "criteria": { "cat_3": "Frokost", "cat_4": "Middag" }
    },
    "gruppe_vanskelighetsgrad": {
      "type": "choice",
      "instructions": "Hvor krevende er denne oppskriften å lage",
      "criteria": { "cat_9": "Enkel", "cat_10": "Middels", "cat_11": "Avansert" }
    }
  }
}
```

Response:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "gruppe_maltidstype": {
      "type": "choice", "choice": "cat_4", "confidence": 0.78,
      "probabilities": { "cat_4": 0.85, "cat_3": 0.15 }
    }
  },
  "usage": { "input_tokens": 392, "output_tokens": 65 }
}
```

**Nøkkeldetalj:** `criteria` er et *map* fra nøkkel til beskrivelse, ikke en liste.
Kategori-id-er kodes derfor som `cat_<id>` og dekodes tilbake fra `choice`. Både
spørsmålsnøkler og kriterienøkler må saneres til trygge identifikatorer (norske tegn,
mellomrom).

### Integrasjon i uttrekksflyten

I `RecipeUrlProcessor.ExtractRecipeFromUrlAsync`, etter at `extractedDto` er satt —
altså felles for både JSON-LD-grenen og AI-grenen:

1. Bygg oppskriftstekst for klassifisering (tittel + beskrivelse + ingredienser +
   instruksjoner), avkortet til en rimelig lengde.
2. Kall `IJevClassifier`.
3. Sett `extractedDto.SuggestedCategoryIds` fra resultatet.

Når Jev er aktiv, fjernes kategorilisten fra `gpt-5.4-mini`-prompten så vi ikke betaler
for samme klassifisering to ganger.

### API Changes

Ingen nye endepunkter. Eksisterende uttrekksendepunkter får bedre utfylt
`suggestedCategoryIds` i responsen.

### UI Changes

Ingen. Frontend leser `suggestedCategoryIds` som før; feltet er bare oftere utfylt.

### Konfigurasjon

| Nøkkel | Standard | Beskrivelse |
|---|---|---|
| `Jev:ApiKey` | — | API-nøkkel. Mangler den, brukes `DisabledJevClassifier`. |
| `Jev:Endpoint` | `https://api.typesafe.ai/v1/systemone` | Endepunkt |
| `Jev:ModelName` | `jev-latest` | Modell |
| `Jev:ConfidenceThreshold` | `0.6` | Forslag under terskel forkastes |
| `Jev:TimeoutSeconds` | `10` | Timeout |

Lokalt via user-secrets, i prod via Key Vault. Aldri hardkodet.

## Out of Scope

- Erstatte fritekst-uttrekket. Jev kan ikke gjøre åpen uttrekking.
- Nytt `Difficulty`-felt på `Recipe`. Vanskelighetsgrad er en kategori.
- Noul-basert forhåndssjekk ("er dette en oppskrift?") og `NoCookTime`-utledning —
  mulige oppfølgere, ikke med her.
- Lagring av konfidens i databasen eller visning i UI.
- Bildeuttrekksveien (`RecipeImageProcessor`) — klassifisereren designes gjenbrukbar,
  men kobles ikke på her.

## Open Questions

Ingen — avklart med bruker: Jev kjører på begge veier, terskel forkaster lave forslag,
og feil degraderer stille.
