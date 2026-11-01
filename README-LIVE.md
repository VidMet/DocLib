# DocLib v2.03

Produksjonspakke promotert direkte fra godkjent STG3 v2.03-rc.2.

Ingen funksjonsendringer er gjort ved produksjonspromoteringen. Kun mappenavn, versjonsidentitet og produksjonsmerking er endret.

Rollback-baseline: STG3 v2.03-rc.2.

Etter publisering: kontroller oppstart/prosjektlasting, de fire verktøyene, en kjent Mengdesammenstilling og minst én eksport før bred bruk.

## Produksjonspakke-korreksjon
Alle ES-modulimporter bruker nå `?v=2.03` som cache-busting. Den første
v2.03-pakken beholdt ved en feil enkelte querystrenger fra preview-baselinen.
Ingen modulfunksjon er endret.
