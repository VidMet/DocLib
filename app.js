'use strict';

const VERSION = '1.23';
const CORE_BASE = 'https://app21.connect.trimble.com/tc/api/2.0';
const MODEL_API_CANDIDATES = [
  'https://model-api.connect.trimble.com/v1',
  'https://model-api.eu.connect.trimble.com/v1',
  'https://app21.connect.trimble.com/model/api/v1'
];
let API = null, currentProject = null, accessToken = null, allFilesData = [], diagLines = [];
const DEFAULT_META={fag:'-',mmi:'-',revisjon:'-',revisjonsdato:'-',gjelder:'-'};
const CANDIDATES={fag:['Underdisiplin','Fag','Disiplin'],mmi:['MMI'],revisjon:['Revisjon','Rev'],revisjonsdato:['Revisjonsdato','RevDato'],gjelder:['Revisjonen gjelder','Gjelder']};

function setStatus(m,s=''){document.getElementById('statusText').textContent=m;document.getElementById('statusDot').className=s==='ok'?'dot live':s==='warn'?'dot warn':s==='error'?'dot error':'dot';}
function safeJson(v){try{return JSON.stringify(v,null,2)}catch{return String(v)}}
function redact(v){if(typeof v!=='string')return v;return v.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi,'Bearer [REDACTED]');}
function diag(m,d){const line=`[${new Date().toISOString()}] ${m}`;console.log('[DOCLIB]',m,d===undefined?'':d);diagLines.push(d===undefined?line:`${line}\n${redact(safeJson(d))}`);if(diagLines.length>800)diagLines=diagLines.slice(-800);const o=document.getElementById('diagOutput');if(o){o.textContent=diagLines.join('\n\n');o.scrollTop=o.scrollHeight;}}
function summarize(d){if(Array.isArray(d))return{type:'array',length:d.length,sample:d.slice(0,2)};if(d&&typeof d==='object')return{type:'object',keys:Object.keys(d).slice(0,50),sample:d};return d;}
async function apiGet(url){diag(`GET ${url}`);let r;try{r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'}})}catch(e){diag(`FETCH BLOCKED/NETWORK ERROR ${url}`,{name:e.name,message:e.message,likely:'CORS, DNS, host or browser policy'});return{ok:false,status:0,data:null,error:e.message}}const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}diag(`HTTP ${r.status} ${url}`,summarize(data));return{ok:r.ok,status:r.status,data,headers:Object.fromEntries(r.headers.entries())};}

function wireUi(){document.getElementById('refreshBtn').onclick=()=>currentProject&&fetchProjectFiles(currentProject.id);document.getElementById('diagBtn').onclick=()=>{const p=document.getElementById('diagPanel');p.style.display=p.style.display==='block'?'none':'block'};document.getElementById('clearDiagBtn').onclick=()=>{diagLines=[];document.getElementById('diagOutput').textContent=''};}
async function initExtension(){try{wireUi();setStatus('Kobler til Trimble Connect...','warn');diag(`DocLib v${VERSION} MODEL_API_DIAGNOSTICS starter`);API=await window.TrimbleConnectWorkspace.connect(window.parent);currentProject=await API.project.getProject();diag('Workspace API/prosjekt OK',{id:currentProject?.id,name:currentProject?.name});const q=new URLSearchParams(location.search);accessToken=q.get('token')||q.get('accessToken')||q.get('access_token');if(!accessToken){try{const t=await API.extension.getPermission('accesstoken');accessToken=typeof t==='string'?t:(t?.accessToken||t?.token||'');diag('Access token forespurt',{received:Boolean(accessToken)})}catch(e){diag('Token-feil',e.message)}}if(!accessToken)throw new Error('Mangler access token');await fetchProjectFiles(currentProject.id)}catch(e){diag('INITIALISERINGSFEIL',{message:e.message,stack:e.stack});setStatus(`Feil: ${e.message}`,'error')}}

async function hentAlleIfc(folderId,folderName){let found=[];const r=await apiGet(`${CORE_BASE}/folders/${folderId}/items`);if(!r.ok)return found;const items=Array.isArray(r.data)?r.data:(r.data?.items||[]),subs=[];for(const x of items){if(x.type==='FILE'&&String(x.name||'').toLowerCase().endsWith('.ifc'))found.push({...x,folderName});else if(x.type==='FOLDER')subs.push(x)}for(const list of await Promise.all(subs.map(x=>hentAlleIfc(x.id,x.name))))found=found.concat(list);return found;}
async function mapWithLimit(a,n,fn){const out=new Array(a.length);let next=0;async function w(){while(true){const i=next++;if(i>=a.length)return;out[i]=await fn(a[i],i)}}await Promise.all(Array.from({length:Math.min(n,a.length)},w));return out;}

async function fetchProjectFiles(projectId){const body=document.getElementById('tableBody'),prog=document.getElementById('progressIndicator');body.innerHTML='<tr><td colspan="7" class="loading">Skanner prosjektet for IFC-filer...</td></tr>';try{const p=await apiGet(`${CORE_BASE}/projects/${projectId}`);if(!p.ok)throw new Error(`Prosjektoppslag HTTP ${p.status}`);const root=p.data?.rootId||p.data?.rootFolder?.id||p.data?.rootFolderId||p.data?.folderId;if(!root)throw new Error('Fant ingen rotmappe');const files=await hentAlleIfc(root,'Rotmappe');diag('IFC-filer funnet',{count:files.length});setupFolders(files);let done=0;setStatus('Kjører Model API-diagnostikk...','warn');allFilesData=await mapWithLimit(files,2,async f=>{const m=await diagnoseModel(f);done++;prog.textContent=`(Diagnostikk: ${done} / ${files.length})`;return{id:f.id,name:f.name,folderName:f.folderName,...m}});prog.textContent='';renderTable(allFilesData);setupSearch();setStatus(`Diagnostikk ferdig for ${files.length} filer`,'ok')}catch(e){diag('PROSJEKTFEIL',{message:e.message});body.innerHTML=`<tr><td colspan="7" class="loading">Feil: ${escapeHtml(e.message)}</td></tr>`;setStatus('API-feil','error')}}

async function diagnoseModel(file){diag(`=== MODEL API START: ${file.name} ===`,{fileId:file.id});const fr=await apiGet(`${CORE_BASE}/files/${file.id}`);if(!fr.ok)return{...DEFAULT_META};const modelId=file.id;diag('ModelId settes lik fileId',{modelId,versionId:fr.data?.versionId,status:fr.data?.status,trianglesCount:fr.data?.trianglesCount});
  const routes=[
    id=>`/models/${id}`,
    id=>`/models/${id}/entities`,
    id=>`/models/${id}/hierarchies`,
    id=>`/models/${id}/psetdefs`,
    id=>`/models/${id}/propertysetdefinitions`,
    id=>`/models/${id}/properties`
  ];
  let best={...DEFAULT_META};
  for(const base of MODEL_API_CANDIDATES){
    diag('Prøver Model API host',{base,modelId});
    for(const makePath of routes){const url=base+makePath(modelId);const r=await apiGet(url);if(r.ok&&r.data){const meta=extractMetadata(r.data);if(hasAnyMeta(meta)){best=mergeMeta(best,meta);diag('Metadata-kandidat fra Model API',{url,meta})}}}
  }
  diag(`=== MODEL API SLUTT: ${file.name} ===`,{result:best});return best;
}

function mergeMeta(a,b){const o={...a};for(const k of Object.keys(o))if(o[k]==='-'&&b[k]!=='-')o[k]=b[k];return o}
function hasAnyMeta(m){return Object.values(m).some(v=>v&&v!=='-')}
function norm(v){return String(v??'').trim().toLowerCase().replace(/[\s_\-.]/g,'')}
function primitive(v){if(v==null)return null;if(['string','number','boolean'].includes(typeof v))return String(v).trim()||null;if(typeof v==='object')for(const k of ['value','displayValue','text','stringValue','nominalValue','propertyValue'])if(v[k]!=null&&typeof v[k]!=='object')return String(v[k]).trim()||null;return null}
function findNamedValue(root,names){const wanted=new Set(names.map(norm)),seen=new WeakSet();function walk(n,path,depth){if(depth>35||!n||typeof n!=='object')return null;if(seen.has(n))return null;seen.add(n);if(Array.isArray(n)){for(let i=0;i<n.length;i++){const h=walk(n[i],`${path}[${i}]`,depth+1);if(h)return h}return null}for(const nk of ['name','key','propertyName','displayName','label'])if(n[nk]!=null&&wanted.has(norm(n[nk])))for(const vk of ['value','displayValue','propertyValue','text','stringValue','nominalValue']){const v=primitive(n[vk]);if(v)return{value:v,path:`${path}.${nk}=${n[nk]}`}}for(const[k,v]of Object.entries(n))if(wanted.has(norm(k))){const x=primitive(v);if(x)return{value:x,path:`${path}.${k}`}}for(const[k,v]of Object.entries(n))if(v&&typeof v==='object'){const h=walk(v,`${path}.${k}`,depth+1);if(h)return h}return null}return walk(root,'$',0)}
function extractMetadata(data){const o={...DEFAULT_META};for(const[field,names]of Object.entries(CANDIDATES)){const h=findNamedValue(data,names);if(h){o[field]=h.value;diag(`TREFF ${field}`,{value:h.value,path:h.path})}}return o}
function setupFolders(files){const s=document.getElementById('folderSelect'),fs=[...new Set(files.map(f=>f.folderName))].sort((a,b)=>a.localeCompare(b,'no'));s.innerHTML='<option value="all">Alle mapper</option>'+fs.map(f=>`<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');s.style.display='block'}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderTable(data){const b=document.getElementById('tableBody');if(!data.length){b.innerHTML='<tr><td colspan="7" class="loading">Ingen treff.</td></tr>';return}b.innerHTML=data.map(f=>`<tr><td style="font-weight:600">${escapeHtml(f.name)}</td><td style="color:var(--muted);font-size:12px">${escapeHtml(f.folderName)}</td><td>${escapeHtml(f.fag)}</td><td>${escapeHtml(f.mmi)}</td><td>${escapeHtml(f.revisjon)}</td><td>${escapeHtml(f.revisjonsdato)}</td><td>${escapeHtml(f.gjelder)}</td></tr>`).join('')}
function setupSearch(){const i=document.getElementById('searchInput'),s=document.getElementById('folderSelect');const f=()=>{const t=i.value.toLowerCase(),d=s.value;renderTable(allFilesData.filter(x=>Object.values(x).some(v=>String(v).toLowerCase().includes(t))&&(d==='all'||x.folderName===d)))};i.oninput=f;s.onchange=f}
window.addEventListener('load',initExtension);
