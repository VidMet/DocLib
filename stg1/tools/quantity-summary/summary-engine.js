import {filterIfcEntities} from './ifc-filter.js?v=2.04-preview.2-fix.2';
import {objectLabel} from './view-options.js?v=2.04-preview.2-fix.2';
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
export function columnRounding(config,key){
  const override=config.columnOverrides?.[key];
  if(!override||override.mode==='inherit')return {...config};
  if(override.mode==='decimals')return {...config,roundMode:'normal'};
  if(override.mode==='step'){
    const result={...config,roundStep:Number(override.step)};roundingSettings(result);return result;
  }
  throw Error('Ugyldig kolonneavrunding.');
}
export function summarize(entities, config) {
  const filtered=filterIfcEntities(entities);
  if(filtered.unknownCount)throw Error(`IFC-klasse mangler for ${filtered.unknownCount} objekter. Beregning og eksport er sperret fordi strukturobjekter ikke kan identifiseres sikkert. Kontroller at metadata inneholder IFC-klasse (for eksempel IfcClass eller IfcEntity). Objektnavn brukes ikke til klassifisering.`);
  entities=filtered.entities;
  const rounding=roundingSettings(config);
  const roundScope=config.roundScope||'final';
  if(!['final','group1','group2','group3'].includes(roundScope))throw Error('Ugyldig avrundingsnivå.');
  const slots=(config.groups||[]).slice(0,3);
  const groupSlots=slots.map((key,index)=>({key,index})).filter(slot=>slot.key);
  const groups=groupSlots.map(slot=>slot.key);
  const targetIndex=roundScope==='final'?-1:Number(roundScope.slice(-1))-1;
  if(targetIndex>=0&&!slots[targetIndex])throw Error('Valgt avrundingsgruppe er ikke i bruk. Velg en aktiv gruppe eller Kun totalsum.');
  if (new Set(groups).size !== groups.length) throw Error('Samme grupperingsnivå kan ikke velges flere ganger.');
  if (!config.column || !config.quantity) throw Error('Velg kolonneegenskap og mengdeegenskap.');
  const root={children:new Map(),cells:new Map(),count:0};
  const columns=new Map(), issues=[];
  let included=0, missing=0, invalid=0, missingColumn=0, missingGroup=0, missingUnit=0;
  for (const entity of entities) {
    const props=entity.properties||{}, raw=props[config.quantity];
    const issue=(reason,value=raw)=>{const label=objectLabel(entity,config.nameProperty);issues.push({modelName:entity.modelName,entityId:entity.entityId,entityName:label.name,nameSource:label.source,entityType:entity.entityType||'',reason,value:value??''});};
    if(absent(raw)){missing++;issue('Mangler mengde');continue;}
    let value=parseQuantity(raw);
    if(value===null){invalid++;issue('Ugyldig mengde');continue;}
    const code=absent(props[config.column])?null:String(props[config.column]);
    if(code===null){missingColumn++;issue('Mangler kolonneverdi',props[config.column]);continue;}
    const unit=config.unit?(absent(props[config.unit])?null:String(props[config.unit])):'';
    if(config.unit && unit===null){missingUnit++;issue('Mangler enhet',props[config.unit]);continue;}
    const labels=groups.map(key=>key===MODEL?String(entity.modelName||entity.modelId):absent(props[key])?null:String(props[key]));
    if(labels.some(label=>label===null)){missingGroup++;issue('Mangler grupperingsverdi');}
    const key=JSON.stringify([code,unit]);
    if(!columns.has(key)) columns.set(key,{key,code,unit,descriptions:[]});
    const description=props[config.descriptionProperty];
    if(!absent(description)&&!columns.get(key).descriptions.includes(String(description)))columns.get(key).descriptions.push(String(description));
    included++;root.count++;add(root.cells,key,value);
    let node=root;
    labels.forEach((label,depth)=>{
      const childKey=JSON.stringify([label,groups[depth]===MODEL?entity.modelId:null]);
      if(!node.children.has(childKey)) node.children.set(childKey,{label:label??'(Mangler verdi)',missing:label===null,depth,groupIndex:groupSlots[depth].index,path:[],children:new Map(),cells:new Map(),count:0});
      const child=node.children.get(childKey);child.path=[...(node.path||[]),childKey];child.count++;add(child.cells,key,value);node=child;
    });
  }
  const decimalConfig={...config,roundMode:'normal'};
  const cloneCells=cells=>new Map([...cells].map(([key,cell])=>[key,{...cell}]));
  function calculate(node,isRoot=false){
    const leaf=!node.children.size;
    if(leaf){
      node.rawCells=cloneCells(node.cells);
      for(const cell of node.cells.values())cell.sum=roundCell(cell.sum,decimalConfig);
    }else{
      node.cells=new Map();
      for(const child of node.children.values()){
        calculate(child);
        for(const [key,cell] of child.cells){
          const old=node.cells.get(key)||{sum:0,count:0};
          node.cells.set(key,{sum:Number((old.sum+cell.sum).toFixed(rounding.decimals)),count:old.count+cell.count});
        }
      }
    }
    node.baseCells=cloneCells(node.cells);
    node.differences=new Map();
    node.roundedHere=isRoot?roundScope==='final':node.groupIndex===targetIndex;
    if(node.roundedHere)for(const [key,cell] of node.cells){
      // At a leaf use its raw sum, never pre-round raw IFC objects.
      const input=leaf?node.rawCells.get(key).sum:cell.sum;
      const rounded=roundCell(input,columnRounding(config,key));
      node.differences.set(key,{sum:Number((rounded-cell.sum).toFixed(rounding.decimals)),count:0});
      cell.sum=rounded;
    }
  }
  calculate(root,true);
  // Baseline is the same grouping/decimal calculation with no coarse rounding.
  function baseline(node){
    if(!node.children.size)return new Map([...node.rawCells].map(([key,cell])=>[key,roundCell(cell.sum,decimalConfig)]));
    const totals=new Map();for(const child of node.children.values())for(const [key,value] of baseline(child))totals.set(key,Number(((totals.get(key)||0)+value).toFixed(rounding.decimals)));return totals;
  }
  const unroundedTotals=baseline(root);
  for(const column of columns.values()){
    column.descriptions.sort((a,b)=>a.localeCompare(b,'nb'));
    const before=unroundedTotals.get(column.key)||0,after=root.cells.get(column.key)?.sum||0;
    const difference=Number((after-before).toFixed(rounding.decimals));
    column.rounding={mode:config.columnOverrides?.[column.key]?.mode||'inherit',effectiveMode:columnRounding(config,column.key).roundMode||'normal',step:Number(columnRounding(config,column.key).roundStep??10),before,after,difference,percent:before===0?null:difference/Math.abs(before)*100};
  }
  const baseTotals=root.baseCells;
  const differences=root.differences;
  return {root,baseTotals,differences,roundScope,columns:[...columns.values()].sort((a,b)=>a.code.localeCompare(b.code,'nb',{numeric:true})||a.unit.localeCompare(b.unit,'nb')),issues,stats:{objects:entities.length,included,missing,invalid,missingColumn,missingGroup,missingUnit}};
}
