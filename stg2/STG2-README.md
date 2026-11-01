# DocLib STG2 v2.03-rc.1-fix.1

Release candidate basert på fungerende STG1-baseline og Mengdesammenstilling v2.03-preview.5.3.i-fix.2.

STG2 er stabiliseringsområde. Nye funksjoner går tilbake til STG1.
Mengdesammenstilling beholder fire avrundingsnivåer, kolonnevis avrunding, prosessbeskrivelse/info, kolonnevalg, eksport og IFC-strukturfilter.
Primær objektlesing bruker `fields=id&fields=psets&fields=class&fields=type`, samme feltmønster som Egenskapsvalidering. Kompatibilitetsfallback beholdes dersom klassen fortsatt mangler.

Før STG3: test IFC2x3, IFC4, IFC4.3 og IFC4.3_ADD2, alle fire avrundingsnivåer, strukturfilter og Excel/CSV/PDF mot kjente mengder.

## Fix.1

Gjenopprettet navigasjonsknappen `modeQuantities` i `index.html`.
`shared/legacy-runtime.js` binder denne knappen under oppstart; fravær ga
`can't access property "onclick", $(...) is null` og stoppet prosjektlastingen.
Ingen beregnings-, eksport- eller modellfunksjoner er endret.
