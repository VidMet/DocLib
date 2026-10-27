# DocLib TEST 2.01-preview.4

## Extracted responsibilities
- tools/explorer/index.js: lifecycle, abortable toolbar handlers and private state.
- tools/explorer/table.js: table, dynamic columns, sorting, filters and 3D selection.
- tools/explorer/styles.css: Explorer-specific styles.
- shared/file-tree.js: recursive scan, tree rendering, folder expansion and scope selection.
- shared/file-tree.css: tree-specific styles.
- shared/properties.js: property definitions, file-level metadata aggregation, property
  catalog, explicit/alias column resolution and versioned local metadata cache.

All new modules are ES modules created with explicit context objects. No direct token
access. Core authentication, GET/HEAD-only policy and local storage isolation remain.
The shared tree is mounted once because both Explorer and Validator use it. Each
workspace still has its own scope. 3D selection belongs to Explorer and is separate.

## Transitional host boundary
The existing project load pipeline, rows and profile administration remain in the host.
core/legacy-bridge.js provides live getters and named service callbacks. Narrow ports
allow legacy profiles, viewer actions and metadata loading to use the extracted services
without duplicate state. Profile publication, analytics and discovery dialogs are not
extracted in this step. This is not a claim that legacy-runtime is now empty.

ControlPlan receives MMI evidence through a context adapter. The file-level metadata
cache is not used by Validator as object-level validation evidence. Validator modules
are byte-for-byte unchanged from preview.3. Cache keys and TEST storage prefix remain
unchanged to preserve existing local profiles, control links and PDF bindings.

## Lifecycle
Explorer toolbar/document listeners use a per-mount AbortController. Unmount closes
menus and clears table rows/handlers; remount restores filters and dynamic headers.
The shared tree remains available for Validator, and destroy releases its expand handler.
Background metadata loading still follows the existing project refresh pipeline. This
release does not add cancellation, pagination guarantees or new cache semantics there.

## Deferred
Shared profile service, full project loader extraction, API writes, Todos and cleanup.
No files are deleted. Existing production files are untouched.
