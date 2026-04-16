# Implementation Plan: Alle oppskrifter

## Approach
Minimale endringer: gjenbruk `HomeClient` på ny rute, oppdater sidebar, redirect gammel rot.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- Gjenbruk `HomeClient` direkte på `/alle-oppskrifter` — ingen duplisering av logikk
- `/page.tsx` bruker Next.js server-side `redirect()` for å unngå klient-side flash
- Sidebar-linken bruker `isActive("/alle-oppskrifter")` og `pathname.startsWith("/alle-oppskrifter")`

## Risks
- Ingen kjente risikoer — endringen er isolert til routing og navigasjon
