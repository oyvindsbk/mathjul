# Implementation Plan: Matbeholdning, handleliste og forslag

## Approach

Ny vertikal slice `Features/Stock/` i backend med to entiteter (`StockItem`,
`ShoppingListItem`), én ren matching-klasse (`IngredientMatcher`) som både ukeplan-dekning
og forslag bygger på, og to små AI-tjenester (skann, korreksjon) etter samme mønster som
`MatkasseImageProcessor`.

Rekkefølge: datamodell → ren logikk med tester → CRUD-API → avledet API (dekning,
forslag) → AI-API → frontend fane for fane → ukeplan-integrasjon sist, siden den
avhenger av alt annet.

All forretningslogikk som kan testes uten AI (normalisering, matching, sammenslåing i
handleliste, anvendelse av korreksjonsendringer, lagringsmodus for skann) ligger i rene
funksjoner med xUnit-tester. AI-tjenestene er tynne: bygg prompt → kall → parse til
typede objekter.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure — ingen nye ressurser; bruker eksisterende AI Foundry-endepunkt.
  Nye modellnavn er valgfrie konfigverdier med standard `gpt-5.4-mini`.

## Key Decisions

- **Per gruppe, ikke per bruker.** Ukeplanen er per gruppe; beholdningen må være det
  samme for at koblingen skal gi mening.
- **Deterministisk matching, ingen AI.** Ukeplan-dekning og forslag kjøres ofte og over
  mange oppskrifter. Navnematching med «har / kanskje / mangler» er gratis, forutsigbar
  og testbar. AI brukes kun der input er ustrukturert (bilde, fritekst-korreksjon).
- **Ingen mengdesammenligning.** Enhetsomregning (stk ↔ g ↔ pakke) er upålitelig.
  Status er tilstede/ikke tilstede; mengden vises for menneskelig vurdering.
- **Korreksjon returnerer endringer, ikke ny liste.** Modellen returnerer
  `add/remove/update` med indeks. Backend validerer og anvender. Det gjør feil synlige
  (avviste endringer rapporteres) og hindrer at modellen stille dropper rader.
- **Strukturert output med JSON-schema** i nye AI-tjenester, i stedet for
  JSON-i-prompt + manuell opprydding som i `MatkasseImageProcessor`.
- **Tilstandsløs skann/korreksjon.** Utkastet lever i frontend til «Lagre». Bilder
  lagres aldri; korreksjon med «se på bildet igjen» sender dem på nytt fra nettleseren.
- **`Status` som streng** på handlelisten, så Oda-featuren kan legge til `i-kurv`.
- **Én side, tre faner** (`/beholdning`) — én ny nav-oppføring, ikke tre.
- **Beregning i minnet.** Forslag laster alle synlige oppskrifter og matcher i minnet.
  Familieskala (titalls–hundrevis av oppskrifter) gjør dette uproblematisk; bruk
  `AsNoTracking` og projiser kun ingrediensfeltene.

## Risks

- **«kanskje»-treff blir støy** (norske sammensatte ord). Mitigering: 4-tegnsgrense,
  «kanskje» er ikke avkrysset som standard i «Hva mangler». Aliastabell er notert som
  videre arbeid.
- **Skanning bommer på varer.** Mitigering: alltid utkast før lagring, «Legg til» som
  standard, eksplisitt «behold»-avkrysning i «Erstatt plassering», korreksjonsboks.
- **Beholdningen drifter** fordi forbruk ikke trekkes fra. Mitigering: ny skanning med
  «Erstatt plassering» er den billige synkroniseringen. «Marker som laget» er videre arbeid.
- **Modellen svarer utenfor schema / avkortet.** Mitigering: `strict` schema, sjekk
  `FinishReason.Length`, norsk feilmelding som i Matkasse.
- **Store bilder fra mobil** gir høy kost og treg respons. Mitigering: skaler til 1536 px
  før sending, maks 4 bilder, maks 10 MB per bilde.
