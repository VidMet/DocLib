DocLib v1.35.4-preview.3.4 UI_CLEANUP
Bygget fra faktisk preview.3.3. Erstatt app.js, index.html og manifest.json. Ingen nye runtime-avhengigheter.

TOPP
Profilvelger, Profiler, Innstillinger, Oppdater metadata, Verktoy, Diagnostikk og Apne valgte i 3D. Egen rad for filformat og sok. Status er flyttet til egen linje. Knappene brytes til nye linjer ved smal bredde; tabellen har fortsatt egen horisontal skrolling ved mange kolonner.
Profiler: Lagre som, Gi nytt navn, Slett, Lag personlig kopi, Administrer Mine profiler, Lagre i Mine profiler, Forbered prosjektprofil, Eksporter, Importer.
Verktoy: IFC-egenskaper, Analyse, Tom modellvalg, Vis alle mapper, Nullstill filtre.
Diagnostikk: vanlig logg, identitetsdiagnostikk, brukermappeoppsett, gjenoppretting, testopplasting, apning uten versjon og enkeltvis viewer-test.
Menyer lukkes ved valg, klikk utenfor, Escape, fokus utenfor eller endret vindusstorrelse. Menyene kan apnes med tastatur. Menypaneler tilpasses vindusbredden og har vertikal skrolling ved behov.
Alle eksisterende kontroll-ID-er og dialoger beholdes. Ingen endringer i opplasting, profilformat, identitetskontroll, ACL eller prosjektindeks. Kun UI-oppstartskall og menyfunksjoner er lagt til i app.js i tillegg til versjonsnummer.

TEST
Se TESTRESULTATER.txt. Ikke autentisert live-test i Trimble Connect.

Tidligere driftsveiledning:
DocLib v1.35.4-preview.3.3 MY_PROFILE_MANAGER
Bygget fra faktisk preview.3.2 ZIP. Erstatt app.js, index.html og manifest.json.

NYTT
Administrer Mine profiler viser brukerens innleste profilfiler, fil-ID, profil-ID, eier-ID, prosjekt-ID, kolonneantall og sortering. Like visningsnavn skilles med fil-ID. Oppdater bare Mine profiler leser brukerens mappe uten ny modellmetadata-skanning. Bruk lagret profil velger skrivebeskyttet oppsett. Lag lokal kopi for redigering oppretter et unikt lokalt navn uten overskriving. Lagre i Mine profiler er fortsatt en separat handling som lager ny UUID-fil. Ingen serveroppdatering, sletting, revisjonskjede eller standardprofilvalg er lagt til.
Innlesing viser ignorerte filer med generell valideringsfeil; ingen rå serverfeil eller token logges av de nye funksjonene. Ved mappefeil fjernes gamle Mine-profiler fra visningen. Enkeltfiler som ikke kan leses/valideres ignoreres. Listen er et innlest øyeblikksbilde, ikke kontinuerlig synkronisering.
Identitetsdiagnostikk, sperrer, manuell ACL-kontroll og gjenoppretting beholdes. Ingen identitetsaliaser. Kun innlogget brukers mappe vises; ingen adminoversikt. Faktisk tilgang styres fortsatt av Trimble Connect og må kontrolleres av admin.

TEST
Se TESTRESULTATER.txt. Lokale simulerte tester, ikke autentisert live-test eller full nettleserregresjon.

Tidligere driftsveiledning:
DocLib v1.35.4-preview.3.2 CONTROLLED_PROFILE_RECOVERY
Bygget fra preview.3.1. Komplette app.js, index.html og manifest.json. Identitetsdiagnostikk og sperrer beholdes. Ingen hardkodet bruker-ID eller automatisk alias/migrering.

NYTT: Gjenopprett profilfil
Velg en JSON-profil som du allerede har lastet ned fra prosjektet. Kontroller kildeeier, kildeprosjekt, innlogget ID, kolonneantall og nytt navn. Kryss av og opprett lokal kopi. Ingen eksisterende profil overskrives. Kun validerte kolonner og gyldig sortering kopieres; ownerId, projectId, id og andre toppnivafelt overtas ikke. Profilen lagres lokalt under innlogget brukers eksisterende prosjektnoekkel. Ingen nettverksskriving ved gjenoppretting. Filstorrelse maks 2 MB. Ingen automatisk tilgang til gammel mappe.
Etter kontroll av lokal kopi kan Lagre i Mine profiler brukes som en separat handling. Denne bruker eksisterende opplastingsflyt og gjeldende bruker-ID, ikke gammel eier-ID. Admin ma fortsatt kontrollere rettighetene til brukermappen. Ingen mapper eller ACL endres automatisk.

TEST
Lokale simulerte tester og syntakskontroll; ikke live-testet i prosjektet. Identitetsavvikets arsak er ikke lost. Denne versjonen gjor kontrollert gjenoppretting enklere, ikke identitetskobling.

Tidligere driftsveiledning:
DocLib v1.35.4-preview.3.1 IDENTITY_DIAGNOSTICS
Bygget fra faktisk preview.3 ZIP. Erstatt app.js, index.html og manifest.json. Ingen nye avhengigheter.

NYTT
Identitetsdiagnostikk viser kun getUser().id, kilde, tidspunkt, kontrollfase, ID-format og kontrollresultat. Ingen navn, e-post, rå API-respons, token eller signert URL inngår i identitetsrapporten. Ingen av de to tidligere observerte ID-ene er hardkodet eller koblet sammen.
Baseline settes ved oppstart. Kontroller ID nå henter getUser() på nytt. Opplasting kontrollerer ID ved preflight, før initiate, før PUT og før commit. ID-endring eller mislykket identitetskontroll sperrer nye opplastingskall resten av økten, selv om ID senere går tilbake. Siden må lastes på nytt etter at innloggingen er kontrollert. Allerede utførte kall rulles ikke tilbake; ingen automatisk sletting eller gjentakelse. Dette er klientkontroll, ikke en atomisk identitetsgaranti på serveren.
Forrige oppstarts-ID lagres lokalt per prosjekt, kun for diagnostikk. Forskjell mellom innlastinger varsles i rapport/logg, men kobles ikke automatisk og sperrer ikke alene: det kan også være en annen innlogget bruker. Historikk følger ikke til annen nettleser. Den begynner med denne versjonen. Kopier rapporten fra begge innlastinger ved reproduksjon.
Ingen mapper, eierfelt, eksisterende profiler eller ACL endres av diagnostikken. Koden avklarer ikke hvorfor ID varierer. Kopier identitetsrapporten, ikke hele nettverksdumpen. Rapporten inneholder bruker-ID og prosjekt-ID og bør bare deles ved behov.

TEST
Se TESTRESULTATER.txt for lokale simulerte tester. Ingen autentisert live-test eller full nettleserregresjon er utført.

BEHOLDT FRA PREVIEW.3
DocLib v1.35.4-preview.3 USER_PROFILE_STORAGE_MANUAL_ACL
Komplette erstatningsfiler fra preview.2. Ingen live-test i prosjektet.

SIKKERHET OG AVGRENSNING
Dette er en implementasjon med manuelt administrerte rettigheter, ikke automatisk ACL-verifikasjon. Bruker-ID, mappebane og ownerId er ikke tilgangsbeskyttelse. Faktiske rettigheter i Trimble Connect beskytter innholdet. Ingen automatisk mappeoppretting eller rettighetsendring. Ikke bruk til privat lagring før admin har kontrollert tilgangen. Eksisterende testopplasting er beholdt, tydelig merket ikke privat.

ADMINOPPSETT
1. Installer filene og bruk Brukermappe - oppsett for bruker-ID fra Workspace API.user.getUser(). Ingen e-post eller JWT-utledning brukes.
2. Opprett Extension_config/DocLib/users/<bruker-ID>/profiles i prosjektet. Ikke bruk brukerens navn i stedet for ID.
3. I Connect for Browser: velg brukermappen, Edit folder permissions. Kontroller og ved behov deaktiver arving. Gi eier Full Access; fjern øvrige brukeres/gruppers tilgang. Kontroller også profiles-mappen og eventuelle ekstra filrettigheter. Prosjektadmins beholder tilgang gjennom rollen.
4. Kontroller med eier, en annen vanlig prosjektbruker og prosjektadmin at faktisk tilgang er riktig. Gjenta etter rettighetsendringer. DocLib verifiserer ikke dette automatisk.

BRUK
Lokale profiler er nå nøkkelsatt med prosjekt og bruker-ID. Gamle lokale profiler migreres ikke automatisk, fordi de ikke har sikker eiertilknytning. Eksporter dem fra preview.2 og importer i preview.3.
Velg lokal profil, Lagre i Mine profiler. Målet låses til brukerens eksisterende mappe. Bekreft manuelt at admin har kontrollert tilgang. Opplasting lager en ny UUID-fil, ingen overskriving. Filen leses tilbake og kontrolleres. Mine profiler lastes fra egen mappe ved oppstart/oppdatering, også i annen nettleser. Lag lokal kopi for redigering. Hver ny lagring lager separat profilfil; ingen automatisk revisjonserstatning/sletting.
Eksisterende preview.2-filer uten ownerId og projectId importeres ikke automatisk som Mine profiler. Last opp på nytt via riktig funksjon etter tilgangskontroll.
Prosjektindeksen endres ikke. Ingen adminoversikt i DocLib; admins bruker prosjektutforskeren for brukermappene. Innlesing er ikke en erstatning for serverrettigheter. Mine profiler caches ikke som prosjektprofiler.

TEKNISK
Beholder preview.2 initiate/PUT/commit-flyt (utgående endepunkter). Ingen reserveforsøk eller automatisk gjentakelse. Ingen token sendes til PUT-adressen. Brukerbasert lokal kvittering. Ved feil kontroller siste forsøk og målmappe før ny lagring.
Kilder: https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browser/files-and-folders/folder-permissions
https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browser/files-and-folders/folder-permissions/change-folder-permissions
Workspace API types: trimble-connect-workspace-api 0.3.38 UserAPI.getUser / ConnectUser.id.
