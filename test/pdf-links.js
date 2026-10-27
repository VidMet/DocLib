'use strict';
// DocLib TEST PDF links v1.37-preview.4-test. Existing app.js/auth-fix.js remain unchanged.
// GET only. Local references bind report version to PDF version, never a signed URL.
(function(){
 if(typeof testStorage==='undefined'||typeof cpPdfCell!=='function'||typeof cpTestRenderBase!=='function'){
  window.addEventListener('load',()=>{const e=document.getElementById('status');if(e){e.textContent='PDF-modul stoppet: forventet DocLib preview.3 TEST mangler.';e.className='status bad';}});return;
 }
 const bindingsKey=()=> 'pdf-report-links-v1:'+String(project?.id||'')+':'+String(mineUser?.id||'unresolved');
 const reportKey=r=>String(r.fileId)+':'+String(r.versionId);
 function readBindings(){const text=testStorage.getItem(bindingsKey());if(!text)return {};const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Lokale PDF-koblinger er ugyldige.');return v;}
 function validPdf(p){const f=cpFile(p);return f&&f.format==='pdf'&&cpControlIds.has(String(f.id))&&String(f.versionId||'')===String(p.versionId)?f:null;}
 function reportFile(r){const f=cpFile({fileId:r.fileId});if(!f||f.format!=='json'||!cpControlIds.has(String(f.id))||String(f.versionId||'')!==String(r.versionId))throw Error('JSON-rapportens versjon er endret. Oppdater Kontrollplan.');return f;}
 function pdfState(r){
  const jf=reportFile(r),saved=readBindings()[reportKey(r)],explicit=saved||r.pdf;
  if(explicit){const f=validPdf(explicit);return f?{state:'linked',ref:{fileId:String(f.id),versionId:String(f.versionId),name:f.name},source:saved?'local':'metadata'}:{state:'stale'};}
  const name=String(jf.name).replace(/\.json$/i,'.pdf');
  const candidates=cpControlFiles.filter(f=>f.format==='pdf'&&String(f.folderId)===String(jf.folderId)&&String(f.name).toLocaleLowerCase('nb')===name.toLocaleLowerCase('nb'));
  return candidates.length===1&&candidates[0].versionId?{state:'suggested',candidate:candidates[0]}:{state:candidates.length>1?'ambiguous':'missing'};
 }
 function reportControls(r){
  let s;try{s=pdfState(r)}catch(_){return '<span>PDF-kobling kunne ikke leses.</span>';}
  const attrs=' data-pdf-report="'+esc(r.fileId)+'" data-pdf-report-version="'+esc(r.versionId)+'"';
  if(s.state==='linked')return '<span class="cp-pdf-actions"><button class="btn" data-pdf-action="open"'+attrs+'>Åpne PDF ↗</button><button class="btn" data-pdf-action="download"'+attrs+'>Last ned PDF</button><small>'+esc(s.ref.name)+' · versjonsbundet · '+(s.source==='local'?'lokal testkobling':'rapportreferanse')+'</small></span>';
  const label={suggested:'Knytt foreslått PDF',stale:'PDF-versjon endret · velg på nytt',ambiguous:'Flere PDF-treff · velg',missing:'Velg PDF'}[s.state];
  return '<button class="btn" data-pdf-action="choose"'+attrs+'>'+esc(label)+'</button>';
 }
 const oldCell=cpPdfCell;
 cpPdfCell=function(file){const reports=cpTableReports(file);return '<td>'+ (reports.length?reports.map(r=>'<div class="cp-pdf-report"><small>'+esc(r.name)+'</small>'+reportControls(r)+'</div>').join(''):'<span>Ingen gyldig koblet JSON-rapport</span>')+'</td>';};
 const oldReport=cpReportHtml;
 cpReportHtml=function(item,ids=[]){const html=oldReport(item,ids);if(!item.entry?.ok)return html;return html.replace('</h4>','</h4><div class="cp-pdf-report">'+reportControls(item.entry.report)+'</div>');};
 function findReport(id,version){const e=cpReports.get(String(id));if(!e?.ok||String(e.report.versionId)!==String(version))throw Error('Rapportgrunnlaget er endret. Oppdater Kontrollplan.');reportFile(e.report);return e.report;}
 function choose(r){
  const pid=String(project.id),uid=String(mineUser?.id||'unresolved'),jf=reportFile(r),s=pdfState(r);
  let d=document.getElementById('cpPdfChoose');if(!d){d=document.createElement('dialog');d.id='cpPdfChoose';d.className='cp-link-dialog';document.body.appendChild(d);}
  const files=cpControlFiles.filter(f=>f.format==='pdf'&&f.versionId);
  d.innerHTML='<div class="cp-dialog-head"><h2>Knytt PDF til kontrollrapport</h2><button class="btn" data-close>Lukk</button></div><p>'+esc(r.name)+'</p><p>Samme filnavn er bare et forslag. Kontroller at PDF og JSON gjelder samme kontroll og revisjon. Koblingen lagres bare i denne nettleseren, for denne brukeren og dette prosjektet.</p><label>PDF <select data-file><option value="">Velg PDF...</option>'+files.map(f=>'<option value="'+esc(f.id)+'" '+(s.candidate?.id===f.id?'selected':'')+'>'+esc(f.folderPath+'/'+f.name)+' · '+esc(f.versionId)+'</option>').join('')+'</select></label><p><label><input type="checkbox" data-consent> Jeg har kontrollert at dette er riktig PDF for JSON-rapporten.</label></p><button class="btn primary" data-save disabled>Lagre PDF-kobling lokalt · TEST</button><p data-message role="status"></p>';
  d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-consent]').onchange=e=>d.querySelector('[data-save]').disabled=!e.target.checked;
  d.querySelector('[data-save]').onclick=()=>{try{
   if(String(project.id)!==pid||String(mineUser?.id||'unresolved')!==uid)throw Error('Prosjekt eller bruker er endret.');
   reportFile(r);const f=files.find(x=>String(x.id)===d.querySelector('[data-file]').value);if(!f||!validPdf({fileId:f.id,versionId:f.versionId}))throw Error('Velg en tilgjengelig PDF med versjon.');
   const bindings=readBindings();bindings[reportKey(r)]={fileId:String(f.id),versionId:String(f.versionId)};
   testStorage.setItem(bindingsKey(),JSON.stringify(bindings));d.close();cpRender();status('PDF-kobling lagret lokalt i TEST. Ingen prosjektfiler endret.','ok');
  }catch(e){d.querySelector('[data-message]').textContent=e.message;}};
  d.showModal();
 }
 async function freshFile(f){
  const response=await fetch(CORE+'/folders/'+encodeURIComponent(f.folderId)+'/items',{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',redirect:'error'});
  if(!response.ok||response.status===206)throw Error('Mappelisten kunne ikke leses fullstendig. Oppdater og prøv igjen.');
  const data=await response.json(),items=Array.isArray(data)?data:data?.items;
  if(!Array.isArray(items)||(data?.total!==undefined&&Number(data.total)!==items.length))throw Error('Ufullstendig mappeliste.');
  const live=items.find(x=>String(x.id)===String(f.id));if(!live||String(live.versionId)!==String(f.versionId))throw Error('Filversjonen er endret. Oppdater Kontrollplan og bekreft koblingen på nytt.');
 }
 async function pdfBlob(r,ref,pid){
  const jf=reportFile(r),f=validPdf(ref);if(!f)throw Error('PDF-versjonen er endret.');
  await freshFile(jf);await freshFile(f);
  // Do not use req(): it logs signed download URLs from other call sites.
  const res=await fetch(CORE+'/files/fs/'+encodeURIComponent(f.id)+'/downloadurl',{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',redirect:'error'});
  if(!res.ok)throw Error('Kunne ikke hente PDF (HTTP '+res.status+').');
  const data=await res.json(),u=new URL(typeof data==='string'?data:data?.url||data?.downloadUrl||data?.downloadurl);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('Ugyldig nedlastingsadresse.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
   const x=await fetch(u.href,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});if(!x.ok)throw Error('PDF-nedlasting feilet (HTTP '+x.status+').');
   const max=100*1024*1024;if(Number(x.headers.get('Content-Length'))>max)throw Error('PDF er større enn 100 MiB.');
   const chunks=[];let size=0;
   if(x.body?.getReader){const reader=x.body.getReader();while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>max){await reader.cancel();throw Error('PDF er større enn 100 MiB.');}chunks.push(p.value);}}
   else {const b=await x.arrayBuffer();if(b.byteLength>max)throw Error('PDF er større enn 100 MiB.');chunks.push(b);}
   const blob=new Blob(chunks,{type:'application/pdf'});if(!new TextDecoder().decode(await blob.slice(0,1024).arrayBuffer()).includes('%PDF-'))throw Error('Nedlastingen er ikke en gjenkjent PDF.');
   await freshFile(jf);await freshFile(f);if(String(project.id)!==pid)throw Error('Prosjektet er endret.');return blob;
  }finally{clearTimeout(timer);}
 }
 async function open(r,download){
  const s=pdfState(r);if(s.state!=='linked')throw Error('Bekreft PDF-koblingen først.');
  const pid=String(project.id);let win=null;
  if(!download){win=window.open('about:blank','_blank');if(!win)throw Error('Tillat ny fane/popup for DocLib.');win.opener=null;win.document.title='Laster kontrollrapport';win.document.body.textContent='Henter original PDF fra Trimble Connect...';}
  try{const blob=await pdfBlob(r,s.ref,pid),url=URL.createObjectURL(blob);
   if(download){const a=document.createElement('a');a.href=url;a.download=s.ref.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
   else {if(win.closed){URL.revokeObjectURL(url);return;}win.location.replace(url);const timer=setInterval(()=>{if(win.closed){clearInterval(timer);URL.revokeObjectURL(url);}},10000);setTimeout(()=>{clearInterval(timer);URL.revokeObjectURL(url);},3600000);}
   status(download?'PDF-nedlasting startet.':'Original PDF åpnet i ny fane.','ok');
  }catch(e){win?.close();throw e;}
 }
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-pdf-action]');if(!b||b.disabled)return;b.disabled=true;try{const r=findReport(b.dataset.pdfReport,b.dataset.pdfReportVersion);if(b.dataset.pdfAction==='choose')choose(r);else await open(r,b.dataset.pdfAction==='download');}catch(err){status(err?.name==='AbortError'?'PDF-henting tok for lang tid. Prøv igjen.':(err.message||'PDF kunne ikke åpnes.'),'bad');}finally{b.disabled=false;}});
 window.DocLibPdfTest={version:'1.37-preview.4-test',pdfState,reportKey};
})();
