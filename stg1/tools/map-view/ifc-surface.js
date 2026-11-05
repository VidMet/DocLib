import {normalizeIfcObjectLayer,matchIfcObjectColor} from './ifc-object-layer-config.js?v=2.05-preview.7.4';
const WEB_IFC_VERSION='0.0.77';
const WEB_IFC_BASE=`https://cdn.jsdelivr.net/npm/web-ifc@${WEB_IFC_VERSION}/`;
export const MAX_WEAR_TRIANGLES=120000;
const SCAN_YIELD_MAX_ITEMS=1000;
const SCAN_YIELD_TIME_CHECK_ITEMS=100;
const OBJECT_YIELD_MAX_ITEMS=5;
const TRIANGLE_YIELD_CHECK_COUNT=2048;
const YIELD_MAX_WORK_MS=50;
let webIfcPromise=null;
let webIfcApiPromise=null;

function loadWebIfc(){
 if(window.WebIFC?.IfcAPI)return Promise.resolve(window.WebIFC);
 if(webIfcPromise)return webIfcPromise;
 webIfcPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=`${WEB_IFC_BASE}web-ifc-api-iife.js`;
  script.async=true;
  script.onload=()=>window.WebIFC?.IfcAPI?resolve(window.WebIFC):reject(Error('web-ifc ble lastet, men API-et mangler.'));
  script.onerror=()=>reject(Error('Kunne ikke laste IFC-geometribiblioteket fra jsDelivr.'));
  document.head.append(script);
 });
 return webIfcPromise;
}

function vectorItems(value){
 if(Array.isArray(value))return value;
 if(value&&typeof value.get==='function'){
  const count=typeof value.size==='function'?value.size():value.size;
  if(!Number.isInteger(count)||count<0)return[];
  const result=[];
  for(let i=0;i<count;i++)result.push(value.get(i));
  return result;
 }
 return [];
}

function unwrap(value){return value&&typeof value==='object'&&'value'in value?value.value:value;}
export function ifcColorToCss(color){
 const components=Array.isArray(color)?color:[color?.x,color?.y,color?.z,color?.w];
 if(components.length<3)return null;
 const rgb=components.slice(0,3).map(Number);
 if(rgb.some(value=>!Number.isFinite(value)||value<0||value>1))return null;
 const alpha=components.length>3&&Number.isFinite(Number(components[3]))?Math.max(0,Math.min(1,Number(components[3]))):1;
 return`rgba(${rgb.map(value=>Math.round(value*255)).join(',')},${Number(alpha.toFixed(3))})`;
}
function entityLabel(entity){
 return ['Name','ObjectType','Description','Tag','PredefinedType'].map(key=>unwrap(entity?.[key])).filter(value=>value!=null).map(String).join(' ').replace(/\\X2\\([0-9A-F]+)\\X0\\/gi,(_,hex)=>{try{return String.fromCodePoint(...hex.match(/.{4}/g).map(code=>parseInt(code,16)));}catch{return'';}});
}
function matrixPoint(matrix,x,y,z){
 if(!matrix||matrix.length!==16)throw Error('IFC-geometrien mangler en 4×4-plasseringsmatrise.');
 const worldX=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
 const worldY=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
 const worldZ=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
 // web-ifc uses Y-up coordinates: map northing is -Z and elevation is Y.
 return[worldX,-worldZ,worldY];
}
function modelLineIds(api,modelId){
 const ids=api.GetAllLines(modelId);
 if(Array.isArray(ids))return ids;
 if(ids&&typeof ids.get==='function')return vectorItems(ids);
 throw Error('IFC-leseren returnerte ikke en lesbar objektliste.');
}

async function yieldToUi(timings,timingKey){
 const started=performance.now();
 await new Promise(resolve=>setTimeout(resolve,0));
 timings[timingKey]+=performance.now()-started;
}

async function getWebIfcApi(){
 if(!webIfcApiPromise){
  webIfcApiPromise=(async()=>{
   const WebIFC=await loadWebIfc();
   const api=new WebIFC.IfcAPI();
   api.SetWasmPath(WEB_IFC_BASE,true);
   await api.Init();
   return api;
  })();
  webIfcApiPromise.catch(()=>{webIfcApiPromise=null;});
 }
 return webIfcApiPromise;
}

export async function readWearSurface(buffer,onProgress=()=>{},triangleLimit=MAX_WEAR_TRIANGLES){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength===0)throw Error('IFC-filen er tom eller ugyldig.');
 if(!Number.isInteger(triangleLimit)||triangleLimit<1||triangleLimit>MAX_WEAR_TRIANGLES)throw Error('Ugyldig trekantgrense for IFC-geometrien.');
 const timings={setup:0,lineScan:0,lineScanYield:0,objectProcessing:0,objectYield:0,meshExtract:0,triangleFilter:0};
 const setupStarted=performance.now();
 const api=await getWebIfcApi();
 let modelId=null;
 try{
  modelId=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false});
  timings.setup=performance.now()-setupStarted;
  const idsStarted=performance.now();
  const ids=modelLineIds(api,modelId);
  timings.lineScan+=performance.now()-idsStarted;
  const candidates=[];
  const wearPattern=/(^|[^a-z])(slitelag|slitelaget|wearing[ _-]?course|asphalt[ _-]?wearing)([^a-z]|$)/i;
  let scanBlockStarted=performance.now();
  let scanChunkStartIndex=0;
  for(let index=0;index<ids.length;index++){
   const expressId=Number(unwrap(ids[index]));
   if(Number.isInteger(expressId)){
    const entity=api.GetLine(modelId,expressId);
    const label=entityLabel(entity);
    if(label&&wearPattern.test(label))candidates.push({expressId,label});
   }
   const processedCount=index+1;
   const chunkItems=processedCount-scanChunkStartIndex;
   const checkElapsed=processedCount%SCAN_YIELD_TIME_CHECK_ITEMS===0;
   const chunkElapsed=checkElapsed?performance.now()-scanBlockStarted:0;
   if(chunkItems>=SCAN_YIELD_MAX_ITEMS||(checkElapsed&&chunkElapsed>=YIELD_MAX_WORK_MS)){
    onProgress(`Leter etter slitelag: ${processedCount.toLocaleString('nb-NO')} av ${ids.length.toLocaleString('nb-NO')} IFC-linjer …`);
    timings.lineScan+=performance.now()-scanBlockStarted;
    await yieldToUi(timings,'lineScanYield');
    scanBlockStarted=performance.now();
    scanChunkStartIndex=processedCount;
   }
  }
  timings.lineScan+=performance.now()-scanBlockStarted;
  if(!candidates.length)throw Error('Fant ingen IFC-objekter med «slitelag» eller «wearing course» i navn, beskrivelse eller objekttype.');
  const triangles=[];
  const labels=[];
  let objectWorkStarted=performance.now();
  let objectChunkStartIndex=0;
  for(let itemIndex=0;itemIndex<candidates.length;itemIndex++){
   const candidate=candidates[itemIndex];
   const meshStarted=performance.now();
   const flat=api.GetFlatMesh(modelId,candidate.expressId);
   const placedGeometries=vectorItems(flat?.geometries);
   timings.meshExtract+=performance.now()-meshStarted;
   for(const placed of placedGeometries){
    const geometryStarted=performance.now();
    const geometry=api.GetGeometry(modelId,Number(placed.geometryExpressID));
    if(!geometry){timings.meshExtract+=performance.now()-geometryStarted;continue;}
    try{
     const vertices=api.GetVertexArray(geometry.GetVertexData(),geometry.GetVertexDataSize());
     const indices=api.GetIndexArray(geometry.GetIndexData(),geometry.GetIndexDataSize());
     const transform=Array.from(placed.flatTransformation||[]);
     if(transform.length!==16)throw Error(`Objekt ${candidate.expressId}: ukjent geometri-transformasjon.`);
     timings.meshExtract+=performance.now()-geometryStarted;
     const filterStarted=performance.now();
     for(let offset=0;offset+2<indices.length;offset+=3){
      const indexA=Number(indices[offset]),indexB=Number(indices[offset+1]),indexC=Number(indices[offset+2]);
      const baseA=indexA*6,baseB=indexB*6,baseC=indexC*6;
      if(baseA+2>=vertices.length||baseB+2>=vertices.length||baseC+2>=vertices.length)throw Error('IFC-geometri inneholder en ugyldig vertex-indeks.');
      const ax=transform[0]*vertices[baseA]+transform[4]*vertices[baseA+1]+transform[8]*vertices[baseA+2]+transform[12];
      const ay=-(transform[2]*vertices[baseA]+transform[6]*vertices[baseA+1]+transform[10]*vertices[baseA+2]+transform[14]);
      const az=transform[1]*vertices[baseA]+transform[5]*vertices[baseA+1]+transform[9]*vertices[baseA+2]+transform[13];
      const bx=transform[0]*vertices[baseB]+transform[4]*vertices[baseB+1]+transform[8]*vertices[baseB+2]+transform[12];
      const by=-(transform[2]*vertices[baseB]+transform[6]*vertices[baseB+1]+transform[10]*vertices[baseB+2]+transform[14]);
      const bz=transform[1]*vertices[baseB]+transform[5]*vertices[baseB+1]+transform[9]*vertices[baseB+2]+transform[13];
      const cx=transform[0]*vertices[baseC]+transform[4]*vertices[baseC+1]+transform[8]*vertices[baseC+2]+transform[12];
      const cy=-(transform[2]*vertices[baseC]+transform[6]*vertices[baseC+1]+transform[10]*vertices[baseC+2]+transform[14]);
      const cz=transform[1]*vertices[baseC]+transform[5]*vertices[baseC+1]+transform[9]*vertices[baseC+2]+transform[13];
      const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az;
      const normalZ=abx*acy-aby*acx;
      const normalX=aby*acz-abz*acy,normalY=abz*acx-abx*acz;
      const normalLength=Math.hypot(normalZ,normalX,normalY);
      if(normalLength>1e-10&&normalZ/normalLength>0.72){
       triangles.push([[ax,ay,az],[bx,by,bz],[cx,cy,cz]]);
       if(triangles.length>=triangleLimit)break;
      }
      const processedTriangles=offset/3+1;
      if(processedTriangles%TRIANGLE_YIELD_CHECK_COUNT===0&&performance.now()-objectWorkStarted>=YIELD_MAX_WORK_MS){
       timings.objectProcessing+=performance.now()-objectWorkStarted;
       await yieldToUi(timings,'objectYield');
       objectWorkStarted=performance.now();
       objectChunkStartIndex=itemIndex+1;
      }
     }
     timings.triangleFilter+=performance.now()-filterStarted;
    }finally{geometry.delete?.();}
    if(triangles.length>=triangleLimit)break;
   }
   labels.push(candidate.label);
   onProgress(`Leser geometri for slitelagsobjekt ${itemIndex+1} av ${candidates.length} …`);
   const processedCount=itemIndex+1;
   const hasMore=processedCount<candidates.length&&triangles.length<triangleLimit;
   const objectWorkMs=performance.now()-objectWorkStarted;
   const shouldYield=hasMore&&(processedCount-objectChunkStartIndex>=OBJECT_YIELD_MAX_ITEMS||objectWorkMs>=YIELD_MAX_WORK_MS);
   if(shouldYield){
    timings.objectProcessing+=objectWorkMs;
    await yieldToUi(timings,'objectYield');
    objectWorkStarted=performance.now();
    objectChunkStartIndex=processedCount;
   }else if(!hasMore){
    timings.objectProcessing+=objectWorkMs;
   }
   if(triangles.length>=triangleLimit)break;
  }
  if(!triangles.length)throw Error(`Fant ${candidates.length} merket slitelagsobjekt, men ingen oppovervendt flate kunne leses.`);
  return{triangles,labels,candidateCount:candidates.length,truncated:triangles.length>=triangleLimit,timings};
 }finally{
  if(modelId!==null)api.CloseModel(modelId);
 }
}

export const MAX_IFC_OBJECT_TRIANGLES=30000;
const unwrapIfc=value=>value&&typeof value==='object'&&'value'in value?value.value:value;
function referenceIds(value){
 const values=Array.isArray(value)?value:[value];
 return values.map(item=>Number(unwrapIfc(item))).filter(Number.isInteger);
}
function propertyValues(property){
 const values=[];
 for(const field of ['NominalValue','EnumerationValues','ListValues']){
  const source=property?.[field];
  for(const item of Array.isArray(source)?source:source==null?[]:[source]){
   const value=unwrapIfc(item);
   if(value!=null&&String(value).trim())values.push(String(value).trim());
  }
 }
 return values;
}
function readConfiguredProperties(api,modelId,entityId){
 const result={};
 const psets=[];
 // IsDefinedBy and IsTypedBy are inverse attributes in IFC. WebIFC omits them unless inverse lookup is explicitly enabled.
 const inverse=api.GetLine(modelId,entityId,false,true);
 for(const relationId of referenceIds(inverse?.IsDefinedBy)){
  const relation=api.GetLine(modelId,relationId);
  const definition=relation?.RelatingPropertyDefinition;
  for(const id of referenceIds(definition))psets.push(api.GetLine(modelId,id));
 }
 for(const relationId of referenceIds(inverse?.IsTypedBy)){
  const relation=api.GetLine(modelId,relationId);
  for(const typeId of referenceIds(relation?.RelatingType)){
   const type=api.GetLine(modelId,typeId);
   for(const psetId of referenceIds(type?.HasPropertySets))psets.push(api.GetLine(modelId,psetId));
  }
 }
 for(const pset of psets){
  const psetName=String(unwrapIfc(pset?.Name)||'').trim();
  if(!psetName)continue;
  for(const propertyId of referenceIds(pset?.HasProperties)){
   const property=api.GetLine(modelId,propertyId);
   const propertyName=String(unwrapIfc(property?.Name)||'').trim();
   const key=`${psetName}::${propertyName}`;
   if(!propertyName)continue;
   const values=propertyValues(property);
   if(!values.length)continue;
   result[key]=[...(result[key]||[]),...values];
  }
 }
 return result;
}

export async function readIfcPropertyCatalog(buffer,onProgress=()=>{}){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength===0)throw Error('IFC-filen er tom eller ugyldig.');
 const api=await getWebIfcApi();let modelId=null;
 try{
  modelId=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false});
  const ids=modelLineIds(api,modelId),catalog=new Map();let workStarted=performance.now(),chunkStart=0;
  for(let index=0;index<ids.length;index++){
   const expressId=Number(unwrap(ids[index]));
   if(Number.isInteger(expressId)){
    const entity=api.GetLine(modelId,expressId);
    if(unwrapIfc(entity?.GlobalId)){
     const properties=readConfiguredProperties(api,modelId,expressId);
     for(const [property,rawValues] of Object.entries(properties)){
      if(!catalog.has(property)&&catalog.size<500)catalog.set(property,new Set());
      const values=catalog.get(property);if(!values)continue;
      for(const rawValue of rawValues){const value=String(rawValue).normalize('NFC').replace(/\s+/gu,' ').trim();if(value&&values.size<200)values.add(value);}
     }
    }
   }
   const processed=index+1;
   if(processed-chunkStart>=SCAN_YIELD_MAX_ITEMS||(processed%SCAN_YIELD_TIME_CHECK_ITEMS===0&&performance.now()-workStarted>=YIELD_MAX_WORK_MS)){
    onProgress(`Leser IFC-egenskaper: ${processed.toLocaleString('nb-NO')} av ${ids.length.toLocaleString('nb-NO')} linjer …`);
    await new Promise(resolve=>setTimeout(resolve,0));workStarted=performance.now();chunkStart=processed;
   }
  }
  return Object.fromEntries([...catalog].map(([property,values])=>[property,[...values].sort((a,b)=>a.localeCompare(b,'nb-NO',{numeric:true,sensitivity:'base'}))]));
 }finally{if(modelId!==null)api.CloseModel(modelId);}
}

export async function readIfcObjectLayer(buffer,rawConfig,onProgress=()=>{},triangleLimit=MAX_IFC_OBJECT_TRIANGLES){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength===0)throw Error('IFC-filen er tom eller ugyldig.');
 if(!Number.isInteger(triangleLimit)||triangleLimit<1||triangleLimit>MAX_IFC_OBJECT_TRIANGLES)throw Error('Ugyldig trekantgrense for IFC-objektslaget.');
 const config=normalizeIfcObjectLayer(rawConfig);
 const rules=config.colorRules.filter(rule=>rule.property);
 if(config.onlyMatched&&!rules.length)throw Error('«Bare treff» krever minst én valgt IFC-egenskap med fargeregler.');
 const timings={setup:0,lineScan:0,lineScanYield:0,objectProcessing:0,objectYield:0,meshExtract:0,triangleFilter:0};
 const setupStarted=performance.now();
 const api=await getWebIfcApi();
 let modelId=null;
 try{
  modelId=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false});
  timings.setup=performance.now()-setupStarted;
  const ids=modelLineIds(api,modelId),candidates=[],matchedValues=new Map(),unmatchedValues=new Map();let mappedObjects=0,defaultObjects=0;
  let scanStarted=performance.now(),scanChunkStart=0;
  for(let index=0;index<ids.length;index++){
   const expressId=Number(unwrap(ids[index]));
   if(Number.isInteger(expressId)){
    const entity=api.GetLine(modelId,expressId);
    const name=String(unwrapIfc(entity?.Name)||'').trim();
    const globalId=String(unwrapIfc(entity?.GlobalId)||'').trim();
    const lineType=typeof api.GetLineType==='function'?api.GetLineType(modelId,expressId):null;
    const ifcType=typeof api.GetNameFromTypeCode==='function'?String(api.GetNameFromTypeCode(lineType)||''):'';
    const properties=rules.length?readConfiguredProperties(api,modelId,expressId):{};
    const hasConfiguredProperty=rules.some(rule=>Object.keys(properties).some(key=>key.toLocaleLowerCase('nb-NO')===rule.property.toLocaleLowerCase('nb-NO')));
    const productWithRepresentation=Boolean(unwrapIfc(entity?.GlobalId)&&entity?.Representation);
    const match=matchIfcObjectColor(properties,rules,config.defaultColor);
    if((config.onlyMatched&&hasConfiguredProperty&&match.matched)||(!config.onlyMatched&&productWithRepresentation)){
     if(match.matched){
      mappedObjects++;const key=JSON.stringify([match.property,match.value,match.color]);const current=matchedValues.get(key);
      if(current)current.count++;else if(matchedValues.size<8)matchedValues.set(key,{property:match.property,value:match.value,color:match.color,count:1});
     }else{
      defaultObjects++;
      for(const rule of rules){
       const raw=properties[rule.property],values=Array.isArray(raw)?raw:[raw],present=values.filter(value=>String(value??'').trim());
       const samples=present.length?present:['(tom verdi)'];
       for(const value of samples){const key=JSON.stringify([rule.property,String(value).slice(0,100)]),current=unmatchedValues.get(key);if(current)current.count++;else if(unmatchedValues.size<8)unmatchedValues.set(key,{property:rule.property,value:String(value).slice(0,100),count:1});}
      }
     }
     candidates.push({expressId,name:name||`IFC-objekt ${expressId}`,globalId,ifcType,properties,match});
    }
   }
   const processed=index+1,chunk=processed-scanChunkStart,check=processed%SCAN_YIELD_TIME_CHECK_ITEMS===0;
   if(chunk>=SCAN_YIELD_MAX_ITEMS||(check&&performance.now()-scanStarted>=YIELD_MAX_WORK_MS)){
    onProgress(`Filtrerer på IFC-egenskaper: ${processed.toLocaleString('nb-NO')} av ${ids.length.toLocaleString('nb-NO')} IFC-linjer …`);
    timings.lineScan+=performance.now()-scanStarted;
    await yieldToUi(timings,'lineScanYield');
    scanStarted=performance.now();scanChunkStart=processed;
   }
  }
  timings.lineScan+=performance.now()-scanStarted;
  if(!candidates.length)throw Error(config.onlyMatched?'Fant ingen IFC-objekter med en eksplisitt fargeregel.':'Fant ingen IFC-objekter med 2D-representasjon å vise.');
  const triangles=[],colors=[],triangleObjectIds=[],labels=[],objects=[],nativeColors=new Map(),valueLegend=new Map(),defaultLegendObjects=new Set();
  let objectStarted=performance.now(),objectChunkStart=0,truncated=false,overriddenGeometries=0,nativeColorGeometries=0,fallbackColorGeometries=0;
  for(let itemIndex=0;itemIndex<candidates.length;itemIndex++){
   const candidate=candidates[itemIndex],meshStarted=performance.now(),objectIndex=objects.length;
   objects.push({expressId:candidate.expressId,name:candidate.name,globalId:candidate.globalId||'',ifcType:candidate.ifcType||'',properties:candidate.properties});
   const flat=api.GetFlatMesh(modelId,candidate.expressId),placedGeometries=vectorItems(flat?.geometries);
   timings.meshExtract+=performance.now()-meshStarted;
   for(const placed of placedGeometries){
    const nativeColor=ifcColorToCss(placed?.color);
    const displayColor=candidate.match.matched?candidate.match.color:config.defaultColor;
    if(candidate.match.matched)overriddenGeometries++;else if(nativeColor)nativeColorGeometries++;else fallbackColorGeometries++;
    if(nativeColor){const entry=nativeColors.get(nativeColor);if(entry)entry.count++;else if(nativeColors.size<8)nativeColors.set(nativeColor,{color:nativeColor,count:1});}
    const geometryStarted=performance.now(),geometry=api.GetGeometry(modelId,Number(placed.geometryExpressID));
    if(!geometry){timings.meshExtract+=performance.now()-geometryStarted;continue;}
    try{
     const vertices=api.GetVertexArray(geometry.GetVertexData(),geometry.GetVertexDataSize());
     const indices=api.GetIndexArray(geometry.GetIndexData(),geometry.GetIndexDataSize());
     const transform=Array.from(placed.flatTransformation||[]);
     if(transform.length!==16)throw Error(`Objekt ${candidate.expressId}: ukjent geometri-transformasjon.`);
     timings.meshExtract+=performance.now()-geometryStarted;
     const filterStarted=performance.now();
     for(let offset=0;offset+2<indices.length;offset+=3){
      const indexA=Number(indices[offset]),indexB=Number(indices[offset+1]),indexC=Number(indices[offset+2]);
      const baseA=indexA*6,baseB=indexB*6,baseC=indexC*6;
      if(baseA+2>=vertices.length||baseB+2>=vertices.length||baseC+2>=vertices.length)throw Error('IFC-geometri inneholder en ugyldig vertex-indeks.');
      const ax=transform[0]*vertices[baseA]+transform[4]*vertices[baseA+1]+transform[8]*vertices[baseA+2]+transform[12];
      const ay=-(transform[2]*vertices[baseA]+transform[6]*vertices[baseA+1]+transform[10]*vertices[baseA+2]+transform[14]);
      const az=transform[1]*vertices[baseA]+transform[5]*vertices[baseA+1]+transform[9]*vertices[baseA+2]+transform[13];
      const bx=transform[0]*vertices[baseB]+transform[4]*vertices[baseB+1]+transform[8]*vertices[baseB+2]+transform[12];
      const by=-(transform[2]*vertices[baseB]+transform[6]*vertices[baseB+1]+transform[10]*vertices[baseB+2]+transform[14]);
      const bz=transform[1]*vertices[baseB]+transform[5]*vertices[baseB+1]+transform[9]*vertices[baseB+2]+transform[13];
      const cx=transform[0]*vertices[baseC]+transform[4]*vertices[baseC+1]+transform[8]*vertices[baseC+2]+transform[12];
      const cy=-(transform[2]*vertices[baseC]+transform[6]*vertices[baseC+1]+transform[10]*vertices[baseC+2]+transform[14]);
      const cz=transform[1]*vertices[baseC]+transform[5]*vertices[baseC+1]+transform[9]*vertices[baseC+2]+transform[13];
      const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az;
      const normalZ=abx*acy-aby*acx,normalX=aby*acz-abz*acy,normalY=abz*acx-abx*acz,normalLength=Math.hypot(normalZ,normalX,normalY);
      if(normalLength>1e-10&&normalZ/normalLength>0.72){
       triangles.push([[ax,ay,az],[bx,by,bz],[cx,cy,cz]]);colors.push(displayColor);triangleObjectIds.push(objectIndex);
       if(candidate.match.matched){const legendKey=JSON.stringify([candidate.match.property,candidate.match.value,displayColor]);let entry=valueLegend.get(legendKey);if(!entry){entry={property:candidate.match.property,value:candidate.match.value,color:displayColor,objectIds:new Set()};valueLegend.set(legendKey,entry);}entry.objectIds.add(candidate.expressId);}else defaultLegendObjects.add(candidate.expressId);
       if(triangles.length>=triangleLimit){truncated=offset+3<indices.length||itemIndex+1<candidates.length;break;}
      }
      const processedTriangles=offset/3+1;
      if(processedTriangles%TRIANGLE_YIELD_CHECK_COUNT===0&&performance.now()-objectStarted>=YIELD_MAX_WORK_MS){
       timings.objectProcessing+=performance.now()-objectStarted;
       await yieldToUi(timings,'objectYield');
       objectStarted=performance.now();objectChunkStart=itemIndex+1;
      }
     }
     timings.triangleFilter+=performance.now()-filterStarted;
    }finally{geometry.delete?.();}
    if(triangles.length>=triangleLimit)break;
   }
   labels.push(candidate.name);
   onProgress(`Leser IFC-objekt ${itemIndex+1} av ${candidates.length} …`);
   const processed=itemIndex+1,hasMore=processed<candidates.length&&triangles.length<triangleLimit,work=performance.now()-objectStarted;
   if(hasMore&&(processed-objectChunkStart>=OBJECT_YIELD_MAX_ITEMS||work>=YIELD_MAX_WORK_MS)){
    timings.objectProcessing+=work;await yieldToUi(timings,'objectYield');objectStarted=performance.now();objectChunkStart=processed;
   }else if(!hasMore)timings.objectProcessing+=work;
   if(triangles.length>=triangleLimit)break;
  }
  if(!triangles.length)throw Error(`Fant ${candidates.length} objekt(er) med valgte egenskaper, men ingen oppovervendte flater kunne leses.`);
  return{triangles,colors,triangleObjectIds,objects,labels,candidateCount:candidates.length,truncated,timings,colorDiagnostics:{mappedObjects,defaultObjects,overriddenGeometries,nativeColorGeometries,fallbackColorGeometries,nativeColorValues:[...nativeColors.values()],matchedValues:[...matchedValues.values()],unmatchedValues:[...unmatchedValues.values()],valueLegend:[...valueLegend.values()].map(item=>({property:item.property,value:item.value,color:item.color,objectCount:item.objectIds.size})),defaultLegend:defaultLegendObjects.size?{label:'Øvrige objekter',color:config.defaultColor,objectCount:defaultLegendObjects.size}:null}};
 }finally{if(modelId!==null)api.CloseModel(modelId);}
}

export function drawIfcObjectLayer(canvas,model,options){
 const {center,span,width,height}=options,ratio=window.devicePixelRatio||1;
 const pixelWidth=Math.max(1,Math.round(width*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
 const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
 const surfaces=Array.isArray(model?.surfaces)?model.surfaces:model?.triangles?.length?[model]:[];
 const scale=width/span,paths=new Map();
 for(const surface of surfaces)for(let index=0;index<surface.triangles.length;index++){
  const triangle=surface.triangles[index],color=surface.colors?.[index]||'#e85223';
  let path=paths.get(color);if(!path){path=[];paths.set(color,path);}
  const x0=width/2+(triangle[0][0]-center.x)*scale,y0=height/2-(triangle[0][1]-center.y)*scale;
  const x1=width/2+(triangle[1][0]-center.x)*scale,y1=height/2-(triangle[1][1]-center.y)*scale;
  const x2=width/2+(triangle[2][0]-center.x)*scale,y2=height/2-(triangle[2][1]-center.y)*scale;
  if(Math.max(x0,x1,x2)<0||Math.min(x0,x1,x2)>width||Math.max(y0,y1,y2)<0||Math.min(y0,y1,y2)>height)continue;
  path.push([x0,y0,x1,y1,x2,y2]);
 }
 for(const [color,triangles] of paths){context.fillStyle=color;context.beginPath();for(const [x0,y0,x1,y1,x2,y2] of triangles){context.moveTo(x0,y0);context.lineTo(x1,y1);context.lineTo(x2,y2);context.closePath();}context.fill();}
}

export function drawWearSurface(canvas,model,options){
 const {center,span,width,height,projectPoint}=options;
 const ratio=window.devicePixelRatio||1;
 const pixelWidth=Math.max(1,Math.round(width*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
 const context=canvas.getContext('2d');
 context.setTransform(ratio,0,0,ratio,0,0);
 context.clearRect(0,0,width,height);
 const isProjected=Array.isArray(model?.surfaces);
 const surfaces=isProjected?model.surfaces:(model?.triangles?.length?[model]:[]);
 if(!surfaces.length)return;
 context.fillStyle='rgba(232,82,35,.38)';
 context.beginPath();
 const scale=width/span;
 for(const surface of surfaces)for(const triangle of surface.triangles){
  let x0=triangle[0][0],y0=triangle[0][1],x1=triangle[1][0],y1=triangle[1][1],x2=triangle[2][0],y2=triangle[2][1];
  if(!isProjected){
   const p0=projectPoint(x0,y0),p1=projectPoint(x1,y1),p2=projectPoint(x2,y2);
   if(!p0||!p1||!p2||!Number.isFinite(p0.x)||!Number.isFinite(p0.y)||!Number.isFinite(p1.x)||!Number.isFinite(p1.y)||!Number.isFinite(p2.x)||!Number.isFinite(p2.y))continue;
   x0=p0.x;y0=p0.y;x1=p1.x;y1=p1.y;x2=p2.x;y2=p2.y;
  }
  const sx0=width/2+(x0-center.x)*scale,sy0=height/2-(y0-center.y)*scale;
  const sx1=width/2+(x1-center.x)*scale,sy1=height/2-(y1-center.y)*scale;
  const sx2=width/2+(x2-center.x)*scale,sy2=height/2-(y2-center.y)*scale;
  if(Math.max(sx0,sx1,sx2)<0||Math.min(sx0,sx1,sx2)>width||Math.max(sy0,sy1,sy2)<0||Math.min(sy0,sy1,sy2)>height)continue;
  context.moveTo(sx0,sy0);context.lineTo(sx1,sy1);context.lineTo(sx2,sy2);context.closePath();
 }
 context.fill();
 context.save();
 context.clip();
 context.strokeStyle='rgba(139,45,20,.34)';
 context.lineWidth=.45;
 context.beginPath();
 const spacing=14;
 for(let offset=-height;offset<width;offset+=spacing){
  context.moveTo(offset,0);
  context.lineTo(offset+height,height);
 }
 context.stroke();
 context.restore();
}
