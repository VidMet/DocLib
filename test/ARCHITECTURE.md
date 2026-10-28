# DocLib TEST 2.01-preview.2

## Implemented boundary
ControlPlan is an ES-module instance created with an explicit host context. All ControlPlan
state and feature functions are private to that instance, not globals in legacy-runtime.
Modules register functions on one private service/state object. Existing composition wrappers
are retained inside the instance to minimize behavior changes; they do not patch global functions.

- index.js: mount, render, update, canLeave, unmount, reload and destroy.
- reports.js: JSON loading and normalization.
- requirements.js: folder scopes, configuration validation, MMI and requirement status.
- links.js: file/version relationships and link validation.
- repository.js: local TEST link persistence; existing storage keys retained.
- table.js: table rendering, phase dates/signatures, selection toolbar.
- details.js: report detail view and link dialog.
- pdf.js: PDF selection, version binding and opening/downloading.
- state.js: private state initialization.
- styles.css: ControlPlan-specific styles extracted from shared CSS.

## Host context
core/legacy-bridge.js supplies live getters for project, identity, configuration and tree,
plus API reads, read-only download fetch, local storage, metadata utilities and UI helpers.
The module never reads a token or another tool's lexical variables directly.
Some context service names still match legacy utilities. Renaming them is deferred.
A narrow compatibility port lets the legacy metadata loader supply MMI evidence.
This port is temporary until the shared property service is extracted.

## Lifecycle
The registry activates/deactivates ControlPlan on workspace changes. Its delegated PDF
listener uses a per-mount AbortController. Dialogs are closed/removed on unmount.
Completed link drafts survive workspace switches, with a warning before leaving.
Unfinished dialog choices close only after confirmation. Page unload warns for unsaved work.
View-specific reads are cancelled on unmount. Background report loading during a project
metadata refresh is deliberately independent: it also supplies scopes to the shared metadata
loader. Reloads are serialized; a new reload cancels the preceding data read.
Already opened PDF tabs retain their blob URL until their existing cleanup timer releases it.

## Not included
Explorer and Validator still use the legacy host. Todos is reserved.
No API writes, new control rules or storage-format migration. No new TC folder required.
This is code organization, not security isolation between scripts on the same page.
