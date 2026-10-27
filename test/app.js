import {createFileTree} from './shared/file-tree.js?v=2.01-preview.4';
import {createProperties} from './shared/properties.js?v=2.01-preview.4';
import {environment} from './config/environment.js?v=2.01-preview.4';
import {createToolRegistry} from './core/tool-registry.js?v=2.01-preview.4';
import explorer from './tools/explorer/index.js?v=2.01-preview.4';
import validation from './tools/validation/index.js?v=2.01-preview.4';
import controlPlan from './tools/control-plan/index.js?v=2.01-preview.4';
import todos from './tools/todos/index.js?v=2.01-preview.4';
const registry=createToolRegistry();[explorer,validation,controlPlan,todos].forEach(t=>registry.register(t));
function loadScript(path){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path+'?v='+environment.version,import.meta.url).href;script.onload=resolve;script.onerror=()=>reject(Error('Kunne ikke laste '+path));document.head.appendChild(script);});}
async function start(){
 try{
  for(const path of ['core/storage.js','core/network-policy.js','shared/legacy-runtime.js','core/diagnostics.js','core/auth.js','core/api.js','core/legacy-bridge.js'])await loadScript(path);
  const bridge=window.DocLibLegacyBridge,host=document.getElementById('workspacePlaceholder');
  const tree=createFileTree(bridge.createTreeContext()),properties=createProperties(bridge.createPropertiesContext());
  bridge.attachShared(tree.port,properties.port);
  const explorerTool=explorer.create(bridge.createExplorerContext());bridge.attachExplorer(explorerTool.port);
  registry.attach('explorer',explorerTool,document.getElementById('explorerContent'));tree.mount();
  const control=controlPlan.create(bridge.createControlContext()),validator=validation.create(bridge.createValidationContext());
  registry.attach('control-plan',control,host);registry.attach('validation',validator,host);
  bridge.attachControlPlan(control.port,registry);bridge.attachValidation(validator.port);
  registry.activate('explorer');
  window.addEventListener('beforeunload',e=>{if(control.snapshot().hasUnsavedChanges||validator.snapshot().busy){e.preventDefault();e.returnValue='';}});
  window.DocLibTest=Object.freeze({environment,tools:registry.list(),bridge,controlPlan:control,validation:validator,explorer:explorerTool});
  await bridge.start();
 }catch(error){const status=document.getElementById('status');if(status){status.textContent='Oppstartsfeil: '+error.message;status.className='status bad';}console.error('[DocLib TEST startup]',error);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
