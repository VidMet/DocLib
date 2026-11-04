const MAX_LAYERS=20;
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
const cleanLayer=layer=>({id:String(layer.id||''),name:String(layer.name||'').trim().slice(0,100),url:safeUrl(layer.url),layer:String(layer.layer||'').trim().slice(0,200),visibleByDefault:layer.visibleByDefault===true});
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
 return{baseMap,layers};
}
function makeLayer(){return{id:`wms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,name:'',url:'',layer:'',visibleByDefault:true};}
export function mountPlanSettings(host,config,doc=document){
 const normalized=normalizePlanConfig(config?.plan);
 const root=doc.createElement('div');
 root.className='plan-settings';
 root.innerHTML='<p>Velg ett felles bakgrunnskart for prosjektet. Flyfoto er standard; et annet valg erstatter det for alle brukere. Tematiske WMS-lag administreres separat nedenfor.</p><label class="plan-basemap-field">Felles bakgrunnskart <select data-plan-basemap></select></label><div data-wms-rows></div><div class="setup-column-actions"><button type="button" data-wms-add>Legg til WMS-lag</button></div><small>Bakgrunnskart: Flyfoto (Esri), Vektorkart (OpenStreetMap), Grunnkart (Geonorge) eller Ingen bakgrunn. WMS-overlegg må være offentlige og tilgjengelige for nettleserbilder; ingen legitimasjon lagres.</small>';
 const baseSelect=root.querySelector('[data-plan-basemap]');
 for(const option of BASEMAPS){
  const element=doc.createElement('option');
  element.value=option.id;
  element.textContent=option.label;
  baseSelect.append(element);
 }
 baseSelect.value=normalized.baseMap;
 const rows=root.querySelector('[data-wms-rows]');
 let layers=normalized.layers.map(layer=>({...layer}));
 function render(){
  rows.replaceChildren();
  if(!layers.length){
   const empty=doc.createElement('p');
   empty.textContent='Ingen tematiske WMS-lag er lagt til ennå.';
   rows.append(empty);
  }
  layers.forEach((layer,index)=>{
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
   remove.addEventListener('click',()=>{layers.splice(index,1);render();});
   field.append(defaultLabel,remove);
   rows.append(field);
  });
  root.querySelector('[data-wms-add]').disabled=layers.length>=MAX_LAYERS;
 }
 root.querySelector('[data-wms-add]').addEventListener('click',()=>{
  if(layers.length<MAX_LAYERS){layers.push(makeLayer());render();}
 });
 render();
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
    })
   };
  },
  set(next){
   const value=normalizePlanConfig(next);
   baseSelect.value=value.baseMap;
   layers=value.layers.map(layer=>({...layer}));
   render();
  }
 });
}
