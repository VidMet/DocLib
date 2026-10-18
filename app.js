'use strict';

const VERSION = '1.22';
const BASE_URL = 'https://app21.connect.trimble.com';
let API = null;
let currentProject = null;
let accessToken = null;
let allFilesData = [];
let diagLines = [];

const DEFAULT_META = { fag:'-', mmi:'-', revisjon:'-', revisjonsdato:'-', gjelder:'-' };
const CANDIDATES = {
  fag: ['Underdisiplin','Fag','Disiplin'],
  mmi: ['MMI'],
  revisjon: ['Revisjon','Rev'],
  revisjonsdato: ['Revisjonsdato','RevDato'],
  gjelder: ['Revisjonen gjelder','Gjelder']
};

function setStatus(message, state='') {
  document.getElementById('statusText').textContent = message;
  document.getElementById('statusDot').className = state === 'ok' ? 'dot live' : state === 'warn' ? 'dot warn' : state === 'error' ? 'dot error' : 'dot';
}
function safeJson(value) { try { return JSON.stringify(value, null, 2); } catch { return String(value); } }
function diag(message, data) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log('[DOCLIB]', message, data === undefined ? '' : data);
  diagLines.push(data === undefined ? line : `${line}\n${safeJson(data)}`);
  if (diagLines.length > 500) diagLines = diagLines.slice(-500);
  const out = document.getElementById('diagOutput');
  if (out) { out.textContent = diagLines.join('\n\n'); out.scrollTop = out.scrollHeight; }
}
async function apiGet(url) {
  diag(`GET ${url}`);
  let response;
  try {
    response = await fetch(url, { method:'GET', headers:{ Authorization:`Bearer ${accessToken}`, Accept:'application/json' } });
  } catch (e) {
    diag(`NETWORK ERROR ${url}`, {name:e.name,message:e.message});
    return {ok:false,status:0,data:null,error:e.message};
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  diag(`HTTP ${response.status} ${url}`, summarize(data));
  return {ok:response.ok,status:response.status,data};
}
function summarize(data) {
  if (Array.isArray(data)) return {type:'array',length:data.length,sample:data.slice(0,2)};
  if (data && typeof data === 'object') return {type:'object',keys:Object.keys(data).slice(0,40),sample:data};
  return data;
}

async function initExtension() {
  try {
    wireUi();
    setStatus('Kobler til Trimble Connect...', 'warn');
    diag(`DocLib v${VERSION} starter`);
    API = await window.TrimbleConnectWorkspace.connect(window.parent);
    diag('Workspace API tilkoblet');
    if (API.ui?.setMenu) {
      API.ui.setMenu({title:'DocLib',command:'open_explorer',icon:'https://vidmet.github.io/DocLib/paper.png'}).catch(e=>diag('setMenu warning',e.message));
    }
    if (API.ui?.onCommand) API.ui.onCommand(command=>{ if(command==='open_explorer') API.ui.setActiveMenuItem('open_explorer').catch(()=>{}); });
    currentProject = await API.project.getProject();
    diag('Prosjekt mottatt', currentProject);
    const params = new URLSearchParams(location.search);
    accessToken = params.get('token') || params.get('accessToken') || params.get('access_token');
    if (!accessToken) {
      try {
        const td = await API.extension.getPermission('accesstoken');
        accessToken = typeof td === 'string' ? td : (td?.accessToken || td?.token || '');
        diag('Access token forespurt via extension permission', {received:Boolean(accessToken),type:typeof td});
      } catch(e) { diag('Kunne ikke hente token via extension permission',e.message); }
    }
    if (!accessToken) throw new Error('Klarte ikke hente gyldig access token.');
    await fetchProjectFiles(currentProject.id);
  } catch(error) {
    console.error(error); diag('INITIALISERINGSFEIL',{message:error.message,stack:error.stack});
    setStatus(`Feil: ${error.message}`,'error');
  }
}
function wireUi() {
  document.getElementById('refreshBtn').onclick = ()=> currentProject && fetchProjectFiles(currentProject.id);
  document.getElementById('diagBtn').onclick = ()=> { const p=document.getElementById('diagPanel'); p.style.display=p.style.display==='block'?'none':'block'; };
  document.getElementById('clearDiagBtn').onclick = ()=> { diagLines=[];document.getElementById('diagOutput').textContent=''; };
}

async function hentAlleIfc(folderId, folderName) {
  let found=[];
  const result=await apiGet(`${BASE_URL}/tc/api/2.0/folders/${folderId}/items`);
  if(!result.ok) { diag('Mappe kunne ikke leses',{folderId,folderName,status:result.status});return found; }
  const items=Array.isArray(result.data)?result.data:(result.data?.items||[]);
  const folders=[];
  for(const item of items) {
    if(item.type==='FILE' && String(item.name||'').toLowerCase().endsWith('.ifc')) found.push({...item,folderName});
    else if(item.type==='FOLDER') folders.push(item);
  }
  diag(`Mappe skannet: ${folderName}`,{folderId,items:items.length,ifc:found.length,subfolders:folders.length});
  const childResults=await Promise.all(folders.map(f=>hentAlleIfc(f.id,f.name)));
  for(const list of childResults) found=found.concat(list);
  return found;
}
async function mapWithLimit(arr,limit,fn) {
  const results=new Array(arr.length); let next=0;
  async function worker(){ while(true){ const i=next++; if(i>=arr.length)return; results[i]=await fn(arr[i],i); } }
  await Promise.all(Array.from({length:Math.min(limit,arr.length)},worker)); return results;
}

async function fetchProjectFiles(projectId) {
  const body=document.getElementById('tableBody'); const progress=document.getElementById('progressIndicator');
  body.innerHTML='<tr><td colspan="7" class="loading">Skanner prosjektet for IFC-filer...</td></tr>'; progress.textContent='';
  try {
    setStatus('Finner rotmappen for prosjektet...','warn');
    const p=await apiGet(`${BASE_URL}/tc/api/2.0/projects/${projectId}`);
    if(!p.ok) throw new Error(`Prosjektoppslag feilet (HTTP ${p.status})`);
    const rootId=p.data?.rootId || p.data?.rootFolder?.id || p.data?.rootFolderId || p.data?.folderId;
    diag('Rotmappe identifisert',{rootId});
    if(!rootId) throw new Error('Fant ingen rotmappe i prosjektresponsen.');
    setStatus('Skanner hele prosjektet for IFC-filer...','warn');
    const files=await hentAlleIfc(rootId,'Rotmappe');
    diag('IFC-skanning ferdig',{count:files.length,files:files.map(f=>({id:f.id,name:f.name,folder:f.folderName}))});
    if(!files.length){body.innerHTML='<tr><td colspan="7" class="loading">Ingen IFC-filer funnet.</td></tr>';setStatus('Ferdig. Ingen IFC-filer funnet.','ok');return;}
    setupFolders(files);
    setStatus('Diagnostiserer IFC-egenskaper...','warn');
    let done=0;
    allFilesData=await mapWithLimit(files,3,async file=>{
      const metadata=await fetchFileMetadata(file);
      done++; progress.textContent=`(Henter data: ${done} / ${files.length})`;
      return {id:file.id,name:file.name,folderName:file.folderName,...metadata};
    });
    progress.textContent='';renderTable(allFilesData);setupSearch();setStatus(`Data lastet inn for ${files.length} filer`,'ok');
    diag('Alle filer ferdig behandlet',allFilesData);
  } catch(error) {
    diag('FILHENTING FEILET',{message:error.message,stack:error.stack});
    body.innerHTML=`<tr><td colspan="7" class="loading">Feil: ${escapeHtml(error.message)}</td></tr>`;progress.textContent='';setStatus('Nettverks-/API-feil','error');
  }
}

async function fetchFileMetadata(file) {
  diag(`=== METADATA START: ${file.name} ===`,{fileId:file.id,folder:file.folderName});
  const fr=await apiGet(`${BASE_URL}/tc/api/2.0/files/${file.id}`);
  if(!fr.ok){diag(`Filoppslag feilet: ${file.name}`,{status:fr.status});return {...DEFAULT_META};}
  const fd=fr.data||{};
  const modelIds=[fd.modelId,fd.model?.id,file.modelId,file.id].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  diag(`Mulige modelId for ${file.name}`,{modelIds,fileResponse:fd});
  const attempts=[];
  for(const modelId of modelIds){
    const urls=[
      `${BASE_URL}/tc/api/2.0/models/${modelId}/properties`,
      `${BASE_URL}/tc/api/2.0/models/${modelId}`
    ];
    for(const url of urls){
      const r=await apiGet(url); attempts.push({modelId,url,status:r.status,ok:r.ok});
      if(r.ok && r.data){
        const meta=extractMetadata(r.data);
        diag(`Metadata-kandidater fra ${url}`,meta);
        if(hasAnyMeta(meta)){diag(`=== METADATA TREFF: ${file.name} ===`,meta);return meta;}
      }
    }
  }
  diag(`Ingen kjente metadata funnet for ${file.name}`,{attempts});
  diag(`=== METADATA SLUTT: ${file.name} ===`);
  return {...DEFAULT_META};
}
function hasAnyMeta(m){return Object.values(m).some(v=>v && v!=='-');}
function normalizeName(v){return String(v??'').trim().toLowerCase().replace(/[\s_\-.]/g,'');}
function primitiveValue(v){
  if(v===null||v===undefined)return null;
  if(['string','number','boolean'].includes(typeof v)) return String(v).trim() || null;
  if(typeof v==='object'){
    for(const key of ['value','displayValue','text','stringValue','nominalValue']) if(v[key]!==undefined && typeof v[key]!=='object') return String(v[key]).trim()||null;
  }
  return null;
}
function findNamedValue(root,names){
  const wanted=new Set(names.map(normalizeName)); const seen=new WeakSet();
  function walk(node,path,depth){
    if(depth>30 || node===null || node===undefined || typeof node!=='object') return null;
    if(seen.has(node))return null; seen.add(node);
    if(Array.isArray(node)){for(let i=0;i<node.length;i++){const hit=walk(node[i],`${path}[${i}]`,depth+1);if(hit)return hit;}return null;}
    const nameKeys=['name','key','propertyName','displayName','label'];
    const valueKeys=['value','displayValue','propertyValue','text','stringValue','nominalValue'];
    for(const nk of nameKeys){
      if(node[nk]!==undefined && wanted.has(normalizeName(node[nk]))){
        for(const vk of valueKeys){const value=primitiveValue(node[vk]);if(value)return {value,path:`${path}.${nk}=${node[nk]}`,shape:'named-property'};}
      }
    }
    for(const [key,val] of Object.entries(node)){
      if(wanted.has(normalizeName(key))){const value=primitiveValue(val);if(value)return {value,path:`${path}.${key}`,shape:'direct-key'};}
    }
    for(const [key,val] of Object.entries(node)){if(val && typeof val==='object'){const hit=walk(val,`${path}.${key}`,depth+1);if(hit)return hit;}}
    return null;
  }
  return walk(root,'$',0);
}
function extractMetadata(data){
  const result={...DEFAULT_META};
  for(const [field,names] of Object.entries(CANDIDATES)){
    const hit=findNamedValue(data,names);
    if(hit){result[field]=hit.value;diag(`TREFF ${field}`,{candidateNames:names,value:hit.value,path:hit.path,shape:hit.shape});}
  }
  return result;
}
function setupFolders(files){
  const sel=document.getElementById('folderSelect');const folders=[...new Set(files.map(f=>f.folderName))].sort((a,b)=>a.localeCompare(b,'no'));
  sel.innerHTML='<option value="all">Alle mapper</option>'+folders.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');sel.style.display='block';
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function renderTable(data){
  const body=document.getElementById('tableBody');
  if(!data.length){body.innerHTML='<tr><td colspan="7" class="loading">Søket ga ingen treff.</td></tr>';return;}
  body.innerHTML=data.map(f=>`<tr><td style="font-weight:600">${escapeHtml(f.name)}</td><td style="color:var(--muted);font-size:12px">${escapeHtml(f.folderName)}</td><td>${escapeHtml(f.fag)}</td><td>${escapeHtml(f.mmi)}</td><td>${escapeHtml(f.revisjon)}</td><td>${escapeHtml(f.revisjonsdato)}</td><td>${escapeHtml(f.gjelder)}</td></tr>`).join('');
}
function setupSearch(){
  const input=document.getElementById('searchInput'),sel=document.getElementById('folderSelect');
  const apply=()=>{const term=input.value.toLowerCase(),folder=sel.value;renderTable(allFilesData.filter(f=>Object.values(f).some(v=>String(v).toLowerCase().includes(term))&&(folder==='all'||f.folderName===folder)));};
  input.oninput=apply;sel.onchange=apply;
}

window.addEventListener('load',initExtension);
