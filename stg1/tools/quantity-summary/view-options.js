// Presentation helpers only. Do not alter raw IFC quantities or rounding.
const present=value=>value!=null&&String(value).trim()!=='';
export function objectLabel(entity,property=''){
 const props=entity.properties||{};
 if(property&&present(props[property]))return {name:String(props[property]),source:property};
 const priorities=['name','navn','ifcname','objectname','objektnavn','betegnelse'];
 for(const suffix of priorities){
  const keys=Object.keys(props).filter(key=>key.split('::').pop().toLowerCase()===suffix).sort();
  for(const key of keys)if(present(props[key]))return {name:String(props[key]),source:key};
 }
 if(present(entity.entityName))return {name:String(entity.entityName),source:'Objektnavn fra API'};
 return {name:'(Navn ikke tilgjengelig)',source:''};
}
export function visibleReport(report,hidden=[]){
 const excluded=new Set(hidden);
 return {...report,columns:report.columns.filter(column=>!excluded.has(column.key))};
}
