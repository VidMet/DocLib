import {environment} from './config/environment.js?v=2.01-preview.2';
import {createToolRegistry} from './core/tool-registry.js?v=2.01-preview.2';
import explorer from './tools/explorer/index.js?v=2.01-preview.2';
import validation from './tools/validation/index.js?v=2.01-preview.2';
import controlPlan from './tools/control-plan/index.js?v=2.01-preview.2';
import todos from './tools/todos/index.js?v=2.01-preview.2';
const registry=createToolRegistry();[explorer,validation,controlPlan,todos].forEach(t=>registry.register(t));
function loadScript(path){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path+'?v='+environment.version,import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(Error('Kunne ikke laste '+path));document.head.appendChild(script);});}
async function start(){
 try{
  for(const path of ['core/storage.js','core/network-policy.js','shared/legacy-runtime.js','core/diagnostics.js','core/auth.js','core/api.js','core/legacy-bridge.js'])await loadScript(path);
  const bridge=window.DocLibLegacyBridge;
  const control=controlPlan.create(bridge.createControlContext());
  registry.attach('control-plan',control,document.getElementById('workspacePlaceholder'));
  bridge.attachControlPlan(control.port,registry);
  registry.activate('explorer');
  window.addEventListener('beforeunload',e=>{if(control.snapshot().hasUnsavedChanges){e.preventDefault();e.returnValue='';}});
  window.DocLibTest=Object.freeze({environment,tools:registry.list(),bridge,controlPlan:control});
  await window.DocLibLegacyBridge.start();
 }catch(error){const status=document.getElementById('status');if(status){status.textContent='Oppstartsfeil: '+error.message;status.className='status bad';}console.error('[DocLib TEST startup]',error);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
