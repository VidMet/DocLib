import {install as reports, compose as reportsCompose} from './reports.js?v=2.01-preview.5';
import {install as requirements} from './requirements.js?v=2.01-preview.5';
import {install as links} from './links.js?v=2.01-preview.5';
import {install as repository, compose as repositoryCompose} from './repository.js?v=2.01-preview.5';
import {install as table, compose as tableCompose} from './table.js?v=2.01-preview.5';
import {install as details} from './details.js?v=2.01-preview.5';
import {initialize} from './state.js?v=2.01-preview.5';
import {install as pdf} from './pdf.js?v=2.01-preview.5';
export default Object.freeze({id:'control-plan',title:'Kontrollplan',legacyMode:'documents',status:'module',create:createControlPlan});
export function createControlPlan(host){
 const cp={active:false,viewController:null,dataController:null};
 const combined=(...signals)=>{const a=signals.filter(Boolean);if(a.length<2)return a[0];if(AbortSignal.any)return AbortSignal.any(a);const c=new AbortController();for(const s of a){if(s.aborted)c.abort();else s.addEventListener('abort',()=>c.abort(),{once:true})}return c.signal;};
 const context=Object.create(null);for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(host))){Object.defineProperty(context,key,{...d,configurable:true,...('value' in d?{writable:true}:{})});}
 context.apiRead=(url,options={})=>{if(!cp.active)throw new DOMException('Kontrollplan er lukket','AbortError');return host.req(url,{...options,signal:combined(options.signal,cp.viewController?.signal)});};
 context.req=(url)=>host.req(url,{signal:cp.dataController?.signal});
 context.fetchRead=(url,options={})=>{
  if(!cp.active)throw new DOMException('Kontrollplan er lukket','AbortError');const method=String(options.method||'GET').toUpperCase();if(!['GET','HEAD'].includes(method))throw Error('Kontrollplan tillater bare lesing.');
  return host.fetchRead(url,{...options,signal:combined(options.signal,cp.viewController?.signal)});
 };
 context.fetchDataRead=(url,options={})=>host.fetchRead(url,{...options,signal:cp.dataController?.signal});
 context.onUnexpectedPdfState=()=>{throw Error('PDF-modulen mangler nødvendig Kontrollplan-grunnlag.');};
 for(const install of [reports,requirements,links,repository,table,details])install(cp,context);
 initialize(cp,context);reportsCompose(cp,context);repositoryCompose(cp,context);tableCompose(cp,context);pdf(cp,context);
 const ready=()=>context.projectState?.phase==='ready';
 const originalRender=cp.cpRender;cp.cpRender=()=>{originalRender();if(cp.active&&!ready())host.$('workspacePlaceholder').querySelectorAll('[data-cp-link-open],[data-cp-link-one],[data-cp-export],[data-pdf-action],[data-test-pdf],[data-cp-check],[data-cp-check-all]').forEach(el=>el.disabled=true);};
 for(const key of ['cpOpenLinkDialog','cpExportLinks']){const original=cp[key];cp[key]=(...args)=>{if(!ready())return;return original(...args);};}
 let hostElement=null,loadTask=Promise.resolve(),destroyed=false;
 const closeDialogs=()=>{for(const id of ['cpLinkDialog','cpPdfChoose']){const d=document.getElementById(id);if(d?.open)d.close();d?.remove()}cp.cpLinkSession=null};
 const api={
  id:'control-plan',
  mount(container){if(destroyed)throw Error('Verktøyet er lukket permanent.');hostElement=container;if(cp.active)return;cp.active=true;cp.viewController=new AbortController();cp.bindPdf?.();},
  render(){if(cp.active)cp.cpRender();},
  update(change={}){if(change.type==='reload')return api.reload();if(change.type==='metadata-complete')cp.cpMetadataComplete=true;api.render();},
  canLeave(){if(cp.cpExportBusy)return false;return !(cp.cpPendingLinks.length||cp.cpLinkSession||document.getElementById('cpPdfChoose')?.open)||confirm('Du har ulagrede kontrollvalg eller koblingsutkast. Forlate Kontrollplan? Ferdige utkast beholdes i økten; uferdige dialogvalg lukkes.');},
  unmount(){if(!cp.active)return;cp.active=false;cp.viewController?.abort();cp.viewController=null;closeDialogs();if(hostElement)hostElement.replaceChildren();hostElement=null;},
  reload(){cp.dataController?.abort();const prior=loadTask;loadTask=(async()=>{await prior.catch(()=>{});if(destroyed)return;cp.dataController=new AbortController();await cp.loadControlPlan();})();return loadTask;},
  destroy(){api.unmount();destroyed=true;cp.dataController?.abort();},
  snapshot(){return Object.freeze({active:cp.active,deliveryCount:cp.cpDeliveryFiles.length,reportCount:cp.cpReports.size,pendingCount:cp.cpPendingLinks.length,hasUnsavedChanges:!!(cp.cpPendingLinks.length||cp.cpLinkSession||document.getElementById('cpPdfChoose')?.open),linkCount:cp.cpConfig?.links.length||0,status:cp.cpStatus,issues:context.projectConfiguration?.controlPlan?[...(!cp.cpConfig?[cp.cpStatus]:[]),...cp.cpIssues,...[...cp.cpReports.values()].filter(x=>!x.ok).map(()=> 'En kontrollrapport kunne ikke leses.')]:[]});},
  // Narrow compatibility port: legacy metadata loading still supplies MMI evidence.
  port:Object.freeze({
   get cpDeliveryIds(){return cp.cpDeliveryIds;},get cpDeliveryFiles(){return cp.cpDeliveryFiles;},get cpMmiEvidence(){return cp.cpMmiEvidence;},
   get cpExportBusy(){return cp.cpExportBusy;},get cpPendingLinks(){return cp.cpPendingLinks;},
   get cpMetadataComplete(){return cp.cpMetadataComplete;},set cpMetadataComplete(v){cp.cpMetadataComplete=!!v;},
   cpMmiSourceKey:()=>cp.cpMmiSourceKey(),cpCollectMmi:(...args)=>cp.cpCollectMmi(...args),
   loadControlPlan:()=>api.reload()
  })
 };
 return Object.freeze(api);
}
