# Pset-regler: tapsfri klargjoring, IKKE importklar

Status: Utkast til utvidet regelmodell. Disse filene er IKKE kompatible med DocLibPropertyRules v2 / preview.7. Ingen app-kode er endret. Ikke erstatt prosjektets aktive regler med disse filene.

Alle originale regelverdier og oppslag er bevart i sourceRules. normalizedProperties splitter grupperte egenskapsnavn og samler requirement/defaultRequirement uten a fjerne avanserte regler. sourceRules er fasit ved eventuell uoverensstemmelse.

Nodvendige motorendringer: dynamisk Pset-opplosning fra 0_Element.Underdisiplinkode; betingelser pa tvers av Psets; listeverdier som alternativer innen samme betingelse; notallowed; fag-/klasseavhengige allowedValues; format/regex; RDS-oppslag med eksplisitte kildebindinger.

Foreslatt valg: fagspesifikk fil har prioritet over 1_FAG for samme fag. Ikke kjor begge pa samme objekt. Manglende/ugyldig fagkode skal gi uavklart/avvik, ikke godkjent. Manglende forventet Pset skal ikke skjules av hasPset-filtrering.

RDS: mappings er bevart, men filen definerer ikke eksplisitt alle kildeegenskapene og sammensettingsreglene for tag. Disse er ikke gjettet. Tomme property-regler er ikke automatisk gjort obligatoriske.

Kildeavvik som krever avklaring:
- 0_Element.Underdisiplinkode: crossReference.target=PNS_Navn finnes ikke som nokkel i alle validPairs. Ingen automatisk retting utfort.
- 0_Element.PNS Kode: crossReference.target=PNS_Navn finnes ikke som nokkel i alle validPairs. Ingen automatisk retting utfort.
- 0_Element: 22 kildeoppforinger, 22 normaliserte egenskaper.
- 1_FAG: 90 kildeoppforinger, 366 normaliserte egenskaper.
- 2_RDS: 15 kildeoppforinger, 15 normaliserte egenskaper.
- 3_Beskrivelse: 7 kildeoppforinger, 7 normaliserte egenskaper.

Teststatus: JSON lest tilbake; sourceRules kontrollert identisk med originalene; hver normalisert egenskapsregel kontrollert mot kilden. Ingen runtime-test i Trimble Connect. Ingen pastand om full kompatibilitet.
