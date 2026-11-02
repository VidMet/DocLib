import {FILE_NAME,normalizeProjectTools} from './project-tools.js?v=2.04-preview.6';
const items=data=>Array.isArray(data)?data:(data?.items||[]);
const isFolder=item=>String(item?.type||item?.itemType||'').toLowerCase().includes('folder');
const nameOf=item=>String(item?.name||'');
function explain(response){const data=response?.data;return String(data?.message||data?.error?.message||data?.error||'').slice(0,300)}
export function createProjectToolsRepository(context){
 let baseline;
 const identity=file=>file?{id:String(file.id),versionId:String(file.versionId||'')}:null;
 const conflict=()=>Error('Prosjektoppsettet er endret av en annen bruker. Trykk Last prosjektoppsett og velg endringene pa nytt.');
 async function authorize(){if(typeof context.authorize!=='function'||await context.authorize()!==true)throw Error('Administratorrettighet kunne ikke bekreftes. Ingen fil er skrevet.');}
 async function currentFile(place){if(!place.file)return null;const r=await context.apiRead(`${context.CORE}/files/${encodeURIComponent(place.file.id)}`);if(!r.ok)throw Error('Kunne ikke kontrollere siste filversjon.');if(!r.data?.id||!r.data?.versionId)throw Error('Filrespons mangler ID eller versionId. Ingen skriving utfort.');if(r.data.name!==FILE_NAME||String(r.data.parentId)!==String(place.folderId))throw conflict();return r.data;}
 async function readFolder(id){const r=await context.apiRead(`${context.CORE}/folders/${encodeURIComponent(id)}/items`);if(!r.ok||r.status===206)throw Error(`Mappen kunne ikke leses komplett (HTTP ${r.status}).`);return items(r.data)}
 async function rootId(){const r=await context.apiRead(`${context.CORE}/projects/${encodeURIComponent(context.projectId)}`);if(!r.ok)throw Error(`Prosjektet kunne ikke leses (HTTP ${r.status}).`);const id=r.data?.rootId||r.data?.rootFolder?.id||r.data?.rootFolderId;if(!id)throw Error('Prosjektsvaret mangler rotmappe-ID.');return id}
 async function childFolder(parent,name){return(await readFolder(parent)).find(x=>isFolder(x)&&nameOf(x).toLowerCase()===name.toLowerCase())||null}
 async function location(){const root=await rootId(),extension=await childFolder(root,'Extension_config');if(!extension)throw Error('Mappen Extension_config mangler.');const doclib=await childFolder(extension.id,'DocLib');if(!doclib)throw Error('Mappen Extension_config/DocLib mangler.');const files=await readFolder(doclib.id),file=files.find(x=>!isFolder(x)&&nameOf(x).toLowerCase()===FILE_NAME);return{folderId:doclib.id,file}}
 async function read(){baseline=undefined;const place=await location();if(!place.file){baseline=null;return{config:null,source:'missing',file:null};}place.file=await currentFile(place);const r=await context.apiRead(`${context.CORE}/files/fs/${encodeURIComponent(place.file.id)}/downloadurl?${new URLSearchParams({versionId:place.file.versionId})}`);if(!r.ok)throw Error(`${FILE_NAME} kunne ikke åpnes (HTTP ${r.status}).`);const url=r.data?.url||r.data?.downloadUrl||r.data;if(!url)throw Error('Nedlastingsadresse mangler.');const response=await fetch(String(url),{cache:'no-store'});if(!response.ok)throw Error(`${FILE_NAME} kunne ikke lastes ned (HTTP ${response.status}).`);const raw=await response.json();if(raw?.schema!=='DocLibProjectTools'||raw?.schemaVersion!==1)throw Error('Ukjent prosjektoppsettformat. Ingen skriving tillatt.');const result={config:normalizeProjectTools(raw),source:'project',file:place.file};baseline=identity(place.file);return result}

 // Source-only single-part upload, per supplied OpenAPI FileUploadDto.
 let saving=false;
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function diagnostic(stage,response,extra={}){
  const data=response?.data||{};
  const clean=value=>{
   let text=typeof value==='string'?value:'';
   for(const secret of [context.projectId,extra.folderId,extra.uploadId].filter(Boolean))text=text.split(String(secret)).join('[redacted]');
   return text.replace(/https?:\/\/[^\s"<>]+/gi,'[URL redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,500);
  };
  const error=Error(`${stage} (HTTP ${response?.status||0}). Se opplastingsdiagnostikk.`);
  error.setupDiagnostics={request:{stage,method:stage==='Start opplasting'?'POST':stage==='Filoverføring'?'PUT':'GET',endpoint:stage==='Filoverføring'?'[signed URL]':'/files/fs/upload',queryKeys:stage==='Start opplasting'?['parentId','parentType']:['uploadId'],bodyKeys:stage==='Start opplasting'?['name']:[],fileName:FILE_NAME},response:{status:response?.status||0,title:clean(data.title),detail:clean(data.detail),message:clean(data.message||data.errorReason||data.error?.message),errorCode:clean(data.code||data.errorCode||data.error?.code),uploadStatus:clean(data.status),responseKeys:typeof data==='object'?Object.keys(data).sort():[]}};
  return error;
 }
 async function save(config){
  if(saving)throw Error('Lagring pågår allerede.');
  saving=true;
  try{
   await authorize();
   if(baseline===undefined)throw Error('Last prosjektoppsettet for lagring.');
   const place=await location();place.file=await currentFile(place);
   const previous=identity(place.file);
   if(JSON.stringify(previous)!==JSON.stringify(baseline))throw conflict();
   const headers={'Content-Type':'application/json'};
   if(previous)headers['If-Match']=previous.versionId;else headers['If-None-Match']='*';
   const expected=normalizeProjectTools(config);
   const bytes=new TextEncoder().encode(JSON.stringify(expected,null,2)+'\n');
   const params=new URLSearchParams({parentId:String(place.folderId),parentType:'FOLDER'});
   const init=await context.apiWrite(`${context.CORE}/files/fs/upload?${params}`,{method:'POST',headers,body:JSON.stringify({name:FILE_NAME})});
   if(init.status===412||init.status===409)throw conflict();
   if(!init.ok||init.status!==202)throw diagnostic('Start opplasting',init,{folderId:place.folderId});
   const data=init.data||{},uploadId=data.uploadId;
   if(previous&&String(data.fileId)!==previous.id)throw Error('Opplastingen peker ikke pa forventet eksisterende fil. Ingen PUT er sendt.');
   const sources=Array.isArray(data.contents)?data.contents.filter(item=>!item.format):[];
   const source=sources[0];
   if(!uploadId||sources.length!==1||typeof source?.url!=='string'||source.multipart===true||source.fileset===true||source.type==='MULTIPART')throw diagnostic('Uventet startrespons',init,{folderId:place.folderId,uploadId});
   let url;try{url=new URL(source.url);}catch{throw Error('Startresponsen mangler gyldig opplastingsadresse.');}
   if(url.protocol!=='https:'||url.username||url.password||url.hash||url.href.includes('*'))throw Error('Ugyldig adresse for enkeltfilopplasting.');
   await authorize();
   const check=await location();check.file=await currentFile(check);if(JSON.stringify(identity(check.file))!==JSON.stringify(previous))throw conflict();
   window.DocLibApproveSignedUpload(url.href,1);
   let put;
   // Uint8Array prevents fetch from adding a Blob Content-Type. No bearer token or cookies.
   try{put=await fetch(url.href,{method:'PUT',body:bytes,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});}catch{throw Error('Filoverføringen kunne ikke bekreftes. Ingen automatisk gjentakelse. Kontroller prosjektfilen før nytt forsøk.');}
   if(!put.ok)throw diagnostic('Filoverføring',{status:put.status,data:{}},{folderId:place.folderId,uploadId});
   let done=false,completed;
   for(let attempt=0;attempt<30;attempt++){
    if(attempt)await pause(1000);
    const state=await context.apiRead(`${context.CORE}/files/fs/upload?${new URLSearchParams({uploadId:String(uploadId)})}`,{signal:AbortSignal.timeout(10000)});
    if(!state.ok)throw diagnostic('Statuskontroll',state,{folderId:place.folderId,uploadId});
    const status=state.data?.status;
    if(status==='DONE'){done=true;completed=state.data;break;}
    if(status!=='UPLOADABLE')throw diagnostic('Statuskontroll',state,{folderId:place.folderId,uploadId});
   }
   if(!done)throw Error('Filen er overført, men DONE er ikke bekreftet innen statusgrensen. Ingen ny opplasting startet. Last prosjektoppsettet på nytt før nytt forsøk.');
   for(let attempt=0;attempt<5;attempt++){
    if(attempt)await pause(1000);
    const confirmed=await read();
    if(previous&&confirmed.file&&String(confirmed.file.id)!==previous.id)throw Error('Fil-ID er endret ved lagring. Kontroller prosjektfilen.');
    if(previous&&confirmed.file?.versionId===previous.versionId)continue;
    if(completed?.versionId&&confirmed.file?.versionId!==completed.versionId)throw conflict();
    if(!confirmed.config)continue;
    if(JSON.stringify(confirmed.config)!==JSON.stringify(expected))throw Error('Prosjektfilen ble lest tilbake, men innholdet samsvarer ikke med valgene. Menyen er ikke oppdatert.');
    return confirmed;
   }
   throw Error('DONE er bekreftet, men prosjektfilen er ikke synlig ved tilbakelesing. Ikke last opp på nytt automatisk.');
  }finally{saving=false;}
 }

 return Object.freeze({read,save});
}
