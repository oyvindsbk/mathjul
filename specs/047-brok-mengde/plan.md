# Implementation Plan: Mengde i brøk

## Approach
Brøk er et rent grensesnittlag rundt en `decimal` som allerede finnes. To rene funksjoner i en
ny modul `frontend/src/lib/fraction.ts` — én inn (`parseQuantityInput`), én ut
(`toFractionString`) — kobles så på de to stedene som trenger dem: mengdefeltet i `RecipeForm`
og `formatQuantity` i `recipe-format.ts`. Fordi alle visningsstedene allerede går gjennom
`formatQuantity`, får oppskriftsvisning, matlagingsmodus og ingrediensomtaler brøkvisning uten
egne endringer.

Rekkefølgen er nedenfra og opp: den rene modulen med tester først, så visning (liten, isolert),
så skjemaet (størst, og det eneste med ny state).

## Stacks Affected
- [x] Frontend
- [ ] Backend — ingen endring; `FlexibleDecimalConverter` dekker allerede AI-uttrekk
- [ ] Infrastructure

## Key Decisions
- **Lagre `decimal`, ikke tekst:** brøk er skrivemåte, ikke data. Å lagre tekst ville krevd
  migrasjon og gjort porsjonsskalering til strengmatte. Skalering skjer på tallet, brøk påføres
  først ved rendring.
- **Kun vanlige kjøkkenbrøker ved visning:** en generell desimal→brøk-algoritme gir `7/20` for
  `0.35`, som er verre å lese enn `0,35`. Tabell over halve, tredjedeler, fjerdedeler og
  åttedeler med toleranse treffer det folk faktisk skriver i oppskrifter.
- **Toleranse framfor eksakt likhet:** skalering gir flyttallsstøy (`1/3` av 3 porsjoner til 4
  blir `0.4444…`), og tredjedeler er uansett ikke eksakt representerbare. Sammenligning innenfor
  en liten epsilon gjør at `2/3` fortsatt vises som `2/3`.
- **Parsing ved `blur`, ikke ved hvert tastetrykk:** `1/4` passerer gjennom `1`, `1/` mens man
  skriver. Parsing per tastetrykk ville omformatert feltet under fingrene på brukeren.
- **`type="text"` + `inputMode="decimal"`:** `type="number"` avviser `/` på tastaturnivå og kan
  ikke brukes. `inputMode` beholder numerisk tastatur på mobil.

## Risks
- **Delvis inndata nullstiller feltet:** i dag settes `quantity` til `null` ved hvert tastetrykk
  som ikke parser. Mitigering: egen råtekst-state per rad, slik at feltet viser det brukeren
  skrev, og `quantity` oppdateres først ved gyldig parsing.
- **Ugyldig inndata lagres stille som `null`:** brukeren skriver `1/0` og mister mengden uten
  varsel. Mitigering: feilmarkering i feltet og blokkert lagring, jf. spec.
- **Regresjon i eksisterende visning:** `formatQuantity` brukes flere steder. Mitigering: enhets-
  tester som fester dagens oppførsel for heltall og ikke-brøk-desimaler før brøk legges til.
- **Seksjonerte ingredienser glemmes:** både flat liste og seksjoner rendrer ingrediensrader.
  Mitigering: begge går gjennom samme `IngredientRow`-komponent — endres ett sted, verifiseres
  begge.
