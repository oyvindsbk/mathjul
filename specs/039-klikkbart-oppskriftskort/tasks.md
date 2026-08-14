# Tasks: Klikkbart oppskriftsbilde og overskrift

## Tasks

- [x] Task 1: Gjør bilde og overskrift klikkbare i `HomeDashboard.tsx` (forsiden — Favoritter og Nyeste oppskrifter). Hjerteknappen flyttes ut av lenkens subtre. Verifiser: lint, tsc, build.
- [x] Task 2: Gjør bilde og overskrift klikkbare i `HomeClient.tsx` (Alle oppskrifter). Kategori-knappene skal fortsatt filtrere. Verifiser: lint, tsc, build.
- [x] Task 3: Gjør bilde og overskrift klikkbare i `favoritter/page.tsx`. Verifiser: lint, tsc, build.
- [x] Task 4: Full verifisering — lint, tsc, build, eksisterende Playwright-tester, samt manuell gjennomgang av alle tre sidene med Playwright MCP (klikk bilde, klikk tittel, klikk hjerte, klikk kategori).

## Verifiseringsresultat

- lint: OK (eneste warning er preeksisterende, i `MealPlanPreviewModal.tsx`)
- tsc --noEmit: OK
- build: OK
- Playwright MCP, manuelt på alle tre sidene:
  - Klikk på bilde → `/recipes/1` ✓
  - Klikk på tittel → `/recipes/1` ✓
  - Klikk på hjerte → ingen navigasjon, favoritt-status veksler ✓
  - Klikk på kategori-knapp → ingen navigasjon, filtrerer ✓
  - DOM-struktur bekreftet: bilde-lenke og hjerteknapp er søsken, ikke nøstet
- Konsoll-feil observert (401/500 mot backend, manglende heftymesterskapet-bilder,
  placeholder-404) er preeksisterende og urelatert til denne endringen.

### Kjent, preeksisterende

- `tests/e2e/smoke.spec.ts` feiler på chromium — verifisert at de feiler likt på `main`
  før denne endringen. Testene ser utdaterte ut: de forventer `recipe-grid` på `/`
  (ligger nå i HomeClient / `/alle-oppskrifter`) og en hardkodet mock-oppskrift.
  Firefox/WebKit feiler fordi nettleser-binærfilene ikke er installert lokalt.

## Oppfølging

- De tre kort-variantene er fortsatt duplisert i tre filer. Å trekke dem ut i én delt
  `RecipeCard`-komponent er bevisst holdt utenfor denne oppgaven, men bør gjøres.
