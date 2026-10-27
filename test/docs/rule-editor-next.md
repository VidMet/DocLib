# Next priority: rule editor under Egenskapsvalidering

This is a proposal, not an implemented feature in preview.5.

Priority: rule editor before Todos and project API writing. Keep it as a separate module
under tools/validation/rule-editor/, with a distinct UI entry under Egenskapsvalidering.
The detailed fields/workflow should be agreed from the user's upcoming suggestions.

Recommended first scope:
1. Import an existing rule JSON and inspect its schema/version and Pset.
2. Create/edit rules, requirements, types and permitted values, with explicit advanced
   controls for MMI, scope, discipline, formats and cross-references where supported.
3. Validate against exactly the same schema-normalization code as the runtime Validator.
   Extract that pure schema service first; do not maintain a second rule definition.
4. Show precise errors and a JSON preview. Download a complete replacement JSON.
5. Do not automatically upload or overwrite project rule files. Keep the network write guard.

Round-trip requirements: supported advanced fields must not silently disappear on import,
form editing or export. Unsupported constructs must be reported, not guessed or dropped.
Draft editing is not publication. A schema-valid rule is not proof of a correct engineering
requirement. Rule testing against model data should be explicit and version-bound.

No inactive editor button, new rule format, placeholder editor or API mutation is added now.
