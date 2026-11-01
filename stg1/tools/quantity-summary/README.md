# Mengdesammenstilling v2.03-preview.5.3.c

## Installering
Pakk ut ZIP-filen i DocLib-roten slik at filene havner under
`stg1/tools/quantity-summary/`. Overskriv de fire eksisterende filene og
legg til `summary-engine.js`. Ingen endringer i core eller shared.
Last utvidelsen pa nytt. Byggnummeret inne i Mengdesammenstilling skal
vise `v2.03-preview.5.3.c`. Felles topptekst kan fortsatt vise gammel
versjon eller Kontrollplan; denne pakken endrer ikke verktoyrammen.

## Bruk
1. Velg IFC-modeller i det felles filtreet.
2. Trykk Bygg objektindeks.
3. Velg kodeegenskap for kolonnene, mengdeegenskap og eventuelt enhet.
4. Velg opptil tre grupperingsnivaer. Modellnavn er standard pa niva 3.
5. Utvid/skjul grupper med pilene. Sum per kolonne star nederst.

Egenskapslisten bygges fra faktisk innleste objektdata, ikke modellens
aggregerte eksempelverdier. Enkle standardvalg foreslas ved eksakte
navnetreff; kontroller alltid at egenskapene er riktige for modellen.
Alle valg kan endres. Endring av modellutvalg/versjon sperrer tabellen
inntil objektindeksen oppdateres. Oppdater bruker eksisterende minnecache
for samme modell-ID og versjon, som i forrige fix.

## Datakvalitet
- Ingen demonstrasjonsdata i verktøyet.
- Manglende/ugyldig mengde, kode eller valgt enhet utelates fra summer.
- Manglende gruppeverdi samles i egen gruppe og inngaer i summene.
- Avvik viser modell, objekt-ID, aarsak og raaverdi. Inntil 500 vises.
- Ulike enheter for samme kode gir separate kolonner, uten omregning.
- Uten valgt enhet er det brukerens ansvar at mengdene er sammenlignbare.
- Punktum/komma som desimalskilletegn stottes. Tusenskilletegn og
  mengdetekst med enhet avvises fremfor aa bli tolket ved gjetting.
- Standard 0 desimaler; velg 0 til 6 desimaler.
- Vanlig avrunding til valgte desimaler, eller opp/ned til 1, 10, 100, 1000 eller 10000.
- Avrunding skjer per celle på nederste grupperingsnivå, IKKE per IFC-objekt.
- Delsummer og totalsum summerer de avrundede cellene uten ny trinnavrunding.
- Endret gruppering kan endre avrundet totalsum. Skjuling av grupper endrer ikke summene.
- Negative tall: opp mot pluss uendelig, ned mot minus uendelig.
- Vanlig avrunding ved halv verdi går bort fra null. Originaldata endres ikke.
- Null vises som 0; celler uten gyldige mengder vises som strek.
- Ingen Total-kolonne per rad. Gruppene har delsummer per kolonne.
- Ved modellfeil vises tydelig varsel; summer gjelder kun komplett leste modeller.
- Excel-eksport og lagring av oppsett er ikke inkludert.

## Filer
- index.js: brukergrensesnitt, livssyklus og kobling til objektindeks.
- object-index.js: uendret API-innlesing fra preview.5.3.a-fix.1.
- summary-engine.js: ny, separat grupperings- og summeringsmotor.
- styles.css: eksisterende tabellstil med tillegg og eksplisitt innlasting.
- README.md: denne dokumentasjonen.

## Verifikasjon
Lokale automatiserte tester med syntetiske data dekker avrunding,
desimalvalg, negative tall, separate enheter og summering fra avrundede
bladceller. JavaScript-syntaks kontrollert. Ikke live-testet i Trimble Connect.
