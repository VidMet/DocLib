# Validation module 2.02-rc.2.1

Private state instance, ES modules. rules/engine/report install functions into private state;
state.js initializes values. index.js exposes mount/render/update/canLeave/unmount/destroy,
a safe status snapshot, and a narrow read-only busy port to the legacy host.

Context: project, treeRoot, workspaceScopes, workspaceMode, CORE, MODEL, VERSION,
DOM lookup, escaping, flatten, API reads, unauthenticated signed downloads, UI refresh.
Selection and project-tree services still come through the legacy bridge until Explorer
and shared property services are extracted. No direct token access or cross-tool state.

The engine's validation decisions are mechanically preserved; authenticated read transport
now uses the shared client instead of duplicating token headers. Completed reports remain
in memory. Signature comparison handles selection/version changes; it does not claim that
an unchanged file ID/version guarantees unchanged rule files since the last run.
