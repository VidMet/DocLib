# DocLib STG1 v2.04-preview.2-fix.2

Bygget direkte fra ren v2.04-preview.2-baseline.

- Eksakt versjonsnavn uten doble suffikser.
- Oppfrisk-knapp ved Utvid/skjul. Knappen bruker den allerede implementerte projectService.reload(false)-koblingen i app.js.
- Setup sender parentId, parentType og name som query-parametere til POST /files/fs/upload, PUT-er JSON til signert URL og fullfører via POST /files/fs/upload/{uploadId}/complete.
- Create-only: eksisterende doclib.tools.json overskrives ikke.
