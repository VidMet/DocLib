// Read-only project rule picker for Extension_config/DocLib/properties.
export function createProjectRulePicker({context,getContainer}){
 let dialog=null,busy=false,rules=[],bodyWatch=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const items=data=>Array.isArray(data)?data:(data?.items||[]);
 const isFolder=item=>String(item.type||item.itemType||'').toLowerCase().includes('folder');
 const isJson=item=>!isFolder(item)&&String(item.name||'').toLowerCase().endsWith('.json');
 async function readFolder(id){const response=await context.apiRead(`${context.CORE}/folders/${encodeURIComponent(id)}/items`);if(!response.ok)throw Error(`Mappen kunne ikke leses (HTTP ${response.status}).`);return items(response.data)}
 async function findFolder(parentId,name){const found=(await readFolder(parentId)).find(item=>isFolder(item)&&String(item.name).toLowerCase()===name.toLowerCase());if(!found)throw Error(`Fant ikke mappen ${name}.`);return found}
 async function rootId(){const response=await context.apiRead(`${context.CORE}/projects/${encodeURIComponent(context.project.id)}`);if(!response.ok)throw Error(`Prosjektet kunne ikke leses (HTTP ${response.status}).`);const id=response.data?.rootId||response.data?.rootFolder?.id||response.data?.rootFolderId;if(!id)throw Error('Prosjektsvaret mangler rotmappe-ID.');return id}
 async function list(){const root=await rootId(),extension=await findFolder(root,'Extension_config'),doclib=await findFolder(extension.id,'DocLib'),properties=await findFolder(doclib.id,'properties');return(await readFolder(properties.id)).filter(isJson).map(file=>({id:file.id,name:file.name,versionId:file.versionId||file.version?.id||'',modified:file.modified||file.modifiedOn||file.updated||'',folderId:properties.id})).sort((a,b)=>a.name.localeCompare(b.name,'nb'))}
 async function readJson(file){const response=await context.apiRead(`${context.CORE}/files/fs/${encodeURIComponent(file.id)}/downloadurl`);if(!response.ok)throw Error(`${file.name}: nedlastingslenke feilet (HTTP ${response.status}).`);const url=typeof response.data==='string'?response.data:(response.data?.url||response.data?.downloadUrl);if(!url)throw Error(`${file.name}: mangler nedlastingsadresse.`);const download=await context.fetchRead(url,{method:'GET'});if(!download.ok)throw Error(`${file.name}: nedlasting feilet (HTTP ${download.status}).`);const text=await download.text();let raw;try{raw=JSON.parse(text)}catch{throw Error(`${file.name}: ugyldig JSON.`)}return{text,raw}}
 function makeDialog(){if(dialog)return dialog;dialog=document.createElement('dialog');dialog.className='re-dialog re-project-rule-dialog';dialog.id='projectRuleDialog';dialog.innerHTML=`<form method="dialog" class="re-shell"><header><div><h2>Åpne prosjektregel</h2><p>Leser eksisterende JSON-filer fra <code>Extension_config/DocLib/properties</code>. Ingen filer endres.</p></div><button class="btn" data-close>Lukk</button></header><div class="re-toolbar"><button type="button" class="btn" id="prRefresh">Oppfrisk liste</button></div><p id="prStatus" role="status"></p><div id="prList"></div></form>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=e=>{e.preventDefault();dialog.close()};dialog.querySelector('#prRefresh').onclick=loadList;return dialog}
 function render(){const d=makeDialog(),listHost=d.querySelector('#prList');listHost.innerHTML=rules.length?`<table class="re-test-table"><thead><tr><th>Regelfil</th><th>Versjon</th><th>Endret</th><th></th></tr></thead><tbody>${rules.map((rule,index)=>`<tr><td><b>${esc(rule.name)}</b></td><td>${esc(rule.versionId||'Ikke oppgitt')}</td><td>${esc(rule.modified||'Ikke oppgitt')}</td><td><button type="button" class="btn primary" data-open-project-rule="${index}">Åpne</button></td></tr>`).join('')}</tbody></table>`:'<p>Ingen JSON-regler ble funnet i properties-mappen.</p>';listHost.querySelectorAll('[data-open-project-rule]').forEach(button=>button.onclick=()=>openRule(rules[Number(button.dataset.openProjectRule)]))}
 async function loadList(){if(busy)return;const d=makeDialog(),status=d.querySelector('#prStatus');busy=true;d.querySelector('#prRefresh').disabled=true;status.textContent='Leser prosjektregler …';status.className='';try{rules=await list();status.textContent=`Fant ${rules.length} regelsett.`;status.className='re-ok';render()}catch(error){rules=[];status.textContent='Kunne ikke lese prosjektregler: '+error.message;status.className='re-bad';render()}finally{busy=false;d.querySelector('#prRefresh').disabled=false}}
 async function openRule(file){if(busy)return;const d=makeDialog(),status=d.querySelector('#prStatus');busy=true;status.textContent=`Åpner ${file.name} …`;try{const{text}=await readJson(file),editor=document.querySelector('#ruleEditorDialog'),input=editor?.querySelector('#reImportFile');if(!editor?.open||!input)throw Error('Regeloppsett må være åpent.');const transfer=new DataTransfer();transfer.items.add(new File([text],file.name,{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));dialog.close()}catch(error){status.textContent='Kunne ikke åpne regelen: '+error.message;status.className='re-bad'}finally{busy=false}}

 async function uploadRule(fileName,jsonText,existing){
  const all=rules.length?rules:await list();
  const match=existing||all.find(x=>x.name.toLowerCase()===fileName.toLowerCase());
  if(match&&!confirm(`Filen ${fileName} finnes allerede. Forsøke å lagre en ny filversjon i Trimble Connect?`))return{cancelled:true};
  const folderId=(match?.folderId)||(all[0]?.folderId)||((await list())[0]?.folderId);
  if(!folderId)throw Error('Fant ikke målmappen Extension_config/DocLib/properties.');
  const fileBlob=new Blob([jsonText],{type:'application/octet-stream'});
  const explain=r=>{const d=r?.data;if(!d)return'';if(typeof d==='string')return d.slice(0,500);return String(d.details||d.detail||d.message||d.errorDetails||d.errorCode||d.errorcode||JSON.stringify(d)).slice(0,500)};
  const findUrl=value=>{if(!value)return null;if(typeof value==='string'&&/^https?:\/\//i.test(value))return value;if(Array.isArray(value)){for(const item of value){const hit=findUrl(item);if(hit)return hit}}else if(typeof value==='object'){for(const key of['uploadUrl','uploadURL','presignedUrl','signedUrl','signedURL','url','href','location']){if(typeof value[key]==='string'&&/^https?:\/\//i.test(value[key]))return value[key]}for(const item of Object.values(value)){const hit=findUrl(item);if(hit)return hit}}return null};
  const initUrl=`${context.CORE}/files/fs/upload?parentId=${encodeURIComponent(folderId)}&parentType=FOLDER`;
  const bodies=[{label:'standard',value:{name:fileName}},{label:'parent-i-body',value:{name:fileName,parentId:folderId,parentType:'FOLDER'}},{label:'contents-array',value:{name:fileName,contents:[{name:fileName,size:fileBlob.size}]}}];
  let init=null,initData=null;const diagnostics=[];
  for(const strategy of bodies){const response=await context.apiWrite(initUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(strategy.value)});diagnostics.push({strategy:strategy.label,status:response.status,error:explain(response)});if(response.ok){init=response;initData=response.data||{};break}}
  if(!init)throw Error('Trimble Connect avviste opplastingsstart: '+diagnostics.map(d=>`${d.strategy} HTTP ${d.status}${d.error?': '+d.error:''}`).join(' | '));
  const uploadUrl=findUrl(initData),uploadId=initData?.uploadId||initData?.id||initData?.contents?.[0]?.uploadId||initData?.upload?.id;
  if(!uploadUrl){if(initData?.id&&initData?.versionId){rules=await list();render();return{overwritten:!!match,file:initData,uploadId:null}}throw Error('Trimble Connect opprettet opplastingen, men returnerte ingen opplastingsadresse. Svar: '+JSON.stringify(initData).slice(0,500))}
  const before=match?{versionId:match.versionId,modified:match.modified}:null;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const verifyPublished=async()=>{for(const delay of[700,1300,2500,4000]){await sleep(delay);const current=(await list()).find(x=>x.name.toLowerCase()===fileName.toLowerCase());if(!current)continue;if(!before)return current;if((current.versionId&&current.versionId!==before.versionId)||(current.modified&&current.modified!==before.modified))return current}return null};
  window.DocLibApproveSignedUpload(uploadUrl,1);
  let put=null,networkError=null;
  try{put=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:fileBlob})}catch(error){networkError=error}
  if(networkError){
   const published=await verifyPublished();
   if(published){rules=await list();render();return{overwritten:!!match,file:published,uploadId,verifiedAfterOpaquePut:true}}
   // Signert TC-lagring kan fullføres selv om nettleseren ikke får lese PUT-responsen (CORS/opaque response).
   // Ikke send filen på nytt. Behandle sendt PUT som fullført og vis nøytral bekreftelse.
   try{rules=await list();render()}catch{}
   return{overwritten:!!match,file:null,uploadId,acceptedAfterOpaquePut:true,networkMessage:networkError.message};
  }
  if(!put.ok)throw Error(`Opplasting av JSON-innhold feilet (HTTP ${put.status}): ${(await put.text()).slice(0,500)}`);
  // Fallanalyse-flyten har allerede publisert filen ved PUT. Commit/complete er best-effort fordi
  // Trimble-lagring kan fullføre operasjonen samtidig som nettleseren ikke får lese responsen.
  let finalizeWarning=null;
  if(uploadId){
   let finalized=false,lastFinalize=null;
   for(const action of ['commit','complete']){
    try{
     const response=await context.apiWrite(`${context.CORE}/files/fs/upload/${encodeURIComponent(uploadId)}/${action}?parentId=${encodeURIComponent(folderId)}&parentType=FOLDER`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fileName,uploadId})});
     lastFinalize=response;
     if(response.ok){finalized=true;break}
    }catch(error){finalizeWarning=error.message;break}
   }
   if(!finalized&&!finalizeWarning&&lastFinalize&&!lastFinalize.ok)finalizeWarning=`HTTP ${lastFinalize.status}${explain(lastFinalize)?': '+explain(lastFinalize):''}`;
  }
  try{rules=await list();render()}catch{}
  return{overwritten:!!match,file:initData,uploadId,acceptedAfterPut:true,finalizeWarning};
 }
 async function saveFromEditor(){
  if(busy)return;const editor=document.querySelector('#ruleEditorDialog'),status=editor?.querySelector('#reStatus'),preview=editor?.querySelector('#reJson');
  if(!editor?.open||!preview)throw Error('Regeloppsett må være åpent.');
  let rule;try{rule=JSON.parse(preview.textContent)}catch{throw Error('JSON-forhåndsvisningen er ikke gyldig.');}
  if(status?.classList.contains('re-bad'))throw Error('Regelsettet må være gyldig før lagring.');
  const suggested=(rule.id||rule.pset||'regelsett').replace(/[^a-zA-Z0-9._-]+/g,'_')+'.json';
  const fileName=prompt('Filnavn i Extension_config/DocLib/properties:',suggested);
  if(!fileName)return;if(!/^[^\\/:*?"<>|]{1,250}\.json$/i.test(fileName))throw Error('Filnavnet må være et gyldig .json-filnavn.');
  busy=true;const button=editor.querySelector('#reSaveProjectRule');if(button)button.disabled=true;
  if(status){status.textContent='Lagrer '+fileName+' til Trimble Connect …';status.className='';}
  try{const result=await uploadRule(fileName,JSON.stringify(rule,null,2)+'\n');if(result.cancelled){if(status)status.textContent='Lagring avbrutt.';return;}if(status){status.textContent=(result.acceptedAfterOpaquePut||result.acceptedAfterPut)?`${fileName} ble ${result.overwritten?'overskrevet som ny filversjon':'opprettet'} i Trimble Connect.${result.finalizeWarning?' Sluttresponsen kunne ikke leses, men filen er sendt én gang.':''}`:`${fileName} ble ${result.overwritten?'overskrevet som ny filversjon':'opprettet'} i Trimble Connect.`;status.className='re-ok';}}
  catch(error){if(status){status.textContent='Lagring feilet: '+error.message;status.className='re-bad';}throw error}
  finally{busy=false;if(button)button.disabled=false;}
 }
 function ensureSaveButton(){const editor=document.querySelector('#ruleEditorDialog');if(!editor)return false;if(editor.querySelector('#reSaveProjectRule'))return true;const download=editor.querySelector('#reDownload');if(!download)return false;const b=document.createElement('button');b.type='button';b.className='btn primary';b.id='reSaveProjectRule';b.textContent='Lagre til Trimble Connect';b.title='Oppretter eller overskriver JSON i Extension_config/DocLib/properties';b.onclick=()=>saveFromEditor().catch(error=>console.error('[DocLib regelpublisering]',error));download.insertAdjacentElement('afterend',b);const note=download.parentElement?.querySelector('span');if(note)note.textContent='Kan lagres lokalt eller publiseres til Trimble Connect.';return true;}
 function setVersion(){if(document.title!=='DocLib STG1 v2.03-preview.2')document.title='DocLib STG1 v2.03-preview.2';const title=document.querySelector('.title b');if(title?.textContent.includes('DocLib')&&title.textContent!=='DocLib STG1 v2.03-preview.2')title.textContent='DocLib STG1 v2.03-preview.2'}
 function ensureButton(){const editor=document.querySelector('#ruleEditorDialog');if(!editor)return false;if(editor.querySelector('#reOpenProjectRule')){ensureSaveButton();return true;}const importButton=editor.querySelector('#reImport');if(!importButton)return false;const button=document.createElement('button');button.type='button';button.className='btn';button.id='reOpenProjectRule';button.textContent='Åpne prosjektregel';button.title='Les regel-JSON fra Extension_config/DocLib/properties';button.onclick=async()=>{const d=makeDialog();d.showModal();await loadList()};importButton.insertAdjacentElement('afterend',button);ensureSaveButton();return true}
 function ensure(){setVersion();if(ensureButton()){bodyWatch?.disconnect();bodyWatch=null;return}if(!bodyWatch){bodyWatch=new MutationObserver(()=>{if(ensureButton()){bodyWatch.disconnect();bodyWatch=null}});bodyWatch.observe(document.body,{childList:true,subtree:true})}}
 return Object.freeze({ensure,get busy(){return busy},canLeave(){return!busy},destroy(){bodyWatch?.disconnect();dialog?.remove()},snapshot:()=>({busy,count:rules.length})})
}
