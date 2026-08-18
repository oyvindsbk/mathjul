# Implementation Plan: Tilbehør inline i oppskrift

## Approach
Flett tilbehørets innhold inn i hovedrettens seksjonslister **på serversiden**, i én delt
hjelper som både `RecipesController.GetRecipe` og `PublicRecipesController` kaller.

Dette er kjernevalget i planen, og det er verifisert mot koden: `RecipeBody`,
`MatlagingsmodusOverlay` og delt-lenke-siden konsumerer alle `ingredientSections` /
`instructionSections`. Ved å flette før dataene forlater API-et dekkes alle tre flatene i
spec-ens omfang uten å endre rendringslogikken tre steder — og de kan ikke komme i utakt
senere.

Alternativet — å flette i frontend — ble vurdert og forkastet: det ville krevd at
detaljsiden henter N ekstra oppskrifter klientside, og at matlagingsmodus og delingssiden
hver implementerte den samme flettingen på nytt.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions
- **`DisplayMode` som streng, ikke enum-int:** følger `Recipe.Visibility`-presedensen i
  samme modell. Lesbart i databasen og i JSON, og unngår at et tall betyr noe usynlig.
- **Ny kolonne med DEFAULT `'Link'`:** migreringen er rent additiv, og alle eksisterende
  tilbehørskoblinger beholder dagens utseende uten backfill.
- **`InlineSideDishIds` som eget felt, ikke omskriving av `SideDishIds`:** holder
  request-kontrakten bakoverkompatibel. En klient som ikke kjenner feltet oppfører seg
  nøyaktig som før.
- **Flat liste → seksjon når noe flettes inn:** en hovedrett uten egne seksjoner må
  konverteres, ellers ville seksjonsgrenen overta og hovedrettens egne ingredienser
  forsvinne fra visningen. Dette er den ikke-åpenbare fellen i hele featuren, og den har
  en egen test.
- **Ingen porsjonsskalering av tilbehør i v1:** hovedrettens og tilbehørets `servings` er
  uavhengige tall uten kjent forhold. Å gjette et forhold ville gitt stille gale mengder;
  å vise tilbehørets egne tall er etterprøvbart. Notert som åpent spørsmål i spec.

## Risks
- **Hovedretten mister sine egne ingredienser i visningen** hvis flat→seksjon-konvertering
  glemmes. Mitigering: dekkes av egen backend-test før frontend røres.
- **Redigering nullstiller Inline-valget** hvis edit-siden ikke populerer
  `inlineSideDishIds` fra detaljresponsen — nøyaktig samme feil som `sideDishIds` hadde i
  036. Mitigering: eksplisitt egen task, og verifiseres i browser til slutt.
- **Dobbel visning** — et innflettet tilbehør som også vises som chip er forvirrende.
  Mitigering: chip-lista filtreres på `displayMode === 'Link'`.
- **Stegnummerering** i `RecipeBody` løper kontinuerlig på tvers av seksjoner, så innfletta
  steg fortsetter hovedrettens nummerrekke. Det er ønsket oppførsel, men verifiseres
  visuelt.
