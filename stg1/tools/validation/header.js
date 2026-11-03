const CLASSES=['IfcProject','IfcSite','IfcBuilding','IfcBuildingStorey'];
const classKey=value=>CLASSES.find(x=>x.toLowerCase()===String(value||'').toLowerCase())||null;
export function install(state){
 const baseRule=state.valRule,baseCheck=state.valCheck;
 function headerRule(entityClass,raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(entityClass+': ugyldig hoderegel.');
  const pset=String(raw.pset||'').trim();if(!pset)throw Error(entityClass+': PSET-navn mangler.');
  return baseRule({schema:'DocLibPropertyRules',schemaVersion:2,id:'IFC_Header_'+entityClass,pset,scope:{mode:'allEntities'},required:raw.required!==false,allowedExtraProperties:raw.allowedExtraProperties!==false,properties:raw.properties||{}});
 }
 state.valRule=function(raw){
  const copy=JSON.parse(JSON.stringify(raw)),header=copy.headerValidation;delete copy.headerValidation;
  const rule=baseRule(copy);const normalized={enabled:false,entities:{}};
  if(header!==undefined){if(!header||typeof header!=='object'||Array.isArray(header))throw Error('headerValidation må være et objekt.');normalized.enabled=header.enabled===true;const entities=header.entities||{};for(const key of CLASSES){const item=entities[key];if(!item){normalized.entities[key]={enabled:false};continue}if(typeof item!=='object'||Array.isArray(item))throw Error(key+': hoderegel må være et objekt.');normalized.entities[key]=item.enabled===true?{enabled:true,rule:headerRule(key,item)}:{enabled:false};}}
  if(header!==undefined)rule.headerValidation=JSON.parse(JSON.stringify(header));Object.defineProperty(rule,'_headerValidation',{value:normalized,enumerable:false,configurable:false});return rule;
 };
 state.valCheck=function(entity,rule){
  const key=classKey(entity.type);if(!key)return baseCheck(entity,rule);
  const header=rule._headerValidation;if(!header?.enabled)return null;
  const item=header.entities[key];if(!item?.enabled)return null;
  const findings=baseCheck(entity,item.rule);if(findings)for(const finding of findings){finding.headerEntity=key;finding.ruleId=rule.id;finding.pset=item.rule.pset;}return findings;
 };
 state.valHeaderClass=classKey;
}
