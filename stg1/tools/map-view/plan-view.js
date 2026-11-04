const MAX_WIDTH=1600,MAX_HEIGHT=1200,WORLD=20037508.342789244;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const safeHost=host=>host.replace(/[^a-z0-9.-]/gi,'').slice(0,100);
function mapUrl(layer,bounds,width,height){
 const url=new URL(layer.url);
 const params=url.searchParams;
 params.set('SERVICE','WMS');params.set('REQUEST','GetMap');params.set('VERSION','1.1.1');
 params.set('LAYERS',layer.layer);params.set('STYLES','');params.set('SRS','EPSG:3857');
 params.set('BBOX',bounds.map(value=>value.toFixed(2)).join(','));
 params.set('WIDTH',String(width));params.set('HEIGHT',String(height));params.set('FORMAT','image/png');params.set('TRANSPARENT','TRUE');
 return url.href;
}
function createPlanView({store}){
 let host=null,root=null,observer=null,timer=0,destroyed=false,unsubscribeStore=null;
 let center={x:1170000,y:8370000},span=1400000,drag=null;
 let layers=[],visible=new Set(),images=new Map();
 const refresh=()=>{if(!root||destroyed)return;clearTimeout(timer);timer=setTimeout(draw,130);};
 const setLayers=next=>{
  const previous=new Set(layers.map(layer=>layer.id));
  layers=Array.isArray(next)?next:[];
  for(const layer of layers)if(!previous.has(layer.id)&&layer.visibleByDefault)visible.add(layer.id);
  for(const id of [...visible])if(!layers.some(layer=>layer.id===id))visible.delete(id);
  renderLayerList();refresh();
 };
 const note=(text,bad=false)=>{const el=root?.querySelector('[data-plan-status]');if(el){el.textContent=text;el.dataset.error=String(bad);}};
 const renderLayerList=()=>{
  const list=root?.querySelector('[data-plan-layers]');if(!list)return;list.replaceChildren();
  if(!layers.length){const empty=document.createElement('p');empty.className='plan-empty';empty.textContent='Ingen WMS-lag er konfigurert. En administrator kan legge til offentlige tjenester i «Innstillinger (felles)». Ingen filoperasjoner er aktivert.';list.append(empty);return;}
  for(const layer of layers){const label=document.createElement('label');label.className='plan-layer-toggle';const input=document.createElement('input');input.type='checkbox';input.checked=visible.has(layer.id);input.addEventListener('change',()=>{if(input.checked)visible.add(layer.id);else visible.delete(layer.id);refresh();});const name=document.createElement('span');name.textContent=layer.name;name.title=`${layer.layer} · ${safeHost(new URL(layer.url).hostname)}`;label.append(input,name);list.append(label);}
 };
 function draw(){
  if(!root)return;const map=root.querySelector('[data-plan-map]'),rect=map.getBoundingClientRect();
  if(rect.width<20||rect.height<20)return;
  const width=clamp(Math.round(rect.width*(window.devicePixelRatio||1)),200,MAX_WIDTH);
  const height=clamp(Math.round(rect.height*(window.devicePixelRatio||1)),150,MAX_HEIGHT);
  const halfX=span/2,halfY=span*height/width/2;
  const bounds=[Math.max(-WORLD,center.x-halfX),Math.max(-WORLD,center.y-halfY),Math.min(WORLD,center.x+halfX),Math.min(WORLD,center.y+halfY)];
  const current=[...visible].map(id=>layers.find(layer=>layer.id===id)).filter(Boolean);
  for(const[id,image]of images)if(!current.some(layer=>layer.id===id)){image.remove();images.delete(id);}
  if(!current.length){note(layers.length?'Slå på et WMS-lag for å vise kartet.':'Legg til offentlige WMS-lag i fellesinnstillingene.');return;}
  note('Henter kartbilder …');let pending=current.length,failed=0;
  for(const layer of current){
   let image=images.get(layer.id);if(!image){image=document.createElement('img');image.className='plan-map-image';image.alt='';image.draggable=false;images.set(layer.id,image);map.append(image);}
   image.onload=()=>{pending--;if(!pending)note(failed?`${failed} WMS-lag kunne ikke vises.`:`${current.length} WMS-lag vist.` ,failed>0);};
   image.onerror=()=>{pending--;failed++;if(!pending)note(`${failed} WMS-lag kunne ikke vises. Kontroller tjenesteadresse og lag-ID.`,true);};
   image.src=mapUrl(layer,bounds,width,height);
  }
 }
 function moveStart(event){if(event.button!==0||event.target.closest('button'))return;drag={x:event.clientX,y:event.clientY,centerX:center.x,centerY:center.y};root.querySelector('[data-plan-map]').setPointerCapture(event.pointerId);}
 function move(event){if(!drag)return;const rect=root.querySelector('[data-plan-map]').getBoundingClientRect();const scale=span/rect.width;center.x=clamp(drag.centerX-(event.clientX-drag.x)*scale,-WORLD,WORLD);center.y=clamp(drag.centerY+(event.clientY-drag.y)*scale,-WORLD,WORLD);refresh();}
 function moveEnd(){drag=null;}
 function build(){
  const style=document.createElement('style');style.dataset.planStyle='';style.textContent=`
  .plan-view{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:#f7f8fa;color:#172033;font:14px/1.45 Arial,sans-serif}
  .plan-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #dce2ea;background:#fff}.plan-head h2{margin:0;font-size:18px}.plan-body{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:0;flex:1;min-height:0}.plan-map{position:relative;overflow:hidden;min-width:0;min-height:280px;background:#e9eef2;touch-action:none;cursor:grab}.plan-map:active{cursor:grabbing}.plan-map-image{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}.plan-tools{position:absolute;z-index:3;left:12px;top:12px;display:grid;gap:6px}.plan-tools button{width:38px;height:38px;border:1px solid #b9c4d0;border-radius:6px;background:#fff;color:#172033;font-size:20px;cursor:pointer}.plan-layers-panel{overflow:auto;padding:14px;background:#fff;border-left:1px solid #dce2ea}.plan-layers-panel h3{margin:0 0 12px;font-size:15px}.plan-layer-toggle{display:flex;align-items:flex-start;gap:8px;padding:8px 2px;border-bottom:1px solid #edf0f3;overflow-wrap:anywhere}.plan-layer-toggle input{margin-top:3px;accent-color:#1764df}.plan-empty{color:#566273;font-size:13px}.plan-status{position:absolute;z-index:2;left:62px;right:12px;bottom:10px;max-width:calc(100% - 74px);padding:6px 9px;border-radius:5px;background:#ffffffdf;color:#334155;font-size:12px;pointer-events:none}.plan-status[data-error=true]{color:#9f2533}.plan-actions{display:flex;gap:6px}.plan-actions button{min-height:34px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer}.plan-actions button:hover{background:#f1f5f9}@media(max-width:720px){.plan-body{grid-template-columns:minmax(0,1fr)}.plan-layers-panel{max-height:180px;border-left:0;border-top:1px solid #dce2ea}.plan-map{min-height:320px}}
  `;
  root=document.createElement('section');root.className='plan-view';root.innerHTML='<header class="plan-head"><h2>Planvisning</h2><div class="plan-actions"><button type="button" data-zoom-out aria-label="Zoom ut">−</button><button type="button" data-zoom-in aria-label="Zoom inn">+</button></div></header><div class="plan-body"><div class="plan-map" data-plan-map role="application" aria-label="WMS-kart. Dra for å flytte kartet."><div class="plan-tools"><button type="button" data-zoom-in aria-label="Zoom inn">+</button><button type="button" data-zoom-out aria-label="Zoom ut">−</button></div><div class="plan-status" data-plan-status role="status" aria-live="polite"></div></div><aside class="plan-layers-panel"><h3>Kartlag</h3><div data-plan-layers></div></aside></div>';
  root.prepend(style);
  root.querySelectorAll('[data-zoom-in]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span/1.6,1000,2*WORLD);refresh();}));
  root.querySelectorAll('[data-zoom-out]').forEach(button=>button.addEventListener('click',()=>{span=clamp(span*1.6,1000,2*WORLD);refresh();}));
  const map=root.querySelector('[data-plan-map]');map.addEventListener('pointerdown',moveStart);map.addEventListener('pointermove',move);map.addEventListener('pointerup',moveEnd);map.addEventListener('pointercancel',moveEnd);
  observer=new ResizeObserver(refresh);observer.observe(map);
 }
 return Object.freeze({
  mount(target){host=target;destroyed=false;host.replaceChildren();build();setLayers(store.snapshot().plan?.layers||[]);unsubscribeStore=store.subscribe(config=>setLayers(config.plan?.layers||[]));},
  render(){refresh();},
  update(change){if(change?.type==='project-state')refresh();},
  canLeave(){return true;},
  unmount(){clearTimeout(timer);unsubscribeStore?.();unsubscribeStore=null;observer?.disconnect();observer=null;root?.remove();root=null;images.clear();},
  destroy(){destroyed=true;this.unmount();}
 });
}
export default Object.freeze({id:'plan',title:'Planvisning',legacyMode:'plan',status:'module',create:context=>createPlanView(context)});
