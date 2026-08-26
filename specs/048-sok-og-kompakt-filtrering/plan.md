# Implementation Plan: Søk i "Alle oppskrifter" + kompakt filtrering

## Approach

Fire lag, bygget nedenfra og opp:

1. **Backend:** `GET /api/recipes` får en valgfri `search`-parameter som legger et
   `EF.Functions.Like`-filter på tittel etter eksisterende synlighets- og kategorifiltrering.
   xUnit-tester dekker treff, ikke-treff, case-insensitivitet, escaping av `%`/`_`, og at
   søk kombineres riktig med kategorifilteret.
2. **Service:** `recipeService.getAllRecipes()` får et fjerde, valgfritt `search`-argument
   som settes som query param. Bakoverkompatibel signatur — eksisterende kallsteder rører vi ikke.
3. **URL-state:** `HomeClient` leser initialtilstand fra `useSearchParams` og skriver tilbake
   med `router.replace` etter debounce. Én sentral `useEffect` som serialiserer
   `{q, cat, vis}` til en query-streng holder URL og state i synk uten løkker.
4. **UI:** Søkefelt + nedtrekksliste over trekkspillet; synlighetspillene flyttes inn i
   trekkspillet som en «Synlighet»-rad; teller-badge oppdateres til å telle både kategorier
   og synlighet.

Nedtrekkslisten trenger ingen egen datakilde: den rendrer de første 8 elementene av
`filteredRecipes` — samme liste rutenettet bruker — så listen og rutenettet er per
konstruksjon enige.

Debouncing skilles i to states: `searchInput` (umiddelbar, driver inputfeltet) og
`searchTerm` (debounced 300 ms, driver fetch og URL). Det unngår at feltet føles tregt
samtidig som vi ikke spammer backend.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **Søk i backend, ikke klientside:** Forsiden henter i dag alle synlige oppskrifter, så
  klientside-søk ville fungert i dag — men det skalerer ikke, og legger vi til paginering
  senere blir klientside-søk direkte feil. Backend nå sparer en omskriving.
- **Kun tittel:** Bevisst avgrenset. Søk i ingredienser krever join mot ingredienstabellen
  og en helt annen diskusjon om relevans/rangering. Bruker valgte tittel.
- **`LIKE` framfor fulltekstindeks:** Datamengden er små hundretalls oppskrifter per bruker.
  `LIKE '%term%'` gjør en scan, men på dette volumet er det umerkelig, og fulltekstindeks
  er driftskompleksitet vi ikke trenger.
- **Synlighet forblir klientside:** Fungerer i dag på `visibility`/`isLikedByMe` i responsen.
  Å flytte det til backend er en separat, større endring uten gevinst her.
- **`router.replace`, ikke `push`:** Ett tastetrykk = én historikkoppføring ville gjort
  tilbakeknappen ubrukelig.
- **Nedtrekksliste uten eget endepunkt:** Gjenbruk av `filteredRecipes` gir null ekstra
  nettverkstrafikk og garanterer konsistens med rutenettet.
- **Navigering rett til oppskrift ved klikk:** Nedtrekkslisten er en hurtigvei; rutenettet
  filtreres uansett live, så «fyll feltet»-varianten ville lagt til et unødvendig klikk.

## Risks

- **Fetch-løkke mellom URL-state og datahenting.** URL-skriving trigger `useSearchParams`,
  som kan trigge ny state-setting, som skriver URL igjen.
  *Mitigering:* URL er ren speiling — les den kun ved førstegangs montering (en `useRef`-vakt),
  og skriv den kun fra state deretter. Aldri toveis binding.
- **Racing mellom debouncede søkekall.** Rask skriving kan gi svar i feil rekkefølge, så et
  eldre resultat overskriver et nyere.
  *Mitigering:* `AbortController` per kall, eller en forespørsels-id-vakt som forkaster
  utdaterte svar.
- **Nedtrekkslisten stjeler klikk fra andre elementer.** `onBlur` som lukker listen kan
  avfyre før `onClick` på et forslag rekker å registreres.
  *Mitigering:* Bruk `onMouseDown` på forslagene, eller sjekk `relatedTarget` i blur-handler.
- **Blinking mens man skriver.** `setLoading(true)` ved hvert søk bytter hele siden til
  skjelettvisning og gjør søket ubrukelig å skrive i.
  *Mitigering:* Søkeoppdateringer skal ikke sette full `loading`; behold forrige resultat og
  vis eventuelt en diskret indikator i søkefeltet.
- **Regresjon i eksisterende kategorifiltrering.** Søk legges inn i samme spørring.
  *Mitigering:* Backend-tester som dekker søk + kategorier kombinert, og Playwright-test som
  verifiserer at kategorifiltrering fortsatt virker uten søk.
