// Preview.5 step 1: read-only inspection of existing selected model metadata.
// No API calls, storage writes or changes to workspace routing.
const BUILD = 'preview.5-step.1-fix.1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compare = (a,b) => a.localeCompare(b,'nb',{numeric:true});
export function inspectSelectedMetadata(context = {}) {
  const explorerPort = context.explorerPort || {};
  const directRows = explorerPort.selectedRows?.() || [];
  const workspaceIds = new Set((explorerPort.workspaceSelectedIds?.() || []).map(String));
  const workspaceRows = workspaceIds.size ? (explorerPort.visibleRows?.() || []).filter(row => workspaceIds.has(String(row?.file?.id))) : [];
  const selected = workspaceRows.length ? workspaceRows : directRows;
  const selectionSource = workspaceRows.length ? 'workspaceScope via explorerPort.visibleRows()' : 'explorerPort.selectedRows()';
  const seen = new Set();
  const models = [];
  const catalog = new Map();
  for (const row of selected) {
    const file = row?.file;
    if (!file || !(String(file.format || '').toLowerCase() === 'ifc' || /\.ifc$/i.test(file.name || ''))) continue;
    if (file.id == null || String(file.id) === '') continue;
    const id = String(file.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const entries = [];
    for (const [key,value] of Object.entries(row.props || {})) {
      const cut = key.indexOf('::');
      if (cut <= 0 || cut + 2 >= key.length || value == null || String(value).trim() === '') continue;
      const pset = key.slice(0,cut), property = key.slice(cut+2);
      entries.push({key,pset,property,value:String(value)});
      if (!catalog.has(key)) catalog.set(key,{key,pset,property,modelIds:[],sampleValues:[]});
      const item = catalog.get(key);
      item.modelIds.push(id);
      if (item.sampleValues.length < 5 && !item.sampleValues.includes(String(value))) item.sampleValues.push(String(value));
    }
    entries.sort((a,b) => compare(a.pset,b.pset) || compare(a.property,b.property));
    models.push({id,name:String(file.name || id),versionId:file.versionId == null ? null : String(file.versionId),propertyCount:entries.length,setCount:new Set(entries.map(x=>x.pset)).size,metadataState:entries.length?'available':'no-values',entries});
  }
  const properties = [...catalog.values()].sort((a,b)=>compare(a.pset,b.pset)||compare(a.property,b.property)).map(item=>({...item,modelCount:item.modelIds.length,selectedModelCount:models.length}));
  return {build:BUILD,source:selectionSource,models,properties,selectedModels:models.length,modelsWithValues:models.filter(x=>x.propertyCount>0).length,setCount:new Set(properties.map(x=>x.pset)).size,propertyCount:properties.length,limitations:['Kun egenskaper med ikke-tom verdi i eksisterende modellmetadata.','Ingen objektdekning, datatype, enhet eller mengdesummering.','Tom metadata betyr ikke at modellen mangler egenskaper.']};
}
export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'module',create});
export function create(context = {}) {
  let host = null, active = false, destroyed = false;
  let last = null;
  function render() {
    if (!active || !host || destroyed) return;
    last = inspectSelectedMetadata(context);
    const modelRows = last.models.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.id)}</td><td>${esc(m.versionId || 'Ikke oppgitt')}</td><td>${m.setCount}</td><td>${m.propertyCount}</td><td>${m.propertyCount?'Verdier tilgjengelige':'Ingen innleste verdier; kontroller metadata'}</td></tr>`).join('');
    const propertyRows = last.properties.map(p=>`<tr><td>${esc(p.pset)}</td><td>${esc(p.property)}</td><td>${p.modelCount} av ${p.selectedModelCount}</td><td>${p.sampleValues.map(esc).join(' / ')}</td></tr>`).join('');
    host.innerHTML = `<div class="quantity-summary-tool"><section class="quantity-hero"><div><span class="quantity-kicker">PREVIEW.5 TRINN 1 FIX.1</span><h2>Mengdesammenstilling</h2><p>Lesekontroll av eksisterende modellmetadata</p></div><button class="btn primary" data-quantity-refresh>Oppdater fra valgte modeller</button></section><div class="quantity-notice" role="status">${last.selectedModels ? `${last.selectedModels} valgte IFC-modeller · ${last.modelsWithValues} med innleste verdier · ${last.setCount} egenskapssett · ${last.propertyCount} egenskaper` : 'Velg minst én IFC-modell i Utforsker og åpne Mengdesammenstilling igjen.'}</div><p>Dette trinnet kontrollerer datagrunnlaget. Dynamiske nedtrekksmenyer og mengdeberegning er ikke implementert her. Ingen nye API-kall utføres.</p><section class="quantity-card"><h3>Valgte modeller</h3><div class="quantity-table-wrap"><table><thead><tr><th>Modell</th><th>Modell-ID</th><th>Versjon-ID</th><th>Sett</th><th>Egenskaper</th><th>Metadata</th></tr></thead><tbody>${modelRows || '<tr><td colspan="6">Ingen valgte IFC-modeller.</td></tr>'}</tbody></table></div></section><section class="quantity-card"><h3>Oppdagede egenskaper</h3><p>Dekning gjelder modeller med registrert verdi, ikke IFC-objekter. Eksempler er modellaggregerte verdier, ikke alle verdier i modellen.</p><div class="quantity-table-wrap"><table><thead><tr><th>Egenskapssett</th><th>Egenskap</th><th>Modelldekning</th><th>Eksempelverdier, maks. 5</th></tr></thead><tbody>${propertyRows || '<tr><td colspan="4">Ingen tilgjengelige egenskapsverdier. Kjør Oppdater metadata ved behov.</td></tr>'}</tbody></table></div></section><details><summary>Datagrunnlag og begrensninger</summary><ul>${last.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>Kilde: ${esc(last.source)}. Diagnose er også tilgjengelig gjennom window.DocLib.quantitySummary.snapshot().</p></details><div class="quantity-actions"><button disabled>Eksporter Excel</button><button disabled>Lagre oppsett</button></div></div>`;
    host.querySelector('[data-quantity-refresh]')?.addEventListener('click',render);
  }
  const api = {
    id:'quantity-summary',
    mount(container){if(destroyed)throw Error('Mengdesammenstilling er lukket permanent.');host=container;active=true;render();},
    render,
    update(){render();},
    canLeave(){return true;},
    unmount(){active=false;if(host)host.replaceChildren();host=null;return true;},
    activate(){active=true;render();},
    deactivate(){active=false;},
    destroy(){api.unmount();last=null;destroyed=true;},
    snapshot(){const report=inspectSelectedMetadata(context);return Object.freeze({active,destroyed,stage:BUILD,...report});}
  };
  return Object.freeze(api);
}
