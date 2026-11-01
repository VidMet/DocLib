# Mengdesammenstilling v2.03-preview.5.3.b

## Installering
Pakk ut ZIP-filen i DocLib-roten slik at filene havner under
`stg1/tools/quantity-summary/`. Overskriv de fire eksisterende filene og
legg til `summary-engine.js`. Ingen endringer i core eller shared.
Last utvidelsen pa nytt. Byggnummeret inne i Mengdesammenstilling skal
vise `v2.03-preview.5.3.b`. Felles topptekst kan fortsatt vise gammel
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
- Visning har opptil seks desimaler. Summer bruker uavrundede tall.
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
29 lokale kontroller bestod med syntetiske testobjekter og simulert API/DOM.
Dekker talltolking, null, ugyldige verdier, gruppering, separate enheter,
modeller med samme navn, modellbytte og mount/unmount/destroy.
JavaScript-syntaks kontrollert. Ikke testet mot levende Trimble Connect
eller visuelt i nettleser. Kontroller forst med modellen som tidligere
rapporterte 322 objekter, og sammenlign en kjent mengdesum manuelt.
