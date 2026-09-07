# Implementation Plan: Velg bort alternativer før du snurrer mathjulet

## Approach
Rent frontend-arbeid i `snurr-mathjulet`-mappen. Fravalg holdes som en `excludedRecipeIds`-state
i `client.tsx`. Kandidatlisten (de 20 filtrerte oppskriftene) beregnes som i dag, mens
`segments` — det hjulet faktisk bygges av — filtreres på fravalg. Legend-blokken løftes ut i en
egen `OptionList`-komponent med checkbokser, på linje med hvordan `FilterPanel` allerede er
skilt ut.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Fravalg lagres som id-er, ikke som «inkludert»-liste:** da er standarden «alt med» gratis,
  og nye oppskrifter som dukker opp i utvalget er automatisk inkludert.
- **Fargeindeks fra kandidatlisten, ikke segmentlisten:** ellers ville radene skifte farge hver
  gang man huket av noe, som ser ut som en feil.
- **Fravalg beskjæres mot kandidatlisten ved bruk, ikke ryddet i en effect:** unngår en
  ekstra render-runde og «spøkelses»-fravalg uten å måtte synkronisere state mot filtrene.
- **Egen komponent:** `client.tsx` er allerede 341 linjer; checkboxlisten hører naturlig sammen
  og testes lettere for seg.

## Risks
- **Snurrelogikken indekserer inn i `segments`:** vinnerindeks og vinkler må fortsatt regnes ut
  fra den filtrerte segmentlisten. Mitigering: `segmentAngle` og `winnerIndex` utledes utelukkende
  av `segments`, som i dag; ingen bruk av kandidatindeks i spin-funksjonen.
- **Tom-tilstand kan låse brukeren:** huker man av alt, forsvinner snurreknappen. Mitigering:
  «Inkluder alle»-knapp er alltid tilgjengelig i den tilstanden.
