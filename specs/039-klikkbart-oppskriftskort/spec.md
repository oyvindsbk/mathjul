# Feature: Klikkbart oppskriftsbilde og overskrift

## Summary
Gjør bildet og overskriften på oppskriftskortet til klikkbare lenker som navigerer til oppskriftssiden, slik at hele kortet føles interaktivt og ikke bare «Vis oppskrift»-knappen.

## Motivation
I dag er «Vis oppskrift»-knappen det eneste klikkbare elementet på kortet. Brukere forventer at bildet og tittelen også tar dem til oppskriften — det er standard oppførsel i de fleste oppskriftsapper og gir et større, mer treffsikkert klikkmål, særlig på mobil.

## Requirements

- Bildet på oppskriftskortet er en lenke til `/recipes/{id}`.
- Overskriften (`<h3>` med oppskriftstittelen) er en lenke til `/recipes/{id}`.
- Gjelder alle steder oppskriftskortet vises:
  - Forsiden / dashboard (`HomeDashboard.tsx`) — seksjonene «Favoritter» og «Nyeste oppskrifter»
  - «Alle oppskrifter» (`HomeClient.tsx`)
  - «Favoritter»-siden (`favoritter/page.tsx`)
- Eksisterende «Vis oppskrift»-knapp beholdes uendret.
- Hjerteknappen (`HeartButton`) over bildet må fortsatt fungere som en egen knapp og skal **ikke** utløse navigasjon.
- Kategori-knappene i kortet (filtrering i `HomeClient.tsx`) må fortsatt fungere som filterknapper og skal ikke utløse navigasjon.
- Lenkene må være tastaturnavigerbare med synlig fokusmarkering.

## Design

### Data Model
Ingen endringer.

### API Changes
Ingen endringer.

### UI Changes

Ingen nye sider eller komponenter. Eksisterende kort oppdateres:

**Bilde-lenke**
- `<Link href={`/recipes/${id}`}>` wrapper selve bilde-innholdet (`<img>` eller «Oppskrift bilde»-plassholderen).
- `HeartButton`-overlegget flyttes ut av lenkens DOM-subtre, men beholder samme visuelle plassering (`absolute top-2 right-2` i den samme `relative`-containeren). Dette unngår en interaktiv knapp nøstet inne i en lenke (ugyldig HTML og klikk-konflikt).
- Hover: bildet skaleres svakt opp (`scale-105`) med `transition-transform`, klippet av containerens `overflow-hidden`. Dette er en veletablert, lavmælt affordance som ikke endrer kortets layout.

**Tittel-lenke**
- `<h3>` beholdes som overskrift for semantikk; `<Link>` legges inne i `<h3>` rundt tittelteksten.
- Hover: `hover:text-blue-600` — samme blåfarge som resten av appens lenker.

**Fokus**
- Begge lenkene får `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500` slik at tastaturbrukere ser hvor de er.

**Visuelt uendret i hviletilstand:** kortet ser identisk ut som i dag når musepekeren ikke er over det. Ingen understreking eller fargeendring på tittelen i normaltilstand.

## Out of Scope
- Endringer i oppskriftens innhold.
- Redesign av oppskriftskortet (layout, farger, spacing).
- Å gjøre *hele* kortet til én stor lenke.
- Å trekke de tre kort-variantene ut i én delt komponent (egen opprydningsoppgave).
- `MatkasseRecipeCard` og kort i ukesplanleggeren — disse har egen interaksjonsmodell (velge/legge til) og er ikke del av denne oppgaven.

## Open Questions
Begge spørsmålene fra det opprinnelige forslaget er avklart over:
- **Hvordan skal lenken se ut visuelt?** Uendret i hviletilstand; ingen understreking.
- **Skal det være hover-effekter?** Ja — svak zoom på bildet, blå tekst på tittelen.
