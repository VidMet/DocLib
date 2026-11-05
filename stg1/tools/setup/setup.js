import {mountViewEditor} from './view-editor.js?v=2.04-preview.7-recovery.4';
import {mountIfcEditor} from './ifc-schema.js?v=2.04-preview.7';
import {availableColumns,normalizeColumns} from '../explorer/columns.js?v=2.04-preview.7';
import {mountPlanSettings} from '../map-view/plan-settings.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.10';
import {enabledTools,normalizeProjectTools,TOOL_IDS} from './project-tools.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.10';
const LABELS={'validation':'IFC-validering','quantity-summary':'Mengdesammenstilling','control-plan':'Kontrollplan','todos':'TODOs','plan':'Planvisning'};
const BUTTONS={'validation':'modeValidation','quantity-summary':'modeQuantities','control-plan':'modeDocuments','todos':'modeTodos','plan':'modePlan'};
const DISPLAY_VERSION='2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.10';
function syncVersion(doc=document){
 const full='DocLib STG1 v'+DISPLAY_VERSION;
 doc.title=full;
 const candidates=[...doc.querySelectorAll('b,strong,a,span,h1,h2')];
 const header=doc.getElementById('doclibVersion')||candidates.find(el=>/^DocLib\s+STG1\s+v/i.test((el.textContent||'').trim()));
 if(header){header.id='doclibVersion';header.textContent=full;}
 const setup=doc.querySelector('.setup-build');if(setup)setup.textContent=DISPLAY_VERSION;
}
syncVersion();
export function installToolVisibility({store,access,document:doc=document}){
 const nav=doc.querySelector('.workspace-nav');if(!nav)return()=>{};
 const ensureTodos=()=>{let b=doc.getElementById('modeTodos');if(!b){b=doc.createElement('button');b.type='button';b.id='modeTodos';b.className='btn';b.textContent='TODOs';nav.appendChild(b);}return b};
 const render=config=>{const enabled=enabledTools(config);for(const id of TOOL_IDS){const b=id==='todos'?ensureTodos():doc.getElementById(BUTTONS[id]);if(b)b.hidden=!enabled.has(id);}const current=doc.querySelector('.workspace-nav .btn[aria-pressed="true"]');if(current?.hidden)doc.getElementById('modeExplorer')?.click();};
 const unsub=store.subscribe(render);return()=>unsub();
}
export function installSetupAccess({access,store,repository,getColumns=()=>[],document:doc=document}){
 const nav=doc.querySelector('.workspace-nav');if(!nav)return()=>{};let button=null,dialog=null,busy=false,unmount=null,readDraft=null,savedDraft='';
 const close=()=>{unmount?.();unmount=null;dialog?.remove();dialog=null;};
 const status=(text,bad=false)=>{const x=dialog?.querySelector('[data-setup-status]');if(x){x.textContent=text;x.className=bad?'setup-status bad':'setup-status';}};
 const open=()=>{syncVersion(doc);if(!access.snapshot().isAdmin)return;if(dialog){dialog.focus();return;}const cfg=store.snapshot();dialog=doc.createElement('section');dialog.tabIndex=-1;dialog.setAttribute('aria-label','Innstillinger (felles)');dialog.className='setup-dialog';dialog.classList.add('doclib-setup-dialog');dialog.innerHTML=`<style>
.doclib-setup-dialog{box-sizing:border-box;width:min(1180px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;border:0;border-radius:12px;padding:24px;background:#fff;color:#111827;font:14px/1.5 Arial,sans-serif;box-shadow:0 18px 60px #0003}
.doclib-setup-dialog::backdrop{background:rgba(25,32,44,.45)}
.doclib-setup-dialog *{box-sizing:border-box}
.doclib-setup-dialog h2{font-size:18px;margin:0 0 14px;font-weight:700}
.doclib-setup-dialog form>p:first-of-type{margin:0 0 24px}
.doclib-setup-dialog fieldset{min-width:0;margin:0 0 28px;padding:18px;border:1px solid #e2e4e9;border-radius:9px;background:#fff}
.doclib-setup-dialog legend{padding:0 8px;font-size:15px;font-weight:700}
.doclib-setup-dialog fieldset:first-of-type label{display:inline-flex;align-items:center;gap:6px;margin:4px 22px 4px 0}
.doclib-setup-dialog button{border:0;border-radius:5px;padding:9px 14px;background:#e9e9ee;color:#111;font:600 13px Arial,sans-serif;cursor:pointer;min-height:34px}
.doclib-setup-dialog button:hover{background:#dcdde5}
.doclib-setup-dialog button:disabled{opacity:.5;cursor:default}
.doclib-setup-dialog button:focus-visible,.doclib-setup-dialog input:focus-visible,.doclib-setup-dialog select:focus-visible{outline:2px solid #1764df;outline-offset:2px}
.doclib-setup-dialog [data-save]{background:#1764df;color:#fff}
.doclib-setup-dialog [data-save]:hover{background:#1254bd}
.doclib-setup-dialog input[type=text],.doclib-setup-dialog input:not([type]),.doclib-setup-dialog select{min-height:34px;padding:7px 8px;border:1px solid #85858e;border-radius:4px;font:13px Arial,sans-serif}
.doclib-setup-dialog select{background:#e9e9ee}
.doclib-setup-dialog input[type=checkbox]{accent-color:#1764df}
.doclib-setup-dialog .setup-view-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 18px}
.doclib-setup-dialog .setup-fixed-columns{display:flex;gap:20px;margin:0 0 12px}
.doclib-setup-dialog .setup-column-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #ededf1}
.doclib-setup-dialog .setup-column-row input[type=text]{width:180px;min-width:100px;flex:0 1 180px}
.doclib-setup-dialog .setup-column-row select{flex:1;min-width:120px}
.doclib-setup-dialog .setup-column-row label{white-space:nowrap}
.doclib-setup-dialog .setup-column-row button{padding:6px 10px;min-height:30px}
.doclib-setup-dialog .setup-column-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
.doclib-setup-dialog small{display:block;color:#596170;font-size:12px;line-height:1.6;margin-top:12px}
.doclib-setup-dialog [data-ifc-schema]>label{display:inline-flex;align-items:center;gap:6px;margin:4px 18px 8px 0}
.doclib-setup-dialog .setup-path{color:#6b7280;font-size:12px;overflow-wrap:anywhere;margin:4px 0 10px}
.doclib-setup-dialog [data-setup-status]{margin:10px 0 18px}
.doclib-setup-dialog form>div:last-child{display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid #ededf1;padding-top:16px}
.doclib-setup-dialog .tool-section{margin:0 0 14px;border:1px solid #e2e4e9;border-radius:10px;background:#fff;overflow:hidden}
.doclib-setup-dialog .tool-section>summary{display:flex;align-items:center;gap:10px;padding:12px 16px;font-weight:700;cursor:pointer;list-style:none;background:#fafbfc}
.doclib-setup-dialog .tool-section>summary::-webkit-details-marker{display:none}
.doclib-setup-dialog .tool-section>summary::before{content:'▸';display:inline-block;width:18px;color:#526071;font-size:17px;line-height:1;transition:transform .15s ease}
.doclib-setup-dialog .tool-section[open]>summary::before{transform:rotate(90deg)}
.doclib-setup-dialog .tool-section>summary:hover{background:#f4f7fb}
.doclib-setup-dialog .tool-section>summary:focus-visible{outline:3px solid #93baff;outline-offset:-3px}
.doclib-setup-dialog .tool-section:has(input[data-tool-toggle]:not(:checked)) .tool-section-body{opacity:.56}
.doclib-setup-dialog .tool-section:has(input[data-tool-toggle]:not(:checked))>summary{color:#657184;background:#f7f8fa}
.doclib-setup-dialog .tool-section-body{padding:16px 18px;border-top:1px solid #edf0f4}.doclib-setup-dialog .tool-section-summary{margin-left:auto;display:inline-flex;gap:7px;font-size:13px;color:#4f5b6c}.doclib-setup-dialog .coming-soon{color:#7b8492;font-size:13px;font-weight:600}.doclib-setup-dialog .future-toggle{opacity:.58;cursor:not-allowed}
@media(max-width:760px){.doclib-setup-dialog{padding:16px}.doclib-setup-dialog fieldset{padding:12px}.doclib-setup-dialog .setup-column-row{flex-wrap:wrap}.doclib-setup-dialog .setup-column-row select{flex-basis:55%}}
</style><form method="dialog"><h2>Innstillinger (felles)</h2><p class="setup-build">2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.10</p><p>Prosjektets felles verktøy og visninger. Utforsker er alltid aktiv.</p><details class="tool-section" open><summary title="Klikk for å åpne eller lukke">Utforsker – prosjektets fellesvisninger <span class="tool-section-summary">Alltid aktiv</span></summary><div class="tool-section-body"><div data-setup-columns></div></div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">IFC-validering <label class="tool-section-summary" onclick="event.stopPropagation()"><input type="checkbox" data-tool-toggle name="validation"${cfg.tools['validation'].enabled?' checked':''}> Aktiv</label></summary><div class="tool-section-body"><div data-ifc-schema></div></div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">Mengdesammenstilling <label class="tool-section-summary" onclick="event.stopPropagation()"><input type="checkbox" data-tool-toggle name="quantity-summary"${cfg.tools['quantity-summary'].enabled?' checked':''}> Aktiv</label></summary><div class="tool-section-body">Ingen nye fellesinnstillinger i dette trinnet.</div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">Planvisning <label class="tool-section-summary" onclick="event.stopPropagation()"><input type="checkbox" data-tool-toggle name="plan"${cfg.tools['plan'].enabled?' checked':''}> Aktiv</label></summary><div class="tool-section-body"><div data-plan-settings></div></div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">Kontrollplan <label class="tool-section-summary" onclick="event.stopPropagation()"><input type="checkbox" data-tool-toggle name="control-plan"${cfg.tools['control-plan'].enabled?' checked':''}> Aktiv</label></summary><div class="tool-section-body">Ingen nye fellesinnstillinger i dette trinnet.</div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">TODOs <label class="tool-section-summary future-toggle" onclick="event.stopPropagation()"><input type="checkbox" disabled> Aktiv</label></summary><div class="tool-section-body"><span class="coming-soon">Kommer senere</span></div></details><details class="tool-section"><summary title="Klikk for å åpne eller lukke">Oppgaver (BCF) <label class="tool-section-summary future-toggle" onclick="event.stopPropagation()"><input type="checkbox" disabled> Aktiv</label></summary><div class="tool-section-body"><span class="coming-soon">Kommer senere</span></div></details><p class="setup-path">Lagring: Extension_config/DocLib/doclib.tools.json</p><p data-setup-status>${store.source()==='project'?'Prosjektoppsett lastet.':'Ingen prosjektfil funnet. Alle prosjektverktøy er på som standard.'}</p><details data-diagnostics hidden><summary>Opplastingsdiagnostikk</summary><pre></pre><button type="button" data-copy>Kopier diagnostikk</button></details><div><button type="button" data-save>Lagre prosjektoppsett</button><button type="button" data-reload>Last prosjektoppsett</button><button type="button" data-close>Lukk</button></div></form>`;let columnEditor,ifcEditor,planEditor;const renderColumns=config=>{columnEditor=mountViewEditor(dialog.querySelector('[data-setup-columns]'),config,getColumns(),doc);ifcEditor=mountIfcEditor(dialog.querySelector('[data-ifc-schema]'),config.requirements?.ifc,doc);planEditor=mountPlanSettings(dialog.querySelector('[data-plan-settings]'),config,doc)};renderColumns(cfg);dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-reload]').onclick=async()=>{if(busy)return;if(!window.confirm('Hent siste prosjektoppsett? Ulagrede valg i dialogen erstattes.'))return;busy=true;try{const loaded=await repository.read();store.set(loaded.config,loaded.source);const cfg=store.snapshot();for(const id of TOOL_IDS)dialog.querySelector(`[name="${id}"]`).checked=cfg.tools[id].enabled;renderColumns(cfg);savedDraft=readDraft();status('Siste prosjektoppsett er lastet.');}catch(error){status(error.message,true);}finally{busy=false;}};dialog.querySelector('[data-save]').onclick=async()=>{if(busy||!access.snapshot().isAdmin)return;busy=true;dialog.querySelector('[data-save]').disabled=true;status('Lagrer til Trimble Connect …');try{const next=normalizeProjectTools({schema:'DocLibProjectTools',schemaVersion:1,tools:Object.fromEntries(TOOL_IDS.map(id=>[id,{enabled:id==='todos'?cfg.tools[id].enabled:dialog.querySelector(`[name="${id}"]`).checked}]))});const diagnosticsBox=dialog.querySelector('[data-diagnostics]');if(diagnosticsBox)diagnosticsBox.hidden=true;next.explorer=columnEditor.snapshot();next.requirements={ifc:ifcEditor.get()};next.plan=planEditor.snapshot();const saved=await repository.save(next);store.set(saved.config,'project');savedDraft=readDraft();status('Prosjektoppsettet er lagret og menyen er oppdatert.');}catch(error){status(error.message||String(error),true);const box=dialog?.querySelector('[data-diagnostics]');if(box&&error.setupDiagnostics){const text=JSON.stringify(error.setupDiagnostics,null,2);box.hidden=false;box.querySelector('pre').textContent=text;box.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(text);status('Diagnostikk kopiert. Ingen token, ID-er eller signerte URL-er er tatt med.');}catch{status('Kopiering feilet. Marker diagnostikkteksten manuelt.',true);}};}}finally{busy=false;if(dialog)dialog.querySelector('[data-save]').disabled=false;}};readDraft=()=>JSON.stringify({tools:TOOL_IDS.map(id=>[id,id==='todos'?cfg.tools[id].enabled:dialog.querySelector(`[name="${id}"]`).checked]),explorer:columnEditor.snapshot(),ifc:ifcEditor.get(),plan:planEditor.snapshot()});savedDraft=readDraft();unmount=mountSetupWorkspace(dialog,nav,button,()=>{if(busy)return true;try{return readDraft()!==savedDraft;}catch{return true;}},close,()=>busy,doc);dialog.querySelector('[data-close]').onclick=()=>{if(busy)return;if(readDraft()!==savedDraft){askDiscard(doc,close);}else close();};};
 const render=state=>{if(state.isAdmin&&!button){button=doc.createElement('button');button.type='button';button.id='modeSetup';button.className='btn';button.textContent='Innstillinger (felles)';button.onclick=open;nav.appendChild(button);}if(!state.isAdmin&&button){button.remove();button=null;close();}};
 const unsub=access.subscribe(render);return()=>{unsub();button?.remove();close();};
}

function askDiscard(doc,discard){
 if(doc.querySelector('[data-setup-discard]'))return;
 const previous=doc.activeElement,prompt=doc.createElement('dialog');prompt.dataset.setupDiscard='';prompt.className='doclib-discard-prompt';prompt.setAttribute('aria-labelledby','doclib-discard-title');prompt.setAttribute('aria-describedby','doclib-discard-description');
 const style=doc.createElement('style');style.textContent=`
 dialog.doclib-discard-prompt{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-width:calc(100vw - 32px);padding:28px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;color:#172033;box-shadow:0 24px 80px #0f172a38;font:14px/1.6 Arial,sans-serif}
 dialog.doclib-discard-prompt::backdrop{background:rgba(15,23,42,.42);backdrop-filter:blur(3px)}
 .doclib-discard-prompt h2{margin:0 0 8px;font-size:21px;line-height:1.3}.doclib-discard-prompt p{margin:0 0 24px;color:#596579}.doclib-discard-prompt .discard-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.doclib-discard-prompt button{min-height:42px;padding:10px 16px;border:1px solid #d5dce7;border-radius:9px;background:#fff;color:#9f2533;font:600 14px Arial,sans-serif;cursor:pointer}.doclib-discard-prompt button[data-stay]{background:#1764df;border-color:#1764df;color:#fff}.doclib-discard-prompt button:hover{filter:brightness(.96)}.doclib-discard-prompt button:focus-visible{outline:3px solid #93baff;outline-offset:3px}`;
 const title=doc.createElement('h2');title.id='doclib-discard-title';title.textContent='Ulagrede endringer';
 const text=doc.createElement('p');text.id='doclib-discard-description';text.textContent='Du har endret fellesinnstillingene. Vil du fortsette å redigere, eller forkaste endringene og gå videre?';
 const actions=doc.createElement('div');actions.className='discard-actions';
 const stay=doc.createElement('button');stay.type='button';stay.dataset.stay='';stay.textContent='Bli her';
 const leave=doc.createElement('button');leave.type='button';leave.textContent='Forkast endringer';
 actions.append(leave,stay);prompt.append(style,title,text,actions);doc.body.append(prompt);
 const remove=()=>{prompt.close();prompt.remove();previous?.focus?.();};stay.onclick=remove;leave.onclick=()=>{remove();discard();};prompt.addEventListener('cancel',e=>{e.preventDefault();remove();});prompt.showModal();stay.focus();
}
function mountSetupWorkspace(panel,nav,button,isDirty,close,isBusy,doc){
 const workspace=doc.querySelector('main.workspace');const target=workspace&&Array.from(workspace.children).find(x=>x.tagName==='SECTION');
 if(!target)throw Error('Finner ikke arbeidsområdet for Innstillinger (felles).');
 const children=Array.from(target.children).map(node=>({node,display:node.style.getPropertyValue('display'),priority:node.style.getPropertyPriority('display')}));
 const active=Array.from(nav.querySelectorAll('button')).map(node=>[node,node.getAttribute('aria-pressed')]);
 const style=doc.createElement('style');style.textContent='.doclib-setup-dialog.setup-workspace{display:block;position:relative;inset:auto;width:100%;max-width:none;max-height:none;height:auto;margin:0;border:0;box-shadow:none;padding:20px;background:white;color:#111}.setup-workspace .setup-actions{position:sticky;bottom:0;background:white;padding:14px 0;z-index:2}.setup-workspace [data-close]{margin-left:auto}.workspace-nav #modeSetup[aria-pressed="true"]{background:#1764df;color:white}';
 panel.classList.add('setup-workspace');panel.prepend(style);
 // Reuse the original buttons and their existing handlers, rather than cloning them.
 const form=panel.querySelector('form'),actions=panel.querySelector('[data-save]')?.parentElement;
 if(!form||!actions)throw Error('Finner ikke handlingslinjen for prosjektoppsettet.');
 actions.classList.add('setup-actions');actions.setAttribute('role','group');actions.setAttribute('aria-label','Prosjektoppsett');
 const build=form.querySelector('.setup-build'),heading=form.querySelector('h2');
 if(build)build.after(actions);else if(heading)heading.after(actions);else form.prepend(actions);
 panel.querySelector('[data-save]').textContent='Lagre prosjektoppsettet';panel.querySelector('[data-reload]').textContent='Last prosjektoppsettet';
 style.textContent+=`.doclib-setup-dialog.setup-workspace{overflow:hidden!important;max-height:calc(100vh - 150px)!important;height:calc(100vh - 150px)!important;min-height:0}.doclib-setup-dialog.setup-workspace form{overflow-y:auto!important;overflow-x:hidden!important;height:100%!important;max-height:100%!important;padding-right:10px;scrollbar-gutter:stable}.doclib-setup-dialog.setup-workspace form{display:block!important}.doclib-setup-dialog.setup-workspace .setup-actions{display:flex!important;visibility:visible!important;opacity:1!important;position:sticky!important;top:0!important;bottom:auto!important;flex-wrap:wrap;gap:10px;align-items:center;min-height:62px;margin:0 0 24px;padding:12px 0;background:#fff;border-top:0;border-bottom:1px solid #e2e8f0;z-index:10}.doclib-setup-dialog.setup-workspace .setup-actions button{display:inline-flex!important;align-items:center;visibility:visible!important;min-height:40px}.doclib-setup-dialog.setup-workspace .setup-actions [data-save]{background:#1764df;color:#fff}`;

 children.forEach(({node})=>node.style.setProperty('display','none','important'));target.append(panel);
 active.forEach(([node])=>node.setAttribute('aria-pressed',String(node===button)));button?.setAttribute('aria-pressed','true');
 const guard=e=>{const destination=e.target.closest?.('.workspace-nav button');if(!destination||destination===button)return;
 if(isBusy()){e.preventDefault();e.stopImmediatePropagation();return;}
 if(isDirty()){e.preventDefault();e.stopImmediatePropagation();askDiscard(doc,()=>{close();destination.click();});return;}close();};
 doc.addEventListener('click',guard,true);
 const unload=e=>{if(isDirty()){e.preventDefault();e.returnValue='';}};doc.defaultView?.addEventListener('beforeunload',unload);
 panel.focus();return()=>{doc.removeEventListener('click',guard,true);doc.defaultView?.removeEventListener('beforeunload',unload);children.forEach(({node,display,priority})=>{if(display)node.style.setProperty('display',display,priority);else node.style.removeProperty('display');});active.forEach(([node,value])=>{if(value===null)node.removeAttribute('aria-pressed');else node.setAttribute('aria-pressed',value);});button?.setAttribute('aria-pressed','false');};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>syncVersion(document),{once:true});else syncVersion(document);
