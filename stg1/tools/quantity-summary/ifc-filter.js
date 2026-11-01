// Explicit class filter. Never infer class from object name, missing quantity,
// process code, predefined type, or numeric API type identifiers.
export const EXCLUDED_IFC_CLASSES=Object.freeze([
 'IfcProject','IfcSite','IfcBuilding','IfcBuildingStorey','IfcSpace','IfcSpatialZone',
 'IfcSpatialElement','IfcSpatialStructureElement','IfcExternalSpatialElement',
 'IfcExternalSpatialStructureElement','IfcFacility','IfcFacilityPart',
 'IfcFacilityPartCommon','IfcBridge','IfcBridgePart','IfcRoad','IfcRoadPart',
 'IfcRailway','IfcRailwayPart','IfcMarineFacility','IfcMarinePart'
]);
const excluded=new Set(EXCLUDED_IFC_CLASSES.map(c=>c.toLowerCase()));
const propertyNames=new Set(['ifcclass','ifcentity','ifcentitytype','ifctype','entitytype','entity','class','type','objekttype','objecttype','ifcentityname']);
function className(value){
 if(typeof value!=='string')return '';
 const text=value.trim();return /^ifc[a-z][a-z0-9]*$/i.test(text)?text:'';
}
export function resolveIfcClass(entity={}){
 const candidates=[entity.entityType,entity.ifcType,entity.ifcClass,entity.type,entity.class];
 for(const value of [entity.product,entity.productInfo,entity.classification])if(value&&typeof value==='object')for(const key of ['ifcClass','ifcType','entityType','class','type'])candidates.push(value[key]);
 const props=entity.properties||{};
 for(const key of Object.keys(props).sort())if(propertyNames.has(key.split('::').pop().replace(/[ _-]/g,'').toLowerCase()))candidates.push(props[key]);
 const classes=candidates.map(className).filter(Boolean);
 // Exclusion wins if metadata contains contradictory classes.
 return classes.find(c=>excluded.has(c.toLowerCase()))||classes[0]||'';
}
export function filterIfcEntities(entities){
 const kept=[],unknown=[],excludedByClass={};let excludedCount=0;
 for(const entity of entities){
  const type=resolveIfcClass(entity);
  if(type&&excluded.has(type.toLowerCase())){excludedCount++;const name=EXCLUDED_IFC_CLASSES.find(c=>c.toLowerCase()===type.toLowerCase());excludedByClass[name]=(excludedByClass[name]||0)+1;continue;}
  const record=type?{...entity,entityType:type}:entity;kept.push(record);if(!type)unknown.push(record);
 }
 return {entities:kept,excludedCount,excludedByClass,unknownCount:unknown.length,unknown};
}
