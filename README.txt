DocLib v1.35.4-preview.3.6 ASSISTED_PROJECT_PUBLISHER
DELVIS LEVERANSE: Fullautomatisk prosjektpublisering er IKKE ferdigstilt. Sikker atomisk indeksoppdatering er ikke verifisert og er ikke aktivert. Ingen skjult reserveflyt skriver til indeksen.

BRUK
Profiler > Forbered prosjektprofil. Velg ny/oppdatering, navn, beskrivelse og prosjektstandard. Åpne Assistert publisering - manuell indeks. Lag plan og kontroller mål og tilgang. Bekreft opplasting. DocLib laster opp én ny UUID-profilfil og leser innholdet tilbake. Last deretter ned indeksforslaget, samordne manuell indeksoppdatering med andre forvaltere og last opp doclib.config.json selv. Kontroller begge filer. Meldingen bekrefter bare samsvar ved kontrolltidspunktet, ikke en atomisk transaksjon.
Ved oppdatering beholdes profil-ID, men ny revisjonsfil erstatter referansen i indeksforslaget. Gammel profilfil beholdes. Dette er et eksplisitt valg i dialogen og gjelder kun den assisterte flyten. Eksisterende manuell ZIP-flyt beholdes uendret.
Eksisterende konfigurasjonsstruktur og indeks kreves. Ingen automatisk mappeoppretting, ACL-endring, sletting eller overskriving av profilfiler. Tilgang til ny profilfil kan følge mappen; kontroller at mål er egnet for felles profiler. Unikt navn og kollisjonskontroll er ikke atomisk create-only-garanti.

FEIL OG GJENOPPTAK
Kvittering med forventet profil og indeks lagres lokalt per prosjekt og bruker før første skrivekall. Token og signert opplastingsadresse lagres ikke. Ved feil: ingen automatisk gjentakelse eller sletting. Åpne dialogen og Kontroller begge filer / siste forsøk. Kvitteringen overlever sideoppdatering i samme nettleser, ikke tømming av lokal lagring eller bytte av nettleser. Uavklart kvittering blokkerer nytt forsøk. Manuell undersøkelse kan være nødvendig hvis initiate/PUT/commit feiler. Ikke tøm kvitteringen for å omgå dette. En tidligere kontrollert kvittering erstattes ved eksplisitt ny plan.

SIKKERHET
Initiate/PUT/commit følger eksisterende SDK-flyt fra trimble-connect-sdk 4.0.12. Identitet kontrolleres før hvert skrivekall. PUT får ikke bearer-token. Tilbakekontroll bruker no-store. Hele indeksinnholdet og profilinnholdet må samsvare; andre samtidige indeksendringer gir stopp, ikke automatisk fletting. Nedlasting av indeksforslag sjekker utgangspunktet på nytt, men beskytter ikke tidsrommet frem til manuell opplasting.
Dokumentasjonen oppgir If-Match for PATCH /files og PATCH /folders. Dette dokumenterer ikke i seg selv betinget filinnholdsopplasting. Check-out beskrives som revisjonskontroll, men integrert låse-/opplastingsflyt er ikke implementert eller testet her. Ingen fullautomatisk flerbrukerpublisering påstås.
Kilder: https://developer.trimble.com/docs/connect/reference/openapi/core/
https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browser/files-and-folders/check-in-and-check-out

TEST
Lokale simulerte tester. Ingen autentisert live-test i prosjektet. UI_CLEANUP, brukerprofiler og identitetsdiagnostikk beholdes.

Begrensning: lokal kvittering og busy-sperre er ikke en distribuert lås mellom nettlesere/faner. Bruk én publiseringsøkt om gangen.
