# Feature: Kategorisering

## Summary
Legg til støtte for å kategorisere oppskrifter på tvers av flere dimensjoner, og gjør det mulig å filtrere og søke på kategorier i oppskriftslisten.

## Motivation
Brukere skal enkelt kunne finne oppskrifter basert på måltidstype, ingredienser og vanskelighetsgrad. En oppskrift kan passe inn i flere kategorier samtidig (f.eks. «middag» og «glutenfri»).

## Requirements
- En oppskrift kan ha null eller flere kategorier
- Kategoriene er predefinerte og delt inn i grupper (se under)
- Bruker kan velge kategorier ved opprettelse og redigering av oppskrift
- Oppskriftslisten kan filtreres på én eller flere kategorier
- Filteret bruker AND-logikk: oppskrifter som matcher alle valgte kategorier vises
- Kategorier vises som tags/chips på oppskriftskort og detaljside
- Eksisterende oppskrifter (inkl. seed-data) trenger ikke kategorier — feltet er valgfritt

## Design

### Kategorigrupper og verdier

| Gruppe            | Verdier (norsk)                                                          |
|-------------------|--------------------------------------------------------------------------|
| Måltidstype       | Frokost, Lunsj, Middag, Dessert, Kveldsmat, Søtbakst, Snacks, Drikke   |
| Vanskelighetsgrad | Enkel, Middels, Avansert                                                 |
| Tilberedningstid  | Under 15 min, Under 30 min, Under 1 time, Over 1 time                   |

> Merk: «Vanskelighetsgrad» her er fri tagging, uavhengig av det eksisterende `Difficulty`-feltet.

### Data Model

**Ny entitet: `Category`**
```
Category
  Id          int (PK)
  Name        string (unik, maks 100 tegn)
  Group       string (maks 50 tegn) — «Måltidstype», «Kosthold», osv.
```

**Koblingstabell: `RecipeCategory`**
```
RecipeCategory
  RecipeId    int (FK -> Recipe)
  CategoryId  int (FK -> Category)
```

Kategoriene er pre-seeded; brukere velger fra listen, de oppretter ikke egne.

### API Changes

**GET `/api/categories`**
Returnerer alle kategorier gruppert:
```json
[
  { "id": 1, "name": "Frokost", "group": "Måltidstype" },
  ...
]
```

**GET `/api/recipes?categories=1,3,7`** (valgfri query-param)
Returnerer oppskrifter som har alle de oppgitte kategori-IDene (AND-filter).

**PUT `/api/recipes/{id}`** — utvidet request body
```json
{ ..., "categoryIds": [1, 5] }
```

**POST `/api/recipes/save-extracted`** — utvidet request body
```json
{ ..., "categoryIds": [1, 5] }
```

**RecipeDto og RecipeDetailDto** — utvidet med:
```json
{ ..., "categories": [{ "id": 1, "name": "Frokost", "group": "Måltidstype" }] }
```

### UI Changes

**Oppskriftsliste (`HomeClient.tsx`)**
- Filterpanel over oppskriftsnettet: chips/knapper gruppert etter kategorigruppe
- Aktivt filter vises som uthevet chip; klikk fjerner filteret
- Oppskriftskort viser kategorier som små tags under tittelen

**Oppskriftdetalj (`recipes/[id]/client.tsx`)**
- Kategorier vises som tags i recipe-headeren

**Oppskriftskjema (`RecipeForm.tsx`)**
- Nytt seksjon «Kategorier» med multi-select chips gruppert etter gruppe
- Bruker kan toggle på/av kategorier

## Out of Scope
- Fritekst-søk på tittel/beskrivelse
- Brukerdefinerte kategorier
- AI-automatisk kategorisering ved ekstraksjon
- Sortering av oppskriftsliste

## Open Questions
- Ingen åpne spørsmål — klar for implementasjon.
