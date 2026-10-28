# Project core extraction, preview.5

The previous large legacy load(force) function is now a thin delegation to
projectController.reload(force). core/project.js coordinates project/root lookup,
staged tree scan, project profiles/configuration, ControlPlan reports, personal profiles,
profile application and pooled file metadata. Host mutations are explicit callbacks in
core/legacy-bridge.js. The legacy host still owns the project tree/rows and profile logic.

A persistent status banner distinguishes loading, ready, incomplete and error. Failed
loads never claim fresh data. A failed folder scan does not replace the previous tree.
After a later-stage failure, old/new data can coexist but is explicitly marked stale and
new control/validation actions are guarded. No transaction or snapshot API is implied.

Validator decision engine and rule parsing are unchanged. Lifecycle/report wrappers now
invalidate historical reports on refresh. ControlPlan lifecycle/PDF wrappers enforce the
project-state guard and report configured load errors to the coordinator. Existing local
control and PDF storage keys, authentication fix and write guard are preserved.

This release was assembled from the actual preview.2 package plus the preview.3 and
preview.4 update packages. Full integration uses the real modules for all three tools and
PDF, not a contract test double. Workspace/HTTP responses and project data remain synthetic.
