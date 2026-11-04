const WEB_IFC_VERSION='0.0.77';
const WEB_IFC_BASE=`https://cdn.jsdelivr.net/npm/web-ifc@${WEB_IFC_VERSION}/`;
export const MAX_WEAR_TRIANGLES=120000;
let webIfcPromise=null;

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

export async function readWearSurface(buffer,onProgress=()=>{},triangleLimit=MAX_WEAR_TRIANGLES){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength===0)throw Error('IFC-filen er tom eller ugyldig.');
 if(!Number.isInteger(triangleLimit)||triangleLimit<1||triangleLimit>MAX_WEAR_TRIANGLES)throw Error('Ugyldig trekantgrense for IFC-geometrien.');
 const WebIFC=await loadWebIfc();
 const api=new WebIFC.IfcAPI();
 api.SetWasmPath(WEB_IFC_BASE,true);
 await api.Init();
 let modelId=null;
 try{
  modelId=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false});
  const ids=modelLineIds(api,modelId);
  const candidates=[];
  const wearPattern=/(^|[^a-z])(slitelag|slitelaget|wearing[ _-]?course|asphalt[ _-]?wearing)([^a-z]|$)/i;
  for(let index=0;index<ids.length;index++){
   const expressId=Number(unwrap(ids[index]));
   if(!Number.isInteger(expressId))continue;
   const entity=api.GetLine(modelId,expressId);
   const label=entityLabel(entity);
   if(label&&wearPattern.test(label))candidates.push({expressId,label});
   if(index%300===0){onProgress(`Leter etter slitelag: ${index.toLocaleString('nb-NO')} av ${ids.length.toLocaleString('nb-NO')} IFC-linjer …`);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  if(!candidates.length)throw Error('Fant ingen IFC-objekter med «slitelag» eller «wearing course» i navn, beskrivelse eller objekttype.');
  const triangles=[];
  const labels=[];
  for(let itemIndex=0;itemIndex<candidates.length;itemIndex++){
   const candidate=candidates[itemIndex];
   const flat=api.GetFlatMesh(modelId,candidate.expressId);
   for(const placed of vectorItems(flat?.geometries)){
    const geometry=api.GetGeometry(modelId,Number(placed.geometryExpressID));
    if(!geometry)continue;
    try{
     const vertices=api.GetVertexArray(geometry.GetVertexData(),geometry.GetVertexDataSize());
     const indices=api.GetIndexArray(geometry.GetIndexData(),geometry.GetIndexDataSize());
     const transform=Array.from(placed.flatTransformation||[]);
     if(transform.length!==16)throw Error(`Objekt ${candidate.expressId}: ukjent geometri-transformasjon.`);
     for(let offset=0;offset+2<indices.length;offset+=3){
      const points=[];
      for(let corner=0;corner<3;corner++){
       const vertexIndex=Number(indices[offset+corner]);
       const base=vertexIndex*6;
       if(base+2>=vertices.length)throw Error('IFC-geometri inneholder en ugyldig vertex-indeks.');
       points.push(matrixPoint(transform,Number(vertices[base]),Number(vertices[base+1]),Number(vertices[base+2])));
      }
      const [a,b,c]=points;
      const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      const normalZ=ab[0]*ac[1]-ab[1]*ac[0];
      const normalLength=Math.hypot(normalZ,ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2]);
      if(normalLength>1e-10&&normalZ/normalLength>0.72){
       triangles.push(points);
       if(triangles.length>=triangleLimit)break;
      }
     }
    }finally{geometry.delete?.();}
    if(triangles.length>=triangleLimit)break;
   }
   labels.push(candidate.label);
   onProgress(`Leser geometri for slitelagsobjekt ${itemIndex+1} av ${candidates.length} …`);
   await new Promise(resolve=>setTimeout(resolve,0));
   if(triangles.length>=triangleLimit)break;
  }
  if(!triangles.length)throw Error(`Fant ${candidates.length} merket slitelagsobjekt, men ingen oppovervendt flate kunne leses.`);
  return{triangles,labels,candidateCount:candidates.length,truncated:triangles.length>=triangleLimit};
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
 if(!model?.triangles?.length)return;
 context.fillStyle='rgba(232,82,35,.72)';
 context.strokeStyle='rgba(139,45,20,.75)';
 context.lineWidth=.35;
 context.beginPath();
 for(const triangle of model.triangles){
  const points=triangle.map(point=>projectPoint(point[0],point[1]));
  if(points.some(point=>!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)))continue;
  const screen=points.map(point=>[width/2+(point.x-center.x)*width/span,height/2-(point.y-center.y)*width/span]);
  if(screen.every(([x,y])=>x<0||x>width||y<0||y>height))continue;
  context.moveTo(screen[0][0],screen[0][1]);context.lineTo(screen[1][0],screen[1][1]);context.lineTo(screen[2][0],screen[2][1]);context.closePath();
 }
 context.fill();context.stroke();
}
