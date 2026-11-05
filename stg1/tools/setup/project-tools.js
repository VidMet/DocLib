import {normalizeIfcRequirement} from './ifc-schema.js?v=2.04-preview.7';
import {normalizeColumns,normalizeDefinitions} from '../explorer/columns.js?v=2.04-preview.7';
import {normalizeIfcObjectLayer} from '../map-view/ifc-object-layer-config.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.11';
export const FILE_NAME='doclib.tools.json';
export const TOOL_IDS=Object.freeze(['validation','quantity-summary','control-plan','todos','plan']);
export const DEFAULT_CONFIG=Object.freeze({schema:'DocLibProjectTools',schemaVersion:1,tools:Object.freeze(Object.fromEntries(TOOL_IDS.map(id=>[id,Object.freeze({enabled:true})])))});
const clone=value=>JSON.parse(JSON.stringify(value));
function normalizePlan(raw){const layers=[],ids=new Set(),baseMap=['flyfoto','vektorkart','grunnkart','none'].includes(raw?.baseMap)?raw.baseMap:'flyfoto';for(const item of Array.isArray(raw?.layers)?raw.layers:[]){if(layers.length>=20)break;try{const id=String(item?.id||''),name=String(item?.name||'').trim().slice(0,100),layer=String(item?.layer||'').trim().slice(0,200),url=new URL(String(item?.url||'')),host=url.hostname.toLowerCase();const blocked=host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='[::1]'||host.startsWith('10.')||host.startsWith('127.')||host.startsWith('192.168.')||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||ids.has(id)||!name||!layer||url.protocol!=='https:'||url.username||url.password||url.hash||url.search||blocked)continue;ids.add(id);layers.push({id,name,url:url.href.replace(/\/$/,''),layer,visibleByDefault:item?.visibleByDefault===true,attribution:String(item?.attribution||'').trim().slice(0,200)});}catch{}}return{baseMap,layers,ifcObjectLayer:normalizeIfcObjectLayer(raw?.ifcObjectLayer)};}
export function normalizeProjectTools(raw){
 const valid=raw?.schema==='DocLibProjectTools'&&raw?.schemaVersion===1;const value={schema:'DocLibProjectTools',schemaVersion:1,tools:{},explorer:{columns:normalizeColumns(valid?raw?.explorer?.columns:undefined)},plan:normalizePlan(valid?raw?.plan:undefined)};
 const definitions=normalizeDefinitions(valid?raw?.explorer?.definitions:null);if(definitions!==null)value.explorer.definitions=definitions;
 for(const id of TOOL_IDS)value.tools[id]={enabled:valid?(raw?.tools?.[id]?.enabled===true||(id==='plan'&&raw?.tools?.[id]?.enabled===undefined)):true};
 value.requirements={ifc:normalizeIfcRequirement(valid?raw?.requirements?.ifc:null)};
 const views=valid&&Array.isArray(raw?.explorer?.views)?raw.explorer.views:[];const ids=new Set();
 value.explorer.views=views.filter(v=>v&&typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v.id)&&!['__proto__','constructor','prototype'].includes(v.id)&&!ids.has(v.id)&&ids.add(v.id)).map(v=>({id:v.id,name:String(v.name||v.id).slice(0,120),columns:normalizeColumns(v.columns),...(normalizeDefinitions(v.definitions)!==null?{definitions:normalizeDefinitions(v.definitions)}:{})}));
 if(!value.explorer.views.length)value.explorer.views=[{id:'project-standard',name:'Prosjektstandard',columns:clone(value.explorer.columns),...(value.explorer.definitions?{definitions:clone(value.explorer.definitions)}:{})}];
 value.explorer.defaultViewId=value.explorer.views.some(v=>v.id===raw?.explorer?.defaultViewId)?raw.explorer.defaultViewId:value.explorer.views[0].id;
 const defaultView=value.explorer.views.find(v=>v.id===value.explorer.defaultViewId);value.explorer.columns=clone(defaultView.columns);if(defaultView.definitions)value.explorer.definitions=clone(defaultView.definitions);else delete value.explorer.definitions;
 return value;
}
export function enabledTools(config){const normalized=normalizeProjectTools(config);return new Set(TOOL_IDS.filter(id=>normalized.tools[id].enabled));}
export function createProjectToolsStore(){let config=normalizeProjectTools(DEFAULT_CONFIG),source='default',listeners=new Set();const publish=(next,nextSource)=>{config=normalizeProjectTools(next);source=nextSource;for(const fn of listeners)fn(config,source);return config;};return Object.freeze({snapshot:()=>clone(config),source:()=>source,subscribe(fn){listeners.add(fn);fn(clone(config),source);return()=>listeners.delete(fn);},set:(next,nextSource='memory')=>publish(next,nextSource)});}
