DocLib v1.36-preview.1 WORKSPACE_MODES_AND_TREE
Bygget fra faktisk v1.35.4-preview.3.6. Komplette erstatningsfiler app.js, index.html, manifest.json.
Extension_config beholdes. Ingen nye konfigurasjonsfiler kreves i dette trinnet.

IMPLEMENTERT
De to syntetiske toppnivåene Alle IFC-filer og prosjektroten skjules. Mapper direkte under prosjektroten vises øverst. Eventuelle filer direkte i prosjektroten vises også, uten å skjules eller flyttes fysisk.
Filer vises under mapper i treet. Pil eller mappenavn utvider/skjuler uten å velge innhold. Avhuking velger mappeinnhold rekursivt, inkludert direkte filer. Flere mapper og enkeltfiler kan velges. Utvalget er en mengde fil-ID-er: ingen duplikater ved overlapp. Fjerner du avhuking på undermappe, fjernes dens filer fra utvalget og overordnet mappe får mellomtilstand. Tomme mapper kan utvides, men ikke velges.
Utforsker starter tom. Kun treutvalget vises til høyre, deretter brukes eksisterende filformat-, søke- og kolonnefiltre/sortering. Filene i treet skjules ikke av tabellfiltre. Tøm treutvalg gir tom arbeidsflate; Nullstill filtre endrer ikke treutvalget. Utvid/skjul endrer ikke utvalget.
Treutvalg og tabellens 3D-avhukinger er separate: treet bestemmer arbeidsutvalget, tabellavhuking bestemmer modellene som åpnes i 3D. 3D-valg beholdes når treutvalget endres; Tøm 3D-valg nullstiller dette eksplisitt. Eksisterende viewerflyt beholdes.
Nederst i venstrepanelet: Utforsker, Egenskapsvalidering og Dokumentplan. Utforsker og validering har separate treutvalg som beholdes ved modusbytte i samme økt. Utvalgene lagres ikke mellom sideinnlastinger. Metadataoppdatering beholder fortsatt eksisterende fil-ID-er og fjerner bortfalte ID-er.
Dokumentplan toner ned og deaktiverer treet. Utforskerverktøy er deaktivert i de to andre modusene.

IKKE IMPLEMENTERT ENNÅ
Egenskapsvalidering viser bare antall valgte filer/IFC og en deaktivert Kjør validering-knapp. Ingen regler leses og ingen egenskaper kontrolleres. Dokumentplan viser kun en plassholder; ingen planfil leses eller leveranser matches. Ingen falske godkjenningsresultater.
Ingen videre profil-, publiserings-, rettighets- eller synlighetsutvikling. Eksisterende dialoger beholdes. Skjuling av prosjektroten er kun presentasjon, ikke tilgangskontroll. Ingen filer eller mapper endres i prosjektet av de nye modusene.

TEST
Se TESTRESULTATER.txt. Lokale nettlesertester med syntetisk mappetre, ikke autentisert live-test i Trimble Connect.
