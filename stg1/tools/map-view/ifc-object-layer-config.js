export const DEFAULT_IFC_OBJECT_LAYER=Object.freeze({
 enabled:false,
 defaultColor:'#e85223',
 onlyMatched:false,
 colorRules:Object.freeze([]),
});

const COLOR=/^#[0-9a-f]{6}$/i;
const cleanText=(value,max)=>String(value??'').trim().slice(0,max);
const normalizeDisplayValue=value=>String(value??'').normalize('NFC').replace(/\s+/gu,' ').trim();
const cleanProperty=value=>cleanText(value,200).replace(/\s*:+\s*/,'::');

export function normalizeIfcObjectLayer(raw){
 const colorRules=[];
 for(const source of Array.isArray(raw?.colorRules)?raw.colorRules:[]){
  if(colorRules.length>=3)break;
  const property=cleanProperty(source?.property);
  if(!property)continue;
  const values=[];
  const seen=new Set();
  for(const mapping of Array.isArray(source?.values)?source.values:[]){
   if(values.length>=40)break;
   const value=cleanText(mapping?.value,120);
   const color=String(mapping?.color??'').trim();
   const key=normalizeDisplayValue(value).toLocaleLowerCase('nb-NO');
   if(!value||!COLOR.test(color)||seen.has(key))continue;
   seen.add(key);
   values.push({value,color:color.toLowerCase()});
  }
  colorRules.push({property,values});
 }
 const defaultColor=String(raw?.defaultColor??'').trim();
 return{
  enabled:raw?.enabled===true,
  defaultColor:COLOR.test(defaultColor)?defaultColor.toLowerCase():DEFAULT_IFC_OBJECT_LAYER.defaultColor,
  onlyMatched:raw?.onlyMatched===true,
  colorRules,
 };
}

export function matchIfcObjectColor(properties,rules,defaultColor){
 for(const rule of Array.isArray(rules)?rules:[]){
  const values=properties?.[rule.property];
  const candidates=Array.isArray(values)?values:[values];
  for(const candidate of candidates){
   const value=normalizeDisplayValue(candidate);
   if(!value)continue;
   const mapping=(rule.values||[]).find(item=>normalizeDisplayValue(item.value).toLocaleLowerCase('nb-NO')===value.toLocaleLowerCase('nb-NO'));
   if(mapping)return{color:mapping.color,matched:true,property:rule.property,value};
  }
 }
 return{color:defaultColor,matched:false,property:null,value:null};
}

export function resolveIfcObjectColor(properties,rules,defaultColor){
 return matchIfcObjectColor(properties,rules,defaultColor).color;
}
