'use strict';
window.DocLibLegacyBridge=Object.freeze({
 start:()=>init(),getProject:()=>project?{id:project.id}:null,getMode:()=>workspaceMode,
 getDiagnostics:()=>lines.slice(),getVersion:()=>VERSION,
 attachControlPlan(port,lifecycle){controlPlanPort=port;toolLifecycle=lifecycle;},
 attachValidation(port){validationPort=port;},
 createValidationContext(){return Object.freeze({
 get project(){return project;},get treeRoot(){return treeRoot;},get workspaceMode(){return workspaceMode;},
 get workspaceScopes(){return workspaceScopes;},get CORE(){return CORE;},get MODEL(){return MODEL;},get VERSION(){return VERSION;},
 $:id=>$(id),esc:v=>esc(v),norm:v=>norm(v),flatten:(...a)=>treePort.flatten(...a),
 apiRead:(...a)=>req(...a),fetchRead:(url,options)=>fetch(url,options),refreshUI:()=>workspaceModeUI()
 });},
 attachShared(tree,properties){treePort=tree;propertiesPort=properties;},
 attachExplorer(port){explorerPort=port;},
 createTreeContext(){return Object.freeze({
  get CORE(){return CORE;},get treeRoot(){return treeRoot;},$:id=>$(id),esc:v=>esc(v),fileExt:v=>fileExt(v),norm:v=>norm(v),req:(...a)=>req(...a),
  workspaceModeUI:()=>workspaceModeUI(),workspaceScope:()=>workspaceScope(),workspaceSelectionChanged:()=>workspaceSelectionChanged()
 });},
 createPropertiesContext(){return Object.freeze({
  get CACHE(){return CACHE;},get MODEL(){return MODEL;},get PAGE(){return PAGE;},
  list:v=>list(v),norm:v=>norm(v),req:(...a)=>req(...a),testStorage,
  controlMetadata:Object.freeze({
   cpMmiSourceKey:()=>controlPlanPort.cpMmiSourceKey(),get cpDeliveryIds(){return controlPlanPort.cpDeliveryIds;},
   get cpMmiEvidence(){return controlPlanPort.cpMmiEvidence;},cpCollectMmi:(...a)=>controlPlanPort.cpCollectMmi(...a)
  })
 });},
 createExplorerContext(){return Object.freeze({
  get VALUE_COLORS(){return VALUE_COLORS;},get activeProfile(){return activeProfile;},get columnConfig(){return columnConfig;},get profiles(){return profiles;},
  get currentFolder(){return treePort.currentFolder;},get treeRoot(){return treeRoot;},get rows(){return rows;},get workspaceMode(){return workspaceMode;},
  $:id=>$(id),esc:v=>esc(v),norm:v=>norm(v),captureProfile:()=>captureProfile(),persistProfiles:()=>persistProfiles(),isProjectProfile:(...a)=>isProjectProfile(...a),
  findNode:(...a)=>treePort.findNode(...a),renderTree:()=>treePort.renderTree(),valueForColumn:(...a)=>propertiesPort.valueForColumn(...a),
  workspaceModeUI:()=>workspaceModeUI(),workspaceScope:()=>workspaceScope(),clearFolderFocus:()=>{treePort.folderFilters.clear();treePort.currentFolder='__ALL__';},
  controlMetadata:Object.freeze({get cpDeliveryFiles(){return controlPlanPort.cpDeliveryFiles;}})
 });},
 createControlContext(){return Object.freeze({
  get project(){return project;},get mineUser(){return mineUser;},get treeRoot(){return treeRoot;},
  get projectConfiguration(){return projectConfiguration;},get projectConfigurationFile(){return projectConfigurationFile;},
  get workspaceMode(){return workspaceMode;},get list(){return list;},get CORE(){return CORE;},get VERSION(){return VERSION;},
  $:(id)=>$(id),esc:(v)=>esc(v),norm:(v)=>norm(v),flatten:(...a)=>treePort.flatten(...a),pool:(...a)=>pool(...a),
  req:(...a)=>req(...a),fetchRead:(url,options)=>fetch(url,options),
  log:(...a)=>log(...a),status:(...a)=>status(...a),cloneData:(v)=>cloneData(v),safeFileName:(v)=>safeFileName(v),
  testStorage:Object.freeze({getItem:k=>testStorage.getItem(k),setItem:(k,v)=>testStorage.setItem(k,v)}),
  publisherCanonical:v=>publisherCanonical(v),publisherValidateConfig:v=>publisherValidateConfig(v),
  publisherReadContext:()=>publisherReadContext(),assistedDownload:(...a)=>assistedDownload(...a)
 });}
});
