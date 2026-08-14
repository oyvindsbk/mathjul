# Implementation Plan: Min oppskriftsprofil

## Approach

Bygger på eksisterende byggeklosser i stedet for å innføre nye. `Recipe.OwnerEmail`
finnes og er indeksert, `ApplyVisibilityFilter` håndterer allerede tilgangsregler, og
`/profil` finnes som innstillingsside. Arbeidet er derfor i hovedsak:

1. **Backend:** to nye read-endepunkter på `RecipesController` som filtrerer på
   `OwnerEmail` og går gjennom `ApplyVisibilityFilter`, pluss et offentlig
   `GET /api/user/{id}` som gir avledet visningsnavn uten å lekke e-post.
2. **Visningsnavn:** en delt hjelpefunksjon som løser `Nickname → Name → DisplayName
   → Email`, brukt både i profil-endepunktet og når oppskrifter beriker
   `OwnerDisplayName`.
3. **Frontend:** trekke ut oppskriftskortet fra `/favoritter` til en delt komponent,
   bygge `/profil` som en seksjonert side, legge til `/profil/[userId]`, og fjerne
   `/favoritter`.

Rekkefølgen er valgt slik at backend er klar før frontend forbruker den, og at
uttrekket av kortkomponenten skjer før `/favoritter` slettes — da mister vi ikke
markup underveis.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **Ingen datamodellendring.** `OwnerEmail` dekker behovet. Å migrere til en ekte
  FK mot `User` ville berørt hver eneste oppskrifts-spørring for null funksjonell
  gevinst i denne featuren.
- **Profil-URL bruker `User.Id`, ikke e-post.** Eierskap er lagret som e-post, men å
  legge e-post i URL-er (`/profil/oyvindsbk@gmail.com`) eksponerer adresser i
  historikk, logger og delte lenker. `userId` slås opp mot `Users` server-side.
- **`OwnerUserId` er nullable.** En oppskrift kan ha `OwnerEmail` for en bruker som
  ikke (lenger) finnes i `Users` — f.eks. seed-data. Da vises navnet uten lenke i
  stedet for å lenke til en 404.
- **`/api/user/{id}` returnerer ikke e-post.** Endepunktet er lesbart for enhver
  innlogget bruker, så det gir kun avledet visningsnavn og antall.
- **Delt `RecipeGridCard`.** Kortet finnes i dag inline i `/favoritter` og gjenbrukes
  av tre seksjoner etter denne featuren. Uttrekk før sletting unngår duplisering.
- **`/favoritter` slettes uten redirect** (brukerens valg). Nav-lenke, breadcrumb og
  rute fjernes i samme commit så ingen intern lenke peker på en død rute.

## Risks

- **Eksisterende oppskrifter uten `OwnerEmail`.** Seed-oppskrifter har trolig
  `OwnerEmail = null`. De dukker da ikke opp på noen profil, som er riktig oppførsel,
  men "Mine oppskrifter" kan se tommere ut enn ventet i dev. *Mitigering:* verifiser
  mot lokal DB i Task 8 og dokumenter funnet.
- **Tilgangslekkasje på `/api/recipes/by-user/{id}`.** Endepunktet må filtrere på
  kallerens tilgang, ikke eierens. *Mitigering:* gjenbruk `ApplyVisibilityFilter` med
  `GetCallerEmail()`, og dekk med en xUnit-test der bruker A ber om bruker Bs
  private oppskrifter.
- **`isLikedByMe` på andres profil.** Hjerteknappen skal reflektere *kallerens*
  likes, ikke profileierens. *Mitigering:* samme `likedIds`-oppslag som i
  `GetAllRecipes`, basert på `callerEmail`.
- **Døde lenker etter sletting av `/favoritter`.** PWA-snarveier eller bokmerker vil
  gi 404. *Mitigering:* akseptert av bruker; grep etter `/favoritter` i hele repoet
  (inkl. `manifest`, e2e-tester) i Task 7.
