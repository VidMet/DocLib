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
 let center={x:1170000,y:8370000},span=1400000,drag=null;
 let baseMap='flyfoto',sharedBaseMap='flyfoto',userBaseMapSelected=false,layers=[],visible=new Set(),images=new Map();
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
 };
 const note=(text,bad=false)=>{const el=root?.querySelector('[data-plan-status]');if(el){el.textContent=text;el.dataset.error=String(bad);}};
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
  if(!root)return;
  const map=root.querySelector('[data-plan-map]');
  const rect=map.getBoundingClientRect();
  if(rect.width<20||rect.height<20)return;
  const cssWidth=rect.width;
  const cssHeight=rect.height;
  const pixelRatio=window.devicePixelRatio||1;
  const width=clamp(Math.round(cssWidth*pixelRatio),200,MAX_WIDTH);
  const height=clamp(Math.round(cssHeight*pixelRatio),150,MAX_HEIGHT);
  const halfX=span/2;
  const halfY=span*cssHeight/cssWidth/2;
  const bounds=[Math.max(-WORLD,center.x-halfX),Math.max(-WORLD,center.y-halfY),Math.min(WORLD,center.x+halfX),Math.min(WORLD,center.y+halfY)];
  drawBase(root.querySelector('[data-plan-base]'),bounds,cssWidth,cssHeight,width,height);
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
  refresh();
 }
 function refreshSelectedIfcFiles(){
  if(!root)return;
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles();
  const summary=root.querySelector('[data-ifc-selection-summary]');
  const list=root.querySelector('[data-ifc-selection-list]');
  list.replaceChildren();
  if(!files.length){
   summary.textContent='Ingen IFC-modeller valgt. Velg modellene i Utforsker-tabellen først; valget følger med når du åpner Planvisning.';
  }else{
   summary.textContent=`${files.length} IFC-modell${files.length===1?'':'er'} valgt i Utforsker:`;
   for(const file of files){const item=document.createElement('li');item.textContent=`${file.folderPath} / ${file.name}`;list.append(item);}
  }
  root.querySelector('[data-ifc-read]').disabled=!files.length;
  root.querySelector('[data-ifc-open-viewer]').disabled=!files.length;
 }
 async function runIfcReadTest(result,button){
  const files=window.DocLibLegacyBridge.listSelectedIfcFiles();
  if(!files.length){result.textContent='Velg én eller flere IFC-modeller i Utforsker-tabellen først.';return;}
  button.disabled=true;
  root.querySelector('[data-ifc-open-viewer]').disabled=true;
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
   result.textContent=`Testet ${files.length} valgte IFC-modell${files.length===1?'':'er'}:\n\n${reports.join('\n\n')}\n\nDette tester bare metadata via Trimble Model API; det laster ikke geometri eller viser modeller i kartflaten.`;
  }finally{refreshSelectedIfcFiles();}
 }
 function openSelectedIfcModels(result,button){
  try{
   const target=window.DocLibLegacyBridge.buildSelectedIfcViewerUrl();
   window.open(target.url,'_blank','noopener,noreferrer');
   result.textContent=`Ba Trimble Connect åpne ${target.modelCount} valgte IFC-modell${target.modelCount===1?'':'er'} i en egen 3D-visning. Dette bekrefter ikke at modellen(e) er lastet før visningen er kontrollert.`;
  }catch(error){result.textContent=`Kunne ikke åpne 3D-visningen: ${error?.message||String(error)}`;}
  finally{refreshSelectedIfcFiles();}
 }
 function build(){
  const style=document.createElement('style');
  style.dataset.planStyle='';
  style.textContent=`
  .plan-view{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:#f7f8fa;color:#172033;font:14px/1.45 Arial,sans-serif}
  .plan-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #dce2ea;background:#fff}.plan-head h2{margin:0;font-size:18px}.plan-body{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:0;flex:1;min-height:0}.plan-map{position:relative;overflow:hidden;min-width:0;min-height:280px;background:#e9eef2;touch-action:none;cursor:grab}.plan-map:active{cursor:grabbing}.plan-base{position:absolute;inset:0;z-index:0;overflow:hidden}.plan-base-tile,.plan-base-image{position:absolute;max-width:none;pointer-events:none}.plan-base-image{inset:0;width:100%;height:100%;object-fit:fill}.plan-map-image{position:absolute;z-index:1;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}.plan-tools{position:absolute;z-index:4;left:12px;top:12px;display:grid;gap:6px}.plan-tools button{width:38px;height:38px;border:1px solid #b9c4d0;border-radius:6px;background:#fff;color:#172033;font-size:20px;cursor:pointer}.plan-layers-panel{overflow:auto;padding:14px;background:#fff;border-left:1px solid #dce2ea}.plan-layers-panel h3{margin:0 0 8px;font-size:15px}.plan-basemap-summary{padding:8px;margin:0 0 12px;border-radius:5px;background:#f1f5f9;color:#334155;font-size:12px}.plan-layer-toggle{display:flex;align-items:flex-start;gap:8px;padding:8px 2px;border-bottom:1px solid #edf0f3;overflow-wrap:anywhere}.plan-layer-toggle input{margin-top:3px;accent-color:#1764df}.plan-empty{color:#566273;font-size:13px}.plan-status{position:absolute;z-index:3;left:62px;bottom:10px;max-width:calc(100% - 170px);padding:6px 9px;border-radius:5px;background:#ffffffdf;color:#334155;font-size:12px;pointer-events:none}.plan-status[data-error=true]{color:#9f2533}.plan-attribution{position:absolute;z-index:3;right:4px;bottom:3px;padding:3px 5px;border-radius:3px;background:#ffffffd9;color:#334155;font-size:10px;pointer-events:auto}.plan-attribution a{color:inherit}.plan-actions{display:flex;gap:6px}.plan-actions button{min-height:34px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer}.plan-actions button:hover{background:#f1f5f9}@media(max-width:720px){.plan-body{grid-template-columns:minmax(0,1fr)}.plan-layers-panel{max-height:180px;border-left:0;border-top:1px solid #dce2ea}.plan-map{min-height:320px}.plan-status{max-width:calc(100% - 24px);bottom:26px}}
  `;
  root=document.createElement('section');
  root.className='plan-view';
  root.innerHTML='<header class="plan-head"><h2>Planvisning</h2><div class="plan-actions"><label>Bakgrunn <select data-plan-basemap aria-label="Velg bakgrunnskart" style="max-width:220px;min-height:34px"><option value="flyfoto">Flyfoto</option><option value="vektorkart">Vektorkart (OpenStreetMap)</option><option value="grunnkart">Grunnkart (Geonorge)</option><option value="none">Ingen bakgrunn</option></select></label><button type="button" data-zoom-out aria-label="Zoom ut">−</button><button type="button" data-zoom-in aria-label="Zoom inn">+</button></div></header><div class="plan-body"><div class="plan-map" data-plan-map role="application" aria-label="Kartvisning. Dra for å flytte kartet. Bruk musehjulet for å zoome."><div class="plan-base" data-plan-base></div><div class="plan-tools"><button type="button" data-zoom-in aria-label="Zoom inn">+</button><button type="button" data-zoom-out aria-label="Zoom ut">−</button></div><div class="plan-status" data-plan-status role="status" aria-live="polite"></div><div class="plan-attribution" data-plan-attribution></div></div><aside class="plan-layers-panel"><h3>Bakgrunnskart</h3><div class="plan-basemap-summary" data-plan-basemap-label></div><h3>Kartlag</h3><div data-plan-layers></div><h3>Valgte IFC-modeller</h3><p data-ifc-selection-summary style="font-size:12px;color:#526173"></p><ul data-ifc-selection-list style="font-size:11px;padding-left:18px;max-height:110px;overflow:auto"></ul><button type="button" data-ifc-read disabled style="min-height:34px;padding:6px 10px;margin:3px 0">Test metadata for valgte</button><button type="button" data-ifc-open-viewer disabled style="min-height:34px;padding:6px 10px">Åpne valgte i Trimble 3D</button><p style="font-size:11px;color:#526173">Velg IFC-er med radavkryssing i Utforsker-tabellen. Filtrer ikke via mappe-/filrutene i treet. 3D åpnes i en separat Trimble Connect-visning.</p><pre data-ifc-result role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.45 Arial,sans-serif;color:#334155"></pre></aside></div>';
  root.prepend(style);
  root.querySelector('[data-plan-basemap]').addEventListener('change',event=>{baseMap=event.target.value;userBaseMapSelected=true;const summary=root.querySelector('[data-plan-basemap-label]');if(summary)summary.textContent=`Prosjektstandard: ${BASEMAPS[sharedBaseMap].label} · Ditt valg: ${BASEMAPS[baseMap].label}`;refresh();});
  root.querySelector('[data-ifc-read]').addEventListener('click',event=>runIfcReadTest(root.querySelector('[data-ifc-result]'),event.currentTarget));
  root.querySelector('[data-ifc-open-viewer]').addEventListener('click',event=>openSelectedIfcModels(root.querySelector('[data-ifc-result]'),event.currentTarget));
  root.querySelectorAll('[data-zoom-in]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span/1.6,1000,2*WORLD);refresh();}));
  root.querySelectorAll('[data-zoom-out]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span*1.6,1000,2*WORLD);refresh();}));
  const map=root.querySelector('[data-plan-map]');
  map.addEventListener('pointerdown',moveStart);
  map.addEventListener('pointermove',move);
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
  },
  render(){refresh();},
  update(change){if(change?.type==='project-state'){refreshSelectedIfcFiles();refresh();}},
  canLeave(){return true;},
  unmount(){
   clearTimeout(timer);
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
