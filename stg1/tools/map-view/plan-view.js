import {readWearSurface,drawWearSurface,readIfcObjectLayer,drawIfcObjectLayer,MAX_WEAR_TRIANGLES,MAX_IFC_OBJECT_TRIANGLES} from './ifc-surface.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.2-ifc-object-layer.1';
import {normalizeIfcObjectLayer} from './ifc-object-layer-config.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.2-ifc-object-layer.1';
import {readWearSurfaceCache,writeWearSurfaceCache,wearSurfaceCacheKey} from './ifc-surface-cache.js?v=2.05-preview.4-planview.6-ifc-read-test.6-2d-camera.2-wear-surface.6-multi-surface.2-hatch-cache.3-plan-performance.2-ifc-read-phases.2-yield-accounting.1-batched-yields.1-ifc-object-layer.2';
const MAX_WIDTH=1600;
const MAX_HEIGHT=1200;
const WORLD=20037508.342789244;
const WORLD_SIZE=WORLD*2;
const TILE_SIZE=256;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const BASEMAPS=Object.freeze({
 flyfoto:{label:'Flyfoto',type:'xyz',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',attribution:'Kilde: Esri World Imagery'},
 vektorkart:{label:'Vektorkart (OpenStreetMap)',type:'xyz',url:'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap contributors'},
 grunnkart:{label:'Grunnkart (Geonorge)',type:'wms',url:'https://wms.geonorge.no/skwms1/wms.norges_grunnkart',layer:'Norges_grunnkart',attribution:'Kartverket / Geonorge'},
 none:{label:'Ingen bakgrunn',type:'none',attribution:''}
});
const safeHost=host=>host.replace(/[^a-z0-9.-]/gi,'').slice(0,100);
const MODEL_CRS=Object.freeze([
 ...Array.from({length:26},(_,index)=>{const zone=index+5;return{code:`EPSG:${5100+zone}`,label:`EUREF89 NTM sone ${zone}`};}),
 {code:'EPSG:25832',label:'EUREF89 UTM sone 32N'},
 {code:'EPSG:25833',label:'EUREF89 UTM sone 33N'}
]);
const DEFAULT_MODEL_CRS='EPSG:5111';
function registerModelCrs(proj4){
 for(const {code} of MODEL_CRS){
  if(code==='EPSG:25832')proj4.defs(code,'+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
  else if(code==='EPSG:25833')proj4.defs(code,'+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
  else{const zone=Number(code.slice(5))-5100;proj4.defs(code,`+proj=tmerc +lat_0=58 +lon_0=${zone+0.5} +k=1 +x_0=100000 +y_0=1000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`);}
 }
}
function mapUrl(layer,bounds,width,height,version='1.1.1'){
 const url=new URL(layer.url);
 const params=url.searchParams;
 params.set('SERVICE','WMS');
 params.set('REQUEST','GetMap');
 params.set('VERSION',version);
 params.set('LAYERS',layer.layer);
 params.set('STYLES','');
 params.set(version==='1.3.0'?'CRS':'SRS','EPSG:3857');
 params.set('BBOX',bounds.map(value=>value.toFixed(2)).join(','));
 params.set('WIDTH',String(width));
 params.set('HEIGHT',String(height));
 params.set('FORMAT','image/png');
 params.set('TRANSPARENT','TRUE');
 return url.href;
}
function createPlanView({store}){
 let host=null,root=null,observer=null,timer=0,destroyed=false,unsubscribeStore=null,selectionController=null;
 let center={x:1170000,y:8370000},span=1400000,drag=null,pointerPosition=null;
 let currentModelCRS=DEFAULT_MODEL_CRS,lastCameraXY=null,cameraConnectionStarted=false;
 let baseMap='flyfoto',sharedBaseMap='flyfoto',userBaseMapSelected=false,layers=[],visible=new Set(),images=new Map();
 let wearSurfaces=[],projectedWearSurface=null,wearSurfaceExtent=null,surfaceFileIds=[],surfaceLoadToken=0,surfaceLoading=false,surfaceRefreshPending=false,wearSurfaceActive=false,lastWearDrawMs=0;
 let ifcObjectLayerConfig=normalizeIfcObjectLayer(null),objectLayerVisible=false,objectLayerModels=[],projectedObjectLayer=null,objectLayerFileIds=[],objectLayerLoadToken=0,objectLayerLoading=false;
 const memoryWearCache=new Map(),memoryObjectLayerCache=new Map();
 let projectedWearCache=new WeakMap(),projectedObjectCache=new WeakMap();
 const wearDrawWaiters=[];
 const waitForWearDraw=()=>new Promise(resolve=>wearDrawWaiters.push(resolve));
 const finishWearDraw=()=>{for(const resolve of wearDrawWaiters.splice(0))resolve(lastWearDrawMs);};
 const refresh=()=>{if(!root||destroyed)return;clearTimeout(timer);timer=setTimeout(draw,130);};
 const setLayers=next=>{
  const previous=new Set(layers.map(layer=>layer.id));
  layers=Array.isArray(next)?next:[];
  for(const layer of layers)if(!previous.has(layer.id)&&layer.visibleByDefault)visible.add(layer.id);
  for(const id of [...visible])if(!layers.some(layer=>layer.id===id))visible.delete(id);
  renderLayerList();
  refresh();
 };
 const setPlanConfig=plan=>{
  sharedBaseMap=Object.prototype.hasOwnProperty.call(BASEMAPS,plan?.baseMap)?plan.baseMap:'flyfoto';
  if(!userBaseMapSelected)baseMap=sharedBaseMap;
  const selector=root?.querySelector('[data-plan-basemap]');
  if(selector)selector.value=baseMap;
  const summary=root?.querySelector('[data-plan-basemap-label]');
  if(summary)summary.textContent=`Prosjektstandard: ${BASEMAPS[sharedBaseMap].label}${userBaseMapSelected&&baseMap!==sharedBaseMap?` · Ditt valg: ${BASEMAPS[baseMap].label}`:''}`;
  setLayers(plan?.layers);
  const nextObjectConfig=normalizeIfcObjectLayer(plan?.ifcObjectLayer);
  const configChanged=JSON.stringify(nextObjectConfig)!==JSON.stringify(ifcObjectLayerConfig);
  ifcObjectLayerConfig=nextObjectConfig;
  if(configChanged){
   objectLayerLoadToken++;objectLayerVisible=ifcObjectLayerConfig.enabled;objectLayerModels=[];projectedObjectLayer=null;
   const objectStatus=root?.querySelector('[data-ifc-object-status]');if(objectStatus)objectStatus.textContent=ifcObjectLayerConfig.enabled?'Fellesfilter eller fargeregler ble endret. Les IFC-objektslaget på nytt.':'IFC-objektslaget er ikke aktivert i fellesinnstillingene.';
  }
  const toggle=root?.querySelector('[data-ifc-object-visible]'),readButton=root?.querySelector('[data-ifc-object-read]');
  if(toggle){toggle.disabled=!ifcObjectLayerConfig.enabled;toggle.checked=objectLayerVisible;}
  if(readButton)readButton.disabled=!ifcObjectLayerConfig.enabled||!ifcObjectLayerConfig.ifcType||objectLayerLoading||!window.DocLibLegacyBridge.listSelectedIfcFiles().length;
  refresh();
 };
 const note=(text,bad=false)=>{const el=root?.querySelector('[data-plan-status]');if(el){el.textContent=text;el.dataset.error=String(bad);}};
 const setCameraStatus=(text,bad=false)=>{const el=root?.querySelector('[data-plan-camera-status]');if(el){el.textContent=text;el.dataset.error=String(bad);}};
 const renderPointerCoordinates=()=>{
  const label=root?.querySelector('[data-plan-coordinates]');
  if(!label)return;
  if(!pointerPosition){label.textContent='Flytt musepekeren over kartet for koordinater';return;}
  const map=root.querySelector('[data-plan-map]');
  const rect=map.getBoundingClientRect();
  const proj4=window.proj4;
  if(typeof proj4!=='function'){label.textContent=`${currentModelCRS} · koordinatomregning ikke tilgjengelig`;return;}
  try{
   registerModelCrs(proj4);
   const mapX=clamp(center.x+(pointerPosition.x-rect.left-rect.width/2)*span/rect.width,-WORLD,WORLD);
   const mapY=clamp(center.y-(pointerPosition.y-rect.top-rect.height/2)*span/rect.width,-WORLD,WORLD);
   const [x,y]=proj4('EPSG:3857',currentModelCRS,[mapX,mapY]);
   if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Ugyldig koordinat.');
   const format=value=>value.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2});
   label.textContent=`${currentModelCRS} · X ${format(x)} m · Y ${format(y)} m`;
  }catch{label.textContent=`${currentModelCRS} · koordinatet kunne ikke beregnes`;}
 };
 const updatePointerCoordinates=event=>{pointerPosition={x:event.clientX,y:event.clientY};renderPointerCoordinates();};
 const clearPointerCoordinates=()=>{pointerPosition=null;renderPointerCoordinates();};
 const applyCameraPoint=(x,y)=>{
  const proj4=window.proj4;
  if(typeof proj4!=='function'){setCameraStatus('Koordinatomregning er ikke tilgjengelig; kontroller lasting av proj4.',true);return;}
  try{
   registerModelCrs(proj4);
   const [longitude,latitude]=proj4(currentModelCRS,'EPSG:4326',[x,y]);
   if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>=90)throw Error('Ugyldige geografiske koordinater.');
   center.x=clamp(longitude*WORLD/180,-WORLD,WORLD);
   const mercatorY=Math.log(Math.tan((90+latitude)*Math.PI/360))/(Math.PI/180)*WORLD/180;
   center.y=clamp(mercatorY,-WORLD,WORLD);
   renderPointerCoordinates();
   setCameraStatus(`Kartet følger senterpunktet fra Trimble-viseren · ${currentModelCRS} · X ${x.toFixed(1)}, Y ${y.toFixed(1)} m`);
   refresh();
  }catch(error){setCameraStatus(`Kunne ikke konvertere kamerakoordinatene (${currentModelCRS}): ${error?.message||String(error)}`,true);}
 };
 const projectModelPoint=(proj4,x,y)=>{
  const [longitude,latitude]=proj4(currentModelCRS,'EPSG:4326',[x,y]);
  if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(latitude)>=90)throw Error('IFC-flaten ga ugyldige geografiske koordinater.');
  const mercatorX=clamp(longitude*WORLD/180,-WORLD,WORLD);
  const mercatorY=clamp(Math.log(Math.tan((90+latitude)*Math.PI/360))/(Math.PI/180)*WORLD/180,-WORLD,WORLD);
  return[mercatorX,mercatorY];
 };
 const projectWearSurface=()=>{
  if(!wearSurfaces.length){projectedWearSurface=null;wearSurfaceExtent=null;const focusButton=root?.querySelector('[data-ifc-focus]');if(focusButton)focusButton.hidden=true;return{cacheHits:0,cacheMisses:0};}
  let cacheHits=0,cacheMisses=0;
  try{
   const proj4=window.proj4;
   if(typeof proj4!=='function')throw Error('Proj4 er ikke tilgjengelig.');
   registerModelCrs(proj4);
   const surfaces=[];
   const extent={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
   let triangleCount=0;
   for(const model of wearSurfaces){
    const source=model.geometrySource||model;
    let modelCache=projectedWearCache.get(source);
    if(!modelCache){modelCache=new Map();projectedWearCache.set(source,modelCache);}
    const cacheKey=`${currentModelCRS}:${model.triangles.length}`;
    let projected=modelCache.get(cacheKey);
    if(projected)cacheHits++;
    else{
     const triangles=new Array(model.triangles.length);
     const modelExtent={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
     for(let triangleIndex=0;triangleIndex<model.triangles.length;triangleIndex++){
      const triangle=model.triangles[triangleIndex],points=new Array(3);
      for(let pointIndex=0;pointIndex<3;pointIndex++){
       const point=triangle[pointIndex],xy=projectModelPoint(proj4,point[0],point[1]);
       points[pointIndex]=[xy[0],xy[1],point[2]];
       modelExtent.minX=Math.min(modelExtent.minX,xy[0]);modelExtent.minY=Math.min(modelExtent.minY,xy[1]);
       modelExtent.maxX=Math.max(modelExtent.maxX,xy[0]);modelExtent.maxY=Math.max(modelExtent.maxY,xy[1]);
      }
      triangles[triangleIndex]=points;
     }
     projected={triangles,extent:modelExtent};
     modelCache.set(cacheKey,projected);
     if(modelCache.size>4)modelCache.delete(modelCache.keys().next().value);
     cacheMisses++;
    }
    surfaces.push(projected);
    triangleCount+=projected.triangles.length;
    extent.minX=Math.min(extent.minX,projected.extent.minX);extent.minY=Math.min(extent.minY,projected.extent.minY);
    extent.maxX=Math.max(extent.maxX,projected.extent.maxX);extent.maxY=Math.max(extent.maxY,projected.extent.maxY);
   }
   projectedWearSurface={surfaces,triangleCount};
   wearSurfaceExtent=extent;
   const focusButton=root?.querySelector('[data-ifc-focus]');if(focusButton)focusButton.hidden=false;
  }catch(error){projectedWearSurface=null;wearSurfaceExtent=null;setCameraStatus(`Slitelagsflaten kunne ikke projiseres (${currentModelCRS}): ${error?.message||String(error)}`,true);}
  return{cacheHits,cacheMisses};
 };
 const projectIfcObjectLayer=()=>{
  if(!objectLayerModels.length){projectedObjectLayer=null;return{cacheHits:0,cacheMisses:0};}
  let cacheHits=0,cacheMisses=0;const surfaces=[];
  try{
   const proj4=window.proj4;if(typeof proj4!=='function')throw Error('Proj4 er ikke tilgjengelig.');registerModelCrs(proj4);
   for(const model of objectLayerModels){
    const source=model.geometrySource||model;let cache=projectedObjectCache.get(source);if(!cache){cache=new Map();projectedObjectCache.set(source,cache);}
    const key=`${currentModelCRS}:${model.triangles.length}`;let projected=cache.get(key);
    if(projected)cacheHits++;else{
     const triangles=new Array(model.triangles.length);
     for(let index=0;index<model.triangles.length;index++){
      const triangle=model.triangles[index],points=new Array(3);
      for(let pointIndex=0;pointIndex<3;pointIndex++){const point=triangle[pointIndex],xy=projectModelPoint(proj4,point[0],point[1]);points[pointIndex]=[xy[0],xy[1],point[2]];}
      triangles[index]=points;
     }
     projected={triangles,colors:model.colors};cache.set(key,projected);if(cache.size>4)cache.delete(cache.keys().next().value);cacheMisses++;
    }
    surfaces.push(projected);
   }
   projectedObjectLayer={surfaces,triangleCount:surfaces.reduce((sum,item)=>sum+item.triangles.length,0)};
  }catch(error){projectedObjectLayer=null;const status=root?.querySelector('[data-ifc-object-status]');if(status)status.textContent=`IFC-objektene kunne ikke projiseres: ${error?.message||String(error)}`;}
  return{cacheHits,cacheMisses};
 };
 const focusWearSurface=()=>{
  if(!wearSurfaceExtent)return;
  const extent=wearSurfaceExtent,width=extent.maxX-extent.minX,height=extent.maxY-extent.minY;
  center={x:(extent.minX+extent.maxX)/2,y:(extent.minY+extent.maxY)/2};
  const rect=root?.querySelector('[data-plan-map]')?.getBoundingClientRect();
  const aspect=rect?.width&&rect?.height?rect.width/rect.height:1;
  span=clamp(Math.max(width,height*aspect,100)*1.2,1000,2*WORLD);
  setCameraStatus(`Kartet zoomet til slitelagsflaten · ${currentModelCRS}. Kartet kan flyttes manuelt; neste kamerahendelse følger Trimble-viseren igjen.`);
  renderPointerCoordinates();
  refresh();
 };
 const handleCameraEvent=(event,payload)=>{
  if(!['viewer.onCameraChanged','viewer.cameraChanged','cameraChanged'].includes(event))return;
  const cameraData=payload?.data;
  const point=cameraData?.lookAt||cameraData?.position;
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
  lastCameraXY={x:point.x,y:point.y};
  applyCameraPoint(point.x,point.y);
 };
 const connectCameraSync=async()=>{
  if(cameraConnectionStarted)return;
  if(typeof window.TrimbleConnectWorkspace==='undefined'){setCameraStatus('Trimble Workspace API ikke tilgjengelig; kartet kan fortsatt flyttes manuelt.',true);return;}
  cameraConnectionStarted=true;
  try{
   await window.TrimbleConnectWorkspace.connect(window.parent,handleCameraEvent);
   setCameraStatus(lastCameraXY?`Kartet følger senterpunktet fra Trimble-viseren · ${currentModelCRS}`:'Tilkoblet til prosjektviseren. Flytt kameraet der for å sentrere 2D-kartet.');
   if(lastCameraXY)applyCameraPoint(lastCameraXY.x,lastCameraXY.y);
  }catch(error){cameraConnectionStarted=false;setCameraStatus(`Kunne ikke koble til prosjektviserens koordinater: ${error?.message||String(error)}`,true);}
 };
 const renderLayerList=()=>{
  const list=root?.querySelector('[data-plan-layers]');
  if(!list)return;
  list.replaceChildren();
  if(!layers.length){
   const empty=document.createElement('p');
   empty.className='plan-empty';
   empty.textContent='Ingen tematiske WMS-overlegg er konfigurert. En administrator kan legge dem til i «Innstillinger (felles)».';
   list.append(empty);
   return;
  }
  for(const layer of layers){
   const label=document.createElement('label');
   label.className='plan-layer-toggle';
   const input=document.createElement('input');
   input.type='checkbox';
   input.checked=visible.has(layer.id);
   input.addEventListener('change',()=>{
    if(input.checked)visible.add(layer.id);
    else visible.delete(layer.id);
    refresh();
   });
   const name=document.createElement('span');
   name.textContent=layer.name;
   name.title=`${layer.layer} · ${safeHost(new URL(layer.url).hostname)}`;
   label.append(input,name);
   list.append(label);
  }
 };
 function drawBase(container,bounds,cssWidth,cssHeight,pixelWidth,pixelHeight){
  container.replaceChildren();
  const definition=BASEMAPS[baseMap]||BASEMAPS.flyfoto;
  let baseErrorReported=false;
  const reportBaseError=()=>{if(baseErrorReported)return;baseErrorReported=true;note('Bakgrunnskartet kunne ikke hentes. Kontroller tjenesten eller nettverkstilgangen.',true);};
  const attribution=root.querySelector('[data-plan-attribution]');
  attribution.replaceChildren();
  const credits=new Set();
  if(baseMap==='vektorkart')credits.add('© OpenStreetMap contributors');
  else if(definition.attribution)credits.add(definition.attribution);
  for(const layer of layers)if(visible.has(layer.id)&&layer.attribution)credits.add(layer.attribution);
  attribution.hidden=!credits.size;
  attribution.textContent=[...credits].join(' · ');
  if(definition.type==='none')return;
  if(definition.type==='wms'){
   const image=document.createElement('img');
   image.className='plan-base-image';
   image.alt='';
   image.draggable=false;
   image.onerror=reportBaseError;
   image.src=mapUrl(definition,bounds,pixelWidth,pixelHeight,'1.3.0');
   container.append(image);
   return;
  }
  const rawZoom=Math.log2((WORLD_SIZE*cssWidth)/(TILE_SIZE*span));
  const zoom=clamp(Math.round(rawZoom),0,19);
  const tileCount=2**zoom;
  const tileResolution=WORLD_SIZE/(TILE_SIZE*tileCount);
  const scale=tileResolution/(span/cssWidth);
  const screenTileSize=TILE_SIZE*scale;
  const centerPixelX=(center.x+WORLD)/tileResolution;
  const centerPixelY=(WORLD-center.y)/tileResolution;
  const firstX=Math.floor((centerPixelX-cssWidth/(2*scale))/TILE_SIZE);
  const lastX=Math.floor((centerPixelX+cssWidth/(2*scale))/TILE_SIZE);
  const firstY=Math.max(0,Math.floor((centerPixelY-cssHeight/(2*scale))/TILE_SIZE));
  const lastY=Math.min(tileCount-1,Math.floor((centerPixelY+cssHeight/(2*scale))/TILE_SIZE));
  for(let y=firstY;y<=lastY;y++){
   for(let x=firstX;x<=lastX;x++){
    const wrappedX=((x%tileCount)+tileCount)%tileCount;
    const image=document.createElement('img');
    image.className='plan-base-tile';
    image.alt='';
    image.draggable=false;
    image.width=TILE_SIZE;
    image.height=TILE_SIZE;
    image.style.width=`${screenTileSize}px`;
    image.style.height=`${screenTileSize}px`;
    image.style.left=`${cssWidth/2+(x*TILE_SIZE-centerPixelX)*scale}px`;
    image.style.top=`${cssHeight/2+(y*TILE_SIZE-centerPixelY)*scale}px`;
    image.onerror=reportBaseError;
    image.src=definition.url.replace('{z}',String(zoom)).replace('{x}',String(wrappedX)).replace('{y}',String(y));
    container.append(image);
   }
  }
 }
 function draw(){
  if(!root){finishWearDraw();return;}
  const map=root.querySelector('[data-plan-map]');
  const rect=map.getBoundingClientRect();
  if(rect.width<20||rect.height<20){lastWearDrawMs=0;finishWearDraw();return;}
  const cssWidth=rect.width;
  const cssHeight=rect.height;
  const pixelRatio=window.devicePixelRatio||1;
  const width=clamp(Math.round(cssWidth*pixelRatio),200,MAX_WIDTH);
  const height=clamp(Math.round(cssHeight*pixelRatio),150,MAX_HEIGHT);
  const halfX=span/2;
  const halfY=span*cssHeight/cssWidth/2;
  const bounds=[Math.max(-WORLD,center.x-halfX),Math.max(-WORLD,center.y-halfY),Math.min(WORLD,center.x+halfX),Math.min(WORLD,center.y+halfY)];
  drawBase(root.querySelector('[data-plan-base]'),bounds,cssWidth,cssHeight,width,height);
  const surfaceCanvas=root.querySelector('[data-plan-wear-surface]');
  const wearDrawStarted=performance.now();
  if(surfaceCanvas)drawWearSurface(surfaceCanvas,projectedWearSurface,{center,span,width:cssWidth,height:cssHeight,projectPoint:(x,y)=>({x,y})});
  const objectCanvas=root.querySelector('[data-plan-object-layer]');
  if(objectCanvas){objectCanvas.hidden=!objectLayerVisible;if(objectLayerVisible)drawIfcObjectLayer(objectCanvas,projectedObjectLayer,{center,span,width:cssWidth,height:cssHeight});else objectCanvas.getContext('2d')?.clearRect(0,0,objectCanvas.width,objectCanvas.height);}
  lastWearDrawMs=performance.now()-wearDrawStarted;
  finishWearDraw();
  const current=[...visible].map(id=>layers.find(layer=>layer.id===id)).filter(Boolean);
  for(const[id,image]of images){
   if(!current.some(layer=>layer.id===id)){
    image.remove();
    images.delete(id);
   }
  }
  if(!current.length){
   note(layers.length?'Bakgrunnskart vist. Slå på et WMS-overlegg for å vise flere data.':'Bakgrunnskart vist. Tematiske WMS-overlegg kan legges til i fellesinnstillingene.');
   return;
  }
  note('Henter kartbilder …');
  let pending=current.length,failed=0;
  for(const layer of current){
   let image=images.get(layer.id);
   if(!image){
    image=document.createElement('img');
    image.className='plan-map-image';
    image.alt='';
    image.draggable=false;
    images.set(layer.id,image);
    map.append(image);
   }
   image.onload=()=>{
    pending--;
    if(!pending)note(failed?`${failed} WMS-overlegg kunne ikke vises.`:`${current.length} WMS-overlegg vist.`,failed>0);
   };
   image.onerror=()=>{
    pending--;
    failed++;
    if(!pending)note(`${failed} WMS-overlegg kunne ikke vises. Kontroller tjenesteadresse og lag-ID.`,true);
   };
   image.src=mapUrl(layer,bounds,width,height);
  }
 }
 function moveStart(event){
  if(event.button!==0||event.target.closest('button'))return;
  drag={x:event.clientX,y:event.clientY,centerX:center.x,centerY:center.y};
  root.querySelector('[data-plan-map]').setPointerCapture(event.pointerId);
 }
 function move(event){
  if(!drag)return;
  const rect=root.querySelector('[data-plan-map]').getBoundingClientRect();
  const scale=span/rect.width;
  center.x=clamp(drag.centerX-(event.clientX-drag.x)*scale,-WORLD,WORLD);
  center.y=clamp(drag.centerY+(event.clientY-drag.y)*scale,-WORLD,WORLD);
  refresh();
 }
 function moveEnd(){drag=null;}
 function zoomWheel(event){
  const map=root?.querySelector('[data-plan-map]');
  if(!map)return;
  const rect=map.getBoundingClientRect();
  if(rect.width<20||rect.height<20)return;
  const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*rect.height:event.deltaY;
  if(!delta)return;
  event.preventDefault();
  const oldSpan=span;
  const nextSpan=clamp(oldSpan*Math.exp(delta*0.0012),1000,2*WORLD);
  if(nextSpan===oldSpan)return;
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  const offsetX=x-rect.width/2,offsetY=y-rect.height/2;
  const pointX=center.x+offsetX*oldSpan/rect.width;
  const pointY=center.y-offsetY*oldSpan/rect.width;
  center.x=clamp(pointX-offsetX*nextSpan/rect.width,-WORLD,WORLD);
  center.y=clamp(pointY+offsetY*nextSpan/rect.width,-WORLD,WORLD);
  span=nextSpan;
  renderPointerCoordinates();
  refresh();
 }
 function selectionKey(file){return JSON.stringify([String(file.id),String(file.versionId||'')]);}
 function sameIfcSelection(files,keys){return files.length===keys.length&&files.every((file,index)=>selectionKey(file)===keys[index]);}
 function showMemorySelection(files){
  const projectId=String(window.DocLibLegacyBridge.getProject()?.id||''),models=[];
  let remaining=MAX_WEAR_TRIANGLES;
  for(const file of files){
   if(remaining<1)break;
   const key=wearSurfaceCacheKey(projectId,file),cached=key?memoryWearCache.get(key):null;
   if(!cached)continue;
   const triangles=cached.triangles.length<=remaining?cached.triangles:cached.triangles.slice(0,remaining);
   models.push({...cached,triangles,geometrySource:cached,fileId:file.id,fileName:file.name});
   remaining-=triangles.length;
  }
  wearSurfaces=models;
  projectWearSurface();
  refresh();
 }
 function refreshSelectedIfcFiles(){
  if(!root)return;
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles();
  const summary=root.querySelector('[data-ifc-selection-summary]');
  const list=root.querySelector('[data-ifc-selection-list]');
  summary.textContent=files.length?`${files.length} IFC-modell${files.length===1?'':'er'} valgt fra treet.`:'Velg IFC-modeller i treet til venstre.';
  list.replaceChildren();
  for(const file of files){const item=document.createElement('li');item.textContent=`${file.folderPath} / ${file.name}`;list.append(item);}
  root.querySelector('[data-ifc-read]').disabled=!files.length;
  const surfaceButton=root.querySelector('[data-ifc-surface]');
  if(surfaceButton)surfaceButton.disabled=!files.length||surfaceLoading;
  const objectReadButton=root.querySelector('[data-ifc-object-read]');if(objectReadButton)objectReadButton.disabled=!files.length||objectLayerLoading||!ifcObjectLayerConfig.enabled||!ifcObjectLayerConfig.ifcType;
  if(!sameIfcSelection(files,objectLayerFileIds)){
   objectLayerLoadToken++;objectLayerFileIds=files.map(selectionKey);objectLayerModels=[];projectedObjectLayer=null;
   const objectStatus=root.querySelector('[data-ifc-object-status]');if(objectStatus)objectStatus.textContent=files.length?'IFC-utvalget ble endret. Les objektslaget på nytt for å vise geometrien.':'Velg IFC-modeller og les objektslaget.';
   refresh();
  }
  if(sameIfcSelection(files,surfaceFileIds))return;
  const hadPreview=wearSurfaceActive;
  const hadDisplayed=wearSurfaces.length>0;
  if(!files.length)surfaceRefreshPending=false;
  surfaceLoadToken++;
  surfaceFileIds=files.map(selectionKey);
  if(hadPreview){
   showMemorySelection(files);
   const surfaceResult=root.querySelector('[data-ifc-surface-result]');
   if(surfaceResult)surfaceResult.textContent=files.length?'IFC-utvalget ble endret. Leser hurtigbuffer og behandler bare manglende filer …':'Ingen IFC-modeller valgt; slitelagsflaten er skjult.';
   if(files.length){
    if(surfaceLoading)surfaceRefreshPending=true;
    else void runIfcSurfacePreview(surfaceButton,true);
   }
  }else if(hadDisplayed){
   wearSurfaces=[];projectWearSurface();
   const surfaceResult=root.querySelector('[data-ifc-surface-result]');if(surfaceResult)surfaceResult.textContent='Slitelagsflatene ble skjult fordi IFC-utvalget ble endret.';
   refresh();
  }
 }
 async function runIfcObjectLayerPreview(button){
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles(),result=root?.querySelector('[data-ifc-object-status]');
  if(!ifcObjectLayerConfig.enabled){if(result)result.textContent='IFC-objektslaget er ikke aktivert i «Innstillinger (felles)».';return;}
  if(!ifcObjectLayerConfig.ifcType){if(result)result.textContent='Angi IFC-type i «Innstillinger (felles)».';return;}
  if(!files.length){if(result)result.textContent='Velg én eller flere IFC-modeller fra treet først.';return;}
  if(objectLayerLoading)return;
  const token=++objectLayerLoadToken,keys=files.map(selectionKey),configKey=JSON.stringify(ifcObjectLayerConfig),models=[],reports=[];
  let remaining=MAX_IFC_OBJECT_TRIANGLES;objectLayerLoading=true;button.disabled=true;
  const selectionIsCurrent=()=>token===objectLayerLoadToken&&sameIfcSelection(window.DocLibLegacyBridge.listSelectedIfcFiles(),keys);
  const formatSeconds=ms=>`${(ms/1000).toFixed(2).replace('.',',')} s`;
  try{
   for(let index=0;index<files.length;index++){
    if(!selectionIsCurrent())return;
    if(remaining<1){reports.push(`${files[index].name}: hoppet over fordi grensen på ${MAX_IFC_OBJECT_TRIANGLES.toLocaleString('nb-NO')} trekanter er nådd.`);continue;}
    const file=files[index],key=JSON.stringify([String(file.id),String(file.versionId||''),configKey]);let model=memoryObjectLayerCache.get(key),source=model?'minnecache':'ny behandling',started=performance.now();
    try{
     if(!model){
      if(result)result.textContent=`Henter og leser IFC ${index+1} av ${files.length}: ${file.name} …`;
      const buffer=await window.DocLibLegacyBridge.downloadIfcForSurface(file.id);if(!selectionIsCurrent())return;
      model=await readIfcObjectLayer(buffer,ifcObjectLayerConfig,message=>{if(result&&selectionIsCurrent())result.textContent=`${file.name} · ${message}`;},remaining);
      memoryObjectLayerCache.set(key,model);if(memoryObjectLayerCache.size>12)memoryObjectLayerCache.delete(memoryObjectLayerCache.keys().next().value);
     }
     if(!selectionIsCurrent())return;
     const count=Math.min(model.triangles.length,remaining),displayModel={...model,triangles:model.triangles.slice(0,count),colors:model.colors.slice(0,count),geometrySource:model,fileId:file.id,fileName:file.name};
     if(count)models.push(displayModel);remaining-=count;
     const truncated=model.truncated||count<model.triangles.length;
     reports.push(`${file.name}: ${count.toLocaleString('nb-NO')} trekanter fra ${model.candidateCount} objekt(er) · ${source}${truncated?' · avkortet av trekantgrensen':''} · ${formatSeconds(performance.now()-started)}`);
    }catch(error){reports.push(`${file.name}: ${error?.message||String(error)}`);}
   }
   if(!selectionIsCurrent())return;
   if(!models.length)throw Error('Ingen valgte IFC-modeller ga oppovervendt geometri for dette objektslaget.');
   objectLayerModels=models;objectLayerFileIds=keys;const projection=projectIfcObjectLayer();
   if(!projectedObjectLayer)throw Error('IFC-objektgeometrien kunne ikke konverteres til valgt CRS.');
   objectLayerVisible=true;const toggle=root.querySelector('[data-ifc-object-visible]');if(toggle)toggle.checked=true;
   const drawWait=waitForWearDraw();refresh();const drawMs=await drawWait;
   if(result)result.textContent=`Viser ${projectedObjectLayer.triangleCount.toLocaleString('nb-NO')} trekanter fra ${models.reduce((sum,model)=>sum+model.candidateCount,0)} objekt(er) i ${models.length} av ${files.length} IFC-modell(er). ${projection.cacheHits} projiseringscachetreff, ${projection.cacheMisses} nye projiseringer; tegning ${formatSeconds(drawMs)}. Fargene følger første egenskap med en definert verdifarge; ellers brukes standardfargen.\n${reports.join('\n')}`;
  }catch(error){if(result&&token===objectLayerLoadToken)result.textContent=`IFC-objektslaget ble ikke vist: ${error?.message||String(error)}${reports.length?`\n${reports.join('\n')}`:''}`;}
  finally{objectLayerLoading=false;if(button.isConnected)button.disabled=!window.DocLibLegacyBridge.listSelectedIfcFiles().length||!ifcObjectLayerConfig.enabled||!ifcObjectLayerConfig.ifcType;}
 }
 async function runIfcReadTest(result,button){
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles();
  if(!files.length){result.textContent='Velg én eller flere IFC-modeller i treet til venstre først.';return;}
  button.disabled=true;
  const reports=[];
  try{
   for(let index=0;index<files.length;index++){
    const file=files[index];
    result.textContent=`Leser IFC ${index+1} av ${files.length}: ${file.name} …`;
    try{
     const data=await window.DocLibLegacyBridge.readIfcMetadata(file.id);
     reports.push(['Lesing OK',`Fil: ${data.fileName}`,`Versjons-ID: ${data.versionId||'ikke oppgitt'}`,`Property-set-definisjoner: ${data.propertySetDefinitionCount}`,`Modellens rapporterte objekter: ${data.entityTotal}`,`Leste eksempelobjekter: ${data.sampleEntityIds.length}${data.sampleEntityIds.length?` (ID ${data.sampleEntityIds.join(', ')})`:''}`].join('\n'));
    }catch(error){reports.push(`Lesing feilet — ${file.name}: ${error?.message||String(error)}`);}
   }
   result.textContent=`Testet ${files.length} valgte IFC-modell${files.length===1?'':'er'}:\n\n${reports.join('\n\n')}\n\nDette tester metadata via Trimble Model API. Bruk den separate slitelag-knappen for en avgrenset geometriprøve.`;
  }finally{refreshSelectedIfcFiles();}
 }
 async function runIfcSurfacePreview(button,automatic=false){
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles();
  const result=root?.querySelector('[data-ifc-surface-result]');
  if(!files.length){surfaceRefreshPending=false;if(result)result.textContent='Velg én eller flere IFC-modeller i treet til venstre.';return;}
  if(surfaceLoading){surfaceRefreshPending=true;return;}
  wearSurfaceActive=true;
  const token=++surfaceLoadToken,selectedKeys=files.map(selectionKey),models=[],reports=[];
  const projectId=String(window.DocLibLegacyBridge.getProject()?.id||'');
  const runStarted=performance.now();
  const formatSeconds=milliseconds=>`${(milliseconds/1000).toFixed(1).replace('.',',')} s`;
   const formatDetailSeconds=milliseconds=>`${(milliseconds/1000).toFixed(2).replace('.',',')} s`;
  let remaining=MAX_WEAR_TRIANGLES;
  surfaceLoading=true;button.disabled=true;
  const selectionIsCurrent=()=>token===surfaceLoadToken&&sameIfcSelection(window.DocLibLegacyBridge.listSelectedIfcFiles(),selectedKeys);
  try{
   for(let index=0;index<files.length;index++){
    if(!selectionIsCurrent())return;
    const file=files[index],key=wearSurfaceCacheKey(projectId,file);
    if(remaining<1){reports.push(`${file.name}: hoppet over fordi samlet sikkerhetsgrense på ${MAX_WEAR_TRIANGLES.toLocaleString('nb-NO')} trekanter er nådd.`);continue;}
    try{
     const timings={cache:0,download:0,read:0,save:0,readDetails:null};
     let model=key?memoryWearCache.get(key):null;
     let source=model?'minnebuffer':'';
     if(!model&&key){
      if(result)result.textContent=`Sjekker lokal cache ${index+1} av ${files.length}: ${file.name} …`;
      const cacheStarted=performance.now();
      try{model=await readWearSurfaceCache(key);}catch(error){reports.push(`${file.name}: lokal cache kunne ikke leses (${error?.message||String(error)}); henter originalfilen.`);}
      timings.cache+=performance.now()-cacheStarted;
      if(!selectionIsCurrent())return;
      if(model){memoryWearCache.set(key,model);source='lokal cache';}
     }
     if(!model){
      if(result)result.textContent=`Henter og behandler IFC ${index+1} av ${files.length}: ${file.name} …`;
      const downloadStarted=performance.now();
      const buffer=await window.DocLibLegacyBridge.downloadIfcForSurface(file.id);
      timings.download=performance.now()-downloadStarted;
      if(!selectionIsCurrent())return;
      const readStarted=performance.now();
      model=await readWearSurface(buffer,message=>{if(result&&selectionIsCurrent())result.textContent=`${file.name} · ${message}`;},MAX_WEAR_TRIANGLES);
      timings.read=performance.now()-readStarted;
      timings.readDetails=model.timings||null;
      if(!selectionIsCurrent())return;
      source=key?'nybehandlet':'nybehandlet; ikke cachet fordi Trimble mangler versjons-ID';
      if(key){
       memoryWearCache.set(key,model);
       const saveStarted=performance.now();
       try{await writeWearSurfaceCache(projectId,file,key,model);source='nybehandlet og lagret lokalt';}
       catch(error){source=`nybehandlet; lokal lagring feilet (${error?.message||String(error)})`;}
       timings.save=performance.now()-saveStarted;
      }
     }
     if(!selectionIsCurrent())return;
     const shownTriangles=model.triangles.length<=remaining?model.triangles:model.triangles.slice(0,remaining);
     const aggregateLimited=shownTriangles.length<model.triangles.length;
     const displayModel={...model,triangles:shownTriangles,geometrySource:model,fileId:file.id,fileName:file.name};
     if(shownTriangles.length){models.push(displayModel);remaining-=shownTriangles.length;}
     const shownCount=shownTriangles.length.toLocaleString('nb-NO');
     const limitNote=aggregateLimited?' (avkortet av samlet visningsgrense)':'';
     const modelLimitNote=model.truncated?' (denne IFC-en nådde grensen på 120 000 trekanter)':'';
     const timingNote=`Tid: cache ${formatSeconds(timings.cache)}, nedlasting ${formatSeconds(timings.download)}, IFC-lesing ${formatSeconds(timings.read)}, lagring ${formatSeconds(timings.save)}`;
     const readDetail=timings.readDetails;
     const measuredReadMs=readDetail?readDetail.setup+readDetail.lineScan+readDetail.lineScanYield+readDetail.objectProcessing+readDetail.objectYield:0;
     const unclassifiedReadMs=readDetail?Math.max(0,timings.read-measuredReadMs):0;
     const readDetailNote=readDetail?` Delmålinger: oppstart/åpning ${formatDetailSeconds(readDetail.setup)}, linjeskanningsarbeid ${formatDetailSeconds(readDetail.lineScan)}, objektbehandling inkl. mesh/trekantfilter ${formatDetailSeconds(readDetail.objectProcessing)}, herav mesh-uttrekk ${formatDetailSeconds(readDetail.meshExtract)} og trekantfilter ${formatDetailSeconds(readDetail.triangleFilter)}, yield-venting skanning ${formatDetailSeconds(readDetail.lineScanYield)} + objekt ${formatDetailSeconds(readDetail.objectYield)}, uklassifisert resttid ${formatDetailSeconds(unclassifiedReadMs)}.`:'';
     reports.push(`${file.name}: ${shownCount} trekanter fra ${model.candidateCount} objekt(er) · ${source}${limitNote}${modelLimitNote}. ${timingNote}.${readDetailNote}`);
    }catch(error){reports.push(`${file.name}: ${error?.message||String(error)}`);}
   }
   if(!selectionIsCurrent())return;
   if(!models.length)throw Error('Ingen av de valgte IFC-modellene ga lesbar slitelagsgeometri.');
   wearSurfaces=models;surfaceFileIds=selectedKeys;
   const projectionStarted=performance.now();
   const projectionCache=projectWearSurface();
   const projectionMs=performance.now()-projectionStarted;
   if(!projectedWearSurface||!wearSurfaceExtent)throw Error('Geometrien kunne ikke konverteres til valgt CRS.');
   const drawWait=waitForWearDraw();
   refresh();
   const drawMs=await drawWait;
   const extentWidth=wearSurfaceExtent.maxX-wearSurfaceExtent.minX,extentHeight=wearSurfaceExtent.maxY-wearSurfaceExtent.minY;
   const extentCenter={x:(wearSurfaceExtent.minX+wearSurfaceExtent.maxX)/2,y:(wearSurfaceExtent.minY+wearSurfaceExtent.maxY)/2};
   const offset=Math.hypot(extentCenter.x-center.x,extentCenter.y-center.y);
   const fmt=value=>Math.round(value).toLocaleString('nb-NO');
   const cacheNote='Lokal cache lagres bare i denne nettleseren og krever Trimble-versjons-ID.';
   const totalTime=formatSeconds(performance.now()-runStarted);
   const projectionNote=`Projisering: ${formatSeconds(projectionMs)} (${projectionCache.cacheHits} cachetreff, ${projectionCache.cacheMisses} nye IFC-projiseringer) · tegning: ${formatSeconds(drawMs)}`;
   if(result)result.textContent=`Viser slitelag fra ${models.length} av ${files.length} valgte IFC-modeller (${projectedWearSurface.triangleCount.toLocaleString('nb-NO')} trekanter totalt). Samlet utstrekning ca. ${fmt(extentWidth)} × ${fmt(extentHeight)} m i ${currentModelCRS}; sentrum er ca. ${fmt(offset)} m fra kartets nåværende sentrum. Trykk «Zoom til slitelaget» for å vise alle.\nSamlet tid: ${totalTime}. ${projectionNote}. ${automatic?'Utvalget ble oppdatert automatisk. ':''}${cacheNote}\n\n${reports.join('\n')}`;
  }catch(error){if(result&&token===surfaceLoadToken)result.textContent=`Slitelagsgeometri ble ikke vist: ${error?.message||String(error)}${reports.length?`\n\n${reports.join('\n')}`:''}`;}
  finally{
   surfaceLoading=false;
   if(button.isConnected)button.disabled=!window.DocLibLegacyBridge.listSelectedIfcFiles().length;
   if(surfaceRefreshPending&&wearSurfaceActive&&root){surfaceRefreshPending=false;queueMicrotask(()=>runIfcSurfacePreview(button,true));}
  }
 }
 function build(){
  const style=document.createElement('style');
  style.dataset.planStyle='';
  style.textContent=`
  .plan-view{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:#f7f8fa;color:#172033;font:14px/1.45 Arial,sans-serif}
  .plan-coordinates{position:absolute;z-index:4;left:50%;bottom:8px;transform:translateX(-50%);max-width:calc(100% - 24px);padding:5px 9px;border:1px solid rgba(255,255,255,.35);border-radius:5px;background:rgba(15,23,42,.84);color:#fff;font:12px/1.3 Arial,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.25)}
  .plan-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #dce2ea;background:#fff}.plan-head h2{margin:0;font-size:18px}.plan-body{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:0;flex:1;min-height:0}.plan-map{position:relative;overflow:hidden;min-width:0;min-height:280px;background:#e9eef2;touch-action:none;cursor:grab}.plan-map:active{cursor:grabbing}.plan-base{position:absolute;inset:0;z-index:0;overflow:hidden}.plan-base-tile,.plan-base-image{position:absolute;max-width:none;pointer-events:none}.plan-base-image{inset:0;width:100%;height:100%;object-fit:fill}.plan-map-image{position:absolute;z-index:1;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}.plan-wear-surface{position:absolute;z-index:2;inset:0;pointer-events:none}.plan-tools{position:absolute;z-index:4;left:12px;top:12px;display:grid;gap:6px}.plan-tools button{width:38px;height:38px;border:1px solid #b9c4d0;border-radius:6px;background:#fff;color:#172033;font-size:20px;cursor:pointer}.plan-layers-panel{overflow:auto;padding:14px;background:#fff;border-left:1px solid #dce2ea}.plan-layers-panel h3{margin:0 0 8px;font-size:15px}.plan-basemap-summary{padding:8px;margin:0 0 12px;border-radius:5px;background:#f1f5f9;color:#334155;font-size:12px}.plan-layer-toggle{display:flex;align-items:flex-start;gap:8px;padding:8px 2px;border-bottom:1px solid #edf0f3;overflow-wrap:anywhere}.plan-layer-toggle input{margin-top:3px;accent-color:#1764df}.plan-empty{color:#566273;font-size:13px}.plan-crs-label{display:grid;gap:5px;font-size:12px;color:#334155}.plan-crs-label select{width:100%;min-height:34px;padding:5px;border:1px solid #b9c4d0;border-radius:5px;background:#fff}.plan-camera-status{margin:7px 0 14px;padding:7px;border-radius:5px;background:#f1f5f9;color:#334155;font-size:11px;overflow-wrap:anywhere}.plan-camera-status[data-error=true]{color:#9f2533;background:#fff1f2}.plan-status{position:absolute;z-index:3;left:62px;bottom:10px;max-width:calc(100% - 170px);padding:6px 9px;border-radius:5px;background:#ffffffdf;color:#334155;font-size:12px;pointer-events:none}.plan-status[data-error=true]{color:#9f2533}.plan-attribution{position:absolute;z-index:3;right:4px;bottom:3px;padding:3px 5px;border-radius:3px;background:#ffffffd9;color:#334155;font-size:10px;pointer-events:auto}.plan-attribution a{color:inherit}.plan-actions{display:flex;gap:6px}.plan-actions button{min-height:34px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer}.plan-actions button:hover{background:#f1f5f9}@media(max-width:720px){.plan-body{grid-template-columns:minmax(0,1fr)}.plan-layers-panel{max-height:180px;border-left:0;border-top:1px solid #dce2ea}.plan-map{min-height:320px}.plan-status{max-width:calc(100% - 24px);bottom:26px}}
  `;
  root=document.createElement('section');
  root.className='plan-view';
  root.innerHTML='<header class="plan-head"><h2>Planvisning · 2D</h2><div class="plan-actions"><label>Bakgrunn <select data-plan-basemap aria-label="Velg bakgrunnskart" style="max-width:220px;min-height:34px"><option value="flyfoto">Flyfoto</option><option value="vektorkart">Vektorkart (OpenStreetMap)</option><option value="grunnkart">Grunnkart (Geonorge)</option><option value="none">Ingen bakgrunn</option></select></label><button type="button" data-zoom-out aria-label="Zoom ut">−</button><button type="button" data-zoom-in aria-label="Zoom inn">+</button></div></header><div class="plan-body"><div class="plan-map" data-plan-map role="application" aria-label="2D-kartvisning. Dra for å flytte kartet. Bruk musehjulet for å zoome."><div class="plan-base" data-plan-base></div><canvas class="plan-wear-surface" data-plan-wear-surface aria-label="2D-projisert slitelagsflate"></canvas><div class="plan-tools"><button type="button" data-zoom-in aria-label="Zoom inn">+</button><button type="button" data-zoom-out aria-label="Zoom ut">−</button></div><div class="plan-status" data-plan-status role="status" aria-live="polite"></div><div class="plan-attribution" data-plan-attribution></div><div class="plan-coordinates" data-plan-coordinates role="status" aria-live="off">Flytt musepekeren over kartet for koordinater</div></div><aside class="plan-layers-panel"><h3>Posisjon og koordinatsystem</h3><label class="plan-crs-label">Modellens CRS<select data-plan-crs aria-label="Velg koordinatsystem for modellkamera"></select></label><p data-plan-camera-status class="plan-camera-status" role="status" aria-live="polite">Venter på kamerakoordinater …</p><h3>Bakgrunnskart</h3><div class="plan-basemap-summary" data-plan-basemap-label></div><h3>Kartlag</h3><div data-plan-layers></div><h3>Valgte IFC-modeller</h3><p data-ifc-selection-summary style="font-size:12px;color:#526173"></p><ul data-ifc-selection-list aria-label="Valgte IFC-filer fra treet" style="font-size:11px;padding-left:18px;max-height:130px;overflow:auto"></ul><button type="button" data-ifc-read disabled style="min-height:34px;padding:6px 10px;margin:6px 0">Test metadata for valgte</button><p data-ifc-result role="status" aria-live="polite" style="font-size:11px;color:#526173;white-space:pre-wrap;overflow-wrap:anywhere"></p><button type="button" data-ifc-surface disabled style="min-height:34px;padding:6px 10px;margin:6px 0">Vis slitelag fra valgte IFC-er</button><button type="button" data-ifc-focus hidden style="min-height:34px;padding:6px 10px;margin:6px 0">Zoom til slitelaget</button><p data-ifc-surface-result role="status" aria-live="polite" style="font-size:11px;color:#526173;white-space:pre-wrap;overflow-wrap:anywhere">Velg én eller flere IFC-er for å vise slitelagsflater samtidig. Filene behandles én om gangen; samlet grense er 120 000 trekanter.</p><p style="font-size:11px;color:#526173">Kartposisjonen følger Trimble-prosjektviserens kamerakoordinater. Velg IFC-er i treet til venstre for metadata-test. Dette verktøyet viser kun 2D-kart; IFC-geometri tegnes ikke i kartet.</p><pre data-ifc-result role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 Arial,sans-serif;color:#334155"></pre></aside></div>';
  root.prepend(style);
  const mapCanvas=root.querySelector('[data-plan-wear-surface]'),objectCanvas=document.createElement('canvas');
  objectCanvas.className='plan-object-layer';objectCanvas.dataset.planObjectLayer='';objectCanvas.setAttribute('aria-label','Fargelagt IFC-objektslag');objectCanvas.hidden=true;objectCanvas.style.cssText='position:absolute;z-index:3;inset:0;pointer-events:none';mapCanvas.after(objectCanvas);
  const objectControls=document.createElement('fieldset');objectControls.className='plan-ifc-object-controls';objectControls.style.cssText='margin:14px 0;padding:10px;border:1px solid #dce2ea;border-radius:6px';
  objectControls.innerHTML='<legend>IFC-objektslag</legend><label style="display:flex;gap:7px;align-items:center"><input type="checkbox" data-ifc-object-visible disabled> Vis objektslag</label><button type="button" data-ifc-object-read disabled style="margin-top:8px">Les IFC-objektslag</button><small data-ifc-object-status role="status" aria-live="polite" style="display:block;margin-top:7px;color:#526173">Konfigurer laget i «Innstillinger (felles)» og velg IFC-modeller.</small>';
  root.querySelector('.plan-layers-panel').append(objectControls);
  root.querySelector('[data-ifc-object-visible]').addEventListener('change',event=>{objectLayerVisible=event.target.checked;if(objectLayerVisible&&!projectedObjectLayer)root.querySelector('[data-ifc-object-status]').textContent='Ingen IFC-objekter er lest ennå. Trykk «Les IFC-objektslag».';refresh();});
  root.querySelector('[data-ifc-object-read]').addEventListener('click',event=>runIfcObjectLayerPreview(event.currentTarget));
  root.querySelector('[data-plan-basemap]').addEventListener('change',event=>{baseMap=event.target.value;userBaseMapSelected=true;const summary=root.querySelector('[data-plan-basemap-label]');if(summary)summary.textContent=`Prosjektstandard: ${BASEMAPS[sharedBaseMap].label} · Ditt valg: ${BASEMAPS[baseMap].label}`;refresh();});
  const crsSelect=root.querySelector('[data-plan-crs]');
  crsSelect.replaceChildren(...MODEL_CRS.map(({code,label})=>{const option=document.createElement('option');option.value=code;option.textContent=`${label} (${code})`;return option;}));
  crsSelect.value=currentModelCRS;
  crsSelect.addEventListener('change',()=>{currentModelCRS=crsSelect.value;projectWearSurface();projectIfcObjectLayer();if(lastCameraXY)applyCameraPoint(lastCameraXY.x,lastCameraXY.y);else setCameraStatus(`Valgt ${currentModelCRS}. Kartet sentreres når kamerakoordinater mottas.`);renderPointerCoordinates();refresh();});
  root.querySelector('[data-ifc-read]').addEventListener('click',event=>runIfcReadTest(root.querySelector('[data-ifc-result]'),event.currentTarget));
  root.querySelector('[data-ifc-surface]').addEventListener('click',event=>runIfcSurfacePreview(event.currentTarget));
  root.querySelector('[data-ifc-focus]').addEventListener('click',focusWearSurface);
  root.querySelectorAll('[data-zoom-in]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span/1.6,1000,2*WORLD);renderPointerCoordinates();refresh();}));
  root.querySelectorAll('[data-zoom-out]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span*1.6,1000,2*WORLD);renderPointerCoordinates();refresh();}));
  const map=root.querySelector('[data-plan-map]');
  map.addEventListener('pointerdown',moveStart);
  map.addEventListener('pointermove',move);
  map.addEventListener('pointermove',updatePointerCoordinates,{passive:true});
  map.addEventListener('pointerleave',clearPointerCoordinates);
  map.addEventListener('pointerup',moveEnd);
  map.addEventListener('pointercancel',moveEnd);
  map.addEventListener('wheel',zoomWheel,{passive:false});
  observer=new ResizeObserver(refresh);
  observer.observe(map);
 }
 return Object.freeze({
  mount(target){
   host=target;
   destroyed=false;
   userBaseMapSelected=false;
   host.replaceChildren();
   build();
   host.append(root);
   selectionController=new AbortController();
   window.addEventListener('doclib:explorer-selection-change',refreshSelectedIfcFiles,{signal:selectionController.signal});
   refreshSelectedIfcFiles();
   setPlanConfig(store.snapshot().plan||{});
   unsubscribeStore=store.subscribe(config=>setPlanConfig(config.plan||{}));
   if(lastCameraXY)applyCameraPoint(lastCameraXY.x,lastCameraXY.y);
   connectCameraSync();
  },
  render(){refresh();},
  update(change){if(change?.type==='project-state'){refreshSelectedIfcFiles();refresh();}},
  canLeave(){return true;},
  unmount(){
   clearTimeout(timer);
   lastWearDrawMs=0;
   finishWearDraw();
   unsubscribeStore?.();
   unsubscribeStore=null;
   selectionController?.abort();
   selectionController=null;
   observer?.disconnect();
   observer=null;
   root?.remove();
   root=null;
   images.clear();
  },
  destroy(){destroyed=true;this.unmount();}
 });
}
export default Object.freeze({id:'plan',title:'Planvisning',legacyMode:'plan',status:'module',create:context=>createPlanView(context)});
