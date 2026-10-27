'use strict';
window.DocLibLegacyBridge=Object.freeze({
 start:()=>init(),
 getProject:()=>project?{id:project.id}:null,
 getMode:()=>workspaceMode,
 getDiagnostics:()=>lines.slice(),
 getVersion:()=>VERSION
});
