import {WMS_CATALOG} from './wms-catalog.js?v=2.05-preview.4-planview.5';
import {DEFAULT_IFC_OBJECT_LAYER,normalizeIfcObjectLayer} from './ifc-object-layer-config.js?v=2.05-preview.7.4';
import {readIfcPropertyCatalog} from './ifc-surface.js?v=2.05-preview.7.4';
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
 let ifcObjectLayer=normalizeIfcObjectLayer(normalized.ifcObjectLayer),propertyCatalog={},catalogLoading=false,catalogAutoStarted=false,catalogStatusText='';
 function renderIfcObjectSettings(){
  objectLayerHost.replaceChildren();
  const legend=doc.createElement('legend');legend.textContent='IFC-objektslag (test)';objectLayerHost.append(legend);
  const note=doc.createElement('p');note.textContent='Velg opptil tre IFC-egenskaper og fargelegg bare verdiene du trenger. Standardregelen #ALL = default tegner øvrige objekter i reservefargen; «Bare eksplisitte treff» skjuler dem.';objectLayerHost.append(note);
  const enabledLabel=doc.createElement('label'),enabled=doc.createElement('input');enabled.type='checkbox';enabled.checked=ifcObjectLayer.enabled;enabledLabel.append(enabled,doc.createTextNode(' Tilby IFC-objektslaget i Planvisning'));objectLayerHost.append(enabledLabel);
  const scanRow=doc.createElement('div');scanRow.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0';
  const scanButton=doc.createElement('button');scanButton.type='button';scanButton.textContent='Oppdater egenskaper fra valgte IFC-modeller';
  const scanStatus=doc.createElement('small');scanStatus.setAttribute('aria-live','polite');scanStatus.textContent=catalogStatusText;scanRow.append(scanButton,scanStatus);objectLayerHost.append(scanRow);
  const defaultGroup=doc.createElement('fieldset');defaultGroup.style.cssText='margin:12px 0;padding:12px;border:1px solid #d6dbe4;border-radius:7px';
  const defaultLegend=doc.createElement('legend');defaultLegend.textContent='#ALL = default';defaultGroup.append(defaultLegend);
  const defaultRow=doc.createElement('label');defaultRow.style.cssText='display:flex;align-items:center;gap:8px';defaultRow.append(doc.createTextNode('Reservefarge for objekter uten eksplisitt fargeregel'));
  const defaultInput=doc.createElement('input');defaultInput.type='color';defaultInput.value=ifcObjectLayer.defaultColor;defaultInput.addEventListener('input',()=>{ifcObjectLayer.defaultColor=defaultInput.value;});defaultRow.append(defaultInput);defaultGroup.append(defaultRow);objectLayerHost.append(defaultGroup);
  const onlyMatchedLabel=doc.createElement('label');onlyMatchedLabel.style.cssText='display:flex;align-items:center;gap:7px;margin:10px 0';
  const onlyMatched=doc.createElement('input');onlyMatched.type='checkbox';onlyMatched.checked=ifcObjectLayer.onlyMatched;onlyMatched.addEventListener('change',()=>{ifcObjectLayer.onlyMatched=onlyMatched.checked;});onlyMatchedLabel.append(onlyMatched,doc.createTextNode('Bare objekter med eksplisitt treff på en valgt verdi'));objectLayerHost.append(onlyMatchedLabel);
  const rulesHost=doc.createElement('div'),palette=['#e85223','#3b82f6','#16a085','#8b5cf6','#d97706','#db2777','#0891b2','#65a30d'];
  for(let index=0;index<3;index++){
   while(ifcObjectLayer.colorRules.length<=index)ifcObjectLayer.colorRules.push({property:'',values:[]});
   const rule=ifcObjectLayer.colorRules[index];
   const group=doc.createElement('fieldset');group.style.cssText='margin:12px 0;padding:12px;border:1px solid #e2e4e9;border-radius:7px';
   const ruleLegend=doc.createElement('legend');ruleLegend.textContent=`Fargeprioritet ${index+1}`;group.append(ruleLegend);
   const propertyLabel=doc.createElement('label');propertyLabel.style.cssText='display:grid;gap:4px';propertyLabel.append(doc.createTextNode('Egenskap'));
   const propertySelect=doc.createElement('select');propertySelect.style.cssText='max-width:100%;min-height:34px';
   const empty=doc.createElement('option');empty.value='';empty.disabled=true;empty.textContent=Object.keys(propertyCatalog).length?'Velg egenskap …':'Hent egenskaper fra valgte IFC-modeller først';propertySelect.append(empty);
   const propertyNames=Object.keys(propertyCatalog).sort((a,b)=>a.localeCompare(b,'nb-NO',{sensitivity:'base'}));
   if(rule.property&&!propertyNames.includes(rule.property))propertyNames.unshift(rule.property);
   for(const property of propertyNames){const option=doc.createElement('option');option.value=property;option.textContent=property;propertySelect.append(option);}
   propertySelect.value=rule.property||'';
   propertySelect.addEventListener('change',()=>{rule.property=propertySelect.value;const oldValues=new Map(rule.values.map(item=>[item.value.toLocaleLowerCase('nb-NO'),item]));rule.values=(propertyCatalog[rule.property]||[]).slice(0,40).map((value,valueIndex)=>oldValues.get(value.toLocaleLowerCase('nb-NO'))||{value,color:palette[(valueIndex+index)%palette.length]});renderIfcObjectSettings();});
   propertyLabel.append(propertySelect);group.append(propertyLabel);
   const valuesTitle=doc.createElement('p');valuesTitle.style.cssText='margin:10px 0 4px';valuesTitle.textContent='Verdier som skal få egen farge';group.append(valuesTitle);
   const valueRows=doc.createElement('div');valueRows.style.cssText='display:grid;gap:5px';
   for(const [valueIndex,mapping] of (rule.values||[]).entries()){
    const row=doc.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    const valueName=doc.createElement('span');valueName.textContent=mapping.value;valueName.style.cssText='flex:1 1 180px;overflow-wrap:anywhere';
    const color=doc.createElement('input');color.type='color';color.value=/^#[0-9a-f]{6}$/i.test(mapping.color)?mapping.color:palette[valueIndex%palette.length];color.setAttribute('aria-label',`Farge for ${mapping.value}`);color.addEventListener('input',()=>{mapping.color=color.value;});
    const remove=doc.createElement('button');remove.type='button';remove.textContent='Fjern';remove.addEventListener('click',()=>{rule.values=rule.values.filter((_,itemIndex)=>itemIndex!==valueIndex);renderIfcObjectSettings();});
    row.append(valueName,color,remove);valueRows.append(row);
   }
   if(!rule.values.length){const emptyValues=doc.createElement('small');emptyValues.textContent=rule.property?'Ingen verdier valgt. Velg en egenskap etter å ha hentet IFC-egenskapene.':'Velg en egenskap for å vise tilgjengelige verdier.';valueRows.append(emptyValues);}
   group.append(valueRows);rulesHost.append(group);
  }
  objectLayerHost.append(rulesHost);
  const help=doc.createElement('small');help.textContent='Bruk «Hent egenskaper» etter at IFC-modeller er valgt i filtreet. Skanningen leser bare egenskaper, ikke 3D-geometri. Fargereglene prøves ovenfra og ned. #ALL = default er alltid siste regel og gir alle umatchede objekter reservefargen, også når IFC-materialfarge mangler.';objectLayerHost.append(help);
  const sync=()=>{scanButton.disabled=catalogLoading;defaultInput.disabled=false;onlyMatched.disabled=false;for(const input of rulesHost.querySelectorAll('input,select,button'))input.disabled=false;};
  enabled.addEventListener('change',()=>{ifcObjectLayer.enabled=enabled.checked;sync();});
  scanButton.addEventListener('click',async()=>{
   if(catalogLoading)return;
   catalogAutoStarted=true;
   const bridge=window.DocLibLegacyBridge;
   if(typeof bridge?.listSelectedIfcFiles!=='function'||typeof bridge?.downloadIfcForSurface!=='function'){catalogStatusText='IFC-henting er ikke tilgjengelig her. Åpne Planvisning i Trimble Connect og prøv igjen.';scanStatus.textContent=catalogStatusText;return;}
   let files=[];
   try{files=bridge.listSelectedIfcFiles()||[];}catch(error){catalogStatusText=`IFC-utvalget kunne ikke leses: ${error?.message||String(error)}`;scanStatus.textContent=catalogStatusText;return;}
   if(!files.length){catalogStatusText='Velg IFC-modeller i filtreet først.';scanStatus.textContent=catalogStatusText;return;}
   catalogLoading=true;catalogStatusText=`Starter egenskapsskanning av ${files.length} IFC-modell(er) …`;scanStatus.textContent=catalogStatusText;scanButton.disabled=true;const merged={};
   try{
    await new Promise(resolve=>setTimeout(resolve,0));
    for(let fileIndex=0;fileIndex<files.length;fileIndex++){
     catalogStatusText=`Henter egenskaper fra ${fileIndex+1} av ${files.length}: ${files[fileIndex].name} …`;scanStatus.textContent=catalogStatusText;
     const buffer=await bridge.downloadIfcForSurface(files[fileIndex].id);
     const catalog=await readIfcPropertyCatalog(buffer,message=>{catalogStatusText=`${files[fileIndex].name} · ${message}`;scanStatus.textContent=catalogStatusText;});
     for(const [property,values] of Object.entries(catalog)){const target=merged[property]||(merged[property]=[]);for(const value of values)if(target.length<200&&!target.some(item=>item.toLocaleLowerCase('nb-NO')===value.toLocaleLowerCase('nb-NO')))target.push(value);}
    }
    propertyCatalog=merged;
    for(const rule of ifcObjectLayer.colorRules){if(rule.property&&!rule.values.length)rule.values=(propertyCatalog[rule.property]||[]).slice(0,40).map((value,index)=>({value,color:palette[index%palette.length]}));}
    catalogStatusText=`Fant ${Object.keys(propertyCatalog).length.toLocaleString('nb-NO')} egenskaper på ${files.length} IFC-modell(er).`;scanStatus.textContent=catalogStatusText;
   }catch(error){catalogStatusText=`Kunne ikke lese egenskapene: ${error?.message||String(error)}`;scanStatus.textContent=catalogStatusText;}
   finally{catalogLoading=false;renderIfcObjectSettings();}
  });
  sync();
  const selectedFiles=window.DocLibLegacyBridge?.listSelectedIfcFiles?.()||[];
  if(!catalogAutoStarted&&selectedFiles.length){catalogAutoStarted=true;queueMicrotask(()=>{if(scanButton.isConnected)scanButton.click();});}
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
