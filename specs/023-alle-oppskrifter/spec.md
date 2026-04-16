# Feature: Alle oppskrifter + Hjem med favoritter/nyeste

## Summary
Opprett en dedikert `/alle-oppskrifter`-side med full oppskriftsoversikt. Hjem-siden (`/`) redesignes til å vise brukerens favorittoppskrifter og de nyeste oppskriftene.

## Motivation
Brukere ønsker rask tilgang til favorittene sine og nye oppskrifter på Hjem. En egen Alle oppskrifter-side gir bedre navigasjon til full oversikt.

## Requirements
- Ny side `/alle-oppskrifter` som viser eksisterende oppskriftsoversikt (HomeClient)
- Sidebar: "Hjem" peker til `/`, ny link "Alle oppskrifter" peker til `/alle-oppskrifter`
- Hjem-siden (`/`) viser to seksjoner:
  - **Favoritter**: brukerens likte oppskrifter (inntil 8 stk)
  - **Nyeste**: de siste oppskriftene lagt til (inntil 8 stk)
  - Tom-state: tydelig melding dersom ingen favoritter eller ingen oppskrifter finnes
- Nytt backend-endepunkt: `GET /api/recipes/newest?take=N` — returnerer N nyeste oppskrifter sortert på `CreatedAt` desc
- Favoritter: bruker eksisterende `GET /api/recipes/liked`

## Design

### API Changes
- `GET /api/recipes/newest?take=8` — ny action i `RecipesController`, returnerer `List<RecipeDto>`, krever auth

### UI Changes
- `/alle-oppskrifter/page.tsx` — re-eksporterer `HomeClient`
- `/page.tsx` — ny Hjem-side med to horisontale scrollable-seksjoner (favoritter + nyeste)
- `Sidebar.tsx` — legg til "Alle oppskrifter"-link under "Hjem"
- `recipe.service.ts` — legg til `getNewestRecipes(token, take)` og `getFavoriteRecipes(token)`

## Out of Scope
- Endringer i oppskriftens detaljer eller redigering fra Hjem
- Sortering/filtrering på Hjem-siden

## Open Questions
- Ingen
