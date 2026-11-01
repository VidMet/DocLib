# Mengdesammenstilling v2.03-preview.5.3.d

## Installering
Pakk ut i DocLib-roten. Overskriv alle filer i stg1/tools/quantity-summary/.
Pakken inkluderer seks komplette filer. export.js er ny i denne versjonen.
Ingen endringer i core/shared. Objektinnlesingen er beholdt fra siste fix.
Last utvidelsen på nytt. Verktøyet skal vise v2.03-preview.5.3.d.
Den felles toppteksten og overskriften Kontrollplan endres ikke her.

## Nytt
- Eksport til ekte Excel (.xlsx), CSV og direkte PDF (.pdf).
- Avrund på nederste grupperingsnivå (standard) eller hvert IFC-objekt.
- Eksport bruker samme beregnede resultat som tabellen.
- Alle grupper eksporteres, uavhengig av sammenfolding på skjermen.
- Ingen eksterne biblioteker, CDN-er eller nettverkskall for eksport.

## Avrunding
Standard: 0 desimaler, vanlig avrunding, nederste grupperingsnivå.
Velg 0–6 desimaler. Opp/ned bruker trinn 1, 10, 100, 1000 eller 10000.
Ved nederste nivå summeres råmengder per celle før cellen avrundes.
Ved objekt avrundes hver gyldig objektmengde før sammenstilling.
Delsummer og totalsum summerer avrundede verdier uten ny trinnavrunding.
Opp går mot pluss uendelig, ned mot minus uendelig. Halve verdier ved
vanlig avrunding går bort fra null. Originaldata endres aldri.
Endret gruppering kan endre totalsum ved avrunding på nederste nivå.
Ved objektavrunding påvirker ikke gruppering totalsummen.

## Eksport
Velg format ved tabellen og trykk Eksporter.

Excel: fire ark: Mengder, Oppsett, Avvik, Modeller. Mengder har faktiske
numeriske celler, gruppering i separate kolonner, radtype, delsummer og
totalsum. Beregnede verdier eksporteres, ikke formler som rekalkulerer
ved redigering. Ved videre summering filtreres Radtype=Mengde for å
unngå dobbelttelling av delsummer og totalsum.

CSV: UTF-8 med BOM, semikolon, desimalkomma og uten tusenskilletegn.
Flat tabell med nederste rader, separate grupperingskolonner og en
merket totalsumrad. Filtrer Radtype=Mengde ved videre summering.
Avrundingsinnstillinger og eventuelt datagrunnlagsvarsel følger radene.
CSV har ikke egne oppsett-/avviksark. Formel-lignende tekst beskyttes
med apostrof; faktiske negative tall beholdes som tall.

PDF: A3 liggende, opptil seks mengdekolonner per kolonnedel. Brede
rapporter deles både vannrett og loddrett, med gjentatte overskrifter
og sidenummer. Oppsett, modelloversikt og alle avvik følger bakerst.
Norske og vesteuropeiske tegn støttes via Helvetica/WinAnsi.
Andre skriftsystemer kan vises som spørsmålstegn. Ingen PDF/A eller
universell Unicode-font er inkludert i denne previewen.

## Datakvalitet
Manglende/ugyldig mengde, kode eller valgt enhet utelates fra summer.
Manglende gruppeverdi inngår i egen gruppe. Ulike enheter får separate
kolonner, uten omregning. Uten valgt enhet må brukeren kontrollere
sammenlignbarheten. Modellfeil varsles og følger eksporten.
Endret modellutvalg/versjon krever oppdatert objektindeks før eksport.
Gyldig null vises som 0; manglende celle vises som strek.
Tusenskilletegn og enhetstekst i mengdeverdier tolkes ikke ved gjetting.
Lagring/import av oppsett og JSON-eksport er ikke inkludert.

## Tester
231 eksisterende kontroller og 39 nye eksport-/avrundingskontroller
bestod med syntetiske data og simulert API/DOM. Genererte testeksporter
ble åpnet med uavhengige lesere: XLSX med openpyxl, PDF med PyMuPDF,
CSV med standard CSV-leser. Norsk tekst, numeriske celler, separate
ark, avvik, totaler og bred PDF med syv sider kontrollert.
JavaScript-syntaks kontrollert. Ikke live-testet i Trimble Connect,
ikke testet i skrivebords-Excel eller alle nettlesere.

## Før live
1. Kontroller kjent modellutvalg og mengdesum mot 5.3.c.
2. Prøv begge avrundingsnivåene med kjent objektmengde.
3. Last ned alle tre formater og sammenlign med tabellen.
4. Åpne XLSX i Excel og kontroller at ingen reparasjonsmelding vises.
5. Kontroller PDF med mange kolonner og CSV med norske tegn.
6. Endre modellutvalg og bekreft at eksport krever oppdatert indeks.
