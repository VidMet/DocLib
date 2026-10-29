import { VERSION } from "./version.js?v=2.02-rc.3";

export const environment = Object.freeze({
  name: "STG3",
  label: "STG3",
  version: VERSION.value,
  versionLabel: VERSION.label,
  readOnly: false,
  persistence: true,
  diagnostics: false
});