# Feature: Tilbehør inline i oppskrift

## Summary
Et påkoblet tilbehør kan nå vises på to måter, valgt per tilbehør: som **lenke** (dagens
oppførsel) eller **innfletta** i hovedretten som egne seksjoner i Ingredienser og
Fremgangsmåte, med tilbehørets tittel som seksjonsoverskrift.

## Motivation
Feature 036 koblet tilbehør til hovedretter, men bare som lenker. Når du faktisk står på
kjøkkenet og lager kylling tikka masala med ris, må du bytte side for å se hvordan risen
koges — og i matlagingsmodus finnes ikke risen i det hele tatt, så stegene du blir ledet
gjennom er ufullstendige.

Samtidig er lenkeformen fortsatt riktig for noen tilbehør: et naanbrød du kjøper ferdig,
eller en standard-ris du kan utenat, trenger ikke fylle hovedoppskriften med støy. Derfor
er valget per tilbehør, ikke en global bryter.

## Requirements
- `RecipeSideDish` får et felt `DisplayMode` med verdiene `Link` (standard) og `Inline`
- Eksisterende koblinger beholder dagens oppførsel — migreringen setter `Link` på alle rader
- Valget gjøres per tilbehør i hovedrettens redigeringsskjema
- Et tilbehør merket `Inline` bidrar med:
  - én ingrediensseksjon med tilbehørets tittel som overskrift
  - én instruksjonsseksjon med tilbehørets tittel som overskrift
- Innfletta seksjoner kommer **etter** hovedrettens egne, i tilbehørets `SortOrder`
- Tilbehør merket `Link` vises som i dag, i "Tilbehør"-chipsene over oppskriften
- Et tilbehør merket `Inline` vises **ikke** som chip — innholdet er allerede der
- Innfletting gjelder oppskriftsdetaljsiden, matlagingsmodus og delt lenke (`/delt/[token]`)
- Innfletting er ren visning: tilbehørets egen oppskrift er kilden, og endringer der slår
  gjennom umiddelbart. Ingenting kopieres.
- Et tilbehør uten ingredienser bidrar ikke med en tom ingrediensseksjon (samme for steg)

## Design

### Data Model

`RecipeSideDish` får én ny kolonne:

```
RecipeSideDish
  RecipeId          int
  SideDishRecipeId  int
  SortOrder         int
  DisplayMode       nvarchar(20)  NOT NULL  DEFAULT 'Link'   ← ny
```

Lagres som streng, ikke enum-int, i tråd med `Recipe.Visibility` som allerede er
`[StringLength(20)] string` med verdier `Public`/`Private`. Konstantene legges i en
statisk klasse `SideDishDisplayModes` ved siden av `RecipeVisibility`.

Migreringen er additiv: ny kolonne med default `'Link'`, så alle eksisterende koblinger
beholder dagens utseende. Ingen backfill utover defaulten.

### Merging — hvor den hører hjemme

**Sammenfletting skjer i backend**, ikke i frontend-komponentene. Grunnen er verifisert i
koden: `RecipeBody`, `MatlagingsmodusOverlay` og delt-lenke-siden leser alle
`ingredientSections` / `instructionSections`. Fletter vi inn i de listene før de forlater
API-et, får alle tre flatene funksjonen uten at rendringskoden røres.

Konsekvens av at seksjonene er kilden: en hovedrett som selv bruker de **flate** listene
(`Ingredients` / `InstructionSteps`, som er tilfellet når oppskriften ikke har seksjoner)
må konverteres til seksjonsform når minst ett tilbehør er `Inline`. Hovedrettens egne
elementer får da en seksjon med hovedrettens egen tittel som overskrift, slik at det er
tydelig hva som hører til hva.

Flettingen legges i én privat hjelper som begge kontrollerne kaller, slik at detaljsiden og
delingssiden ikke kan komme i utakt.

### API Changes

Ingen nye endepunkter.

**Endrede DTO-er**

| DTO | Endring |
|-----|---------|
| `RecipeRefDto` | `+ DisplayMode: string` |
| `UpdateRecipeRequest` | `SideDishIds: int[]?` → suppleres med `InlineSideDishIds: int[]?` |
| `SaveExtractedRecipeRequest` | samme tillegg |

`SideDishIds` beholdes som den er (rekkefølge = SortOrder). `InlineSideDishIds` er en
delmengde av den — de id-ene som skal flettes inn. Dette er bakoverkompatibelt: en klient
som ikke sender feltet får `Link` på alt, som er dagens oppførsel.

**GET `/api/recipes/{id}`** — `IngredientSections` og `InstructionSections` inneholder nå
også de innfletta tilbehørsseksjonene. `SideDishes` inneholder fortsatt alle tilbehør, med
`DisplayMode` slik at frontend kan skjule chip-en for de innfletta.

**GET `/api/recipes/{id}?merged=false`** — samme respons, men uten fletting. Lagt til under
implementeringen: redigeringsskjemaet leser `ingredientSections` / `instructionSections` og
skriver dem rett tilbake ved lagring. Fikk det den flettede visningen, ville tilbehørets
innhold blitt kopiert permanent inn i hovedretten ved første lagring — og for en flat
hovedrett ville flat→seksjon-konverteringen i tillegg spist de flate listene. Standard er
`true`, så alle visningsflater er uendret.

**GET `/api/public/shared/{token}`** — samme fletting. `SideDishes` her er `List<string>`
(bare titler) og filtreres til kun `Link`-tilbehør.

**Validering** — `InlineSideDishIds` må være delmengde av `SideDishIds`; ellers
`BadRequest`. Resten av tilbehørsreglene fra 036 gjelder uendret.

### UI Changes

- **`RecipeForm`** — hver valgt tilbehørs-chip får en bryter for Lenke/Innflettet, ved
  siden av dagens ↑/↓-knapper. Kun synlig på valgte tilbehør.
- **`RecipeBody`** — filtrerer chip-lista til `displayMode === 'Link'`. Seksjonene kommer
  ferdig flettet fra API-et, så rendringen er uendret.
- **Matlagingsmodus** — ingen endring i komponenten; den får flere seksjoner inn.
- **Delt lenke** — ingen endring i komponenten.
- **Redigeringssiden** må populere `inlineSideDishIds` fra detaljresponsen, ellers
  tilbakestilles valget til Lenke ved hver lagring (samme fallgruve som `sideDishIds`
  hadde i 036).

## Out of Scope
- Handleliste- og ukesplanlegger-aggregering av tilbehørets ingredienser
- Skalering av tilbehørets porsjoner etter hovedrettens `desiredServings` — tilbehøret
  vises med sine egne mengder. Se Open Questions.
- Mer enn ett nivå med tilbehør (uendret regel fra 036)
- Redigering av tilbehørets innhold fra hovedrettens side

## Open Questions
- **Delt lenke og tilbehørets synlighet:** delingsendepunktet filtrerer ikke tilbehør på
  synlighet — det gjorde det ikke før heller, der titlene på private tilbehør allerede var
  med. Med innfletting deles nå også *innholdet* i et innflettet tilbehør. Vurderingen er at
  dette er tilsiktet: å merke et tilbehør Innflettet er eierens uttrykkelige valg om å gjøre
  det til en del av denne oppskriften, og da deles det som står på siden. Notert fordi det
  utvider hva en delt lenke eksponerer.
- **Porsjonsskalering:** hovedretten har en `ServingsStepper` som skalerer ingredienser mot
  `recipe.servings`. Innfletta tilbehør har sin egen `servings`, som kan avvike. I denne
  omgangen skaleres tilbehørets mengder **ikke** — de vises som oppgitt i tilbehøret.
  Dette er den ærlige oppførselen så lenge vi ikke vet forholdet mellom porsjonene, men
  det bør revurderes hvis det oppleves feil i bruk.
