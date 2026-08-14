# Implementation Plan: Klikkbart oppskriftsbilde og overskrift

## Approach

Ren frontend-endring i tre filer som hver har sin egen kopi av oppskriftskortet. Samme mønster brukes i alle tre for å holde dem konsistente:

1. Wrap bilde-innholdet i `<Link href={`/recipes/${id}`}>`, plassert som søsken til `HeartButton`-overlegget — ikke som forelder.
2. Wrap tittelteksten i `<Link>` inne i den eksisterende `<h3>`.
3. Legg til hover- og fokus-klasser.

Ingen nye avhengigheter. `Link` fra `next/link` er allerede importert i alle tre filene.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **Hjerteknappen holdes utenfor lenken:** en `<button>` inne i en `<a>` er ugyldig HTML og gir uforutsigbar klikkoppførsel. Bilde-lenken og hjerte-overlegget blir søsken i samme `relative`-container, så det visuelle resultatet er identisk.
- **`<h3>` beholdes, `<Link>` legges inni:** bevarer dokumentets overskriftsstruktur for skjermlesere. Motsatt rekkefølge (`<Link>` rundt `<h3>`) ville også vært gyldig, men gjør klikkflaten til hele bredden av kortet, inkludert tomrommet ved siden av korte titler.
- **Ingen delt komponent nå:** de tre kortene har ulike detaljer (høyder, kategori-knapper, `initialLiked`). Å slå dem sammen er en større refaktorering med egen risiko og hører ikke hjemme i denne oppgaven — men det er notert som oppfølging.
- **Én oppgave per fil:** gjør hver endring liten og verifiserbar, med egen commit.

## Risks

- **Klikk-konflikt mellom hjerteknapp og bilde-lenke:** mitigeres ved at de er søsken; hjertet ligger over med `absolute` og fanger sine egne klikk.
- **Kategori-knappene i `HomeClient.tsx` ligger under tittelen:** de er utenfor både bilde- og tittel-lenken, så de påvirkes ikke. Verifiseres manuelt med Playwright.
- **Playwright-tester som klikker «Vis oppskrift»:** knappen er uendret, så eksisterende tester skal fortsatt passere. Kjøres som sjekk til slutt.
