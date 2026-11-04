const VERSION='2.05-preview.3-upload.1-fix.1';
const MAX_FILE_BYTES=100*1024*1024;
const UPLOAD_ENABLED=false;

export function createExplorerUpload(context){
 let active=false;
 let button=null;
 let dialog=null;
 let controller=null;
 let session=null;
 let stylesheet=null;

 const byId=id=>dialog?.querySelector('#'+id);
 const fileSize=value=>{
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(1)} KiB`;
  return `${(value/(1024*1024)).toFixed(1)} MiB`;
 };
 const folderNodes=(node,out=[])=>{
  if(node?.projectFolderId)out.push({id:node.projectFolderId,name:node.name,path:'/',files:node.files||[],folders:node.folders||[]});
  for(const folder of node?.folders||[]){
   out.push(folder);
   folderNodes(folder,out);
  }
  return out;
 };
 const currentProjectState=()=>context.projectState||{phase:'idle',stale:true,revision:0};
 const targetFromSelection=()=>{
  const id=byId('doclibUploadFolder')?.value;
  if(!id)return null;
  return folderNodes(context.treeRoot).find(node=>String(node.id)===String(id))||null;
 };
 const targetPath=node=>String(node?.path||('/'+(node?.name||'')));

 function targetProblem(target=session?.target){
  if(!session)return 'Opplastingskøen er ikke åpnet.';
  if(String(context.projectId||'')!==session.projectId)return 'Prosjektet er endret. Lukk dialogen og åpne den på nytt.';
  const state=currentProjectState();
  if(state.phase!=='ready'||state.stale)return 'Prosjektgrunnlaget er ikke bekreftet oppdatert. Oppfrisk prosjektet før du fortsetter.';
  if(state.revision!==session.revision)return 'Prosjektet er lastet inn på nytt. Lukk dialogen og velg målmappen igjen.';
  if(!target)return 'Velg en eksisterende målmappe først.';
  const found=folderNodes(context.treeRoot).find(node=>String(node.id)===String(target.id));
  if(!found||String(found.id)!==String(target.id)||targetPath(found)!==target.path)return 'Målmappen er ikke lenger den samme. Lukk dialogen og velg mappe på nytt.';
  return '';
 }

 function setMessage(text,kind='info'){
  const node=byId('doclibUploadMessage');
  if(!node)return;
  node.textContent=text;
  node.dataset.kind=kind;
 }

 function buildDialog(){
  if(dialog)return;
  stylesheet=document.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=new URL(`./explorer-upload.css?v=${VERSION}`,import.meta.url).href;
  stylesheet.dataset.doclibUploadCss='';
  document.head.append(stylesheet);

  dialog=document.createElement('dialog');
  dialog.id='doclibUploadDialog';
  dialog.className='doclib-upload-dialog';
  dialog.innerHTML=`
   <form method="dialog" class="doclib-upload-shell">
    <header class="doclib-upload-header">
     <div><h2>Last opp filer</h2><p>Preview.3 · opplasting er sperret mens API og rettigheter verifiseres.</p></div>
     <button type="button" class="doclib-upload-close" data-close aria-label="Lukk">×</button>
    </header>
    <div class="doclib-upload-context">
     <div><b>Prosjekt</b><span id="doclibUploadProject"></span></div>
     <label><b>Målmappe</b><select id="doclibUploadFolder" required><option value="">Velg eksisterende målmappe …</option></select></label>
     <div><b>Låst mål</b><span id="doclibUploadTarget">Velg mappe før du legger filer i køen.</span></div>
    </div>
    <label class="doclib-upload-drop" id="doclibUploadDrop">
     <input id="doclibUploadInput" type="file" multiple>
     <strong>Slipp filer her, eller velg filer</strong>
     <span>Filvelger og dra-og-slipp bruker samme kø. Mappopplasting støttes ikke.</span>
    </label>
    <p id="doclibUploadMessage" class="doclib-upload-message" role="status" aria-live="polite"></p>
    <div class="doclib-upload-list-wrap">
     <table class="doclib-upload-list"><thead><tr><th>Fil</th><th>Størrelse</th><th>Status / feil</th></tr></thead><tbody id="doclibUploadRows"></tbody></table>
     <p id="doclibUploadEmpty" class="doclib-upload-empty">Ingen filer i køen.</p>
    </div>
    <label class="doclib-upload-consent"><input id="doclibUploadConsent" type="checkbox"> Jeg bekrefter at prosjekt, målmappe og fil(er) er riktige.</label>
    <p class="doclib-upload-limit">Foreslått grense for første preview: 100 MiB per fil. Dette er en DocLib-grense som må verifiseres.</p>
    <footer class="doclib-upload-footer">
     <button type="button" class="btn" data-close>Lukk</button>
     <button type="button" class="btn primary" id="doclibUploadStart" disabled>Opplasting ikke aktivert</button>
    </footer>
   </form>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-close]').forEach(node=>node.addEventListener('click',close,{signal:controller.signal}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();},{signal:controller.signal});
  byId('doclibUploadFolder').addEventListener('change',renderTarget,{signal:controller.signal});
  byId('doclibUploadInput').addEventListener('change',event=>{
   addFiles(event.target.files);
   event.target.value='';
  },{signal:controller.signal});
  byId('doclibUploadConsent').addEventListener('change',renderQueue,{signal:controller.signal});
  const drop=byId('doclibUploadDrop');
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('is-dragging');},{signal:controller.signal});
  drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('is-dragging');},{signal:controller.signal});
  drop.addEventListener('drop',event=>{
   event.preventDefault();
   drop.classList.remove('is-dragging');
   const hasFolder=[...(event.dataTransfer?.items||[])].some(item=>item.webkitGetAsEntry?.()?.isDirectory);
   if(hasFolder){
    setMessage('Mappopplasting er ikke med i preview.3. Velg én eller flere enkeltfiler.','error');
    return;
   }
   addFiles(event.dataTransfer?.files||[]);
  },{signal:controller.signal});
 }

 function renderFolders(){
  const select=byId('doclibUploadFolder');
  if(!select||!session)return;
  const folders=folderNodes(context.treeRoot);
  select.replaceChildren(new Option('Velg eksisterende målmappe …',''));
  for(const folder of folders){
   const option=new Option(targetPath(folder),String(folder.id));
   select.add(option);
  }
 }

 function renderTarget(){
  if(!session)return;
  const select=byId('doclibUploadFolder');
  if(session.target){select.value=String(session.target.id);select.disabled=true;}
  const target=session.target||targetFromSelection();
  const projectState=currentProjectState();
  const stale=String(context.projectId||'')!==session.projectId||projectState.revision!==session.revision||projectState.phase!=='ready'||projectState.stale;
  byId('doclibUploadProject').textContent=`${session.projectName} · ${session.projectId}`;
  byId('doclibUploadTarget').textContent=target?`${targetPath(target)}${session.target?' · låst for køen':''}`:'Velg mappe før du legger filer i køen.';
  if(stale)setMessage('Prosjektgrunnlaget har endret seg eller er utdatert. Lukk dialogen og oppfrisk før du fortsetter.','error');
  else if(targetProblem(target))setMessage(targetProblem(target),'error');
  else setMessage('Målprosjektet er låst. Målmappen låses når første fil legges i køen. Skriving er deaktivert i denne byggingen.');
  renderQueue();
 }

 function addFiles(fileList){
  if(!session)return;
  const files=[...fileList||[]];
  if(!files.length)return;
  let target=session.target||targetFromSelection();
  const targetIssue=targetProblem(target);
  if(!targetIssue&&!session.target){
   session.target={id:String(target.id),name:String(target.name),path:targetPath(target)};
   byId('doclibUploadFolder').value=session.target.id;
   byId('doclibUploadFolder').disabled=true;
   target=session.target;
  }
  const targetNode=target?folderNodes(context.treeRoot).find(node=>String(node.id)===String(target.id)):null;
  for(const file of files){
   let error=targetIssue;
   if(!error&&file.size>MAX_FILE_BYTES)error='Filen overskrider foreslått DocLib-grense på 100 MiB.';
   if(!error&&targetNode?.files?.some(existing=>String(existing.name).toLocaleLowerCase('no')===file.name.toLocaleLowerCase('no'))){
    error='Filnavnet finnes allerede i målmappevisningen. Overskriving er ikke tillatt.';
   }
   if(!error&&session.queue.some(item=>item.targetId===String(target?.id)&&item.file.name.toLocaleLowerCase('no')===file.name.toLocaleLowerCase('no')&&item.state==='queued')){
    error='Samme filnavn ligger allerede i køen for målmappevisningen.';
   }
   session.queue.push({file,targetId:String(target?.id||''),state:error?'error':'queued',message:error||'Klar i lokal kø · ikke sendt'});
  }
  renderTarget();
 }

 function renderQueue(){
  if(!dialog||!session)return;
  const tbody=byId('doclibUploadRows');
  tbody.replaceChildren();
  for(const item of session.queue){
   const row=document.createElement('tr');
   const name=document.createElement('td');name.textContent=item.file.name;
   const size=document.createElement('td');size.textContent=fileSize(item.file.size);
   const status=document.createElement('td');status.textContent=item.message;status.dataset.state=item.state;
   row.append(name,size,status);tbody.append(row);
  }
  byId('doclibUploadEmpty').hidden=session.queue.length>0;
  const canWrite=UPLOAD_ENABLED&&session.queue.some(item=>item.state==='queued')&&byId('doclibUploadConsent').checked&&!targetProblem();
  byId('doclibUploadStart').disabled=!canWrite;
  byId('doclibUploadStart').textContent=UPLOAD_ENABLED?'Start opplasting':'Opplasting ikke aktivert';
 }

 function open(){
  if(!active||!context.treeRoot)return;
  const state=currentProjectState();
  session={projectId:String(context.projectId||''),projectName:String(context.treeRoot?.name||'Prosjekt'),revision:state.revision,queue:[],target:null};
  buildDialog();
  byId('doclibUploadConsent').checked=false;
  byId('doclibUploadFolder').disabled=false;
  renderFolders();
  renderTarget();
  dialog.showModal();
 }

 function close(){
  if(dialog?.open)dialog.close();
  if(session?.queue?.length)setMessage('Den lokale køen ble tømt da dialogen ble lukket. Ingen filer er lastet opp.');
  session=null;
  dialog?.remove();
  dialog=null;
 }

 function mount(){
  if(active)return;
  active=true;
  controller=new AbortController();
  const toolbar=document.querySelector('.toolbar');
  if(!toolbar){active=false;return;}
  button=document.createElement('button');
  button.type='button';
  button.className='btn';
  button.id='doclibUploadOpen';
  button.textContent='Last opp fil';
  button.title='Legg enkeltfiler i preview.3-køen';
  button.addEventListener('click',open,{signal:controller.signal});
  const search=toolbar.querySelector('.search');
  if(search?.parentElement)search.parentElement.insertBefore(button,search);else toolbar.append(button);
 }

 function unmount(){
  if(!active)return;
  close();
  active=false;
  controller?.abort();
  controller=null;
  button?.remove();
  button=null;
  stylesheet?.remove();
  stylesheet=null;
 }

 return Object.freeze({mount,unmount});
}
