import {FILE_NAME,normalizeProjectTools} from './project-tools.js?v=2.04-preview.2-fix.1';
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
  const place=await location(),body=JSON.stringify(normalizeProjectTools(config),null,2)+'\n',blob=new Blob([body],{type:'application/json'}),match=place.file;
  const payload={parentId:place.folderId,parentType:'FOLDER',name:FILE_NAME,size:blob.size,contentType:'application/json'};if(match?.id)payload.fileId=match.id;if(match?.versionId)payload.versionId=match.versionId;
  const init=await context.apiWrite(`${context.CORE}/files/fs/upload`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!init.ok)throw Error(`Opplasting kunne ikke startes (HTTP ${init.status})${explain(init)?': '+explain(init):''}.`);
  const data=init.data||{},uploadUrl=data.uploadUrl||data.url||data.signedUrl||data.contents?.[0]?.uploadUrl,uploadId=data.uploadId||data.id||data.contents?.[0]?.uploadId||data.upload?.id;
  if(!uploadUrl){if(data.id&&data.versionId)return read();throw Error('Trimble Connect returnerte ingen opplastingsadresse.');}
  window.DocLibApproveSignedUpload(uploadUrl,1);let putError=null;try{const put=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:blob});if(!put.ok)throw Error(`HTTP ${put.status}`);}catch(error){putError=error;}
  if(uploadId)for(const action of ['commit','complete']){const r=await context.apiWrite(`${context.CORE}/files/fs/upload/${encodeURIComponent(uploadId)}/${action}?parentId=${encodeURIComponent(place.folderId)}&parentType=FOLDER`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FILE_NAME,uploadId})});if(r.ok)break;}
  if(putError){await new Promise(r=>setTimeout(r,1200));try{return await read()}catch{throw Error(`Filen ble sendt, men kunne ikke bekreftes: ${putError.message}`)}}
  await new Promise(r=>setTimeout(r,700));return read();
 }
 return Object.freeze({read,save});
}
