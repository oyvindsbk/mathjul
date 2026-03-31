# Implementation Plan: Kategorisering

## Approach
Legg til en `Category`-entitet og koblingstabell i databasen, eksponér kategorier via API, og bygg filterUI i frontend. Arbeider lagvis: database → backend → frontend.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure (ingen endringer)

## Key Decisions

- **Pre-seeded kategorier:** Kategoriene er faste og seedes i `RecipeDbContext`. Brukere velger fra listen — vi trenger ikke admin-UI for å opprette kategorier. Raskt å implementere og gir konsistent UX.

- **AND-filter:** Å matche alle valgte kategorier gir presise resultater. OR-filter ville gitt for mange treff.

- **Server-side filter:** Filtreringen skjer i backend (`WHERE`-klausul med JOIN) fremfor client-side filtrering av en full liste. Skalerer bedre og unngår å laste all data til klienten.

- **Chip-basert multi-select UI:** Chips/knapper er visuelt tydelige og touch-vennlige. Samme komponent brukes i filterpanel og i skjema for konsistens.

- **CategoryDto gjenbrukt:** Samme DTO brukes i `GET /api/categories`, innebygd i `RecipeDto`, og i `RecipeDetailDto` — unngår duplisering.

## Risks

- **EF Core migrering:** Ny tabell og seed-data krever en ny migration. Risiko: mismatch mellom migration og eksisterende seed-data. Mitigering: teste lokalt med Aspire før commit.

- **Null-håndtering i frontend:** Eksisterende oppskrifter har ingen kategorier. Alle komponenter må håndtere `categories: []` trygt. Mitigering: initialisere som tom array i mock-data og service.
