# v2.03-preview.5.3.i-fix.1

Installering: Pakk ut i DocLib-roten. Overskriv stg1/index.html og alle
filer under stg1/tools/quantity-summary/. Ny fil core/quantity-heading.js
følger med. Ingen eksisterende core-moduler eller shared/properties.js
endres. Gjør full sideinnlasting før test.

Overskriften currentFolder korrigeres til Mengdesammenstilling bare når
mengdeverktøyet er montert og synlig. Kontrollplan beholder sitt navn.
Dette er en avgrenset kompatibilitetsretting i rammen, ikke en omskriving
av app.js, som ikke var vedlagt.

Klasselesing: behold eksisterende id+psets-forespørsel. Når IFC-klassen
mangler, forsøkes samme GET-endepunkt uten fields-projeksjon. Klasse
kobles til eksisterende objekter med identisk objekt-ID, samme modell
og versjon. Ingen udokumenterte fields-verdier sendes. IFC-klassen
kan også leses fra Objekttype/ObjectType når verdien faktisk er Ifc...
Fritekst som Veg eller Terreng tolkes ikke som IFC-klasse.

VIKTIG: Dette er en kandidat for live-test, ikke en verifisert løsning
på klasselesing i brukerens prosjekt. Vi vet ikke om standardresponsen
inneholder klasse. Hvis klasse fortsatt mangler, beholdes sperren.
Bruk da Last ned klassediagnostikk og legg ved JSON-filen.
Diagnostikken inneholder egenskapsnavn, antall, lesestatus og et lite
utvalg klasseverdier, ikke token, objekt-ID-er eller øvrige råverdier.
Egenskapsnavn kan likevel være prosjektspesifikke; kontroller før deling.
Resultater med ukjent klasse gjenbrukes ikke fra minnecache ved Oppdater.

25 lokale kontroller med syntetiske API-svar og simulert DOM-observer
bestod. Testene dekker direkte klasse, klasseegenskap, standardrespons,
manglende klasse, HTTP-feil, cache og overskrift ved verktøybytte.
JavaScript-syntaks kontrollert. Ingen live-test eller visuell nettlesertest.
Beregning, avrunding og eksport fra 5.3.i er ellers beholdt.
