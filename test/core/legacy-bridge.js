'use strict';
window.DocLibLegacyBridge=Object.freeze({
 start:()=>init(),getProject:()=>project?{id:project.id}:null,getMode:()=>workspaceMode,
 getDiagnostics:()=>lines.slice(),getVersion:()=>VERSION,
 attachControlPlan(port,lifecycle){controlPlanPort=port;toolLifecycle=lifecycle;},
 createControlContext(){return Object.freeze({
  get project(){return project;},get mineUser(){return mineUser;},get treeRoot(){return treeRoot;},
  get projectConfiguration(){return projectConfiguration;},get projectConfigurationFile(){return projectConfigurationFile;},
  get workspaceMode(){return workspaceMode;},get list(){return list;},get CORE(){return CORE;},get VERSION(){return VERSION;},
  $:(id)=>$(id),esc:(v)=>esc(v),norm:(v)=>norm(v),flatten:(...a)=>flatten(...a),pool:(...a)=>pool(...a),
  req:(...a)=>req(...a),fetchRead:(url,options)=>fetch(url,options),
  log:(...a)=>log(...a),status:(...a)=>status(...a),cloneData:(v)=>cloneData(v),safeFileName:(v)=>safeFileName(v),
  testStorage:Object.freeze({getItem:k=>testStorage.getItem(k),setItem:(k,v)=>testStorage.setItem(k,v)}),
  publisherCanonical:v=>publisherCanonical(v),publisherValidateConfig:v=>publisherValidateConfig(v),
  publisherReadContext:()=>publisherReadContext(),assistedDownload:(...a)=>assistedDownload(...a)
 });}
});
