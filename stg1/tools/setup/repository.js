import {FILE_NAME,normalizeProjectTools} from './project-tools.js?v=2.04-preview.2-fix.4';
const items=data=>Array.isArray(data)?data:(data?.items||[]);
const isFolder=item=>String(item?.type||item?.itemType||'').toLowerCase().includes('folder');
const nameOf=item=>String(item?.name||'');
function explain(response){const data=response?.data;return String(data?.message||data?.error?.message||data?.error||'').slice(0,300)}
export function createProjectToolsRepository(context){
 async function readFolder(id){const r=await context.apiRead(`${context.CORE}/folders/${encodeURIComponent(id)}/items`);if(!r.ok||r.status===206)throw Error(`Mappen kunne ikke leses komplett (HTTP ${r.status}).`);return items(r.data)}
 async function rootId(){const r=await context.apiRead(`${context.CORE}/projects/${encodeURIComponent(context.projectId)}`);if(!r.ok)throw Error(`Prosjektet kunne ikke leses (HTTP ${r.status}).`);const id=r.data?.rootId||r.data?.rootFolder?.id||r.data?.rootFolderId;if(!id)throw Error('Prosjektsvaret mangler rotmappe-ID.');return id}
 async function childFolder(parent,name){return(await readFolder(parent)).find(x=>isFolder(x)&&nameOf(x).toLowerCase()===name.toLowerCase())||null}
 async function location(){const root=await rootId(),extension=await childFolder(root,'Extension_config');if(!extension)throw Error('Mappen Extension_config mangler.');const doclib=await childFolder(extension.id,'DocLib');if(!doclib)throw Error('Mappen Extension_config/DocLib mangler.');const files=await readFolder(doclib.id),file=files.find(x=>!isFolder(x)&&nameOf(x).toLowerCase()===FILE_NAME);return{folderId:doclib.id,file}}
 async function read(){const place=await location();if(!place.file)return{config:null,source:'missing',file:null};const r=await context.apiRead(`${context.CORE}/files/fs/${encodeURIComponent(place.file.id)}/downloadurl`);if(!r.ok)throw Error(`${FILE_NAME} kunne ikke åpnes (HTTP ${r.status}).`);const url=r.data?.url||r.data?.downloadUrl||r.data;if(!url)throw Error('Nedlastingsadresse mangler.');const response=await fetch(String(url),{cache:'no-store'});if(!response.ok)throw Error(`${FILE_NAME} kunne ikke lastes ned (HTTP ${response.status}).`);return{config:normalizeProjectTools(await response.json()),source:'project',file:place.file}}
 async function save(config){
  const place=await location();if(place.file)throw Error(`${FILE_NAME} finnes allerede. Denne previewen oppretter bare første prosjektfil og overskriver ikke eksisterende filer.`);
  const body=JSON.stringify(normalizeProjectTools(config),null,2)+'\n',blob=new Blob([body],{type:'application/json'});
  const params=new URLSearchParams({parentId:String(place.folderId),parentType:'FOLDER',name:FILE_NAME});
  const requestInfo={method:'POST',endpoint:'/files/fs/upload',queryKeys:['parentId','parentType','name'],bodyKeys:['size','contentType'],parentType:'FOLDER',fileName:FILE_NAME,size:blob.size};
  const init=await context.apiWrite(`${context.CORE}/files/fs/upload?${params}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({size:blob.size,contentType:'application/json'})});
  if(!init.ok){
    const data=init.data||{},safeResponse={status:init.status,title:String(data.title||''),detail:String(data.detail||''),instance:String(data.instance||''),errorCode:String(data.code||data.errorCode||data.error?.code||''),message:String(data.message||data.error?.message||(typeof data.error==='string'?data.error:'')),responseKeys:data&&typeof data==='object'?Object.keys(data).sort():[]};
    const error=Error(`Opplasting kunne ikke startes (HTTP ${init.status}). Diagnostikk er tilgjengelig.`);error.setupDiagnostics={request:requestInfo,response:safeResponse};throw error;
  }
  const data=init.data||{},uploadId=data.uploadId||data.id,uploadURL=data.uploadURL||data.uploadUrl||data.url||data.signedUrl;
  if(!uploadId||typeof uploadURL!=='string')throw Error(`Uventet upload-respons. Felter: ${Object.keys(data).sort().join(', ')||'ingen'}.`);
  const url=new URL(uploadURL);if(url.protocol!=='https:'||url.username||url.password)throw Error('Ugyldig opplastingsadresse.');
  window.DocLibApproveSignedUpload(url.href,1);const put=await fetch(url.href,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:blob,credentials:'omit',redirect:'error'});if(!put.ok)throw Error(`Filoverføring feilet (HTTP ${put.status}).`);
  const completeParams=new URLSearchParams({parentId:String(place.folderId),parentType:'FOLDER',name:FILE_NAME});
  const complete=await context.apiWrite(`${context.CORE}/files/fs/upload/${encodeURIComponent(uploadId)}/complete?${completeParams}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploadId})});
  if(!complete.ok)throw Error(`Fullføring feilet (HTTP ${complete.status})${explain(complete)?': '+explain(complete):''}.`);
  await new Promise(resolve=>setTimeout(resolve,1000));const confirmed=await read();if(!confirmed.config)throw Error('Filen ble sendt, men kunne ikke bekreftes. Ikke gjenta automatisk.');return confirmed;
 }
 return Object.freeze({read,save});
}
