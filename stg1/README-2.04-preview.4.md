# DocLib STG1 v2.04-preview.5

Bygget videre fra preview.3. Opprettings- og oppdateringslogikken i Setup-repository er uendret.

## Implementert
- Alle fire prosjektverktøy er aktivert for prosjekter uten oppsett.
- Eksisterende lagrede verktøyvalg beholdes.
- Utforsker er alltid tilgjengelig. Setup vises bare for administratorer.
- Setup har avkryssing for prosjektets standardkolonner. Filnavn er obligatorisk.
- Kolonnesynlighet lagres i explorer.columns i doclib.tools.json sammen med verktøyvalgene.
- Vis kolonner i Utforsker lagrer personlige valg lokalt per prosjekt og bruker, uten å endre prosjektfilen.
- Bruk prosjektstandard tilbakestiller personlige synlighetsvalg til prosjektets standard.
- 3D-kolonnen er fjernet. Knapper for å åpne valgte modeller i 3D er beholdt.
- Format er skjult som standard, men kan velges.

Eksisterende tilpassede kolonneprofiler beholdes og kan overstyre metadata-kolonners synlighet. Velg Bruk prosjektstandard under Vis kolonner for å følge Setup. Prosjektoppsettet deler synlighet, ikke nye IFC PSET-/egenskapsdefinisjoner, farger eller rekkefølge.

## Installasjon og test
1. Ta vare på preview.3 som tilbakeføringspakke.
2. Kopier innholdet i ZIP-ens stg1 til eksisterende stg1 med overskriving. Unngå stg1/stg1.
3. Last hele utvidelsen på nytt og kontroller preview.4 i versjonsvisningen.
4. Lagre standardkolonner i Setup, last på nytt og kontroller at valgene beholdes.
5. Test Vis kolonner og Bruk prosjektstandard. Personlige valg skal ikke endre prosjektfilen.
6. Kontroller eksisterende avvalgte verktøy og et prosjekt uten oppsett.

Ingen prosjektfil skrives før administrator velger Lagre prosjektoppsett. Live er ikke endret.

## Teststatus
Lokale komponenttester i Chromium er bestått. Alle 51 JavaScript-filer er syntakskontrollert og relative modulreferanser kontrollert. Lagring er simulert i komponenttestene. Faktisk Trimble Connect-lagring og full Workspace-oppstart må testes i STG1. Eldre README-/testfiler er historikk, ikke testresultater for preview.4.
