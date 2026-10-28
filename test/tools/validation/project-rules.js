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
  if(match&&!confirm(`Filen ${fileName} finnes allerede. Overskrive og opprette en ny filversjon i Trimble Connect?`))return{cancelled:true};
  const folderId=(match?.folderId)||(all[0]?.folderId)||((await list())[0]?.folderId);
  if(!folderId)throw Error('Fant ikke målmappen Extension_config/DocLib/properties.');
  const bytes=new TextEncoder().encode(jsonText);
  const payload={projectId:String(context.project.id),parentId:String(folderId),folderId:String(folderId),name:fileName,fileName:fileName,size:bytes.byteLength,contentType:'application/json',mimeType:'application/json'};
  if(match){payload.fileId=String(match.id);payload.existingFileId=String(match.id);}
  const explain=r=>{const d=r?.data;if(!d)return'';if(typeof d==='string')return d.slice(0,500);return String(d.details||d.message||d.errorDetails||d.errorCode||JSON.stringify(d)).slice(0,500)};
  const init=await context.apiWrite(`${context.CORE}/files/fs/upload`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!init.ok)throw Error(`Kunne ikke opprette opplastingsjobb (HTTP ${init.status})${explain(init)?': '+explain(init):'.'}`);
  const info=init.data||{},uploadId=info.uploadId||info.id||info.upload?.id||info.data?.uploadId;
  let uploadUrl=info.uploadUrl||info.url||info.upload?.url||info.urls?.upload||info.data?.uploadUrl;
  if(!uploadId)throw Error('Trimble Connect opprettet ingen uploadId. Svar: '+JSON.stringify(info).slice(0,500));
  if(!uploadUrl){const details=await context.apiRead(`${context.CORE}/files/fs/upload?uploadId=${encodeURIComponent(uploadId)}`);if(!details.ok)throw Error(`Kunne ikke hente opplastingsdetaljer (HTTP ${details.status})${explain(details)?': '+explain(details):'.'}`);const d=details.data||{};uploadUrl=d.uploadUrl||d.url||d.upload?.url||d.urls?.upload||d.data?.uploadUrl;Object.assign(info,d)}
  if(!uploadUrl)throw Error('Trimble Connect returnerte uploadId, men ingen opplastingsadresse.');
  const putHeaders={...(info.headers||info.upload?.headers||{})};if(!Object.keys(putHeaders).some(k=>k.toLowerCase()==='content-type'))putHeaders['Content-Type']='application/json';
  const put=await fetch(uploadUrl,{method:info.method||info.upload?.method||'PUT',headers:putHeaders,body:bytes});
  if(!put.ok)throw Error(`Opplasting av JSON-innhold feilet (HTTP ${put.status}): ${(await put.text()).slice(0,500)}`);
  const complete=await context.apiWrite(`${context.CORE}/files/fs/upload/${encodeURIComponent(uploadId)}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploadId,projectId:payload.projectId,fileId:match?String(match.id):undefined})});
  if(!complete.ok&&![404,405].includes(complete.status))throw Error(`Kunne ikke fullføre opplastingen (HTTP ${complete.status})${explain(complete)?': '+explain(complete):'.'}`);
  const commitBody={uploadId,projectId:payload.projectId,parentId:payload.parentId,folderId:payload.folderId,name:fileName,fileName:fileName,size:payload.size,contentType:payload.contentType};
  if(match){commitBody.fileId=String(match.id);commitBody.existingFileId=String(match.id);}
  const commit=await context.apiWrite(`${context.CORE}/files/fs/commit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(commitBody)});
  if(!commit.ok)throw Error(`Opplastingen ble sendt, men commit feilet (HTTP ${commit.status})${explain(commit)?': '+explain(commit):'.'}`);
  rules=await list();render();return{overwritten:!!match,file:commit.data,uploadId};
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
  try{const result=await uploadRule(fileName,JSON.stringify(rule,null,2)+'\n');if(result.cancelled){if(status)status.textContent='Lagring avbrutt.';return;}if(status){status.textContent=`${fileName} ble ${result.overwritten?'overskrevet som ny filversjon':'opprettet'} i Trimble Connect.`;status.className='re-ok';}}
  catch(error){if(status){status.textContent='Lagring feilet: '+error.message;status.className='re-bad';}throw error}
  finally{busy=false;if(button)button.disabled=false;}
 }
 function ensureSaveButton(){const editor=document.querySelector('#ruleEditorDialog');if(!editor)return false;if(editor.querySelector('#reSaveProjectRule'))return true;const download=editor.querySelector('#reDownload');if(!download)return false;const b=document.createElement('button');b.type='button';b.className='btn primary';b.id='reSaveProjectRule';b.textContent='Lagre til Trimble Connect';b.title='Oppretter eller overskriver JSON i Extension_config/DocLib/properties';b.onclick=()=>saveFromEditor().catch(error=>console.error('[DocLib regelpublisering]',error));download.insertAdjacentElement('afterend',b);const note=download.parentElement?.querySelector('span');if(note)note.textContent='Kan lagres lokalt eller publiseres til Trimble Connect.';return true;}
 function setVersion(){if(document.title!=='DocLib TEST v2.02-preview.11.2-test')document.title='DocLib TEST v2.02-preview.11.2-test';const title=document.querySelector('.title b');if(title?.textContent.includes('DocLib TEST')&&title.textContent!=='DocLib TEST v2.02-preview.11.2-test')title.textContent='DocLib TEST v2.02-preview.11.2-test'}
 function ensureButton(){const editor=document.querySelector('#ruleEditorDialog');if(!editor)return false;if(editor.querySelector('#reOpenProjectRule')){ensureSaveButton();return true;}const importButton=editor.querySelector('#reImport');if(!importButton)return false;const button=document.createElement('button');button.type='button';button.className='btn';button.id='reOpenProjectRule';button.textContent='Åpne prosjektregel';button.title='Les regel-JSON fra Extension_config/DocLib/properties';button.onclick=async()=>{const d=makeDialog();d.showModal();await loadList()};importButton.insertAdjacentElement('afterend',button);ensureSaveButton();return true}
 function ensure(){setVersion();if(ensureButton()){bodyWatch?.disconnect();bodyWatch=null;return}if(!bodyWatch){bodyWatch=new MutationObserver(()=>{if(ensureButton()){bodyWatch.disconnect();bodyWatch=null}});bodyWatch.observe(document.body,{childList:true,subtree:true})}}
 return Object.freeze({ensure,get busy(){return busy},canLeave(){return!busy},destroy(){bodyWatch?.disconnect();dialog?.remove()},snapshot:()=>({busy,count:rules.length})})
}
