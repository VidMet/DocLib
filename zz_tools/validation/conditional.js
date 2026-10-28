// Composite conditional allowed values for schemaVersion 2 rules.
export function install(state){
 const baseRule=state.valRule,baseCheck=state.valCheck;
 const primitive=v=>['string','number','boolean'].includes(typeof v);
 function normalizeConditional(raw,properties,propertyName){
  if(raw===undefined)return undefined;
  if(!Array.isArray(raw)||!raw.length||raw.length>200)throw Error(propertyName+': conditionalAllowedValues må være 1–200 regler.');
  const signatures=new Set();
  return raw.map((row,index)=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw Error(`${propertyName}: betingelsesregel ${index+1} er ugyldig.`);
   if(!Array.isArray(row.conditions)||!row.conditions.length||row.conditions.length>20)throw Error(`${propertyName}: betingelsesregel ${index+1} må ha 1–20 betingelser.`);
   if(!Array.isArray(row.allowedValues)||!row.allowedValues.length||row.allowedValues.length>1000||row.allowedValues.some(v=>!primitive(v)))throw Error(`${propertyName}: betingelsesregel ${index+1} har ugyldige tillatte verdier.`);
   const seen=new Set(),conditions=row.conditions.map((condition,conditionIndex)=>{
    if(!condition||typeof condition!=='object'||Array.isArray(condition))throw Error(`${propertyName}: betingelse ${conditionIndex+1} er ugyldig.`);
    const property=String(condition.property||'').trim();if(!property||!Object.hasOwn(properties,property)||property===propertyName)throw Error(`${propertyName}: ukjent eller selvrefererende betingelsesegenskap ${property||'(mangler)'}.`);
    if(condition.operator!=='equals')throw Error(`${propertyName}: bare operatoren equals støttes.`);
    if(!primitive(condition.value))throw Error(`${propertyName}: betingelsesverdien må være tekst, tall eller ja/nei.`);
    if(seen.has(property))throw Error(`${propertyName}: egenskapen ${property} er brukt flere ganger i samme regel.`);seen.add(property);
    return{property,operator:'equals',value:condition.value};
   });
   const signature=JSON.stringify([...conditions].sort((a,b)=>a.property.localeCompare(b.property)).map(x=>[x.property,x.value]));
   if(signatures.has(signature))throw Error(`${propertyName}: flere regler har identiske betingelser.`);signatures.add(signature);
   return{conditions,allowedValues:[...new Set(row.allowedValues.map(v=>JSON.stringify(v)))].map(v=>JSON.parse(v))};
  });
 }
 state.valRule=function(raw){
  if(raw?.schemaVersion!==2)return baseRule(raw);
  const copy=JSON.parse(JSON.stringify(raw)),conditional={};
  if(copy.properties&&typeof copy.properties==='object')for(const[name,property]of Object.entries(copy.properties)){if(property&&Object.hasOwn(property,'conditionalAllowedValues')){conditional[name]=property.conditionalAllowedValues;delete property.conditionalAllowedValues;}}
  const rule=baseRule(copy);
  for(const[name,value]of Object.entries(conditional)){if(!rule.properties[name])throw Error('Ukjent egenskap med conditionalAllowedValues: '+name);rule.properties[name].conditionalAllowedValues=normalizeConditional(value,rule.properties,name);}
  return rule;
 };
 state.valCheck=function(entity,rule){
  const findings=baseCheck(entity,rule);if(findings===null||rule.schemaVersion!==2)return findings;
  const ps=entity.sets.get(rule.pset);if(!ps)return findings;
  for(const[name,property]of Object.entries(rule.properties)){
   const rows=property.conditionalAllowedValues;if(!rows?.length)continue;
   const actual=ps.get(name);if(state.valMissing(actual))continue;
   const missing=[...new Set(rows.flatMap(r=>r.conditions.map(c=>c.property)))].filter(p=>state.valMissing(ps.get(p)));
   if(missing.length){findings.push({objectId:entity.id,pset:rule.pset,property:name,actual,expected:'Betingelsesgrunnlag: '+missing.join(', '),severity:'error',incomplete:true,message:'Betingelsesstyrt verdikrav kunne ikke vurderes fordi egenskaper mangler.'});continue;}
   const matching=rows.filter(row=>row.conditions.every(c=>ps.get(c.property)===c.value));
   if(!matching.length){findings.push({objectId:entity.id,pset:rule.pset,property:name,actual,expected:'Minst én definert kombinasjon av betingelser',severity:'error',incomplete:true,message:'Ingen betingelsesregel samsvarer med objektet.'});continue;}
   const allowed=[...new Set(matching.flatMap(r=>r.allowedValues).map(v=>JSON.stringify(v)))].map(v=>JSON.parse(v));
   if(!allowed.some(v=>Object.is(v,actual)))findings.push({objectId:entity.id,pset:rule.pset,property:name,actual,expected:JSON.stringify(allowed),severity:property.severity||'error',message:'Verdi er ikke tillatt for de samsvarende betingelsene.'});
  }
  return findings;
 };
}
