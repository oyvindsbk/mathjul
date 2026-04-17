# Feature: Matkasse i ukesplanlegger

## Summary
Brukere kan laste opp bilder av sin ukentlige matkasse fra Hellofresh, Kokkeløren eller Godt Levert. AI trekker ut 2–5 oppskrifter fra bildene, lagrer dem som matkasseoppskrifter, og brukeren kan enkelt legge dem til i ukesplanleggeren — enten automatisk fordelt på de tre første dagene i uken, eller manuelt via drag-and-drop.

## Motivation
Matkassebrukere planlegger allerede ukene sine rundt leveransen, men må manuelt registrere oppskriftene. Denne featuren eliminerer manuelt arbeid og integrerer matkassen direkte i planleggingen.

## Requirements

### Bildeopplasting og AI-ekstraksjon
- Brukeren laster opp 1–5 bilder av matkassen (menykort, leveransenotat, appskjermbilde)
- Leverandør velges: Hellofresh, Kokkeløren eller Godt Levert
- AI trekker ut alle oppskrifter fra bildene (2–5 stk typisk)
- Hvert bilde kan inneholde én eller flere oppskrifter — AI returnerer en liste
- Ekstraksjon skjer via et nytt backend-endepunkt `POST /api/matkasse/from-images`

### Matkasseoppskrifter (separat tabell)
- Lagres i en egen `MatkasseRecipe`-tabell, ikke i hoveddisplayet
- Felter: Id, Tittel, Beskrivelse, Leverandør (Hellofresh/Kokkeløren/GoddtLevert), UkeStart (DateOnly), GroupId, ImageUrl (valgfritt), Ingredienser (JSON), Instruksjoner (JSON), CreatedByEmail, CreatedAt
- Knyttes til en gruppe (samme GroupId-mønster som MealPlan)

### Ukesplanlegger-integrasjon
- Ny "Matkasse"-fane/panel i sidebar ved siden av oppskriftspickeren
- Viser matkasseoppskrifter for valgt uke gruppert per leverandør
- "Legg til i uke"-knapp: fordeler alle oppskrifter automatisk på mandag–onsdag (dag 1–3)
  - Hvis det er 4–5 oppskrifter, brukes mandag–fredag
  - Eksisterende planer på disse dagene erstattes ikke uten bekreftelse
- Enkeltoppskrifter kan klikkes og legges til på aktivt valgt dag (som vanlige oppskrifter)
- Oppskriftene vises som "matkasse-kort" med leverandørlogo/badge og tittel

### Ukesnavigasjon
- Ukesplanleggeren har allerede månedvisning med uker — matkassen knyttes til en uke (mandag i uken)
- Brukeren velger hvilken uke matkassen gjelder for ved opplasting

### Leverandørmerking
- Badge per leverandør: Hellofresh (oransje), Kokkeløren (grønn), Godt Levert (rød)
- Fargekoder kan justeres etter faktiske merkevarefarger

## Design

### Data Model

**Ny tabell: `MatkasseRecipes`**
```
Id              int (PK, auto)
GroupId         int (FK → Groups)
Leverandor      string (max 50) — "Hellofresh" | "Kokkeloren" | "GodtLevert"
UkeStart        DateOnly — mandag i leveranseuka
Tittel          string (max 200)
Beskrivelse     string? (max 2000)
Ingredienser    string? (JSON-array)
Instruksjoner   string? (JSON-array)
ImageUrl        string? (max 500)
CreatedByEmail  string? (max 200)
CreatedAt       DateTime
```

Ingen unik constraint på (GroupId, UkeStart, Tittel) — brukeren kan ha like oppskrifter fra ulike leverandører.

### API Changes

| Method | Endpoint                                | Description                                              |
|--------|-----------------------------------------|----------------------------------------------------------|
| POST   | /api/matkasse/from-images               | AI-ekstraksjon av 2–5 oppskrifter fra bildeopplasting    |
| GET    | /api/matkasse?groupId=&weekStart=       | Hent matkasseoppskrifter for en uke og gruppe            |
| DELETE | /api/matkasse/{id}                      | Slett en matkasseoppskrift                               |

**POST /api/matkasse/from-images** — multipart/form-data:
- `images`: 1–5 bildefiler
- `leverandor`: "Hellofresh" | "Kokkeloren" | "GodtLevert"
- `groupId`: int
- `weekStart`: "yyyy-MM-dd" (mandag i uken)

Response:
```json
{
  "recipes": [
    {
      "id": 1,
      "tittel": "Kylling tikka masala",
      "beskrivelse": "...",
      "leverandor": "Hellofresh",
      "ukeStart": "2026-04-21",
      "imageUrl": null
    }
  ]
}
```

**GET /api/matkasse?groupId=1&weekStart=2026-04-21**
Response: array av matkasseoppskrifter for uka

### UI Changes

**Frontend-komponenter:**
- `MatkassePanelSidebar.tsx` — ny sidebar-fane i ukesplanleggeren
  - Leverandørvelger (Hellofresh / Kokkeløren / Godt Levert)
  - Ukevelger (viser gjeldende uke som standard)
  - Bildeopplasting (dra-og-slipp, maks 5 bilder)
  - Vis matkasseoppskrifter per leverandør når de er lastet inn
  - "Legg til i uke"-knapp
- `MatkasseRecipeCard.tsx` — kort for én matkasseoppskrift med leverandørbadge
- `matkasse.service.ts` — frontend API-service

**Endringer i `UkesplanleggerClient.tsx`:**
- Ny fane "Matkasse" i sidebarens toppnavigasjon
- Bruk av `MatkassePanelSidebar` i stedet for / ved siden av `RecipePickerSidebar`

## Out of Scope
- Automatisk scraping av leverandørenes nettsider (krever innlogging/API-tilgang)
- Full oppskriftsredigering av matkasseoppskrifter
- Matkasseoppskrifter i hoveddisplayet (`/alle-oppskrifter`)
- Integrasjon med andre leverandører enn de tre nevnte
- Shopping list-generering

## Open Questions
- Ingen — klar til implementering
