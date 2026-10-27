# DocLib TEST 2.01-preview.1

First migration step, not complete tool extraction.

app.js is now an ES-module bootstrap. It imports environment, registry and tool descriptors.
The existing UI/navigation remains in shared/legacy-runtime.js. Descriptors are registered,
but do not yet own mount/update/unmount. Todos is reserved and has no menu entry.
Classic-script loading is deliberate: legacy code and the PDF adapter still share lexical
state. core/auth.js, api.js and diagnostics.js contain the working authentication fix,
not duplicate legacy implementations. storage.js and network-policy.js own browser
storage and the GET/HEAD-only fetch guard. Inline CSS is moved unchanged to styles.css.
The PDF module is relocated unchanged; its legacy wrappers remain until tool extraction.
No new API writes. No TC configuration changes. v137 TEST storage namespace is retained
intentionally, so existing TEST profiles, control links and PDF links survive this migration.
Production localStorage is not migrated or read as test settings.

Next: extract control-plan behind an explicit context and lifecycle contract; remove
legacy wrappers incrementally. Do not implement new tools against legacy globals.
Environment settings describe this fixed read-only release, not a switch to enable writes.
