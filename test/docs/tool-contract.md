# DocLib TEST tool contract, v2.01-preview.5

## Registration and instance
Each descriptor exports id, title, legacyMode and create(context). Todos is reserved and
has no instance. create returns mount(container), render(), update(change), canLeave(),
unmount() and destroy(). The registry validates these methods at attachment.

- mount: synchronous, idempotent, attach handlers to the supplied container.
- render: synchronous, only touch the tool's own view when active.
- update: project-state events must be handled synchronously; other explicitly requested
  operations such as ControlPlan reload may return a Promise which the caller awaits.
- canLeave: synchronous boolean. Ask about unsaved changes before returning true.
- unmount: remove handlers and dialogs; keep completed in-memory results/drafts as defined.
- destroy: release resources permanently. This is not an automatic project switch handler.

## Shared project lifecycle
core/project.js owns the refresh sequence. reload(force) coalesces concurrent requests
into the existing job; a later force=true does not upgrade an already running non-forced
job. snapshot returns phase (idle/loading/ready/incomplete/error), stage, attempt,
revision, stale, file/metadata counts, timestamps and issue strings. subscribe returns an
unsubscribe function. Tool instances receive update({type:'project-state',state}).

Ready means the configured project-load stages completed without detected issues. It
is not an engineering approval, a validation result, or a guarantee of API snapshot
consistency. Configuration/profile administration still uses the legacy host bridge.
Personal server profile errors remain visible in their existing profile status; an absent
personal-profile folder is optional and does not block the project-ready state.

The three tool contexts expose projectState and read-only capabilities. Other services
remain tool-specific named callbacks/getters: project tree, selection, property lookup,
read-only HTTP, local storage and UI. Never fetch tokens or access another tool's state.
The shared file-level metadata cache is not Validator object-level evidence.

## Refresh behavior
One refresh job at a time. Validation running or link save busy vetoes refresh. Pending
control/PDF dialog choices require confirmation. Folder scanning is staged before tree
replacement; failed/partial scans leave the old tree visible with an explicit stale banner.
After tree commit, later-stage errors can leave partly updated data, always marked stale.
This is not an atomic multi-service transaction. HTTP 206, known next-page markers and
reported total mismatches are rejected for tree scans, not silently treated as complete.
No new folder-pagination implementation is claimed in this release.

Metadata read failures are not cached as successful empty properties. Missing IFC version
IDs and detected metadata/configuration/report errors produce incomplete state. New
validation and control/PDF actions are conservatively blocked unless phase is ready.
Existing historical reports may still be inspected/exported, explicitly marked stale.
Every project refresh invalidates a previous validation report, including unchanged file
versions, because rules may have changed. Re-running validation clears that marker.

No project-refresh cancel UI or global request timeout is added. destroy prevents future
refreshes and commit guards detect project-ID changes; users must reload the extension
when switching to a different project. Existing HTTP reads may still settle in the background.
