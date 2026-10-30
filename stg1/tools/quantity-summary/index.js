import {createObjectIndex} from './object-index.js?v=2.03-preview.5.3.a';
// DocLib Mengdesammenstilling - v2.03-preview.5, trinn 2
// Dynamiske valg fra eksisterende, modellaggregerte metadata. Ingen nye API-kall.
const BUILD = '2.03-preview.5.3.a';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compare = (a,b) => String(a).localeCompare(String(b),'nb',{numeric:true,sensitivity:'base'});

function selectedSource(context = {}) {
  const port = context.explorerPort || {};
  const directRows = port.selectedRows?.() || [];
  const workspaceIds = new Set((port.workspaceSelectedIds?.() || []).map(String));
  const visibleRows = port.visibleRows?.() || [];
  const workspaceRows = workspaceIds.size ? visibleRows.filter(row => workspaceIds.has(String(row?.file?.id))) : [];
  return {
    rows: workspaceRows.length ? workspaceRows : directRows,
    source: workspaceRows.length ? 'workspaceScope via explorerPort.visibleRows()' : 'explorerPort.selectedRows()'
  };
}

export function inspectSelectedMetadata(context = {}) {
  const selection = selectedSource(context);
  const seen = new Set();
  const models = [];
  const catalog = new Map();
  for (const row of selection.rows) {
    const file = row?.file;
    if (!file || !(String(file.format || '').toLowerCase() === 'ifc' || /\.ifc$/i.test(file.name || ''))) continue;
    if (file.id == null || String(file.id) === '') continue;
    const id = String(file.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const entries = [];
    for (const [fullKey,value] of Object.entries(row.props || {})) {
      const cut = fullKey.indexOf('::');
      if (cut <= 0 || cut + 2 >= fullKey.length || value == null || String(value).trim() === '') continue;
      const pset = fullKey.slice(0,cut), property = fullKey.slice(cut+2);
      entries.push({key:fullKey,pset,property,value:String(value)});
      if (!catalog.has(fullKey)) catalog.set(fullKey,{key:fullKey,pset,property,modelIds:[],sampleValues:[],valuesByModel:{}});
      const item = catalog.get(fullKey);
      item.modelIds.push(id);
      item.valuesByModel[id] = String(value);
      if (item.sampleValues.length < 5 && !item.sampleValues.includes(String(value))) item.sampleValues.push(String(value));
    }
    entries.sort((a,b) => compare(a.pset,b.pset) || compare(a.property,b.property));
    models.push({id,name:String(file.name || id),versionId:file.versionId == null ? null : String(file.versionId),propertyCount:entries.length,setCount:new Set(entries.map(x=>x.pset)).size,metadataState:entries.length?'available':'no-values',entries});
  }
  models.sort((a,b)=>compare(a.name,b.name));
  const properties = [...catalog.values()].sort((a,b)=>compare(a.pset,b.pset)||compare(a.property,b.property)).map(item=>({...item,modelCount:item.modelIds.length,selectedModelCount:models.length}));
  return {
    build:BUILD,source:selection.source,models,properties,
    selectedModels:models.length,modelsWithValues:models.filter(x=>x.propertyCount>0).length,
    setCount:new Set(properties.map(x=>x.pset)).size,propertyCount:properties.length,
    limitations:['Kun egenskaper med ikke-tom verdi i eksisterende modellmetadata.','Dekning gjelder valgte modeller, ikke IFC-objekter.','Ingen datatype, enhet eller mengdesummering i dette trinnet.']
  };
}

function scopedCatalog(report, modelScope) {
  const modelIds = modelScope === 'all' ? new Set(report.models.map(m=>m.id)) : new Set([modelScope]);
  const properties = report.properties.map(item => {
    const ids = item.modelIds.filter(id=>modelIds.has(id));
    const sampleValues = [];
    for (const id of ids) {
      const value = item.valuesByModel[id];
      if (value != null && sampleValues.length < 5 && !sampleValues.includes(value)) sampleValues.push(value);
    }
    return {...item,modelIds:ids,modelCount:ids.length,selectedModelCount:modelIds.size,sampleValues};
  }).filter(item=>item.modelCount>0);
  const sets = [...new Set(properties.map(item=>item.pset))].sort(compare);
  return {modelIds,properties,sets};
}

function option(value,label,selected=false) {
  return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;
}

export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'module',create});

export function create(context = {}) {
  let host = null, active = false, destroyed = false, last = null;
  const objectIndex=createObjectIndex(context);
  const state = {modelScope:'all',setKey:'',propertyKey:'',notice:'',indexStatus:'idle',indexResult:null,indexProgress:'',indexError:''};

  function validateSelections(report) {
    if (state.modelScope !== 'all' && !report.models.some(m=>m.id===state.modelScope)) state.modelScope='all';
    let scoped = scopedCatalog(report,state.modelScope);
    if (state.setKey && !scoped.sets.includes(state.setKey)) {state.setKey='';state.propertyKey='';state.notice='Det tidligere valgte egenskapssettet finnes ikke lenger i modellutvalget.';}
    const setProperties = scoped.properties.filter(p=>!state.setKey || p.pset===state.setKey);
    if (state.propertyKey && !setProperties.some(p=>p.key===state.propertyKey)) {state.propertyKey='';state.notice='Den tidligere valgte egenskapen finnes ikke lenger i modellutvalget.';}
    return {scoped,setProperties};
  }

  function render() {
    if (!active || !host || destroyed) return;
    last = inspectSelectedMetadata(context);
    const {scoped,setProperties} = validateSelections(last);
    const chosen = scoped.properties.find(p=>p.key===state.propertyKey) || null;
    const modelOptions = [option('all',`Alle valgte modeller (${last.selectedModels})`,state.modelScope==='all'),...last.models.map(m=>option(m.id,m.name,state.modelScope===m.id))].join('');
    const setOptions = [option('','Velg egenskapssett',!state.setKey),...scoped.sets.map(setName=>{
      const count = new Set(scoped.properties.filter(p=>p.pset===setName).flatMap(p=>p.modelIds)).size;
      return option(setName,`${setName} · ${count} av ${scoped.modelIds.size}`,state.setKey===setName);
    })].join('');
    const propertyOptions = [option('','Velg egenskap',!state.propertyKey),...setProperties.filter(p=>state.setKey && p.pset===state.setKey).map(p=>option(p.key,`${p.property} · ${p.modelCount} av ${p.selectedModelCount}`,state.propertyKey===p.key))].join('');
    const summary = last.selectedModels ? `${last.selectedModels} valgte IFC-modell${last.selectedModels===1?'':'er'} · ${last.modelsWithValues} med innleste verdier · ${last.setCount} egenskapssett · ${last.propertyCount} egenskaper` : 'Velg minst én IFC-modell i Utforsker.';
    const details = chosen ? `<section class="quantity-card"><h3>Valgt egenskap</h3><dl class="quantity-property-details"><dt>Full nøkkel</dt><dd>${esc(chosen.key)}</dd><dt>Modelldekning</dt><dd>${chosen.modelCount} av ${chosen.selectedModelCount}</dd><dt>Eksempelverdier</dt><dd>${chosen.sampleValues.length?chosen.sampleValues.map(esc).join(' / '):'Ingen tilgjengelige verdier'}</dd></dl></section>` : `<section class="quantity-card"><h3>Valgt egenskap</h3><p>Velg først egenskapssett og deretter egenskap.</p></section>`;
    host.innerHTML = `<div class="quantity-summary-tool"><section class="quantity-hero"><div><span class="quantity-kicker">PREVIEW.5 TRINN 3A</span><div><strong>Bygg: v2.03-preview.5.3.a</strong></div><h2>Mengdesammenstilling</h2><p>Dynamiske egenskapsvalg fra valgte IFC-modeller</p></div><button class="btn primary" data-action="refresh"${last.selectedModels?'':' disabled'}>${last.selectedModels?'Oppdater fra valgte modeller':'Velg IFC-modeller i Utforsker'}</button></section><div class="quantity-notice" role="status">${esc(summary)}</div>${state.notice?`<div class="quantity-notice warning">${esc(state.notice)}</div>`:''}<section class="quantity-card"><h3>Velg egenskap</h3><div class="quantity-fields"><label>Modellomfang<select data-field="model"${last.selectedModels?'':' disabled'}>${modelOptions}</select></label><label>Egenskapssett<select data-field="set"${scoped.sets.length?'':' disabled'}>${setOptions}</select></label><label>Egenskap<select data-field="property"${state.setKey?'':' disabled'}>${propertyOptions}</select></label></div></section>${details}<section class="quantity-card"><h3>Objektindeks</h3><p>Trinn 3A leser og bevarer metadata per IFC-objekt. Gruppering og summering aktiveres først etter at objektantallet er kontrollert.</p><button class="btn primary" data-action="build-index"${last.selectedModels&&state.indexStatus!=='loading'?'':' disabled'}>${state.indexStatus==='loading'?'Leser objekter...':'Bygg objektindeks'}</button><p role="status">${state.indexProgress||'Objektindeksen er ikke bygget ennå.'}</p>${state.indexError?`<div class="quantity-notice warning">${esc(state.indexError)}</div>`:''}${state.indexResult?`<div class="quantity-table-wrap"><table><thead><tr><th>Modeller</th><th>Objekter</th><th>Med egenskaper</th><th>Unike egenskaper</th><th>Cachetreff</th><th>Feil</th></tr></thead><tbody><tr><td>${state.indexResult.modelsLoaded} av ${state.indexResult.modelsRequested}</td><td>${state.indexResult.entityCount.toLocaleString('nb-NO')}</td><td>${state.indexResult.entitiesWithProperties.toLocaleString('nb-NO')}</td><td>${state.indexResult.propertyCount}</td><td>${state.indexResult.cacheHits}</td><td>${state.indexResult.errors.length}</td></tr></tbody></table></div>`:''}</section><details><summary>Datagrunnlag og begrensninger</summary><ul>${last.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>Kilde: ${esc(last.source)}</p></details><div class="quantity-actions"><button disabled>Eksporter Excel</button><button disabled>Lagre oppsett</button></div></div>`;
    host.querySelector('[data-action="build-index"]')?.addEventListener('click',async()=>{
      state.indexStatus='loading';state.indexResult=null;state.indexError='';state.indexProgress='Starter objektlesing...';render();
      const report=inspectSelectedMetadata(context);
      const models=report.models.map(model=>({id:model.id,name:model.name,versionId:model.versionId}));
      try{state.indexResult=await objectIndex.load(models,{onProgress:progress=>{state.indexProgress=progress.stage==='definitions'?`Leser egenskapsdefinisjoner for ${progress.model.name}...`:`${progress.model.name}: ${Number(progress.done||0).toLocaleString('nb-NO')} av ${Number(progress.total||0).toLocaleString('nb-NO')} objekter`;render();}});state.indexStatus=state.indexResult.errors.length?'partial':'ready';state.indexError=state.indexResult.errors.map(item=>`${item.modelName}: ${item.message}${item.status!=null?` [HTTP ${item.status}]`:''}`).join(' | ');state.indexProgress=`${state.indexResult.entityCount.toLocaleString('nb-NO')} objekter lest fra ${state.indexResult.modelsLoaded} modell${state.indexResult.modelsLoaded===1?'':'er'}.`;}catch(error){if(error?.name!=='AbortError'){state.indexStatus='error';state.indexError=error?.message||String(error);state.indexProgress='Objektindeksen kunne ikke bygges.';}}render();
    });
        host.querySelector('[data-action="refresh"]')?.addEventListener('click',()=>{state.notice='';render();});
    host.querySelector('[data-field="model"]')?.addEventListener('change',event=>{state.modelScope=event.target.value;state.setKey='';state.propertyKey='';state.notice='';render();});
    host.querySelector('[data-field="set"]')?.addEventListener('change',event=>{state.setKey=event.target.value;state.propertyKey='';state.notice='';render();});
    host.querySelector('[data-field="property"]')?.addEventListener('change',event=>{state.propertyKey=event.target.value;state.notice='';render();});
  }

  const api = {
    id:'quantity-summary',
    mount(container){if(destroyed)throw Error('Mengdesammenstilling er lukket permanent.');host=container;active=true;render();},
    render,
    update(){render();},
    canLeave(){return true;},
    unmount(){objectIndex.abort();active=false;if(host)host.replaceChildren();host=null;return true;},
    activate(){active=true;render();},
    deactivate(){active=false;},
    destroy(){api.unmount();objectIndex.clear();last=null;destroyed=true;},
    snapshot(){const report=inspectSelectedMetadata(context);const scoped=scopedCatalog(report,state.modelScope);return Object.freeze({active,destroyed,stage:BUILD,selection:{...state},selectedModels:report.selectedModels,setCount:scoped.sets.length,propertyCount:scoped.properties.length,source:report.source,indexStatus:state.indexStatus,indexResult:state.indexResult,indexCache:objectIndex.snapshot()});}
  };
  return Object.freeze(api);
}
