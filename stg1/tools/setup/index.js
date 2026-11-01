const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installSetupAccess({access,document:doc=document}){
 const nav=doc.querySelector('.workspace-nav');if(!nav)return()=>{};let button=null,dialog=null;
 const close=()=>{dialog?.close();};
 const open=()=>{
  const state=access.snapshot();if(!state.isAdmin)return;
  dialog=doc.createElement('dialog');dialog.className='setup-preview-dialog';dialog.innerHTML=`<section><h2>Setup</h2><p><strong>Trimble Connect-rolle:</strong> Prosjektadministrator</p><p>Rolleoppslaget er aktivt. Verktøyvalg og prosjekt-JSON kommer i neste trinn.</p><details><summary>Diagnostikk</summary><dl><dt>Status</dt><dd>${esc(state.state)}</dd><dt>Rolle</dt><dd>${esc(state.roles.join(', ')||'Ikke oppgitt')}</dd></dl></details><button type="button">Lukk</button></section>`;doc.body.appendChild(dialog);dialog.querySelector('button').addEventListener('click',close);dialog.addEventListener('close',()=>{dialog.remove();dialog=null;},{once:true});dialog.showModal();
 };
 const render=state=>{
  if(state.isAdmin&&!button){button=doc.createElement('button');button.type='button';button.id='modeSetup';button.className='btn';button.textContent='Setup';button.addEventListener('click',open);nav.appendChild(button);}
  if(!state.isAdmin&&button){button.remove();button=null;close();}
  nav.dataset.setupAccess=state.state;
 };
 const unsubscribe=access.subscribe(render);return()=>{unsubscribe();button?.remove();close();};
}
