// File-level metadata service. Never used as Validator object-control evidence.
export function createProperties(context){
const state={};
state.defs = (function(d){const m=new Map();for(const x of context.list(d)){const props=(x.props||[]).map(p=>p.name);m.set(Number(x.idx),{name:x.name||`Pset ${x.idx}`,props});for(const prop of props){const key=`${x.name||`Pset ${x.idx}`}::${prop}`;if(!state.propertyCatalog.has(key))state.propertyCatalog.set(key,{pset:x.name||`Pset ${x.idx}`,property:prop})}}return m});

state.extractAll = (function(d,map){const out={};for(const e of context.list(d))for(const ps of e.psets||[]){const df=map.get(Number(ps.idx));if(!df)continue;for(let i=0;i<df.props.length;i++){const v=ps.values?.[i];if(v==null||String(v).trim()==='')continue;const key=`${df.name}::${df.props[i]}`;if(out[key]===undefined)out[key]=String(v)}}return out});

state.getCache = (function(f){try{return JSON.parse(context.testStorage.getItem(state.key(f))||'null')}catch{return null}});

state.putCache = (function(f,v){try{context.testStorage.setItem(state.key(f),JSON.stringify(v))}catch{}});

state.valueForColumn = (function(r,c){if(c.pset&&c.property)return r.props?.[`${c.pset}::${c.property}`]??'-';if(c.aliases){for(const [k,v] of Object.entries(r.props||{})){const prop=k.split('::').pop();if(c.aliases.some(a=>context.norm(a)===context.norm(prop)))return v}}return '-'});

state.catalogProps = (function(props){for(const full of Object.keys(props||{})){const cut=full.indexOf('::');if(cut<=0)continue;const pset=full.slice(0,cut),property=full.slice(cut+2),key=`${pset}::${property}`;if(!state.propertyCatalog.has(key))state.propertyCatalog.set(key,{pset,property})}});

state.meta = (async function(f){if(f.format!=='ifc')return{m:{props:{}},c:true};const source=context.controlMetadata.cpMmiSourceKey(),c=state.getCache(f),needsControlMMI=context.controlMetadata.cpDeliveryIds.has(String(f.id))&&!!source;if(c&&c.props&&(!needsControlMMI||c.controlPlanMMI?.source===source)){state.catalogProps(c.props);if(c.controlPlanMMI)context.controlMetadata.cpMmiEvidence.set(String(f.id),c.controlPlanMMI);return{m:c,c:true}}const m=encodeURIComponent(f.id),v=f.versionId?`&versionId=${encodeURIComponent(f.versionId)}`:'';const dr=await context.req(`${context.MODEL}/models/${m}/psetdefs?offset=0&top=30000${v}`);if(!dr.ok)return{m:{props:{}},c:false};const dm=state.defs(dr.data);let props={},off=0,total=Infinity,mmi={source,values:[],truncated:false};while(off<total){const er=await context.req(`${context.MODEL}/models/${m}/entities?offset=${off}&top=${context.PAGE}&fields=id&fields=psets${v}`);if(!er.ok)break;Object.assign(props,state.extractAll(er.data,dm));if(needsControlMMI)context.controlMetadata.cpCollectMmi(er.data,dm,mmi);total=Number(er.data?.total??0);const count=Number(er.data?.count??context.list(er.data).length);if(count<=0)break;off+=count}state.catalogProps(props);const result={props};if(needsControlMMI){result.controlPlanMMI=mmi;context.controlMetadata.cpMmiEvidence.set(String(f.id),mmi)}state.putCache(f,result);return{m:result,c:false}});
state.propertyCatalog = (new Map());
state.key = (f=>context.CACHE+f.id+':'+(f.versionId||f.hash||'none'));
return Object.freeze({port:Object.freeze({defs:(...args)=>state.defs(...args),
extractAll:(...args)=>state.extractAll(...args),
get key(){return state.key;},set key(value){state.key=value;},
getCache:(...args)=>state.getCache(...args),
putCache:(...args)=>state.putCache(...args),
valueForColumn:(...args)=>state.valueForColumn(...args),
catalogProps:(...args)=>state.catalogProps(...args),
meta:(...args)=>state.meta(...args),
get propertyCatalog(){return state.propertyCatalog;},set propertyCatalog(value){state.propertyCatalog=value;}})});}
