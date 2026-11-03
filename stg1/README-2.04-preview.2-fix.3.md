# DocLib STG1 v2.04-preview.2-fix.3

Ren diagnostikkfix basert på fix.2.

- Oppfrisk og øvrig funksjonalitet er uendret.
- Feil på første POST /files/fs/upload viser en sikker diagnostikkblokk i Setup.
- Diagnostikken viser HTTP-status, Core-feilkode/melding, responsens feltnavn og hvilke parameter-/body-feltnavn DocLib sendte.
- Diagnostikken inneholder ikke token, prosjekt-/mappe-/bruker-ID, signert URL eller rå request-/response-body.
- Ingen automatisk retry. Ved startfeil kjøres ikke PUT eller complete.
