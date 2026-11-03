# DocLib STG1 v2.04-preview.2-fix.5

Baseline: v2.04-preview.2-fix.4. Bare Setup-opplasting er funksjonelt endret.

- POST /files/fs/upload med parentId og parentType i query og {"name":"doclib.tools.json"} i body.
- Forventer 202 og bruker source-elementet uten format i contents[].url.
- PUT med UTF-8-bytes uten ekstra headere, Authorization eller cookies. Ingen automatisk PUT-retry.
- GET /files/fs/upload?uploadId=... kontrolleres inntil DONE, maksimalt 30 statuskall. Ingen multipart /complete.
- Leser prosjektfilen tilbake og sammenligner normaliserte verktovalg for menyen oppdateres.
- Eksisterende doclib.tools.json overskrives fortsatt ikke. Oppfrisk og rolleoppslag er beholdt.
- Diagnostikk angir hvilket trinn som feilet. Signerte URL-er og kjente ID-er redigeres bort.

## Installasjon
Pakk ut og kopier innholdet i stg1 til eksisterende stg1, med overskriving. Ikke legg stg1 inni stg1. Live 2.03 er ikke med i pakken.

## Test i STG1
Kontroller versjonen. Lagre en gang nar prosjektfilen ikke finnes. Kontroller filen i Extension_config/DocLib, og last utvidelsen pa nytt for a kontrollere at valgene leses fra prosjektet.

## Teststatus
Lokale kontrakt-/flyttester bruker simulerte svar basert pa vedlagt OpenAPI. Faktisk lagring i Trimble Connect er ikke kjort her.
