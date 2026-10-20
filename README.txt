DocLib v1.35.4-preview.2
Bygget fra de fire vedlagte preview.1-filene.
Erstatt app.js, index.html og manifest.json. Ingen nye avhengigheter.
Velg personlig profil, Last opp ny profilfil, bla til eksisterende testmappe, kontroller sammendrag, kryss av og last opp.
Prosjektindeksen endres ikke. Filen blir ikke automatisk prosjektprofil.
Eksisterende manuell publiseringspakke er beholdt.
Opplasting: POST /files/fs/initiate med parentId,parentType:FOLDER,name; PUT uploadURL; POST /files/fs/commit med uploadId. Basert paa TCPS.uploadFileContent i offisiell trimble-connect-sdk 4.0.12. Initiate/commit er deprecated i Core API. Ingen alternative endepunkter proeves.
Ingen innebygde hemmeligheter; eksisterende brukertoken brukes bare mot Core API, ikke PUT-adressen. Signert uploadURL logges eller lagres ikke.
Kvittering med forventet profilinnhold lagres lokalt foer skriving. Kontroller siste forsoek gjoer bare lesekall. Ingen automatisk gjentakelse eller sletting.
Unikt UUID-filnavn og kollisjonskontroll reduserer kollisjonsrisiko, men er ikke en atomisk create-only-garanti. Ikke en produksjonsklar flerbrukerpublisher.
Ingen autentisert live-test er utfoert. Nettleser-CORS, rettigheter og legacy-endepunktenes tilgjengelighet maa testes i testmappe.
Ved uklar feil: ikke start ny opplasting foer mappen og siste forsoek er kontrollert. Kvitteringen lagres per prosjekt i nettleseren; ikke del logg eller nettverksdump med token/signerte URL-er.
