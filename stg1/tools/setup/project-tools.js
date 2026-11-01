export const FILE_NAME='doclib.tools.json';
export const TOOL_IDS=Object.freeze(['validation','quantity-summary','control-plan','todos']);
export const DEFAULT_CONFIG=Object.freeze({schema:'DocLibProjectTools',schemaVersion:1,tools:Object.freeze(Object.fromEntries(TOOL_IDS.map(id=>[id,Object.freeze({enabled:false})])))});
const clone=value=>JSON.parse(JSON.stringify(value));
export function normalizeProjectTools(raw){
 const value={schema:'DocLibProjectTools',schemaVersion:1,tools:{}};
 for(const id of TOOL_IDS)value.tools[id]={enabled:raw?.schema==='DocLibProjectTools'&&raw?.schemaVersion===1&&raw?.tools?.[id]?.enabled===true};
 return value;
}
export function enabledTools(config){const normalized=normalizeProjectTools(config);return new Set(TOOL_IDS.filter(id=>normalized.tools[id].enabled));}
export function createProjectToolsStore(){let config=clone(DEFAULT_CONFIG),source='default',listeners=new Set();const publish=(next,nextSource)=>{config=normalizeProjectTools(next);source=nextSource;for(const fn of listeners)fn(config,source);return config;};return Object.freeze({snapshot:()=>clone(config),source:()=>source,subscribe(fn){listeners.add(fn);fn(clone(config),source);return()=>listeners.delete(fn);},set:(next,nextSource='memory')=>publish(next,nextSource)});}
