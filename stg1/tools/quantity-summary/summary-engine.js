// Pure object-level aggregation. No network access and no unit conversion.
export const MODEL = '@model';
export function parseQuantity(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  // Accept one decimal separator; do not guess ambiguous thousands separators.
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}
export function catalog(entities) {
  const keys = new Set();
  for (const entity of entities) Object.keys(entity.properties || {}).forEach(key => keys.add(key));
  return [...keys].sort((a,b)=>a.localeCompare(b,'nb',{numeric:true}));
}
const absent = value => value == null || String(value).trim() === '';
const add = (map,key,value) => { const old=map.get(key)||{sum:0,count:0}; map.set(key,{sum:old.sum+value,count:old.count+1}); };
export function summarize(entities, config) {
  const groups = (config.groups || []).filter(Boolean);
  if (new Set(groups).size !== groups.length) throw Error('Samme grupperingsnivå kan ikke velges flere ganger.');
  if (!config.column || !config.quantity) throw Error('Velg kolonneegenskap og mengdeegenskap.');
  const root={children:new Map(),cells:new Map(),count:0};
  const columns=new Map(), issues=[];
  let included=0, missing=0, invalid=0, missingColumn=0, missingGroup=0, missingUnit=0;
  for (const entity of entities) {
    const props=entity.properties||{}, raw=props[config.quantity];
    const issue=reason=>issues.push({modelName:entity.modelName,entityId:entity.entityId,reason,value:raw??''});
    if(absent(raw)){missing++;issue('Mangler mengde');continue;}
    const value=parseQuantity(raw);
    if(value===null){invalid++;issue('Ugyldig mengde');continue;}
    const code=absent(props[config.column])?null:String(props[config.column]);
    if(code===null){missingColumn++;issue('Mangler kolonneverdi');continue;}
    const unit=config.unit?(absent(props[config.unit])?null:String(props[config.unit])):'';
    if(config.unit && unit===null){missingUnit++;issue('Mangler enhet');continue;}
    const labels=groups.map(key=>key===MODEL?String(entity.modelName||entity.modelId):absent(props[key])?null:String(props[key]));
    if(labels.some(label=>label===null)){missingGroup++;issue('Mangler grupperingsverdi');}
    const key=JSON.stringify([code,unit]);
    if(!columns.has(key)) columns.set(key,{key,code,unit});
    included++;root.count++;add(root.cells,key,value);
    let node=root;
    labels.forEach((label,depth)=>{
      const childKey=JSON.stringify([label,groups[depth]===MODEL?entity.modelId:null]);
      if(!node.children.has(childKey)) node.children.set(childKey,{label:label??'(Mangler verdi)',missing:label===null,depth,path:[],children:new Map(),cells:new Map(),count:0});
      const child=node.children.get(childKey);child.path=[...(node.path||[]),childKey];child.count++;add(child.cells,key,value);node=child;
    });
  }
  return {root,columns:[...columns.values()].sort((a,b)=>a.code.localeCompare(b.code,'nb',{numeric:true})||a.unit.localeCompare(b.unit,'nb')),issues,stats:{objects:entities.length,included,missing,invalid,missingColumn,missingGroup,missingUnit}};
}
