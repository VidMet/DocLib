export const DEFAULT_IFC_OBJECT_LAYER=Object.freeze({
 enabled:false,
 ifcType:'',
 nameContains:'',
 defaultColor:'#e85223',
 colorRules:Object.freeze([]),
});

const COLOR=/^#[0-9a-f]{6}$/i;
const cleanText=(value,max)=>String(value??'').trim().slice(0,max);

export function normalizeIfcObjectLayer(raw){
 const colorRules=[];
 for(const source of Array.isArray(raw?.colorRules)?raw.colorRules:[]){
  if(colorRules.length>=3)break;
  const property=cleanText(source?.property,200);
  if(!property)continue;
  const values=[];
  const seen=new Set();
  for(const mapping of Array.isArray(source?.values)?source.values:[]){
   if(values.length>=40)break;
   const value=cleanText(mapping?.value,120);
   const color=String(mapping?.color??'').trim();
   const key=value.toLocaleLowerCase('nb-NO');
   if(!value||!COLOR.test(color)||seen.has(key))continue;
   seen.add(key);
   values.push({value,color:color.toLowerCase()});
  }
  colorRules.push({property,values});
 }
 const defaultColor=String(raw?.defaultColor??'').trim();
 return{
  enabled:raw?.enabled===true,
  ifcType:cleanText(raw?.ifcType,120),
  nameContains:cleanText(raw?.nameContains,120),
  defaultColor:COLOR.test(defaultColor)?defaultColor.toLowerCase():DEFAULT_IFC_OBJECT_LAYER.defaultColor,
  colorRules,
 };
}

export function resolveIfcObjectColor(properties,rules,defaultColor){
 for(const rule of Array.isArray(rules)?rules:[]){
  const values=properties?.[rule.property];
  const candidates=Array.isArray(values)?values:[values];
  for(const candidate of candidates){
   const value=String(candidate??'').trim();
   if(!value)continue;
   const mapping=(rule.values||[]).find(item=>String(item.value).toLocaleLowerCase('nb-NO')===value.toLocaleLowerCase('nb-NO'));
   if(mapping)return mapping.color;
  }
 }
 return defaultColor;
}
