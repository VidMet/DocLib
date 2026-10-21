DocLib v1.36-preview.3 PROPERTY_RULES_V2
Bygget fra faktisk preview.2. Komplette app.js, index.html og manifest.json. Ingen nye nettverksavhengigheter.

INSTALLASJON
Erstatt de tre appfilene. Legg en tilpasset v2-regelfil i Extension_config/properties. JSON Schema kan ligge ved siden av reglene som doclib-properties-v2.schema.json; filer med endelsen .schema.json brukes ikke som regelsett. $schema er en editorreferanse, ikke en ekstern kode-/skjemanedlasting i DocLib. Validatoren har innebygd struktur- og semantikkontroll; den kjører ikke en generell JSON Schema-motor i nettleseren.

FORMAT
schema=DocLibPropertyRules, schemaVersion=2. Én fil per Pset. properties er et objekt med eksakte egenskapsnavn som nøkler. required på toppnivå gjelder Pset; requirement=required/optional gjelder hver egenskap. Ingen propertySet per egenskap: pset gjelder hele filen. scope.mode=hasPset med scope.pset, eller allEntities. Samme begrensninger for klassefilter og typearv som preview.2. hasPset med samme Pset som kontrollmålet oppdager IKKE fravær av hele Pset på andre objekter. Ikke bruk dette som bevis for at alle objekter har Pset.

allowedExtraProperties
Eksakt skrivemåte i v2 er allowedExtraProperties, som etterspurt. false gir error-avvik for alle ekstra egenskaper i DETTE Pset på et relevant objekt, også tomme egenskaper. Andre Pset påvirkes ikke. true tillater ekstra egenskaper. Feltet er obligatorisk. Den tidligere skrivemåten allowExtraProperties avvises med ukjent felt; den ignoreres ikke. Én v2-fil per Pset håndheves for å unngå motstridende ekstraegenskapspolicy.

crossReference
Ligger på kildeegenskapen og har target samt validPairs. target må være en annen egenskap definert i samme regelsett/Pset. Hvert par har nøyaktig kilde- og targetnavn som nøkler, med primitive verdier. Flere tillatte mål for samme kilde støttes. Sammenligning skjer på samme objekt og samme Pset, eksakt og typesensitivt. Manglende mål eller kildeverdi uten tillatt par gir avvik når kilden er utfylt. Manglende kilde styres av requirement/minMMI; valgfri tom kilde utløser ikke kryssjekk. Ingen automatisk utledning eller utfylling av verdier.
Bekreftede rettelser: Underdisiplinkode -> Underdisiplin, PNS Kode -> PNS Navn. Ingen automatisk PNS_Navn-aliasing i faktiske IFC-data.

minMMI
Krever eksplisitt mmiSource med propertySet og property, på samme objekt. required-egenskap blir påkrevd ved MMI >= minMMI; optional forblir valgfri. Verdier som finnes kontrolleres også under terskelen. Pset-kravet på toppnivå har ikke MMI-terskel.
MMI kan leses som heltall 0-999 eller tekst med 1-3 siffer, kun for terskelsammenligning. Rå verdi endres ikke; allowedValues/type er fortsatt typesensitive. Ingen trim, desimaltall, bool, null eller tekst som MMI 200 godtas som MMI-kilde. Manglende/ugyldig MMI på relevant objekt med MMI-avhengige required-krav gir incomplete-avvik og filstatus Kunne ikke kontrolleres, også om noen andre egenskaper kan kontrolleres. Delavvik beholdes. MMI-kildens egen allowedValues/type-regel kan i tillegg gi vanlige avvik; numerisk gyldighet alene er ikke en prosjektspesifikk MMI-godkjenning. MMI-egenskapen bør være required uten minMMI for tydelig krav uten sirkulær terskel.

 disallowedValues
Eksakte primitive verdier. Forbudt verdi gir avvik selv om den også finnes i allowedValues. Eksplisitt forbudt blank streng kontrolleres selv under MMI-terskel og for optional. Manglende egenskap regnes ikke automatisk som en forbudt verdi. null kan ikke oppgis i verdilistene; bruk requirement for null/tom/manglende. 0 og false er ikke tomme verdier.

JSON SCHEMA
Draft 2020-12 strukturskjema følger med. Skjemaet kontrollerer felt, typer, grenser og mmiSource ved minMMI. Innebygd runtime-kontroll verifiserer i tillegg at target finnes, ikke er kildeegenskapen, at validPairs har riktige dynamiske nøkler og at min <= max. Strukturskjema alene kan derfor ikke bekrefte alle navneavhengigheter. Ukjente felter avvises. Ingen eval av JSON-innhold.

EKSEMPEL OG MIGRERING
0_Element.example.json er et BEGRENSET EKSEMPEL basert på seks egenskaper fra vedlegget: Underdisiplinkode, Underdisiplin, PNS Kode, PNS Navn, MMI og Revisjonen gjelder. Verdilistene og verdiparene for disse er beholdt, med de to bekreftede target-rettelsene. defaultRequirement for PNS Navn er skrevet som requirement. MMI er gjort ubetinget required i eksemplet, og format-uttrykket er ikke tatt med: allowedValues begrenser MMI til de oppgitte tekstverdiene. allowedExtraProperties=true er et bevisst eksempelvalg fordi listen ikke er komplett. Sett false først når alle tillatte egenskaper i Pset er definert.
Dette er IKKE en full migrering av originalfilen. Originalen har også format/regex, defaultRequirement, overrides og hierarkiske allowedValues-objekter. Disse støttes ikke i v2 og avvises, ikke ignoreres. Ingen faglige verdier i de øvrige reglene er flatet ut eller gjettet. Den gamle blandede innpakningen med properties-liste som inneholder nytt properties-objekt støttes ikke. Bruk v2-formatet og se MIGRERING.txt.
Gamle gyldige v1-regler fra preview.2 støttes uendret. De fire nye feltene gjelder v2; v1 ignorerer dem ikke, men avviser ukjente felter. Ikke la gamle og nye eksempelregler kontrollere samme Pset utilsiktet.

BEGRENSNINGER
Model API-lesing og fullstendighetskrav er beholdt fra preview.2: versionId kreves, total må være eksplisitt, paginering må være komplett. Ingen reserveflyt via GetModelInfo. Ingen direkte IFC STEP-parser. Ingen automatisk publisering, ACL-endring, filendring eller modellretting fra validatoren. Dokumentplan er fortsatt plassholder. Eksport inneholder faktiske egenskapsverdier og bør deles med omtanke.

TEST
Se TESTRESULTATER.txt. Lokale tester med syntetiske objekter/stubbet API, ingen autentisert live-test. JSON Schema kontrollert med Draft202012Validator.
