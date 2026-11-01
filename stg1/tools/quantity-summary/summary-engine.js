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
// Round leaf cells once, then rebuild parent totals from those rounded cells.
export function roundingSettings(config={}) {
  const decimals=Number(config.decimals ?? 0), step=Number(config.roundStep ?? 10);
  const mode=config.roundMode || 'normal';
  if(!Number.isInteger(decimals)||decimals<0||decimals>6) throw Error('Velg 0 til 6 desimaler.');
  if(!['normal','up','down'].includes(mode)||![1,10,100,1000,10000].includes(step)) throw Error('Ugyldig avrundingsvalg.');
  return {decimals,step,mode};
}
export function roundCell(value,config={}) {
  const {decimals,step,mode}=roundingSettings(config);
  const quantum=mode==='normal'?10**(-decimals):step;
  let scaled=value/quantum;
  const integer=Math.round(scaled);
  if(Math.abs(scaled-integer)<=Math.min(1e-7,Number.EPSILON*8*Math.max(1,Math.abs(scaled))))scaled=integer;
  const rounded=mode==='up'?Math.ceil(scaled):mode==='down'?Math.floor(scaled):Math.sign(scaled)*Math.floor(Math.abs(scaled)+0.5+Math.min(1e-7,Number.EPSILON*8*Math.max(1,Math.abs(scaled))));
  const result=Number((rounded*quantum).toFixed(decimals));
  return Object.is(result,-0)?0:result;
}
function rebuildRounded(node,config) {
  if(!node.children.size){for(const cell of node.cells.values()){cell.rawSum=cell.sum;cell.sum=roundCell(cell.sum,{decimals:config.decimals,roundMode:config.mode,roundStep:config.step});}return;}
  node.cells=new Map();
  for(const child of node.children.values()){
    rebuildRounded(child,config);
    for(const [key,cell] of child.cells){
      const old=node.cells.get(key)||{sum:0,count:0};
      node.cells.set(key,{sum:Number((old.sum+cell.sum).toFixed(config.decimals)),count:old.count+cell.count});
    }
  }
}
export function summarize(entities, config) {
  const rounding=roundingSettings(config);
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
  rebuildRounded(root,rounding);
  return {root,columns:[...columns.values()].sort((a,b)=>a.code.localeCompare(b.code,'nb',{numeric:true})||a.unit.localeCompare(b.unit,'nb')),issues,stats:{objects:entities.length,included,missing,invalid,missingColumn,missingGroup,missingUnit}};
}
