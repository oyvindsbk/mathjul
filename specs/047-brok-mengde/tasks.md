# Tasks: Mengde i brøk

## Tasks

- [x] Task 1: Lag `frontend/src/lib/fraction.ts` med `parseQuantityInput` (enkel brøk, blandet
      tall, unicode-brøktegn, komma/punktum-desimal, heltall; `null` ved ugyldig) og
      `toFractionString` (vanlige kjøkkenbrøker med toleranse, blandet tall over 1, `null` når
      ingen brøk passer). Rene funksjoner, ingen React. Verifiser med lint + tsc.

- [x] Task 2: Koble brøkvisning på `formatQuantity` i `frontend/src/lib/recipe-format.ts` — bruk
      `toFractionString`, fall tilbake til dagens desimalformatering når den gir `null`. Sjekk at
      oppskriftsvisning, matlagingsmodus og ingrediensomtaler alle viser brøk (de deler denne
      funksjonen). Verifiser med lint + tsc + build.

- [ ] Task 3: Gjør mengdefeltet i `IngredientRow` (`RecipeForm.tsx`) om til `type="text"` med
      `inputMode="decimal"`, råtekst-state per rad og parsing ved `blur` via
      `parseQuantityInput`. Vis eksisterende mengde som brøk når feltet ikke har fokus. Gjelder
      både flat liste og seksjonerte ingredienser. Verifiser med lint + tsc + build.

- [ ] Task 4: Feilhåndtering ved ugyldig inndata — marker feltet og blokker lagring framfor å
      lagre `null`. Verifiser med lint + tsc + build.

- [ ] Task 5: Playwright E2E i `frontend/tests/e2e/` — skriv `1/4` i mengdefeltet, lagre, og
      bekreft at oppskriften viser `1/4 ts salt`. Dekk også blandet tall og ugyldig inndata.
