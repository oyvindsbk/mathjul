# Feature: Matbeholdning, handleliste og forslag fra det vi har

## Summary

Registrer hva husstanden har av mat hjemme — manuelt eller ved å ta bilde av kjøleskapet —
koble det mot ukesplanleggeren for å se hva som mangler, samle det som mangler i en
handleliste, og foreslå oppskrifter ut fra det vi allerede har.

## Motivation

Ukesplanleggeren sier hva vi skal lage, men ikke hva vi må kjøpe. I dag må man gå gjennom
hver oppskrift og sjekke skapene selv.

Det langsiktige målet er å fylle en Oda-handlekurv gradvis ut fra ukeplanen og det vi har.
Denne featuren legger grunnmuren: **beholdning** (hva vi har) og **handleliste** (hva vi
trenger). Handlelisten er det stabile overleveringspunktet en senere Oda-integrasjon leser
fra — se «Videre arbeid».

## Background: Oda MCP

Oda har en offisiell, ekstern MCP-server på `https://oda.com/mcp` (verifisert 2026-10-12):

- Beskyttet med OAuth 2.1: authorization server `https://oda.com/o`, scope `mcp`,
  authorization code + PKCE (S256), refresh tokens.
- **Dynamisk klientregistrering** (`https://oda.com/o/register/`) — mathjul kan registrere
  seg som klient selv, uten manuell avtale.
- Verktøylisten krever innlogging og er ikke kartlagt ennå.

Det betyr at mathjul-backend kan være MCP-klient direkte: brukeren trykker «Koble til
Oda», logger inn hos Oda, og backend lagrer refresh-token. Ingen passord lagres, og det er
ikke et uoffisielt API. Dette er likevel en **egen feature** — det krever token-lagring,
produktmatching (vår «melk» → et konkret Oda-produkt) og avklaring av Odas vilkår for
automatisert bruk.

Denne featuren leverer det Oda-featuren trenger: en handleliste med et ryddig, stabilt
format og en utvidbar `Status`.

## Requirements

### Beholdning
- Beholdningen tilhører en **gruppe** (husstand), som ukeplanen.
- Bruker kan legge til, endre og slette varer manuelt: navn, mengde (valgfri), enhet
  (valgfri), plassering (`kjoleskap` | `fryser` | `skap` | `annet`), best før (valgfri).
- En vare kan markeres som **basisvare** (salt, olje, pepper …). Basisvarer regnes alltid
  som tilgjengelige og spores ikke på mengde.
- Listen grupperes på plassering. Varer med best før innen 3 dager markeres.

### Bildeskanning
- Bruker tar/laster opp 1–4 bilder og velger plassering. Modellen returnerer et **utkast**
  (navn, mengde, enhet). Ingenting lagres før brukeren bekrefter.
- Gjennomgangsskjermen viser utkastet sammenlignet med nåværende beholdning på samme
  plassering: **ny**, **finnes allerede** (mengde vises), og — i erstatt-modus —
  **fjernes** (varer som ikke ble sett).
- To lagringsmoduser:
  - **Legg til** (standard): nye varer opprettes, eksisterende med samme navn og enhet
    får oppdatert mengde. Ingenting slettes.
  - **Erstatt plassering**: som over, men varer på plasseringen som ikke er i utkastet
    slettes. Hver «fjernes»-vare kan krysses av for å beholdes (bildet kan ha gått glipp
    av ting bak andre varer).
- Matching ved lagring er på normalisert navn + enhet, innenfor valgt plassering. Et
  skann-resultat viser det som ligger der *nå*, så mengden i utkastet **erstatter**
  eksisterende mengde (summeres ikke). Utkast uten enhet matcher på navn alene og
  endrer ikke mengden (enhetene er ikke sammenlignbare). Doble rader i ett utkast slås
  sammen først.
- **Basisvarer slettes aldri av «Erstatt plassering»** — et bilde som ikke viser saltet
  betyr ikke at saltet er borte.
- Tomt utkast kan ikke lagres, så «Erstatt» aldri kan tømme en plassering ved et uhell.
- Utkastet kan redigeres direkte i listen (endre, slette, legge til rad).
- Bilder lagres ikke — verken i blob storage eller database.

### Korreksjonsboks
- På gjennomgangsskjermen kan brukeren skrive en instruksjon på norsk, f.eks.
  «fjern yoghurten, det er 2 melk, legg til 12 egg».
- Backend sender utkast + instruksjon til en liten modell som returnerer
  **strukturerte endringer** (`add` / `remove` / `update`). Backend validerer og
  anvender dem, og returnerer det nye utkastet.
- Hver korreksjon er tilstandsløs: ingen samtalehistorikk.
- Avkrysning «Se på bildet igjen» sender originalbildene med (for «du gikk glipp av
  smøret»). Av som standard — tekstkorreksjon er billigere.
- Ugyldige endringer (ukjent indeks, tomt navn, negativ mengde) forkastes enkeltvis og
  rapporteres; gyldige endringer anvendes likevel.

### Ukeplan-kobling
- For en uke vises, per planlagt oppskrift, hver ingrediens med status:
  - **har** — eksakt navnetreff i beholdningen, eller basisvare
  - **kanskje** — delvis treff (se Matching)
  - **mangler** — ingen treff
- Ingredienser hentes fra `Ingredients` og alle `IngredientSections`, samt fra
  oppskriftens tilbehør (`SideDishes`).
- Matkasse- og egendefinerte innslag har ingen ingrediensliste og hoppes over, synlig
  merket.
- «Hva mangler denne uka?» samler manglende ingredienser for hele uka, slått sammen på
  normalisert navn. Mengder summeres bare når enheten er lik; ellers listes de separat.
- Bruker velger hvilke som skal på handlelisten (alle «mangler» avkrysset, «kanskje» ikke).

### Handleliste
- Tilhører gruppen. Varer har navn, mengde, enhet, valgfritt notat, kilde
  (`manuell` | `ukeplan`) og status (`aapen` | `kjopt`).
- Legge til manuelt, krysse av som kjøpt, slette, tømme kjøpte.
- Duplikater: legges en vare til med samme normaliserte navn og enhet som en åpen vare,
  summeres mengden i stedet for å lage ny rad.
- «Legg kjøpte i beholdningen»: flytter kjøpte varer til beholdningen (bruker velger
  plassering for hele bunken), og fjerner dem fra handlelisten.

### Forslag: hva kan vi lage?
- Rangerer oppskrifter synlige for gruppen etter hvor stor andel av ingrediensene
  (ekskl. basisvarer) vi har: `har` = 1, `kanskje` = 0,5.
- Oppskrifter som bruker varer med best før innen 3 dager rangeres høyere ved lik score.
- Krever minst ett treff som ikke er basisvare. Viser topp 10 med hva som mangler.
- Deterministisk — ingen AI-kall.

## Design

### Data Model

```csharp
public class StockItem            // Features/Stock/StockItem.cs
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;
    [StringLength(100)] public string Name { get; set; } = "";
    [StringLength(100)] public string NormalizedName { get; set; } = "";  // indeksert (GroupId, NormalizedName)
    public decimal? Quantity { get; set; }
    [StringLength(20)] public string? Unit { get; set; }
    [StringLength(20)] public string Location { get; set; } = "kjoleskap";
    public DateOnly? BestBefore { get; set; }
    public bool IsStaple { get; set; }
    [StringLength(200)] public string? UpdatedByEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ShoppingListItem     // Features/Stock/ShoppingListItem.cs
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;
    [StringLength(100)] public string Name { get; set; } = "";
    [StringLength(100)] public string NormalizedName { get; set; } = "";
    public decimal? Quantity { get; set; }
    [StringLength(20)] public string? Unit { get; set; }
    [StringLength(200)] public string? Note { get; set; }
    [StringLength(20)] public string Source { get; set; } = "manuell";   // manuell | ukeplan
    [StringLength(20)] public string Status { get; set; } = "aapen";     // aapen | kjopt
    [StringLength(200)] public string? CreatedByEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? BoughtAt { get; set; }
}
```

Begge slettes kaskadert med gruppen. `Status` er streng, ikke bool, slik at en senere
Oda-feature kan legge til f.eks. `i-kurv` uten migrering av eksisterende data.

### Matching (`IngredientMatcher`, ren statisk klasse)

Normalisering:
1. Små bokstaver, trim, fjern innhold i parentes.
2. Kutt etter første komma («løk, finhakket» → «løk»).
3. Fjern tegnsetting, slå sammen mellomrom.
4. Fjern et lite sett tilberedningsord som første ord: `fersk`, `frossen`, `hakket`,
   `revet`, `kokt`, `finhakket`.

Treff, i prioritert rekkefølge:
1. **har**: normalisert navn er likt.
2. **kanskje**: det ene navnet er et helt ord i det andre («rød paprika» / «paprika»),
   eller sammensatt-ord-treff der det korteste navnet er ≥ 4 tegn og er prefiks eller
   suffiks av det lengste («kyllingfilet» / «kylling», «lettmelk» / «melk»).
3. **mangler**.

Grensen på 4 tegn hindrer falske treff som «ris» i «kapris». Mengder sammenlignes **ikke**
i denne featuren — stk/g/dl/pakke lar seg ikke omregne pålitelig. Beholdningens mengde
vises ved siden av treffet så brukeren kan vurdere selv.

Ingen AI i matchingen. Hvis «kanskje» viser seg å være for upresist, er neste steg en
lært aliastabell (brukeren bekrefter et treff én gang) — se «Videre arbeid».

### AI-tjenester

Følger mønsteret fra `MatkasseImageProcessor`: Azure AI Foundry, `Disabled*`-variant når
konfigurasjon mangler, registrert betinget i `Program.cs`.

| Tjeneste | Konfignøkkel | Standard |
|---|---|---|
| `IStockScanProcessor` | `AiFoundry:StockScanModelName` | `gpt-5.4-mini` |
| `IStockCorrectionProcessor` | `AiFoundry:StockCorrectionModelName` | `gpt-5.4-mini` |

- Strukturert output med JSON-schema (`ChatResponseFormat.CreateJsonSchemaFormat`,
  `strict: true`) i stedet for fri JSON i prompten.
- Bilder skaleres til maks 1536 px (ImageSharp) før sending.
- Korreksjon: utkastet sendes som nummerert liste; endringer refererer til indeks.
  Maks 100 rader i utkastet, maks 500 tegn instruksjon.

### API Changes

Alle under `api/groups/{groupId:int}/…`, krever gruppemedlemskap (samme
`IsGroupMemberAsync`-mønster som `MealPlansController`; 403 ellers).

| Metode | Rute | Beskrivelse |
|---|---|---|
| GET | `stock` | Alle varer i beholdningen |
| POST | `stock` | Opprett vare |
| PUT | `stock/{id}` | Oppdater vare |
| DELETE | `stock/{id}` | Slett vare |
| POST | `stock/scan` | multipart: `images[]`, `location` → `{ items: DraftItem[] }` |
| POST | `stock/scan/correct` | multipart: `draft` (JSON), `instruction`, valgfri `images[]` → `{ items, applied, rejected }` |
| POST | `stock/scan/apply` | `{ location, mode: "legg-til" \| "erstatt", items, keepIds }` |
| GET | `stock/week-coverage?weekStart=yyyy-MM-dd` | Per innslag: ingredienser med status + samlet «mangler» |
| GET | `stock/suggestions?limit=10` | Rangerte oppskrifter med dekning og manglende |
| GET | `shopping-list?status=aapen` | Handleliste (status valgfri) |
| POST | `shopping-list` | Legg til én eller flere varer (med sammenslåing) |
| PATCH | `shopping-list/{id}` | Endre felt / status |
| DELETE | `shopping-list/{id}` | Slett vare |
| DELETE | `shopping-list?status=kjopt` | Tøm kjøpte |
| POST | `shopping-list/move-to-stock` | `{ location }` — flytt kjøpte til beholdning |

`DraftItem`: `{ name, quantity?, unit? }`.

### UI Changes

- Ny side `/beholdning` med gruppevelger (samme mønster som ukesplanleggeren,
  `?groupId=`) og tre faner: **Beholdning**, **Handleliste**, **Forslag**.
- Én ny navigasjonsoppføring «Beholdning» i `Sidebar` og `BottomNav`.
- Beholdning-fanen: liste gruppert på plassering, «+ Legg til», «📷 Skann».
- Skann-flyt: velg plassering → bilder → gjennomgang (utkast, diff-merker, modus,
  korreksjonsboks, «Lagre»).
- Ukesplanlegger: `DayDetailModal` viser ingrediensstatus for oppskriften; ny knapp
  «Hva mangler denne uka?» åpner et panel med avkrysning og «Legg på handlelisten».
- All tekst på norsk.

## Out of Scope

- Oda-integrasjon (handlekurv, produktsøk, innlogging).
- Automatisk nedtrekk av beholdning når en planlagt rett lages. Beholdningen holdes
  oppdatert manuelt eller ved ny skanning («Erstatt plassering»).
- Mengdesammenligning og enhetsomregning.
- Lært aliastabell for ingrediensnavn.
- Chat / samtalehistorikk.
- Strekkodeskanning.

## Videre arbeid

1. **Oda-overlevering** — egen feature. «Koble til Oda» (OAuth mot `oda.com/o`, refresh
   token lagret kryptert per gruppe), deretter «Send til Oda»: for hver åpen vare søk
   produkt via Oda MCP, la brukeren bekrefte valget første gang (huskes per normalisert
   navn), legg i kurv, sett status `i-kurv`. Kartlegg verktøylisten først.
2. **«Marker som laget»** på et ukeplan-innslag som trekker matchede varer fra beholdningen.
3. **Aliastabell** hvis «kanskje»-treff blir for mange.

## Open Questions

Alle har en foreslått standard; bekreft eller korriger før implementering.

1. **Per gruppe?** Foreslått: ja, beholdning og handleliste tilhører gruppen, som ukeplanen.
2. **«Erstatt plassering»** — ønsket, eller bare «Legg til»? Foreslått: begge, med
   «Legg til» som standard.
3. **Tilbehør i ukeplan-dekningen** — foreslått: ja, tilbehørets ingredienser telles med.
