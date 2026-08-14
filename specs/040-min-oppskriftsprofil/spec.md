# Feature: Min oppskriftsprofil

## Summary

Gjør `/profil` om til en samlet "Min side": brukerens egne oppskrifter og favoritter
vises sammen med profilinnstillingene. Andre brukere får en read-only profilside på
`/profil/[userId]`, som man kommer til ved å trykke navnet under "Lagt til av" på en
oppskrift.

## Motivation

I dag finnes ingen oversikt over oppskrifter du selv har lagt til — du må lete i
`/alle-oppskrifter` blant alles oppskrifter. Favoritter ligger på en egen rute
(`/favoritter`), og `/profil` er kun et innstillingsskjema. Det gir tre halvtomme
sider der én samlet side hadde vært nok.

Samtidig lekker oppskriftssiden i dag rå e-postadresse ("Lagt til av
oyvindsbk@gmail.com"). Å vise navn/kallenavn i stedet er både penere og mindre
eksponerende, og gir et naturlig sted å lenke videre til den brukerens profil.

## Requirements

### Min side (`/profil`, innlogget bruker)

- Vise header med brukerens visningsnavn og telling: `N oppskrifter · M favoritter`
- Vise seksjonen **Favoritter** øverst (samme innhold som dagens `/favoritter`)
- Vise seksjonen **Mine oppskrifter** under favoritter
- Vise en «Rediger profil»-knapp i headeren som går til `/profil/rediger`
- Redigere navn og kallenavn på egen side (`/profil/rediger`), ikke inline på Min side
- Sortere begge oppskriftslister med nyeste først (`CreatedAt` synkende)
- Vise tom tilstand per seksjon når listen er tom
- Åpne en oppskrift ved klikk på kort (gjenbruk av eksisterende kortoppsett)

### Andres profil (`/profil/[userId]`, read-only)

- Vise brukerens visningsnavn og antall oppskrifter
- Vise kun oppskrifter den brukeren har lagt til, filtrert på hva den **innloggede**
  brukeren har tilgang til å se (Public, egne Private, delte Group)
- **Ikke** vise favorittene til andre brukere
- **Ikke** vise profilinnstillinger for andre brukere
- Vise tom tilstand hvis brukeren ikke har synlige oppskrifter
- Vise "Fant ikke brukeren" ved ukjent `userId`
- Hvis `userId` er den innloggede brukeren selv, redirect til `/profil`

### Visningsnavn

- Brukere vises som: `Nickname` → `Name` → `DisplayName` → `Email` (første som er satt)
- "Lagt til av" på oppskriftssiden viser visningsnavn, ikke e-post, og lenker til
  `/profil/[userId]` for den eieren

### Navigasjon

- `/favoritter` fjernes helt (rute, nav-lenke og breadcrumb-oppføring)
- Sidebar-lenken "Favoritter" erstattes med "Min side" → `/profil`
- Breadcrumb får `/profil` → "Min side"

## Design

### Data Model

**Ingen endringer.** `Recipe.OwnerEmail` finnes allerede
(`backend/RecipeApi/Features/Recipes/Recipe.cs:95`) og er indeksert sammen med
`Visibility` (migrasjon `20260413124711_AddGroupsAndVisibility`). Ingen ny migrasjon
kreves.

Merk: eierskap er lagret som **e-post**, ikke som fremmednøkkel til `User`. Profilruter
bruker numerisk `User.Id` i URL-en og slår opp e-post server-side, slik at e-poster
ikke havner i URL-er.

### API Changes

Nye endepunkter i `RecipesController`:

| Metode | Rute | Beskrivelse |
|--------|------|-------------|
| `GET` | `/api/recipes/mine` | Oppskrifter eid av innlogget bruker, nyeste først |
| `GET` | `/api/recipes/by-user/{userId:int}` | Oppskrifter eid av angitt bruker, filtrert gjennom `ApplyVisibilityFilter` for kalleren |

Nytt endepunkt i `UserController`:

| Metode | Rute | Beskrivelse |
|--------|------|-------------|
| `GET` | `/api/user/{id:int}` | Offentlig profil: `id`, `displayName` (avledet), `recipeCount` |

Begge oppskriftsendepunktene returnerer eksisterende `RecipeDto` og gjenbruker
`ApplyVisibilityFilter`. `/api/user/{id}` returnerer **ikke** e-post — kun avledet
visningsnavn — slik at profilsiden ikke eksponerer adresser.

`RecipeDetailDto` og `RecipeDto` utvides med:
- `OwnerDisplayName: string?` — avledet visningsnavn for eieren
- `OwnerUserId: int?` — for lenking til profil (null hvis eier ikke finnes i `Users`)

### UI Changes

**`/profil`** (`frontend/src/app/profil/page.tsx`) bygges om:

```
┌────────────────────────────────────────────────┐
│ Øyvind                       [Rediger profil]  │
│ 12 oppskrifter · 5 favoritter                  │
├────────────────────────────────────────────────┤
│ ❤️ Favoritter                                   │
│ [kort] [kort] [kort] [kort]                    │
├────────────────────────────────────────────────┤
│ Mine oppskrifter                               │
│ [kort] [kort] [kort]                           │
└────────────────────────────────────────────────┘
```

**`/profil/rediger`** — navn og kallenavn, med Lagre og Avbryt. Begge går tilbake
til Min side, der det nye navnet vises i headeren.

**`/profil/[userId]`** — samme header, kun seksjonen "Oppskrifter fra <navn>".

Oppskriftskortet i `/favoritter` trekkes ut til en delt
`components/RecipeGridCard.tsx` slik at begge profilsidene og favorittseksjonen
bruker samme kort. `HeartButton` vises kun når kortet rendres for innlogget bruker.

## Out of Scope

- Redigering av andres profilinformasjon
- Deling av oppskrifter fra profilen
- Statistikk, rangering eller aktivitetslogg
- Administrasjon av grupper eller tilgang fra profilsiden
- Sortering- eller filter-UI på profilsidene (fast: nyeste først)
- Sletting av oppskrifter direkte fra profilsiden (finnes på oppskriftssiden)
- Å vise andres favoritter
- Migrering av `OwnerEmail` til en ekte fremmednøkkel mot `User`

## Open Questions

Alle avklart med bruker 2026-08-14:

- **Andres profil i scope?** Ja — read-only, uten favoritter og innstillinger.
- **Hvordan vises brukere?** Kallenavn → navn → visningsnavn → e-post.
- **Hva skjer med `/favoritter`?** Slettes helt; blir seksjon på `/profil`.
- **Antall/sortering/filter/sletting?** Antall øverst og nyeste først. Ingen filter, ingen sletting.
