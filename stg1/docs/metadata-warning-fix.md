# preview.5.1: project availability versus file metadata

Project phase remains ready when project/configuration/folder loading completed but
individual metadata requests failed. The snapshot now has a separate warnings array
with fileId, versionId, name, folder, HTTP status when known, and a short message.
metadataFailed remains a count of failed file metadata attempts. It no longer decides
project phase. Structural/configuration/report issues still yield incomplete/error and
retain existing action guards. Loading remains guarded.

metadataComplete in the ControlPlan compatibility port means the metadata attempt
finished, not that every file has verified metadata. MMI evidence is still per file;
missing evidence stays unknown, never below-threshold or approved. Validator continues
to read selected object data independently and reports incomplete control if it cannot
read the selected model. Existing PDF documentation may be opened despite an unrelated
or same-file metadata failure, provided its own file/version checks succeed.

Warnings are visible on the project banner (details in tooltip), Explorer file rows and
FILE_METADATA_WARNING diagnostics. File errors are not cached as successful metadata.
No retries, API routes, project scope, rules or authentication changes in this fix.
A 404 remains unresolved: the fix changes its impact, not the underlying model service.
