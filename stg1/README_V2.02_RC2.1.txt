DocLib STG1 v2.02-preview.11.11.1

Critical hotfix for RC2:
- Stops MutationObserver feedback loop in config/version.js.
- Version text is only changed when the displayed value differs.
- Observer updates are coalesced through a single microtask.

Install only after the emergency rollback has restored normal browser and Trimble Connect behavior.
