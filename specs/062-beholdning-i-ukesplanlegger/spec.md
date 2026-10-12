# Feature: Beholdning inne i ukesplanleggeren

## Summary
Beholdning, handleliste og forslag (fra 061) flyttes fra egen side `/beholdning` til en visning inne i ukesplanleggeren.

## Motivation
Beholdningen hører sammen med ukeplanen: det er ukas middager som avgjør hva som mangler. En egen toppnavigasjon-side gjorde at man hoppet mellom to steder med hver sin gruppevelger.

## Requirements
- Ukesplanleggeren har en bryter «Ukeplan | Beholdning» i toppen. Valget ligger i URL-en (`?view=beholdning`), slik at lenker og tilbakeknapp fungerer.
- Beholdningsvisningen har fanene Beholdning, Handleliste og Forslag (`?tab=`), og bruker planleggerens gruppevelger.
- Beholdningsvisningen er tilgjengelig også når ukesplanleggeren er deaktivert for gruppen, siden beholdningen ikke avhenger av den.
- Knappen «Hva mangler denne uka?» vises bare i ukeplan-visningen. «Åpne handlelisten» i det panelet går til beholdningsvisningen, handlelisten.
- Ingen kalender- eller ukeplan-henting når beholdningsvisningen er aktiv.
- Gamle adresser `/beholdning?groupId=&tab=` videresendes til `/ukesplanlegger?view=beholdning&...`.
- Egen oppføring for Beholdning fjernes fra `Sidebar`, `BottomNav` og brødsmulene.

## Design
Fanene og innholdet flyttes til `BeholdningPanel` (tar `groupId` og `token`). `BeholdningClient` og dens gruppevelger fjernes. Ingen endringer i backend.

## Out of Scope
- Endringer i selve beholdnings-, handleliste- eller forslagsfanene.
- Oda-kobling.
