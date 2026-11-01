# DocLib STG1 v2.04-preview.1

Første read-only trinn for prosjektstyrt verktøyoppsett.

- Leser innlogget bruker fra eksisterende Workspace-identitet.
- Leser prosjektmedlemskap fra Core API `GET /projects/{projectId}/users/{userId}`.
- Leser rollekatalog fra `GET /projects/{projectId}/roles` for å kunne mappe rolle-ID til rollenavn.
- Setup vises bare ved eksplisitt administratorrolle. Ukjent rolle, API-feil eller manglende kontekst skjuler Setup.
- Setup er foreløpig read-only og viser kun resultatet av rolleoppslaget.
- Eksisterende verktøy og prosjektfiler er ikke endret i dette trinnet.

Test med både prosjektadministrator og vanlig prosjektbruker før neste trinn.
