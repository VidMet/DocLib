'use strict';
window.DocLibLegacyBridge=Object.freeze({
 start:()=>init(),getProject:()=>project?{id:project.id}:null,getMode:()=>workspaceMode,
 getDiagnostics:()=>lines.slice(),getVersion:()=>VERSION,
 attachControlPlan(port,lifecycle){controlPlanPort=port;toolLifecycle=lifecycle;},
 attachValidation(port){validationPort=port;},
 createValidationContext(){return Object.freeze({
 get ruleEditorAccess(){const cfg=projectConfiguration?.ruleEditor||{};const ids=Array.isArray(cfg.adminUserIds)?cfg.adminUserIds.map(String):[];const mode=cfg.accessMode||'all';const userId=String(mineUser?.id||'');return Object.freeze({mode,userId,allowed:mode!=='admins'||ids.includes(userId)});},
 capabilities:Object.freeze({networkWrites:true,linkStorage:'local',ruleEditor:true}),
 get projectState(){return projectController?.snapshot()||{phase:'idle',stale:true};},
 get project(){return project;},get treeRoot(){return treeRoot;},get workspaceMode(){return workspaceMode;},
 get workspaceScopes(){return workspaceScopes;},get CORE(){return CORE;},get MODEL(){return MODEL;},get VERSION(){return VERSION;},
 $:id=>$(id),esc:v=>esc(v),norm:v=>norm(v),flatten:(...a)=>treePort.flatten(...a),
 apiRead:(...a)=>req(...a),apiWrite:(url,options={})=>reqWrite(url,{...options,headers:{...(options.headers||{}),'X-DocLib-Write':'rule-json'}}),fetchRead:(url,options)=>fetch(url,options),refreshUI:()=>workspaceModeUI()
 });},
 attachShared(tree,properties){treePort=tree;propertiesPort=properties;},
 attachExplorer(port){explorerPort=port;},
 attachProject(controller){projectController=controller;},
 createProjectContext(){return Object.freeze({
  projectId:()=>project?.id,
  canReload(){
   if(validationPort.valBusy||controlPlanPort.cpExportBusy)return false;const validationSnapshot=toolLifecycle.snapshot('validation');if(validationSnapshot?.editorDirty&&!confirm('Du har ulagrede endringer i Regeloppsett. Oppfrisk prosjektet likevel? Regelutkastet beholdes, men eventuelle modellresultater blir utdaterte.'))return false;
   const pending=controlPlanPort.cpPendingLinks.length||document.getElementById('cpLinkDialog')?.open||document.getElementById('cpPdfChoose')?.open;
   if(pending&&!confirm('Oppdatering lukker kontrollvalg og forkaster upubliserte koblingsutkast. Fortsette?'))return false;
   for(const id of ['cpLinkDialog','cpPdfChoose']){const d=document.getElementById(id);if(d?.open)d.close();d?.remove();}
   return true;
  },
  prepare(force){
   controlPlanPort.cpMetadataComplete=false;controlPlanPort.cpMmiEvidence.clear();
   if(force)for(let i=testStorage.length-1;i>=0;i--){const k=testStorage.key(i);if(k?.startsWith(CACHE))testStorage.removeItem(k);}
  },
  readProject:id=>req(CORE+'/projects/'+encodeURIComponent(id)),
  scanTree:(id,name)=>treePort.scanFolder(id,name,'',null),flatten:tree=>treePort.flatten(tree),
  commitTree(tree,files){
   treeRoot=tree;const ids=new Set(files.map(f=>f.id));
   for(const set of Object.values(workspaceScopes))for(const id of set)if(!ids.has(id))set.delete(id);
   for(const id of explorerPort.selected)if(!ids.has(id))explorerPort.selected.delete(id);
   explorerPort.allFormats=new Set(files.map(f=>f.format));explorerPort.formatFilters=new Set(explorerPort.allFormats);
   explorerPort.renderFormats();explorerPort.updateSelection();
  },
  async loadProfiles(rootId){loadProfiles();await loadProjectProfiles(rootId);},
  configurationIssues(){
   const issues=[];
   if(projectProfileStatus.includes('Kunne')||projectProfileStatus.includes('cache')||projectProfileStatus.includes('ignorert'))issues.push('Prosjektprofiler: '+projectProfileStatus);
   if(projectConfiguration&&(projectConfiguration.schema!=='DocLibProjectConfiguration'||projectConfiguration.schemaVersion!==1||!Array.isArray(projectConfiguration.profiles)))issues.push('Ugyldig prosjektkonfigurasjon.');
   return issues;
  },
  reloadControlPlan:()=>toolLifecycle.update('control-plan',{type:'reload'}),
  controlIssues:()=>toolLifecycle.snapshot('control-plan')?.issues||[],
  loadPersonalProfiles:rootId=>loadMineProfiles(rootId),
  applyProfiles(){applyProfileState(false);renderProfileControls();},
  prepareRows(files){rows=files.map(file=>({file,props:{}}));explorerPort.updateSelection();treePort.renderTree();explorerPort.renderTable();},
  pool:(files,fn)=>pool(files,WORKERS,fn),metadata:file=>propertiesPort.meta(file),
  commitRow(index,file,metadata){rows[index]={file,...metadata};},
  metadataComplete:complete=>{controlPlanPort.cpMetadataComplete=complete;},
  progress(done,total,cached){$('progress').textContent=done===null?'':`${done}/${total}, ${cached} fra cache`;},
  render:()=>explorerPort.renderTable(),status:(...a)=>status(...a),log:(...a)=>log(...a),
  present(state){
   let banner=$('projectLoadState');
   if(!banner){banner=document.createElement('div');banner.id='projectLoadState';banner.className='status project-load-state';banner.setAttribute('aria-live','polite');document.querySelector('header.top')?.appendChild(banner);}
   const labels={idle:'Venter på prosjekt',loading:'Laster prosjekt',ready:'Prosjektgrunnlag klart',incomplete:'Ufullstendig prosjektgrunnlag',error:'Prosjektinnlasting feilet'};
   banner.dataset.phase=state.phase;banner.dataset.warnings=String(state.warnings?.length||0);banner.textContent=labels[state.phase]+(state.stage?' · '+state.stage:'')+(state.stale&&state.phase!=='idle'?' · Visningen er ikke bekreftet oppdatert.':'')+(state.warnings?.length?' · '+state.warnings.length+' fil(er) med metadataadvarsel. Øvrige filer kan brukes.':'');
   banner.title=[...state.issues,...(state.warnings||[]).map(x=>[x.folder,x.name,'ID: '+x.fileId,x.status?'HTTP '+x.status:'',x.message].filter(Boolean).join(' · '))].join('\n');banner.setAttribute('aria-busy',String(state.phase==='loading'));
   $('refresh').disabled=state.phase==='loading'||validationPort.valBusy;const treeRefresh=$('treeRefresh');if(treeRefresh){treeRefresh.disabled=state.phase==='loading'||validationPort.valBusy||controlPlanPort.cpExportBusy;treeRefresh.setAttribute('aria-busy',String(state.phase==='loading'));}
   for(const id of ['profileSelect','profileSaveAs','profileRename','profileDelete','profileExport','profileImport','settingsBtn','discoveryBtn','analyticsBtn']){const el=$(id);if(el)el.disabled=state.phase==='loading'||workspaceMode!=='explorer';}
   workspaceModeUI();
  }
 });},
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
 capabilities:Object.freeze({networkWrites:false,linkStorage:'local',ruleEditor:false}),
 get projectState(){return projectController?.snapshot()||{phase:'idle',stale:true};},
  get VALUE_COLORS(){return VALUE_COLORS;},get activeProfile(){return activeProfile;},get columnConfig(){return columnConfig;},get profiles(){return profiles;},
  get currentFolder(){return treePort.currentFolder;},get treeRoot(){return treeRoot;},get rows(){return rows;},get workspaceMode(){return workspaceMode;},
  $:id=>$(id),esc:v=>esc(v),norm:v=>norm(v),captureProfile:()=>captureProfile(),persistProfiles:()=>persistProfiles(),isProjectProfile:(...a)=>isProjectProfile(...a),
  findNode:(...a)=>treePort.findNode(...a),renderTree:()=>treePort.renderTree(),valueForColumn:(...a)=>propertiesPort.valueForColumn(...a),
  workspaceModeUI:()=>workspaceModeUI(),workspaceScope:()=>workspaceScope(),clearFolderFocus:()=>{treePort.folderFilters.clear();treePort.currentFolder='__ALL__';},
  controlMetadata:Object.freeze({get cpDeliveryFiles(){return controlPlanPort.cpDeliveryFiles;}})
 });},
 createControlContext(){return Object.freeze({
 capabilities:Object.freeze({networkWrites:false,linkStorage:'local',ruleEditor:false}),
 get projectState(){return projectController?.snapshot()||{phase:'idle',stale:true};},
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
