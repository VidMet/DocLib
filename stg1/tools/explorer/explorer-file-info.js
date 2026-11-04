// Read-only file details and version history. No write API is exposed here.
export const first=(...values)=>values.find(v=>v!==undefined&&v!==null&&v!=='')??null;
export function versionItems(data){
 if(Array.isArray(data))return data;
 for(const key of ['items','versions','files','data'])if(Array.isArray(data?.[key]))return data[key];
 throw Error('Ukjent svarformat for versjonshistorikk. Ingen historikk er tolket.');
}
export function formatBytes(value){if(value===null||value===undefined||value==='')return 'Ikke tilgjengelig';const n=Number(value);if(!Number.isFinite(n)||n<0)return 'Ikke tilgjengelig';return n.toLocaleString('nb-NO')+' byte';}
export function person(value){if(value&&typeof value==='object')return first(value.name,[value.firstName,value.lastName].filter(Boolean).join(' '),value.email,value.id);return value;}
export function dateText(value){if(value===null||value===undefined||value==='')return 'Ikke tilgjengelig';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('nb-NO');}
export function createFileReader(context){
 const endpoint=id=>context.CORE+'/files/'+encodeURIComponent(String(id));
 const check=r=>{if(!r.ok)throw Error(r.status===403?'Du har ikke tilgang (HTTP 403).':r.status===404?'Filen eller historikken ble ikke funnet (HTTP 404).':r.status===0?'Nettverksfeil. Prøv igjen.':'Lesing feilet (HTTP '+r.status+').');return r;};
 return Object.freeze({
 async details(id,signal){const r=check(await context.apiRead(endpoint(id)+'?minimal=false',{signal}));const data=r.data?.file??r.data;if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ukjent svarformat for filinformasjon.');return data;},
 async versions(id,start=0,signal){const r=check(await context.apiRead(endpoint(id)+'/versions',{signal,range:'items='+start+'-'+(start+49)}));const items=versionItems(r.data);const match=/items\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(r.contentRange||'');if(match&&Number(match[1])!==start)throw Error('API-et returnerte en annen side enn forespurt.');const total=match&&match[3]!=='*'?Number(match[3]):null;const end=match?Number(match[2])+1:start+items.length;return {items,total,next:items.length&&(total!==null?end<total:r.status===206&&items.length>0)?end:null,partial:r.status===206};}
 });
}
export function createFileInfoPanel(context){
 const reader=createFileReader(context);let dialog=null,abort=null,sequence=0,trigger=null;
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);return x;};
 function close(){sequence++;abort?.abort();abort=null;if(dialog){dialog.close();dialog.remove();dialog=null;}if(trigger?.isConnected)trigger.focus();trigger=null;}
 async function open(file,button){
  close();trigger=button;const seq=++sequence,projectId=context.projectId;abort=new AbortController();const signal=abort.signal;
  const valid=()=>seq===sequence&&!signal.aborted&&context.projectId===projectId;
  dialog=el('dialog');dialog.className='explorer-file-info';dialog.style.cssText='width:min(760px,92vw);max-height:85vh;overflow:auto;border:1px solid #aaa;border-radius:8px;padding:20px;color:inherit;background:var(--panel,#fff)';
  const header=el('div');header.style.cssText='display:flex;justify-content:space-between;gap:12px;align-items:center';const heading=el('h2','Filinformasjon');const exit=el('button','Lukk');exit.type='button';exit.onclick=close;header.append(heading,exit);
  const name=el('h3',file.name||file.id),note=el('p','Kun lesing. Ingen prosjektfiler endres.'),meta=el('div','Henter filinformasjon …'),history=el('section'),ht=el('h3','Versjonshistorikk'),status=el('p','Henter historikk …'),list=el('div'),more=el('button','Last flere versjoner');more.type='button';more.hidden=true;
  history.append(ht,status,list,more);dialog.append(header,name,note,meta,history);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(dialog);dialog.showModal();
  const row=(dl,label,value)=>{const dt=el('dt',label),dd=el('dd',value===null||value===undefined||value===''?'Ikke tilgjengelig':value);dd.style.cssText='margin:0;overflow-wrap:anywhere';dl.append(dt,dd);};
  const displayMeta=(d,fallback=false)=>{meta.replaceChildren();if(fallback)meta.append(el('p','Viser kun lokalt innlastede opplysninger.'));const dl=el('dl');dl.style.cssText='display:grid;grid-template-columns:140px 1fr;gap:8px';
   row(dl,'Filnavn',first(d.name,file.name));row(dl,'Fil-ID',file.id);row(dl,'Mappe',first(d.path,d.folderPath,file.folderPath));row(dl,'Størrelse',formatBytes(first(d.size,d.fileSize)));row(dl,'Opprettet',dateText(first(d.createdOn,d.createdAt)));row(dl,'Endret',dateText(first(d.modifiedOn,d.modifiedAt)));row(dl,'Endret av',person(first(d.modifiedBy,d.createdBy)));row(dl,'Versjon',first(d.version,d.versionNumber));row(dl,'Versjons-ID',d.versionId);meta.append(dl);};
  reader.details(file.id,signal).then(d=>{if(valid())displayMeta(d);}).catch(e=>{if(!valid())return;displayMeta(file,true);meta.prepend(el('p',e.message));});
  let loaded=0,busy=false;const seen=new Set();
  async function load(start){if(busy||!valid())return;busy=true;more.disabled=true;status.textContent='Henter historikk …';
   try{const page=await reader.versions(file.id,start,signal);if(!valid())return;
    for(const item of page.items){const key=String(first(item.versionId,item.id,JSON.stringify(item)));if(seen.has(key))continue;seen.add(key);loaded++;const box=el('article');box.style.cssText='border-top:1px solid #ddd;padding:10px 0';const dl=el('dl');dl.style.cssText='display:grid;grid-template-columns:140px 1fr;gap:6px';row(dl,'Versjon',first(item.version,item.versionNumber));row(dl,'Versjons-ID',first(item.versionId,item.id));row(dl,'Dato',dateText(first(item.modifiedOn,item.createdOn,item.modifiedAt,item.createdAt)));row(dl,'Bruker',person(first(item.modifiedBy,item.createdBy)));row(dl,'Størrelse',formatBytes(first(item.size,item.fileSize)));box.append(dl);list.append(box);}
    status.textContent=loaded?(loaded+' versjoner vist'+(page.total!==null?' av '+page.total:'')+(page.next!==null?'. Last flere for resten.':'.')):'API-et returnerte ingen versjoner.';
    more.textContent='Last flere versjoner';more.hidden=page.next===null;more.onclick=()=>load(page.next);
   }catch(e){if(valid()){status.textContent='Historikk kunne ikke leses: '+e.message;more.hidden=false;more.textContent='Prøv igjen';more.onclick=()=>load(start);}}
   finally{busy=false;if(valid())more.disabled=false;}
  }
  void load(0);
 }
 return Object.freeze({open,close});
}
