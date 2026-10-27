import {install as rules} from './rules.js?v=2.01-preview.3';
import {install as engine} from './engine.js?v=2.01-preview.3';
import {install as report} from './report.js?v=2.01-preview.3';
import {initialize} from './state.js?v=2.01-preview.3';
export default Object.freeze({id:'validation',title:'Egenskapsvalidering',legacyMode:'validation',status:'module',create:createValidation});
export function createValidation(host){
 const state={},context=Object.create(null);let active=false,destroyed=false,container=null;
 for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(host)))Object.defineProperty(context,k,{...d,configurable:true,...('value' in d?{writable:true}:{})});
 context.apiRead=(url,options)=>host.apiRead(url,options);
 context.fetchRead=(url,options={})=>{if(!['GET','HEAD'].includes(String(options.method||'GET').toUpperCase()))throw Error('Validator tillater bare lesing.');return host.fetchRead(url,options)};
 context.workspaceModeUI=()=>host.refreshUI();
 for(const install of [rules,engine,report])install(state,context);initialize(state,context);
 const render=state.valRender;state.valRender=()=>{if(active&&!destroyed)render()};
 const api={
  id:'validation',
  mount(hostElement){if(destroyed)throw Error('Validator er lukket permanent.');container=hostElement;active=true;},
  render(){state.valRender();},
  update(){state.valRender();},
  canLeave(){return !state.valBusy;},
  unmount(){if(state.valBusy)return false;active=false;if(container){container.replaceChildren();container.classList.remove('vr-report')}container=null;return true;},
  destroy(){state.valAbort?.abort();active=false;destroyed=true;container?.replaceChildren();container=null;},
  snapshot(){return Object.freeze({active,busy:state.valBusy,hasReport:!!state.valReport,complete:state.valReport?.complete??false,stale:!!state.valReport&&state.valReport.signature!==state.valSelectionSignature(),fileCount:state.valReport?.files.length||0,message:state.valMessage});},
  port:Object.freeze({get valBusy(){return state.valBusy;}})
 };
 return Object.freeze(api);
}
