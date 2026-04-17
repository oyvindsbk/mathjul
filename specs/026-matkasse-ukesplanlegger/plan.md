# Implementation Plan: Matkasse i ukesplanlegger

## Approach
Bygger på eksisterende AI-ekstraksjonsinfrastruktur (`POST /api/recipes/from-images`), men med et nytt dedikert endepunkt og datamodell for matkasseoppskrifter. Frontend gjenbruker bildeopplastings-UX fra `last-opp-oppskrift`, men i en innebygd sidebar-panel i ukesplanleggeren.

Nøkkelvalg:
- **Separat tabell** (`MatkasseRecipes`) for å holde matkasseoppskrifter adskilt fra hoveddisplayet uten filtrering-kompleksitet
- **AI trekker ut flere oppskrifter** fra ett sett bilder — ny systemmelding som instruerer modellen om å returnere en JSON-array i stedet for ett objekt
- **"Legg til i uke"** distribuerer oppskrifter på dag 1–N (mandag–onsdag/fredag) ved å kalle eksisterende `POST /api/groups/{groupId}/mealplans` for hver dag

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure (ingen endringer nødvendig)

## Key Decisions

- **Matkasse-oppskrifter lagres ikke som vanlige `Recipe`-objekter** — de mangler full struktur (ingen kategorier, ingen sections, ikke i grupper-synlighet-systemet). Separat tabell er renere.
- **"Legg til i uke" kaller eksisterende MealPlan-API** med en ny `MatkasseRecipeId` — MealPlan-tabellen må støtte enten `RecipeId` (eksisterende) eller `MatkasseRecipeId` (ny nullable FK). Alternativt: konverter matkasseoppskrift til en enkel Recipe ved "legg til"-operasjonen. **Valgt approach: Konvertering** — lag en midlertidig/enkel Recipe-rad i Recipe-tabellen med en `IsMatkasse=true`-flag, og bruk eksisterende MealPlan-mekanisme. Dette unngår å røre MealPlan-skjema.
  - Revidert: Enklere å legge til nullable `MatkasseRecipeId` i `MealPlan` og oppdatere DTO. Da slipper vi å blande matkasseoppskrifter inn i Recipe-tabellen.
  - **Endelig valg: Separat MatkasseRecipe-tabell + nullable MatkasseRecipeId i MealPlan.** Dette er rent og utvidbart.

- **AI-ekstraksjon av multiple oppskrifter** — nytt endepunkt `POST /api/matkasse/from-images` med system prompt som instruerer GPT-4o til å returnere `{ "oppskrifter": [...] }`. Gjenbruker bildeopplastings-logikk fra `RecipesController.ExtractRecipeFromImages`.

- **Ukesnavigasjon i sidebar** — gjenbruker eksisterende `viewYear`/`viewMonth`-state og beregner aktiv uke fra `activeDayDate`.

## Risks

- **AI returnerer variabelt antall oppskrifter** — mitigation: valider at 1–5 oppskrifter returneres, vis feilmelding ved 0.
- **Bildekvalitet** — dårlige bilder (glare, skjev vinkel) gir dårlig ekstraksjon. Mitigation: brukeren kan se hva som ble hentet og slette det som er feil.
- **MealPlan-DTO-endringer** — nullable `MatkasseRecipeId` og `MatkasseRecipe`-objekt i `MealPlanDto` påvirker frontend-typer. Håndteres ved type-utvidelse, ikke breaking change.
