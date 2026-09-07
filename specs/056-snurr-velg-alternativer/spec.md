# Feature: Velg bort alternativer før du snurrer mathjulet

## Summary
Fargeforklaringen (legend) under mathjulet blir en interaktiv checkboxliste, slik at man kan
huke av oppskrifter man ikke vil ha med før man snurrer. Bare inkluderte oppskrifter blir
segmenter på hjulet.

## Motivation
Filtrene (kategori/ingrediens) styrer utvalget grovt, men treffer ofte én eller to oppskrifter
man akkurat spiste eller ikke er i humør til. I dag må man snurre om igjen eller stramme
filtrene til noe som ikke helt passer. Med en checkboxliste kan man fjerne enkelte alternativer
direkte, uten å endre filtrene.

## Requirements
- Listen under hjulet viser de samme oppskriftene som havner på hjulet i dag: de første
  `MAX_SEGMENTS` (20) oppskriftene som matcher filtrene.
- Hver rad har en checkbox, fargeprikk og tittel. Alle er avhuket (inkludert) som standard.
- Å huke av en rad fjerner oppskriften fra hjulet; hjulet og segmentfargene bygges kun av
  inkluderte oppskrifter.
- Å huke av nullstiller et eventuelt snurreresultat (samme oppførsel som filterendringer).
- Man kan ikke snurre med under 2 inkluderte oppskrifter. Da vises en forklarende melding med
  mulighet for å inkludere alle igjen, i stedet for snurreknappen.
- «Inkluder alle»-knapp vises når minst én oppskrift er fravalgt.
- Fravalg som gjelder oppskrifter som forsvinner ut av listen (fordi filtre endres) skal ikke
  «spøke» — en oppskrift som kommer tilbake i listen igjen skal være inkludert på nytt.
- Fravalg lagres ikke; alt er inkludert ved ny sidelasting.

## Design

### Data Model
Ingen endringer. Rent klientside-state.

### API Changes
Ingen.

### UI Changes
`frontend/src/app/(app)/snurr-mathjulet/` :
- Ny komponent `OptionList.tsx` — checkboxliste med fargeprikk, tittel og «Inkluder alle».
- `client.tsx`:
  - Ny state `excludedRecipeIds: number[]` (fravalgte id-er).
  - `wheelCandidates` = filtrerte oppskrifter kuttet til `MAX_SEGMENTS` (dagens `recipes`).
  - `segments` = `wheelCandidates` minus fravalgte.
  - Fargeindeks følger `wheelCandidates`, slik at en oppskrift beholder fargen sin i listen
    selv når andre rader hukes av.
  - Legend erstattes av `OptionList`.
  - Tom-tilstanden («under 2 segmenter») skiller mellom «filtrene matcher ingenting» og
    «du har huket av for mange», og viser listen i sistnevnte tilfelle.
- Playwright-test `frontend/tests/e2e/` for av/på-huking og snurring med redusert utvalg.

## Out of Scope
- Å velge blant mer enn 20 oppskrifter (grensen `MAX_SEGMENTS` beholdes som i dag).
- Lagring av fravalg mellom besøk (localStorage/backend).
- Vekting av hvor sannsynlig hver oppskrift er.

## Open Questions
Ingen — utvalgsgrense og persistens avklart med bruker (kun de 20 første; ingen lagring).
