# Mengdesammenstilling v2.03-preview.5.3.f

## Installering
Pakk ut i DocLib-roten. Overskriv alle sju filer under
stg1/tools/quantity-summary/. Ingen endringer i core/shared.
Last utvidelsen på nytt. Verktøyets byggnummer skal vise
v2.03-preview.5.3.f. Felles topptekst og Kontrollplan-overskrift
endres ikke av denne pakken. API-innlesingen er uendret fra 5.3.e.

## Nytt i 5.3.f
- Tabelloppsett samler Datakilder, Gruppering, Avrunding og Summering i
  en lukkbar boks. Åpen ved første bruk. Åpen/lukket beholdes i verktøyøkten,
  også ved endring av valg og bytte frem/tilbake til verktøyet.
- Objektnavn i avvik: velg en egenskap under Datakilder, eller bruk
  Automatisk navnevalg. Ved tom valgt egenskap forsøkes automatisk valg.
  Automatisk valg ser etter egenskapsnavn Name, Navn, IfcName, ObjectName,
  Objektnavn eller Betegnelse. Finnes ingen verdi, vises Navn ikke tilgjengelig.
  Navn kan bare vises når navneverdien finnes i innleste metadata.
  Objekt-ID beholdes. Objekttype vises når API-dataene inneholder typen.
  Hold pekeren over objektnavnet for å se hvilken navneegenskap som ble brukt.
  Excel/PDF-avvik får også objektnavn og navneegenskap.
- Velg kolonner: avkryssing per kode/enhet, Vis alle og Skjul alle.
  Utvalget gjelder både tabellen og Excel/CSV/PDF. Ingen IFC-data slettes,
  og avrundingsreglene endres ikke. Alle kolonner vises som standard.
  Ved endring av kode-/enhetsegenskap nullstilles skjulingen. Valgene
  beholdes ellers i verktøyøkten, men lagres ikke permanent mellom sideinnlastinger.
- Objektantall og avvik gjelder fortsatt hele modellutvalget. Det står
  uttrykkelig i kolonnevelgeren og i eksportoppsettet. Skjuling av kolonner
  er et visnings-/eksportvalg, ikke et filter på objekter eller datakvalitet.
- Skjules alle kolonner, sperres eksport og en forklaring vises.
- Råverdi ved manglende kode/enhet gjelder nå den aktuelle egenskapen,
  ikke mengdeegenskapen.
- Ny modul view-options.js følger pakken. Ingen endring i objektinnlesing.

## Tre avrundingsnivåer
IFC-objektmengder avrundes ALDRI. Valget fra 5.3.d er fjernet,
ikke bare gitt nytt navn. Gamle roundScope=object avvises eksplisitt.

1. Kun sluttsum (standard)
   Objektmengder summeres per modell-ID, valgt kodeegenskap og enhet.
   Modellsummene avrundes normalt til valgte desimaler. Disse verdiene
   brukes i modellrader og delsummer. Bare Sum per kolonne avrundes
   videre etter valgt retning og trinn. Avrundingsdifferanse vises rett
   over sluttsummen, også når differansen er null.

2. Per prosesskode per modell
   Objektmengder summeres per modell-ID, valgt kodeegenskap og enhet.
   Modellsummene avrundes etter valgt retning og trinn. Delsummer og
   totalsum summerer disse uten ny trinnavrunding. Fungerer også når
   modellnavn ikke er valgt som synlig grupperingsnivå.
   Navnet prosesskode viser til valgt kolonneegenskap; også andre
   kodeegenskaper kan brukes.

3. Nederste grupperingsnivå
   Råmengder summeres per celle på nederste nivå i tabellgrupperingen.
   Cellene avrundes etter valgt retning og trinn. Delsummer og totalsum
   summerer avrundede celler uten ny trinnavrunding.

Standard: Kun sluttsum, 0 desimaler, vanlig avrunding. Ingen
10-er/100-er-avrunding før brukeren velger Rund opp eller Rund ned.
Velg 0–6 desimaler og trinn 1, 10, 100, 1000 eller 10000.
Opp går mot pluss uendelig, ned mot minus uendelig, også for negative
tall. Vanlig avrunding ved halv verdi går bort fra null.
Originaldata endres ikke.

## Viktig om gruppering
Fast modellnivå (Kun sluttsum og Per prosesskode per modell) kan ikke
fordele én avrundet modell/kode/enhet-sum på flere undergrupper uten
å velge en fordelingsregel. Derfor sperres beregning og eksport hvis
samme modell/kode/enhet finnes i flere nederste grupper. Meldingen
angir modell og kode og ber om endret gruppering eller valget
Nederste grupperingsnivå. Ingen avrundingsdifferanse fordeles automatisk.
Å skjule/utvide grupper endrer aldri tallene. Ved nederste grupperingsnivå
kan endret gruppering endre avrundet totalsum. Fast modellnivå beholder
totalsummen ved omgruppering som ikke deler modell/kode/enhet.

## Eksport
Excel (.xlsx), CSV og PDF bruker samme beregnede resultat som tabellen.
Alle grupper inkluderes, også sammenfoldede. Avrundingsdifferanse
følger alle tre formater ved Kun sluttsum.

Excel har fire ark: Mengder, Oppsett, Avvik og Modeller. Mengdeceller
er numeriske verdier, ikke tekst eller rekalkulerende formler.
CSV: UTF-8 med BOM, semikolon, desimalkomma, uten tusenskilletegn.
CSV inneholder nederste rader, eventuell differanse og merket totalsum.
Ved videre summering i Excel/CSV brukes Radtype=Mengde, pluss
Avrundingsdifferanse hvis den endelige avrundede summen ønskes.
Delsum og Totalsum må ikke telles en gang til.
PDF: A3 liggende, opptil seks mengdekolonner per kolonnedel,
gjentatte overskrifter, sidenummer, oppsett og avvik bakerst.
Norske og vesteuropeiske tegn støttes; andre skriftsystemer kan bli ?.
Ingen eksterne biblioteker, CDN-er eller nettverkskall for eksport.

## Datakvalitet
Manglende/ugyldig mengde, kode eller valgt enhet utelates fra summer.
Manglende gruppeverdi samles i egen gruppe og inngår i summene.
Ulike enheter gir separate kolonner, uten omregning. Uten valgt enhet
må brukeren kontrollere at mengdene er sammenlignbare.
Modellfeil varsles og følger eksporten. Endret modellutvalg/versjon
krever oppdatert objektindeks før beregning/eksport.
Gyldig null vises som 0; manglende celle vises som strek.
Tusenskilletegn og enhetstekst i mengdeverdier tolkes ikke ved gjetting.
Lagring/import av oppsett og JSON-eksport er ikke inkludert.

## Tester
2176 lokale kontroller bestod med syntetiske testobjekter og simulert
API/DOM. Dekker tre nivåer, 0–6 desimaler, opp/ned/vanlig, alle trinn,
negative tall, separate enheter, modellidentitet, omgruppering,
sperring ved oppdeling, modellbytte og livssyklus. En test med 1000
små objekter kontrollerer at objektene ikke avrundes hver for seg.
36 av kontrollene dekker nye visningsvalg, navnevalg, manglende navn,
kolonneutvalg, skjul alle, gjenoppretting og bevaring av lukket oppsett.
Filtrerte testeksporter ble kontrollert for riktig kolonneutvalg, tall,
avrundingsdifferanse og objektnavn.
Testeksporter fra alle tre nivåer ble åpnet med uavhengige lesere:
XLSX med openpyxl, PDF med PyMuPDF og CSV med standard CSV-leser.
Totalsum og differanse ble sammenlignet med beregningsresultatet.
Bred PDF med 7 sider, norske tegn og siste kolonnedel kontrollert.
JavaScript-syntaks kontrollert. Ingen live-test i Trimble Connect eller
skrivebords-Excel, og ingen visuell nettlesertest i dette miljøet.

## Før live
1. Sammenlign kjent modellutvalg med tidligere versjon.
2. Prøv alle tre nivåer med kjent kode og mengde.
3. Kontroller at modellrader + differanse = sluttsum ved Kun sluttsum.
4. Eksporter alle tre formater og sammenlign med tabellen.
5. Åpne XLSX i Excel uten reparasjonsmelding.
6. Kontroller meldingen ved modell/kode fordelt på flere grupper.

7. Lukk Tabelloppsett, endre kolonnevalg og kontroller at boksen forblir lukket.
8. Velg en kjent navneegenskap og kontroller navnene i avvik og eksport.
9. Skjul en prosess og kontroller at kolonnen mangler i alle tre eksportformater.
10. Bruk Vis alle for å gjenopprette tabellen.
