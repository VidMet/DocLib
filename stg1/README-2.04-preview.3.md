# DocLib STG1 v2.04-preview.3

Baseline: fungerende v2.04-preview.2-fix.5.

- Oppretter eller oppdaterer doclib.tools.json via samme single-part upload.
- Ved oppdatering brukes samme mappe og navn, med If-Match: siste innleste versionId.
- Ved oppretting brukes If-None-Match: *.
- Nytt rolleoppslag foretas for start og for PUT. Manglende bekreftelse stopper skriving.
- Kontrollerer fil-ID og versjon mot sist innleste oppsett, samt fil-ID i startresponsen.
- Leser innholdet tilbake og kontrollerer fil-ID, ny versjon og valgene for menyen oppdateres.
- Ingen sletting, ingen versjonsrydding, ingen automatisk ny opplasting.
- Last prosjektoppsett-knapp henter ny baseline etter konflikt.

Konfliktkontrollen bruker If-Match ved upload-start og ny kontroll for PUT. Dette er ikke en garanti mot alle samtidige endringer under asynkron opplasting; serverens handheving ma testes.
Admin-sjekkene er klientkontroller. Trimble Connects fil-/mapperettigheter er den reelle serverbaserte beskyttelsen mot direkte skriving utenfor DocLib. ACL-er endres ikke her.

Test: Endre et verktovalg, lagre, bekreft samme fil-ID og ny versjon i Trimble Connect, og last utvidelsen pa nytt. Test ogsa to samtidige okter og en vanlig bruker.
Live 2.03, Oppfrisk og eksisterende verktov er ikke endret.
