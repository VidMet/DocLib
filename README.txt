DocLib v1.36-preview.2 PROPERTY_VALIDATION
Bygget fra faktisk v1.36-preview.1. Erstatt app.js, index.html og manifest.json. Profilpublisering, ACL og Dokumentplan videreutvikles ikke.

OPPSETT
Opprett Extension_config/properties i prosjektet. Legg JSON-regler direkte i denne mappen. example-project-revision.json er KUN ET EKSEMPEL, ikke en faglig prosjektstandard. Endre begge BYTT_TIL_DITT_PSET til eksakt Pset-navn før opplasting. Velg IFC-filer i Egenskapsvalidering og Kjør validering. Ingen prosjektfiler endres. Eksporter rapport lagrer JSON lokalt.
Alle JSON-filer i properties må være gyldige regelsett; én ugyldig fil stopper hele kjøringen. Ingen regler betyr ingen godkjenning. Ukjente regelfelt avvises, ikke ignoreres.

REGELFORMAT v1
schema: DocLibPropertyRules, schemaVersion: 1, unik id, eksakt pset, scope, required (Pset påkrevd), properties (liste).
scope.mode=hasPset og scope.pset velger objekter som har det angitte Pset. Dette kan være et annet Pset enn det som valideres. Med samme Pset i begge felter kan fravær av Pset på andre objekter IKKE oppdages: disse er utenfor scope. Bruk dette for kontroll av egenskaper på kjente Pset-bærere, for eksempel prosjektmetadata. Dette er ikke automatisk IfcProject-filtrering.
scope.mode=allEntities kontrollerer ALLE returnerte objekter, inkludert eventuelle struktur-/prosjektobjekter. Bruk med omtanke. Det finnes ennå ikke IFC-klassefilter, arvede typeegenskaper eller egenskapsbasert equals-filter. Ingen gjetting av objekttype.
properties: name (eksakt), required (bool), type (valgfri: string, number, integer, boolean), allowedValues (valgfri liste med eksakte primitive verdier), min/max (kun numerisk type), severity (error eller warning, standard error). Null, manglende og blank tekst er tom verdi. 0 og false er gyldige ikke-tomme verdier. Ingen automatisk trimming, store/små-bokstavnormalisering, tallkonvertering eller enhetskonvertering. Tallgrenser gjelder rå API-verdi. Typekontroll gjelder JSON-verdien, ikke en full IFC-skjema/datatypekontroll. Regex og datoformatkontroll er ikke implementert.

DATA OG FULLSTENDIGHET
Separat leseflyt fra Model API psetdefs og entities, ikke dagens flate metadatacache. Filens versionId kreves og sendes med alle modellkall. Resultater gjelder Model API-representasjonen av den oppgitte filversjonen, ikke direkte STEP-parsing av IFC. API-et kan være eventually consistent; nylig prosesserte modeller må vurderes med dette forbeholdet.
Offset/top-paginering krever eksplisitt total på første side. Manglende total, endret total, avvikende count, ukjent Pset-definisjon, manglende psets-liste, feil verdiantall, duplisert objekt-ID eller flere Pset med samme navn på ett objekt gir Kunne ikke kontrolleres. Ingen grønn status ved ufullstendig innlesing. Hvis API-responsen bruker et annet format enn baseline-forventningen, stoppes filkontrollen med forklaring; dette må live-verifiseres.
Maks 200 000 elementer per samling og 50 000 avvik per fil. Grenseoverskridelse gir ufullstendig kontroll, ikke godkjenning. Første 500 avvik per fil vises; eksport inneholder alle registrerte avvik. Ingen rå token eller signerte URL-er inngår i rapporten. Rapporten inneholder fil-/objekt-ID-er, regelinnhold og faktiske verdier: del bare ved behov.

STATUS
Godkjent: komplett innlesing, minst én relevant objekt/regel-kombinasjon, ingen avvik.
Advarsler: komplett kontroll med kun warning-avvik.
Avvik: komplett kontroll med minst ett error-avvik.
Ikke relevant: objekter lest, men ingen regel traff noen objekter.
Kunne ikke kontrolleres: feil, tom modell eller ufullstendig lesing. Delavvik kan vises, men er ikke fullstendige resultater.
Regeltreff vises per fil: en regel med null treff er ikke testet på noen objekter, selv om andre regler gir Godkjent. Godkjent er derfor ikke en generell prosjekt-/leveransegodkjenning.
Valgte andre filtyper utelates eksplisitt. Tre/modus låses under kjøring, Avbryt stopper videre lesing. Metadataoppdatering er sperret under kjøring. Endret utvalg/versjon etter kjøring gir varsel om gamle resultater. Regler leses på nytt ved hver kjøring; endringer etter kjøringen overvåkes ikke. Regelinnholdet som faktisk ble brukt følger rapporten. Ingen skrivekall fra validatoren.

TEST
Lokale enhets- og nettlesertester med syntetiske objekter og stubbet API. Ingen autentisert live-test. Dokumentplan er fortsatt plassholder.
Kilde: https://developer.trimble.com/docs/connect/reference/openapi/model/

VIKTIG LIVE-AVKLARING: Denne versjonen krever total i Model API-sidene. Dokumentasjonen beskriver også at totalantall for ufiltrerte samlinger kan hentes fra GetModelInfo. Denne reserveflyten er ikke implementert. Hvis prosjektets svar utelater total, stopper kontrollen med eksplisitt feil; det skal ikke tolkes som et modellavvik.
