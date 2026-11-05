import {WMS_CATALOG} from './wms-catalog.js?v=2.05-preview.4-planview.5';
import {DEFAULT_IFC_OBJECT_LAYER,normalizeIfcObjectLayer} from './ifc-object-layer-config.js?v=2.05-preview.7.1';
const MAX_LAYERS=20;
const CATALOG_IDS=new Set(WMS_CATALOG.map(item=>item.id));
const BASEMAPS=Object.freeze([
 {id:'flyfoto',label:'Flyfoto'},
 {id:'vektorkart',label:'Vektorkart (OpenStreetMap)'},
 {id:'grunnkart',label:'Grunnkart (Geonorge)'},
 {id:'none',label:'Ingen bakgrunn'}
]);
const safeUrl=value=>{
 const raw=String(value||'').trim();
 if(!raw)return'';
 let url;
 try{url=new URL(raw);}catch{throw Error('WMS-adressen må være en gyldig HTTPS-adresse.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)throw Error('Bruk en offentlig HTTPS-adresse uten innlogging, token, spørring eller fragment.');
 const host=url.hostname.toLowerCase();
 if(['localhost','127.0.0.1','::1'].includes(host)||/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host))throw Error('Private eller lokale nettverksadresser er ikke tillatt i den åpne WMS-konfigurasjonen.');
 return url.href.replace(/\/$/,'');
};
const cleanLayer=layer=>({id:String(layer.id||''),name:String(layer.name||'').trim().slice(0,100),url:safeUrl(layer.url),layer:String(layer.layer||'').trim().slice(0,200),visibleByDefault:layer.visibleByDefault===true,attribution:String(layer.attribution||'').trim().slice(0,200)});
export function normalizePlanConfig(raw){
 const seen=new Set(),layers=[];
 const baseMap=BASEMAPS.some(option=>option.id===raw?.baseMap)?raw.baseMap:'flyfoto';
 for(const source of Array.isArray(raw?.layers)?raw.layers:[]){
  if(layers.length>=MAX_LAYERS)break;
  try{
   const layer=cleanLayer(source);
   if(!/^[A-Za-z0-9_-]{1,80}$/.test(layer.id)||!layer.name||!layer.url||!layer.layer||seen.has(layer.id))continue;
   seen.add(layer.id);
   layers.push(layer);
  }catch{}
 }
 return{baseMap,layers,ifcObjectLayer:normalizeIfcObjectLayer(raw?.ifcObjectLayer)};
}
function makeLayer(){return{id:`wms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,name:'',url:'',layer:'',visibleByDefault:true,attribution:''};}
export function mountPlanSettings(host,config,doc=document){
 const normalized=normalizePlanConfig(config?.plan);
 const root=doc.createElement('div');
 root.className='plan-settings';
 root.innerHTML='<p>Velg prosjektets standardbakgrunn og hvilke tematiske WMS-lag som skal være tilgjengelige for brukerne. Brukerne kan slå tilgjengelige lag av og på i Planvisning.</p><label class="plan-basemap-field">Felles bakgrunnskart <select data-plan-basemap></select></label><fieldset class="plan-wms-catalog"><legend>Forhåndsdefinerte WMS-lag</legend><p>Hak av lagene som skal tilbys i dette prosjektet. Nye lag er av som standard.</p><div data-wms-catalog></div><small data-wms-catalog-status aria-live="polite"></small></fieldset><h3>Egne WMS-lag</h3><div data-wms-rows></div><div class="setup-column-actions"><button type="button" data-wms-add>Legg til eget WMS-lag</button></div><small>Bakgrunnskart: Flyfoto (Esri), Vektorkart (OpenStreetMap), Grunnkart (Geonorge) eller Ingen bakgrunn. WMS-overlegg må være offentlige og tilgjengelige for nettleserbilder; ingen legitimasjon lagres.</small>';
 const objectLayerHost=doc.createElement('fieldset');
 objectLayerHost.className='plan-ifc-object-settings';
 objectLayerHost.innerHTML='<legend>IFC-objektslag (test)</legend><p>Vis et avgrenset utvalg IFC-objekter i 2D-plan. Geometrien begrenses til oppovervendte flater og en samlet testgrense på 30&nbsp;000 trekanter.</p>';
 root.append(objectLayerHost);
 const baseSelect=root.querySelector('[data-plan-basemap]');
 for(const option of BASEMAPS){
  const element=doc.createElement('option');
  element.value=option.id;
  element.textContent=option.label;
  baseSelect.append(element);
 }
 baseSelect.value=normalized.baseMap;
 const rows=root.querySelector('[data-wms-rows]');
 const catalogHost=root.querySelector('[data-wms-catalog]');
 const catalogStatus=root.querySelector('[data-wms-catalog-status]');
 let layers=normalized.layers.map(layer=>({...layer}));
 let ifcObjectLayer=normalizeIfcObjectLayer(normalized.ifcObjectLayer);
 function renderIfcObjectSettings(){
  objectLayerHost.replaceChildren();
  const legend=doc.createElement('legend');legend.textContent='IFC-objektslag (test)';objectLayerHost.append(legend);
  const note=doc.createElement('p');note.textContent='Velg objekter på tvers av IFC-typer ved hjelp av inntil tre egenskaper. IFC-modellens egne materialfarger vises som utgangspunkt; fargeregler overstyrer dem. Bare objekter med minst én valgt egenskap vises, med maksimalt 30 000 oppovervendte trekanter totalt.';objectLayerHost.append(note);
  const enabledLabel=doc.createElement('label'),enabled=doc.createElement('input');enabled.type='checkbox';enabled.checked=ifcObjectLayer.enabled;enabledLabel.append(enabled,doc.createTextNode(' Tilby IFC-objektslaget i Planvisning'));objectLayerHost.append(enabledLabel);
  const defaultLabel=doc.createElement('label');defaultLabel.style.cssText='display:flex;align-items:center;gap:8px;margin:10px 0';defaultLabel.append(doc.createTextNode('Reservefarge når IFC-en mangler materialfarge'));const defaultInput=doc.createElement('input');defaultInput.type='color';defaultInput.value=ifcObjectLayer.defaultColor;defaultInput.addEventListener('input',()=>{ifcObjectLayer.defaultColor=defaultInput.value;});defaultLabel.append(defaultInput);objectLayerHost.append(defaultLabel);
  const rulesHost=doc.createElement('div');
  for(let index=0;index<3;index++){
   const rule=ifcObjectLayer.colorRules[index]||{property:'',values:[]};
   const group=doc.createElement('fieldset');group.style.cssText='margin:12px 0;padding:12px;border:1px solid #e2e4e9;border-radius:7px';
   const ruleLegend=doc.createElement('legend');ruleLegend.textContent=`Fargeprioritet ${index+1}`;group.append(ruleLegend);
   const propertyLabel=doc.createElement('label');propertyLabel.style.cssText='display:grid;gap:4px';propertyLabel.append(doc.createTextNode('Egenskap (PropertySet::Property)'));
   const propertyInput=doc.createElement('input');propertyInput.type='text';propertyInput.maxLength=200;propertyInput.placeholder='Pset_WallCommon::IsExternal';propertyInput.value=rule.property||'';propertyInput.addEventListener('input',()=>{while(ifcObjectLayer.colorRules.length<=index)ifcObjectLayer.colorRules.push({property:'',values:[]});ifcObjectLayer.colorRules[index].property=propertyInput.value;});propertyLabel.append(propertyInput);group.append(propertyLabel);
   const mappingsLabel=doc.createElement('label');mappingsLabel.style.cssText='display:grid;gap:4px;margin-top:8px';mappingsLabel.append(doc.createTextNode('Verdier og farger (én per linje: verdi = #RRGGBB)'));
   const mappings=doc.createElement('textarea');mappings.rows=3;mappings.maxLength=5000;mappings.placeholder='Asfalt = #e85223\nBetong = #3b82f6';mappings.value=(rule.values||[]).map(item=>`${item.value} = ${item.color}`).join('\n');mappings.addEventListener('input',()=>{while(ifcObjectLayer.colorRules.length<=index)ifcObjectLayer.colorRules.push({property:'',values:[]});ifcObjectLayer.colorRules[index].values=mappings.value.split(/\r?\n/).map(line=>{const split=line.indexOf('=');return split<0?null:{value:line.slice(0,split).trim(),color:line.slice(split+1).trim()};}).filter(Boolean);});mappingsLabel.append(mappings);group.append(mappingsLabel);rulesHost.append(group);
  }
  objectLayerHost.append(rulesHost);
  const help=doc.createElement('small');help.textContent='Bare objekter med minst én egenskap som er fylt inn her tas med, uansett IFC-type. IFC-materialfargen brukes når den finnes; reglene prøves ovenfra og ned og et fargetreff overstyrer materialfargen. Hvis IFC-en mangler lesbar materialfarge, brukes reservefargen. Egenskapsnavn kan skrives PropertySet:Property eller PropertySet::Property.';objectLayerHost.append(help);
  const sync=()=>{const disabled=!enabled.checked;defaultInput.disabled=disabled;for(const input of rulesHost.querySelectorAll('input,textarea'))input.disabled=disabled;};
  enabled.addEventListener('change',()=>{ifcObjectLayer.enabled=enabled.checked;sync();});
  sync();
 }
 function renderCatalog(){
  const groups=new Map();
  for(const item of WMS_CATALOG){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item);}
  const fragment=doc.createDocumentFragment();
  for(const [category,items] of groups){
   const fieldset=doc.createElement('fieldset');
   const legend=doc.createElement('legend');legend.textContent=category;fieldset.append(legend);
   for(const item of items){
    const current=layers.find(layer=>layer.id===item.id);
    const row=doc.createElement('div');row.className='plan-wms-catalog-row';row.style.cssText='display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:5px 0;border-bottom:1px solid #edf0f3';
    const availableLabel=doc.createElement('label');availableLabel.style.cssText='display:inline-flex;align-items:center;gap:7px;flex:1 1 260px';
    const available=doc.createElement('input');available.type='checkbox';available.checked=Boolean(current);available.title=`${item.layer} · ${new URL(item.url).hostname}`;
    available.addEventListener('change',()=>{
     if(available.checked){if(layers.length>=MAX_LAYERS){available.checked=false;if(catalogStatus)catalogStatus.textContent=`Maksimalt ${MAX_LAYERS} WMS-lag kan være tilgjengelige samtidig.`;return;}layers.push({...item,visibleByDefault:false});}
     else layers=layers.filter(layer=>layer.id!==item.id);
     if(catalogStatus)catalogStatus.textContent='';
     render();
    });
    const name=doc.createElement('span');name.textContent=item.name;availableLabel.append(available,name);
    const defaultLabel=doc.createElement('label');defaultLabel.style.cssText='display:inline-flex;align-items:center;gap:7px';
    const defaultInput=doc.createElement('input');defaultInput.type='checkbox';defaultInput.checked=current?.visibleByDefault===true;defaultInput.disabled=!current;defaultInput.setAttribute('aria-label',`Vis ${item.name} som standard`);
    defaultInput.addEventListener('change',()=>{const layer=layers.find(value=>value.id===item.id);if(layer)layer.visibleByDefault=defaultInput.checked;});
    defaultLabel.append(defaultInput,doc.createTextNode('Vis som standard'));
    row.append(availableLabel,defaultLabel);fieldset.append(row);
   }
   fragment.append(fieldset);
  }
  catalogHost.replaceChildren(fragment);
 }
 function render(){
  rows.replaceChildren();
  const customLayers=layers.filter(layer=>!CATALOG_IDS.has(layer.id));
  if(!customLayers.length){
   const empty=doc.createElement('p');
   empty.textContent='Ingen egne WMS-lag er lagt til.';
   rows.append(empty);
  }
  customLayers.forEach((layer,index)=>{
   const field=doc.createElement('fieldset');
   field.className='plan-wms-row';
   const legend=doc.createElement('legend');
   legend.textContent=`WMS-overlegg ${index+1}`;
   field.append(legend);
   const addInput=(labelText,key,placeholder)=>{
    const label=doc.createElement('label');
    label.className='plan-wms-field';
    label.textContent=labelText;
    const input=doc.createElement('input');
    input.type='text';
    input.maxLength=key==='url'?500:200;
    input.placeholder=placeholder;
    input.value=layer[key]||'';
    input.autocomplete='off';
    input.addEventListener('input',()=>{layer[key]=input.value;});
    label.append(input);
    field.append(label);
   };
   addInput('Visningsnavn','name','For eksempel Vegnett');
   addInput('Tjenesteadresse (HTTPS)','url','https://wms.example.no/wms');
   addInput('WMS-lag-ID','layer','Eksakt Name fra GetCapabilities');
   const defaultLabel=doc.createElement('label');
   defaultLabel.className='plan-wms-default';
   const checkbox=doc.createElement('input');
   checkbox.type='checkbox';
   checkbox.checked=layer.visibleByDefault;
   checkbox.addEventListener('change',()=>{layer.visibleByDefault=checkbox.checked;});
   defaultLabel.append(checkbox,doc.createTextNode('Vis som standard'));
   const remove=doc.createElement('button');
   remove.type='button';
   remove.textContent='Fjern';
   remove.addEventListener('click',()=>{layers=layers.filter(value=>value.id!==layer.id);render();});
   field.append(defaultLabel,remove);
   rows.append(field);
  });
  root.querySelector('[data-wms-add]').disabled=layers.length>=MAX_LAYERS;
  renderCatalog();
 }
 root.querySelector('[data-wms-add]').addEventListener('click',()=>{
  if(layers.length<MAX_LAYERS){layers.push(makeLayer());render();}
 });
 render();
 renderIfcObjectSettings();
 host.replaceChildren(root);
 return Object.freeze({
  snapshot(){
   if(layers.length>MAX_LAYERS)throw Error(`Maksimalt ${MAX_LAYERS} WMS-lag kan lagres.`);
   return{
    baseMap:BASEMAPS.some(option=>option.id===baseSelect.value)?baseSelect.value:'flyfoto',
    layers:layers.map(layer=>{
     const result=cleanLayer(layer);
     if(!result.name||!result.url||!result.layer)throw Error('Fyll ut visningsnavn, HTTPS-adresse og WMS-lag-ID, eller fjern den tomme raden.');
     return result;
    }),
    ifcObjectLayer:normalizeIfcObjectLayer(ifcObjectLayer)
   };
  },
  set(next){
   const value=normalizePlanConfig(next);
   baseSelect.value=value.baseMap;
   layers=value.layers.map(layer=>({...layer}));
   ifcObjectLayer=normalizeIfcObjectLayer(value.ifcObjectLayer||DEFAULT_IFC_OBJECT_LAYER);
   render();
   renderIfcObjectSettings();
  }
 });
}
