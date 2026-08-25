# Feature: Mengde i brøk

## Summary
La brukeren skrive inn ingrediensmengder som brøk (f.eks. `1/4 ts salt`, `1 1/2 dl fløte`) i
oppskriftsskjemaet, og vis små mengder som brøk i stedet for desimaltall i oppskriftsvisningen.

## Motivation
Norske oppskrifter oppgir små mengder som brøk — `1/4 ts salt`, `1/2 dl fløte`. I dag er
mengdefeltet et `type="number"`-felt (`RecipeForm.tsx:118-123`) som ikke godtar `/`, så brukeren
må selv regne om til `0.25`. Det er tungvint ved innskriving, og visningen blir `0.25 ts salt`,
som ikke er slik nordmenn leser en oppskrift.

Backend håndterer allerede brøk fra AI-uttrekk: `FlexibleDecimalConverter`
(`RecipeExtraction.cs:10-70`) parser `"1/2"`, `"1 1/2"` og `"1,5"` til `decimal`. Manuell
innskriving mangler den samme fleksibiliteten, og ingen av delene vises som brøk.

## Requirements

### Innskriving
- Mengdefeltet godtar enkel brøk (`1/4`), blandet tall (`1 1/2`), desimaltall med både punktum
  og komma (`0.25`, `1,5`), og heltall (`4`) — som i dag.
- Feltet godtar også unicode-brøktegn (`¼`, `½`, `¾`) og blandet form `1½`.
- Verdien lagres uendret som `decimal` i `StructuredIngredient.Quantity`. Ingen skjemaendring.
- Ugyldig inndata (`1/0`, `abc`, `1/`) markeres visuelt i feltet og blokkerer lagring, framfor
  å bli stille lagret som `null`.
- Under skriving skal delvis inndata (`1`, `1/`, `1 `) ikke nullstille eller omformatere feltet —
  omforming skjer først ved `blur`.

### Visning
- Mengder vises som brøk når den skalerte verdien ligger nær en vanlig kjøkkenbrøk:
  halve, tredjedeler, fjerdedeler, åttedeler (`1/2`, `1/3`, `2/3`, `1/4`, `3/4`, `1/8`, `3/8`,
  `5/8`, `7/8`) innenfor en liten toleranse.
- Verdier over 1 vises som blandet tall: `1.5` → `1 1/2`.
- Verdier som ikke treffer en vanlig brøk beholder dagens desimalvisning (maks 2 desimaler,
  etterfølgende nuller fjernet) — f.eks. `0.35` blir `0,35`, ikke `7/20`.
- Brøkvisningen gjelder alle stedene mengder rendres, siden alle går gjennom
  `formatQuantity`/`formatIngredientParts` i `frontend/src/lib/recipe-format.ts`:
  oppskriftsvisning (`RecipeBody.tsx`), matlagingsmodus (`IngredientsTab.tsx`), og
  ingrediensomtaler i instruksjonssteg (`instruction-mentions.ts`).
- Skalering skjer på desimalverdien før formatering, slik at porsjonsjustering fortsatt er
  presis; brøk er kun et visningslag.

## Design

### Data Model
Ingen endring. `StructuredIngredient.Quantity` er allerede `decimal?` (`Recipe.cs:29`), og
frontend-typen er `number | null` (`mock-data.ts:13`). Brøk er ren inndata-parsing og
utdata-formatering. Ingen migrasjon.

### API Changes
Ingen. Kontrakten er uendret — mengder går fortsatt over tråden som tall.

### UI Changes
- `RecipeForm.tsx`: mengdefeltet endres fra `type="number"` til `type="text"` med
  `inputMode="decimal"`, egen råtekst-state per ingrediens, parsing ved `blur`, og
  feilmarkering ved ugyldig verdi. Gjelder både flat ingrediensliste og seksjonerte
  ingredienser (samme `IngredientRow`-komponent).
- `recipe-format.ts`: `formatQuantity` utvides til å gi brøk der det passer.

### New Module
`frontend/src/lib/fraction.ts` — `parseQuantityInput(raw: string): number | null` og
`toFractionString(value: number): string | null`. Samlet ett sted slik at skjema og visning
deler samme brøktabell.

## Out of Scope
- Endring av `FlexibleDecimalConverter` på backend — den fungerer allerede for AI-uttrekk.
- Brøk i porsjons-/antallsfeltet (`servings`) — kun ingrediensmengder.
- Enhetskonvertering (ts → ml, dl → g).
- Intervaller som `1/2-1` — backend tar allerede nedre grense ved uttrekk; manuell inntasting
  av intervall støttes ikke.
- Å lagre den opprinnelige brøkskrivemåten. `1/2` og `0,5` blir samme verdi, og vises likt.

## Open Questions
Ingen. Alle avklart under utforming:
- Lagres brøk som tekst eller tall? → Tall. Ingen skjemaendring, skalering forblir presis.
- Skal `0.35` vises som brøk? → Nei, kun vanlige kjøkkenbrøker; ellers desimal.
