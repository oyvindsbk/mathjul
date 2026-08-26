# Feature: Søk i "Alle oppskrifter" + kompakt filtrering

## Summary

Legg til et søkefelt over oppskriftslisten som søker på tittel via backend, og flytt
synlighetsvalgene (Offentlig / Mine grupper / Privat / Favoritter) inn i det eksisterende
filter-trekkspillet, slik at filtreringen tar vesentlig mindre plass over listen.

## Motivation

To problemer på forsiden i dag:

1. **Ingen søk.** Med et voksende antall oppskrifter er eneste vei til en bestemt oppskrift
   å skrolle eller filtrere på kategori. Man husker gjerne tittelen — men kan ikke søke på den.
2. **Filtreringen spiser skjermplass.** Raden med fem synlighetspiller og trekkspillknappen
   ligger permanent over listen. På mobil dyttes de første oppskriftskortene godt ned, og de
   fem pillene brytes ofte over to linjer.

Ved å slå sammen synlighet og kategori til ett trekkspill, og legge søket over det, blir
plassbruken over listen redusert til ett søkefelt og én trekkspillknapp.

## Requirements

### Søk

- Søkefelt plassert over filter-trekkspillet, med placeholder «Søk i oppskrifter …».
- Søket matcher **kun oppskriftens tittel**, case-insensitivt, delstrengmatch
  («kyll» treffer «Kyllingform»).
- Søket kjøres i backend som `GET /api/recipes?search=<term>`, kombinert med eksisterende
  kategori- og synlighetsregler.
- Frontend debouncer inntastingen (300 ms) før kall sendes.
- Tomt eller kun blanke tegn i feltet = ingen søkefiltrering.
- Feltet har en «tøm»-knapp (×) når det har innhold.
- Når et søk gir null treff, vises en tydelig tom-tilstand: «Ingen oppskrifter matcher søket»
  med knapp for å nullstille søk og filtre.

### Søkeforslag (nedtrekksliste)

- Mens man skriver vises en nedtrekksliste under søkefeltet med de matchende oppskriftene.
- Hvert forslag viser **miniatyrbilde + tittel**. Mangler oppskriften bilde, vises en nøytral
  plassholder i samme størrelse.
- Listen viser maks **8** treff. Er det flere, vises en avsluttende linje «Viser 8 av N treff»
  som ikke er klikkbar.
- Forslagene er de samme oppskriftene som rutenettet under viser — altså **begrenset av aktivt
  synlighets- og kategorifilter**, slik at listen og rutenettet aldri er uenige.
- **Klikk på et forslag navigerer rett til `/recipes/[id]`.** Rutenettet under filtreres uansett
  live mens man skriver, så nedtrekkslisten er en ren hurtigvei.
- Listen vises kun når søkefeltet har fokus og inneholder minst 2 tegn. Den lukkes ved
  Escape, ved klikk utenfor, og når feltet mister fokus.
- Tastaturnavigasjon: ↓/↑ flytter markering mellom forslag, Enter åpner det markerte
  forslaget, Escape lukker listen og beholder søketeksten.
- Tilgjengelighet: kombobox-mønster med `role="listbox"` / `role="option"`,
  `aria-expanded`, `aria-activedescendant` og `aria-controls` på inputfeltet.
- Gir søket null treff, vises ingen nedtrekksliste — kun tom-tilstanden i rutenettet.

### Filtrering

- Synlighetsvalgene flyttes fra raden over listen og inn i trekkspillet, som en egen rad
  «Synlighet» øverst — samme pill-stil og layout som kategorigruppene (etikett til venstre,
  piller til høyre).
- Valgene er uendret: Alle, 🌍 Offentlig, 👥 Mine grupper, 🔒 Privat, ❤️ Favoritter.
  Kun ett valg av gangen (som i dag). «Alle» er standard.
- Trekkspillknappen får ny etikett «Filtre» (ikke lenger «Filtrer etter kategori») og en
  teller-badge som summerer aktive filtre: antall valgte kategorier + 1 hvis synlighet ≠ «Alle».
- Ingen chips eller andre indikatorer utenfor trekkspillet — telleren er eneste indikator
  når det er lukket.
- «Fjern alle filtre» inne i trekkspillet nullstiller både kategorier og synlighet
  (og ikke søkefeltet).

### URL-state

- Søk og filtre speiles i URL-ens query params:
  - `?q=<søketekst>`
  - `?cat=<kommaseparerte kategori-id-er>`
  - `?vis=<public|myGroups|private|favoritter>` (utelates når «Alle»)
- Parametre som ikke er i bruk utelates helt fra URL-en.
- Ved lasting av siden leses URL-en og fyller søkefelt, kategorivalg og synlighet.
- URL-oppdateringer skjer med `router.replace` (ikke `push`), slik at hvert tastetrykk
  ikke fyller nettleserhistorikken. Oppdateringen skjer etter debounce.
- Lenker er delbare: åpner man `/?q=kylling&vis=private` får man samme tilstand.

### Trekkspillets standardtilstand

- Lukket som standard.
- Åpnes automatisk ved lasting hvis URL-en inneholder aktive filtre (`cat` eller `vis`),
  slik at en delt lenke viser hva som er valgt. `q` alene åpner det ikke.
- Klikk på en kategori-tag på et oppskriftskort setter filteret og åpner trekkspillet
  (uendret oppførsel).

## Design

### Data Model

Ingen endringer.

### API Changes

`GET /api/recipes` i `backend/RecipeApi/Features/Recipes/RecipesController.cs` utvides:

```
GET /api/recipes?categories=1,2&groupId=3&search=kylling
```

- Ny valgfri parameter `[FromQuery] string? search = null`.
- Legges på som `query.Where(r => EF.Functions.Like(r.Title, $"%{term}%"))` etter
  eksisterende synlighets- og kategorifiltrering. `Like` gir case-insensitiv match under
  standard SQL Server-kollasjon.
- `%` og `_` i søketeksten escapes så de ikke tolkes som jokertegn.
- Blank/whitespace `search` ignoreres.
- Søketeksten trimmes og avkortes til rimelig lengde (f.eks. 100 tegn).

Synlighetsfilteret (`vis`) blir værende klientside, som i dag — det opererer på `visibility`
og `isLikedByMe` i responsen og krever ingen API-endring.

### UI Changes

Kun `frontend/src/app/(app)/HomeClient.tsx` og `frontend/src/lib/services/recipe.service.ts`.

Før:

```
[Alle][🌍 Offentlig][👥 Mine grupper][🔒 Privat][❤️ Favoritter]
┌─ Filtrer etter kategori (2)                        ▾ ─┐
└───────────────────────────────────────────────────────┘
[oppskriftsrutenett]
```

Etter:

```
┌─ 🔍 kyll                                          × ─┐
├──────────────────────────────────────────────────────┤
│ [img] Kyllingform med paprika                        │  ← forslag
│ [img] Kyllingwok                                     │
│ [img] Grillet kyllinglår                             │
└──────────────────────────────────────────────────────┘
┌─ ⚙ Filtre (2)                                    ▾ ─┐
│  Synlighet   [Alle][🌍][👥][🔒][❤️]                  │
│  Måltidstype [Middag][Lunsj][…]                      │
│  Type        [Vegetar][Kjøtt][…]                     │
└──────────────────────────────────────────────────────┘
[oppskriftsrutenett]
```

`recipe.service.ts` → `getAllRecipes(token?, categoryIds?, groupId?, search?)` setter
`search`-parameteren når den er oppgitt. Signaturen utvides bakover-kompatibelt, så
eksisterende kallsteder (bl.a. `getSideDishes`) er uberørt.

## Out of Scope

- Søk i beskrivelse, ingredienser, instruksjoner eller kategorinavn — kun tittel.
- Fuzzy-søk, stavekorrigering, synonymer, rangering etter relevans.
- Uthevet markering av den matchende delstrengen i forslagene.
- Egne søkeforslag-endepunkt i backend — forslagene gjenbruker samme resultatsett som rutenettet.
- Fulltekstindeks i SQL Server.
- Søkehistorikk, forslag/autocomplete.
- Flervalg av synlighet samtidig.
- Endring av kategorifiltrets ELLER/OG-semantikk.
- Søk på andre sider enn forsiden (ukesplanlegger, spin, tilbehørsvelger).
- Paginering av resultatlisten.

## Open Questions

Ingen — alle avklart med bruker før spec ble skrevet.
