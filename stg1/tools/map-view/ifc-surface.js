const WEB_IFC_VERSION='0.0.77';
const WEB_IFC_BASE=`https://cdn.jsdelivr.net/npm/web-ifc@${WEB_IFC_VERSION}/`;
export const MAX_WEAR_TRIANGLES=120000;
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

async function yieldToUi(timings){
 const started=performance.now();
 await new Promise(resolve=>setTimeout(resolve,0));
 timings.yield+=performance.now()-started;
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
 const timings={setup:0,lineScan:0,meshExtract:0,triangleFilter:0,yield:0};
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
  for(let index=0;index<ids.length;index++){
   const expressId=Number(unwrap(ids[index]));
   if(Number.isInteger(expressId)){
    const entity=api.GetLine(modelId,expressId);
    const label=entityLabel(entity);
    if(label&&wearPattern.test(label))candidates.push({expressId,label});
   }
   if(index%300===0){
    timings.lineScan+=performance.now()-scanBlockStarted;
    onProgress(`Leter etter slitelag: ${index.toLocaleString('nb-NO')} av ${ids.length.toLocaleString('nb-NO')} IFC-linjer …`);
    await yieldToUi(timings);
    scanBlockStarted=performance.now();
   }
  }
  timings.lineScan+=performance.now()-scanBlockStarted;
  if(!candidates.length)throw Error('Fant ingen IFC-objekter med «slitelag» eller «wearing course» i navn, beskrivelse eller objekttype.');
  const triangles=[];
  const labels=[];
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
     }
     timings.triangleFilter+=performance.now()-filterStarted;
    }finally{geometry.delete?.();}
    if(triangles.length>=triangleLimit)break;
   }
   labels.push(candidate.label);
   onProgress(`Leser geometri for slitelagsobjekt ${itemIndex+1} av ${candidates.length} …`);
   await yieldToUi(timings);
   if(triangles.length>=triangleLimit)break;
  }
  if(!triangles.length)throw Error(`Fant ${candidates.length} merket slitelagsobjekt, men ingen oppovervendt flate kunne leses.`);
  return{triangles,labels,candidateCount:candidates.length,truncated:triangles.length>=triangleLimit,timings};
 }finally{
  if(modelId!==null)api.CloseModel(modelId);
 }
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
 context.fillStyle='rgba(232,82,35,.72)';
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
 context.strokeStyle='rgba(139,45,20,.78)';
 context.lineWidth=.65;
 context.beginPath();
 const spacing=8;
 for(let offset=-height;offset<width;offset+=spacing){
  context.moveTo(offset,0);
  context.lineTo(offset+height,height);
 }
 context.stroke();
 context.restore();
}
