# Nytt i v2.03-preview.5.3.h

IFC-prosjekt- og romlige strukturobjekter filtreres fra objektindeksen
før egenskapskatalog, objektantall, summering, avvik og eksport.
En ekstra kontroll i summeringsmotoren beskytter også direkte bruk.

Eksplisitt liste: IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey,
IfcSpace, IfcSpatialZone, IfcSpatialElement, IfcSpatialStructureElement,
IfcExternalSpatialElement, IfcExternalSpatialStructureElement,
IfcFacility, IfcFacilityPart, IfcFacilityPartCommon, IfcBridge,
IfcBridgePart, IfcRoad, IfcRoadPart, IfcRailway, IfcRailwayPart,
IfcMarineFacility og IfcMarinePart.
Dette gjelder romlige containere, ikke bjelker, vegger eller andre
fysiske fagobjekter. Objektnavn brukes aldri til å avgjøre klasse.

Klasse leses fra tilgjengelige objektklassefelt eller klasseegenskaper
som IfcClass, IfcEntity, IfcType, EntityType, Class og Type, bare når
verdien er et IFC-klassenavn. Numeriske type-ID-er tolkes ikke.
Ved motstridende klasseverdier prioriteres utelatelse av strukturobjekt.

VIKTIG BEGRENSNING FØR STG2:
Den eksisterende API-forespørselen ber om id og psets. Vi har ikke
verifisert mot live API at klasse finnes i alle objekters metadata.
Ingen udokumenterte API-felt er lagt til. Dersom klassen ikke finnes,
viser verktøyet antall med ukjent klasse og SPERRER beregning/eksport.
Dette hindrer at strukturobjekter ubemerket tas med, men kan stoppe
modeller som tidligere fungerte. Da må klasseinnlesingen tilpasses
faktiske API-data før STG2. Ikke omgå sperren med navnegjetting.

Status viser utelatte strukturobjekter og ukjent IFC-klasse. Antall
utelatte følger Excel/PDF-oppsettet. Strukturobjekter vises ikke som
avvik. Vanlige fagobjekter med manglende mengde/kode gir fortsatt avvik.

Verifikasjon: 6125 eksisterende kontroller (med eksplisitt IFC-klasse i
syntetiske testobjekter) og 401 nye filterkontroller bestod. Nye tester
dekker alle utelatte klasser, store/små bokstaver, pset-klasse, cache,
objektantall, avvik, ukjent klasse og egenskaper som kun finnes på
strukturobjekter. Filtrerte XLSX/CSV/PDF åpnet med uavhengige lesere.
Ikke live-testet i Trimble Connect. Før STG2 må Ukjent IFC-klasse være 0,
utelatte objekter kontrolleres og kjent mengdesum/avvik sammenlignes.

# Mengdesammenstilling v2.03-preview.5.3.h

## Installering
Pakk ut i DocLib-roten. Overskriv alle åtte filer under
stg1/tools/quantity-summary/. Ingen endringer i core/shared.
Last utvidelsen på nytt. Verktøyets byggnummer skal vise
v2.03-preview.5.3.h. Felles topptekst og Kontrollplan-overskrift
endres ikke av denne pakken. API-feltkombinasjonen er beholdt. Objektindeksen filtrerer nå strukturobjekter.

## Fire avrundingsnivåer
De tidligere valgene er erstattet med:
- Gruppe 3: valgt egenskap, normalt Modellnavn.
- Gruppe 2: valgt egenskap.
- Gruppe 1: valgt egenskap.
- Kun totalsum (standard).

Gruppeplasser beholder nummereringen selv om andre plasser er tomme.
Hvis bare gruppe 3 er valgt, er avrundingsvalget fortsatt Gruppe 3,
ikke Gruppe 1. Ubrukte grupper kan ikke velges for avrunding.
Fjernes gruppen som brukes for avrunding, bytter verktøyet til Kun totalsum.
Etiketten viser egenskapen som faktisk er valgt på gruppenivået.
Gruppe 3 er bare per fil når Modellnavn er valgt som gruppe 3.

IFC-objektmengder avrundes ALDRI. Råmengder summeres i nederste
celler per kode og enhet. Disse følger valgt desimalpresisjon, med
unntak av når selve nederste gruppen er valgt for trinnavrunding.
Da trinnavrundes råsummen i cellen direkte, uten dobbel avrunding.
Nivåer under valgt avrundingsnivå følger desimalpresisjonen.
Valgt nivå avrundes etter retning og trinn. Nivåer over summerer
resultatet uten ny trinnavrunding. Dermed kan totalsummen være et
annet tall enn totalsummen ville blitt ved direkte trinnavrunding.

Eksempel med fire modellrader på 12,4, 0 desimaler og opp til 10:
X / E1 / A = 12,4; X / E1 / B = 12,4;
X / E2 / C = 12,4; Y / E3 / D = 12,4.
Gruppe 3 gir total 80. Gruppe 2 gir 70. Gruppe 1 gir 60.
Kun totalsum gir 50 (desimalavrundede modellrader summerer til 48).

Standard: Kun totalsum, 0 desimaler, vanlig avrunding.
Velg 0–6 desimaler. Opp/ned bruker trinn 1, 10, 100, 1000 eller 10000.
Opp går mot pluss uendelig, ned mot minus uendelig, også for negative
tall. Vanlig avrunding ved halv verdi går bort fra null.
Originaldata endres ikke. Endret gruppering kan endre avrundet total.
Den tidligere sperren ved samme modell/kode fordelt på flere grupper
er fjernet: beregningen følger nå den valgte gruppeplassen, ikke et
fast modellnivå uavhengig av tabelloppsettet.

## Avrundingsdifferanser
Ved avrunding på mellomnivå vises Avrundingsdifferanse etter gruppens
underliggende rader. Underliggende summer + differanse = gruppesum.
Ved Kun totalsum vises differansen over Sum per kolonne.
Ved avrunding på nederste gruppe vises Avrundingsinfo (inngår i raden
over). Denne informasjonen forklarer forskjellen fra vanlig
 desimalavrunding og skal IKKE summeres i tillegg til Mengde-raden.
Skjules en gruppe, skjules også tilhørende differanse/info i tabellen.
Alle grupper og differanser følger eksportene uavhengig av sammenfolding.

## Tabelloppsett og kolonnevalg
Tabelloppsett samler Datakilder, Gruppering, Avrunding og Summering i
lukkbar boks. Åpen/lukket beholdes i verktøyøkten.
Velg kolonner gir avkryssing per kode/enhet, Vis alle og Skjul alle.
Utvalget gjelder tabell og eksport, ikke beregningsreglene eller
objektantall/avvik. Alle kolonner vises som standard. Endring av
kode-/enhetsegenskap nullstiller skjuling. Skjules alle, sperres eksport.
Valgene lagres ikke permanent mellom sideinnlastinger.

## Avvik og navn
Velg navneegenskap under Datakilder eller bruk Automatisk navnevalg.
Automatisk valg ser etter Name, Navn, IfcName, ObjectName, Objektnavn
eller Betegnelse. Mangler verdi, vises Navn ikke tilgjengelig.
Objekt-ID beholdes. Objekttype vises hvis API-dataene har typen.
Navn og navneegenskap følger avvikslistene i Excel/PDF.
Avvik gjelder hele modellutvalget, også skjulte kolonner. Avvik er
informasjon om datagrunnlaget, ikke nødvendigvis modellfeil.

## Eksport
Excel (.xlsx), CSV og PDF bruker samme resultat som tabellen.
Excel: Mengder, Oppsett, Avvik og Modeller. Numeriske celler,
ikke rekalkulerende formler. Gruppeoverskrifter, differanser og
informasjon følger med. PDF viser samme radtyper.
CSV: UTF-8 med BOM, semikolon, desimalkomma, uten tusenskilletegn.
Flat tabell med nederste Mengde-rader, nødvendige differanser ved
mellomnivå/totalsum og merket Totalsum. Avrundingsinfo ved bladnivå
er ikke en additiv CSV-rad, fordi den inngår i Mengde-raden.
Ved videre summering i Excel/CSV brukes Mengde + Avrundingsdifferanse.
Delsum, Totalsum og Avrundingsinfo skal IKKE telles i tillegg.
Oppsettet beskriver valgt gruppeplass og egenskap.
PDF: A3 liggende, opptil seks mengdekolonner per kolonnedel,
gjentatte overskrifter, sidenummer, oppsett og avvik bakerst.
Norske og vesteuropeiske tegn støttes; andre skriftsystemer kan bli ?.
Ingen eksterne biblioteker, CDN-er eller nettverkskall for eksport.

## Datakvalitet
Manglende/ugyldig mengde, kode eller valgt enhet utelates fra summer.
Manglende gruppeverdi inngår i egen gruppe. Ulike enheter gir separate
kolonner, uten omregning. Uten valgt enhet må sammenlignbarhet kontrolleres.
Modellfeil varsles og følger eksporten. Endret modellutvalg/versjon
krever oppdatert objektindeks før beregning/eksport.
Gyldig null vises som 0; manglende celle vises som strek.
Tusenskilletegn og enhetstekst i mengdeverdier tolkes ikke ved gjetting.
Lagring/import av oppsett og JSON-eksport er ikke inkludert.

## Tester
6125 lokale kontroller bestod med syntetiske data, uavhengig
referanseberegning og simulert API/DOM. Dekker fire nivåer, 0–6
desimaler, alle trinn/retninger, negative tall, differanser, tomme
gruppeplasser, deaktivert gruppevalg, automatisk tilbakestilling,
objektnavn, kolonnevalg, lukket oppsett, modellbytte og livssyklus.
Test med 1000 små objekter kontrollerer at objektene ikke avrundes.
XLSX/CSV/PDF fra alle fire nivåer er åpnet med uavhengige lesere.
Additive differanser og totalsummer er sammenlignet med resultatet.
JavaScript-syntaks kontrollert. Ingen live-test i Trimble Connect,
skrivebords-Excel eller visuell nettlesertest i dette miljøet.

## Før live
1. Prøv de fire nivåene på et kjent utvalg med alle grupper aktive.
2. Kontroller at gruppeunderlag + differanse = avrundet gruppesum.
3. Kontroller at høyere summer ikke trinnavrundes på nytt.
4. Fjern et grupperingsnivå og kontroller etiketter/deaktiverte valg.
5. Sammenlign alle tre eksportformater med tabellen.
6. Åpne XLSX i Excel uten reparasjonsmelding.
