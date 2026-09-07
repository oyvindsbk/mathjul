# Tasks: Velg bort alternativer før du snurrer mathjulet

## Tasks

- [x] Task 1: Lag `OptionList.tsx` — checkboxliste (fargeprikk, tittel, checkbox, «Inkluder alle»-knapp) med props for kandidater, fravalgte id-er, toggle og inkluder-alle. Verifiser med lint + tsc + build.
- [x] Task 2: Koble på i `client.tsx` — `excludedRecipeIds`-state, `wheelCandidates`/`segments`-splitt, fargeindeks fra kandidatlisten, erstatt legend med `OptionList`, nullstill resultat ved toggle. Verifiser med lint + tsc + build.
- [x] Task 3: Håndter tom-tilstanden — skill mellom «ingen treff på filtre» og «for mange fravalgt» (under 2 inkluderte), vis liste + «Inkluder alle» i sistnevnte. Verifiser med lint + tsc + build.
- [x] Task 4: Playwright E2E-test i `frontend/tests/e2e/` — huk av et alternativ, sjekk at hjulet/segmentene reduseres, snurr, og at «Inkluder alle» gjenoppretter utvalget. Kjør `npx playwright test`.
