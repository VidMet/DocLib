import {visibleReport} from './view-options.js?v=2.03-rc.1-fix.1';
import {makeSnapshot,downloadExport} from './export.js?v=2.03-rc.1-fix.1';
import {createObjectIndex} from './object-index.js?v=2.03-rc.1-fix.1';
// DocLib Mengdesammenstilling - v2.03-preview.5, trinn 2
// Dynamiske valg fra eksisterende, modellaggregerte metadata. Ingen nye API-kall.
const BUILD = '2.03-rc.1-fix.1';
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

import {MODEL,catalog,summarize} from './summary-engine.js?v=2.03-rc.1-fix.1';
export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'module',create});
const signature = models => JSON.stringify(models.map(m=>[m.id,m.versionId]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));

export function create(context={}) {
  let host=null,active=false,destroyed=false,generation=0;
  const objectIndex=createObjectIndex(context);
  const state={result:null,signature:'',loading:false,progress:'',error:'',config:{groups:['','',MODEL],column:'',quantity:'',unit:'',decimals:0,roundMode:'normal',roundStep:10,roundScope:'final',nameProperty:'',descriptionProperty:'',columnOverrides:{}},setupOpen:true,columnPickerOpen:false,hiddenColumns:new Set(),collapsed:new Set()};
  function entities(){return state.result?.results.flatMap(r=>r.entities)||[];}
  function field(name,label,keys,value,model=false){return `<label>${esc(label)}<select data-config="${name}">${option('','Ikke valgt',!value)}${model?option(MODEL,'Modellnavn (filnavn)',value===MODEL):''}${keys.map(key=>option(key,key,key===value)).join('')}</select></label>`;}
  function defaults(keys){
    const find=names=>keys.find(key=>names.includes(key.split('::').pop().toLowerCase()))||'';
    if(!state.config.column)state.config.column=find(['prosesskode','ns-kode','nskode']);
    if(!state.config.quantity)state.config.quantity=find(['mengde','volum','netvolume']);
    if(!state.config.unit)state.config.unit=find(['enhet','unit']);
    if(!state.config.descriptionProperty)state.config.descriptionProperty=find(['prosessnavn']);
    if(!state.config.groups[0])state.config.groups[0]=find(['sted']);
    if(!state.config.groups[1])state.config.groups[1]=find(['element','0_element']);
  }
  function columnDescription(column){
    return column.descriptions?.length?column.descriptions.join(' / '):'Ingen beskrivelse tilgjengelig';
  }
  function columnInfo(column){
    const r=column.rounding,fmt=new Intl.NumberFormat('nb-NO',{maximumFractionDigits:6});
    return [column.descriptions?.length?column.descriptions.join(' / '):'Ingen beskrivelse tilgjengelig',r?`Før grovavrunding: ${fmt.format(r.before)}\nEtter avrunding: ${fmt.format(r.after)}\nSamlet differanse: ${fmt.format(r.difference)} (${r.percent===null?'prosent ikke definert':fmt.format(r.percent)+' %'})`:'' ].filter(Boolean).join('\n');
  }
  function columnPicker(columns){
    const visible=columns.filter(c=>!state.hiddenColumns.has(c.key)).length;
    return `<details class="qs-column-picker" data-column-picker${state.columnPickerOpen?' open':''}><summary>Velg kolonner og avrunding (${visible} av ${columns.length})</summary><div class="qs-column-actions"><button class="btn" data-columns="all">Vis alle</button><button class="btn" data-columns="none">Skjul alle</button></div><div class="qs-column-list">${columns.map(c=>{
      const setting=state.config.columnOverrides[c.key]||{mode:'inherit',step:10};
      return `<div class="qs-column-item"><label><input type="checkbox" data-column-key="${esc(c.key)}"${state.hiddenColumns.has(c.key)?'':' checked'}><span>${esc(c.code)} <small>${esc(c.unit||'Enhet ikke valgt')}</small></span></label><label>Avrunding<select data-override="mode" data-key="${esc(c.key)}">${option('inherit','Følg tabelloppsett',setting.mode==='inherit')}${option('decimals','Kun desimaler',setting.mode==='decimals')}${option('step','Eget avrundingstrinn',setting.mode==='step')}</select></label><label>Trinn<select data-override="step" data-key="${esc(c.key)}"${setting.mode!=='step'?' disabled':''}>${[1,10,100,1000,10000].map(n=>option(String(n),String(n),Number(setting.step)===n)).join('')}</select></label><small>${esc(columnInfo(c))}</small></div>`;
    }).join('')}</div><p>Avrundingsnivå og retning følger Tabelloppsett. Eget trinn brukes ved Rund opp/ned; vanlig avrunding bruker desimalvalget. Kolonnevalg gjelder tabell og eksport. Objektantall og avvik gjelder hele modellutvalget.</p></details>`;
  }
  function matrix(report){
    const cols=report.columns;
    const numberFormat=new Intl.NumberFormat('nb-NO',{minimumFractionDigits:Number(state.config.decimals),maximumFractionDigits:Number(state.config.decimals)});
    const cells=node=>cols.map(col=>{const cell=node.cells.get(col.key);return `<td class="qs-number">${cell?esc(numberFormat.format(cell.sum)):'<span title="Ingen gyldige mengder">–</span>'}</td>`;}).join('');
    const rows=[];
    function walk(parent,hidden=false){
      const children=[...parent.children.values()].sort((a,b)=>compare(a.label,b.label));
      for(const node of children){
        const id=JSON.stringify(node.path),closed=state.collapsed.has(id),hasChildren=node.children.size>0;
        rows.push(`<tr class="${hasChildren?'qs-group-row':'qs-model-row'}" data-depth="${node.depth}"${hidden?' hidden':''}><th scope="row"><div class="qs-indent" style="--depth:${node.depth}">${hasChildren?`<button class="qs-toggle" data-toggle="${esc(id)}" aria-expanded="${!closed}" aria-label="Utvid eller skjul gruppe">${closed?'▸':'▾'}</button>`:''}<span>${esc(node.label)}</span><span class="qs-count">${node.count} obj.</span></div></th>${cells(node)}</tr>`);
        walk(node,hidden||closed);
        if(node.roundedHere)rows.push(`<tr class="qs-node-diff"${hidden||(hasChildren&&closed)?' hidden':''}><th scope="row"><div class="qs-indent" style="--depth:${node.depth+1}">${hasChildren?'Avrundingsdifferanse':'Avrundingsinfo (inngår i raden over)'}</div></th>${cells({cells:node.differences})}</tr>`);
      }
    }
    walk(report.root);
    if(!report.root.children.size&&report.root.count)rows.push(`<tr class="qs-model-row"><th scope="row">Alle objekter</th>${cells({cells:report.baseTotals})}</tr>`);
    return `<div class="qs-table-wrap"><table class="qs-matrix"><thead><tr><th class="qs-axis" scope="col">Gruppering</th>${cols.map(c=>`<th scope="col">${esc(c.code)} <button type="button" class="qs-info" data-info="${esc(c.key)}" title="${esc(columnDescription(c))}" aria-label="Informasjon om ${esc(c.code)}">ⓘ</button><small class="qs-unit">${esc(c.unit||'Enhet ikke valgt')}</small></th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody><tfoot>${report.roundScope==='final'?`<tr class="qs-round-diff"><th scope="row">Avrundingsdifferanse</th>${cells({cells:report.differences})}</tr>`:''}<tr><th scope="row">Sum per kolonne</th>${cells(report.root)}</tr></tfoot></table></div>`;
  }
  function render(){
    if(!active||!host||destroyed)return;
    const selection=inspectSelectedMetadata(context), stale=state.result&&signature(selection.models)!==state.signature;
    const keys=catalog(entities());let report=null,allColumns=[],configError='';
    if(state.result&&!stale&&!state.loading){try{report=summarize(entities(),state.config);allColumns=report.columns;report=visibleReport(report,state.hiddenColumns);}catch(error){configError=error.message;}}
    host.innerHTML=`<div class="qs-shell"><header><div><span class="quantity-kicker">PREVIEW.5 TRINN 3I</span><h2>Mengdesammenstilling</h2><p>Bygg: v${BUILD}</p></div><button class="btn primary" data-action="load"${state.loading||!selection.selectedModels?' disabled':''}>${state.loading?'Leser objekter...':state.result?'Oppdater objektindeks':'Bygg objektindeks'}</button></header><p>${selection.selectedModels} valgte IFC-modeller. ${esc(state.progress)}</p>${state.error?`<p class="quantity-notice warning">${esc(state.error)}</p>`:''}${stale?'<p class="quantity-notice warning">Modellutvalget eller versjonen er endret. Oppdater objektindeksen før summering.</p>':''}${state.result?`<div class="qs-kpis"><span>Modeller: ${state.result.modelsLoaded} av ${state.result.modelsRequested}</span><span>Objekter: ${state.result.entityCount}</span><span>Med egenskaper: ${state.result.entitiesWithProperties}</span><span>Egenskaper: ${keys.length}</span><span>Cachetreff: ${state.result.cacheHits}</span><span>Utelatte strukturobjekter: ${state.result.excludedStructureCount??0}</span><span>Ukjent IFC-klasse: ${state.result.unknownClassCount??0}</span></div><details class="qs-settings" data-setup${state.setupOpen?' open':''}><summary>Tabelloppsett</summary><section class="qs-setup"><div class="qs-setup-row"><div class="qs-row-title"><h3>Datakilder</h3><p>Egenskaper fra innleste objekter</p></div><div class="qs-fields qs-fields-sources">${field('column','Kolonner (kode)',keys,state.config.column)}${field('descriptionProperty','Kolonne (beskrivelse)',keys,state.config.descriptionProperty)}${field('quantity','Mengde',keys,state.config.quantity)}${field('unit','Enhet (valgfritt)',keys,state.config.unit)}<label>Objektnavn i avvik<select data-config="nameProperty">${option('','Automatisk navnevalg',!state.config.nameProperty)}${keys.map(key=>option(key,key,key===state.config.nameProperty)).join('')}</select><small>Valgt egenskap først, deretter automatisk navnevalg. Objekt-ID beholdes.</small></label></div></div><div class="qs-setup-row"><div class="qs-row-title"><h3>Gruppering</h3><p>Øverste til nederste nivå</p></div><div class="qs-fields qs-fields-groups">${state.config.groups.map((key,i)=>field('group'+i,'Nivå '+(i+1),keys,key,true)).join('')}</div></div><div class="qs-setup-row"><div class="qs-row-title"><h3>Avrunding</h3><p>Før delsummer og totalsum</p></div><div><div class="qs-fields qs-fields-sources"><label>Avrund på<select data-config="roundScope">${option('final','Kun totalsum',state.config.roundScope==='final')}${[2,1,0].map(i=>`<option value="group${i+1}"${state.config.roundScope==='group'+(i+1)?' selected':''}${state.config.groups[i]?'':' disabled'}>Gruppe ${i+1}: ${esc(state.config.groups[i]===MODEL?'Modellnavn':state.config.groups[i]||'Ikke valgt')}</option>`).join('')}</select></label><label>Desimaler<select data-config="decimals">${[0,1,2,3,4,5,6].map(n=>option(String(n),String(n),Number(state.config.decimals)===n)).join('')}</select></label><label>Avrundingsmåte<select data-config="roundMode">${[['normal','Vanlig avrunding'],['up','Rund opp'],['down','Rund ned']].map(([v,t])=>option(v,t,state.config.roundMode===v)).join('')}</select></label><label>Avrundingstrinn<select data-config="roundStep"${state.config.roundMode==='normal'?' disabled':''}>${[1,10,100,1000,10000].map(n=>option(String(n),new Intl.NumberFormat('nb-NO').format(n),Number(state.config.roundStep)===n)).join('')}</select></label></div><p>${state.config.roundScope==='final'?'Gruppe 3–1 følger valgte desimaler. Bare Sum per kolonne avrundes etter valgt retning og trinn.':`Gruppe ${state.config.roundScope.slice(-1)} avrundes etter valgt retning og trinn. Nivåer under følger valgte desimaler. Nivåer over summerer avrundede verdier uten ny trinnavrunding.`} IFC-objektmengdene avrundes aldri. Avrundingsdifferansen vises ved valgt nivå. Vanlig avrunding bruker valgt antall desimaler. Opp/ned bruker valgt trinn. Originaldata endres ikke.</p></div></div><div class="qs-setup-row"><div class="qs-row-title"><h3>Summering</h3></div><p>Ulike enheter får separate kolonner. Ingen omregning av enheter.${!state.config.unit?' <strong>Enhet er ikke valgt. Kontroller at mengdene har samme enhet før summene brukes.</strong>':''}</p></div></section></details>`:'<p>Velg IFC-filer i det felles filtreet, og bygg objektindeksen.</p>'}${configError?`<p class="quantity-notice">${esc(configError)}</p><button class="btn" data-class-diagnostics>Last ned klassediagnostikk</button>`:''}${report?`<section class="qs-main">${columnPicker(allColumns)}<div class="qs-export-bar"><label>Eksporter<select data-export-format><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option><option value="pdf">PDF (.pdf)</option></select></label><button class="btn primary" data-action="export"${!report.columns.length?' disabled':''}>Eksporter</button><span>${report.columns.length} av ${allColumns.length} kolonner eksporteres. Alle grupper inkluderes, også sammenfoldede.</span></div><div class="qs-kpis"><span>Summerte objekter: ${report.stats.included}</span><span>Mangler mengde: ${report.stats.missing}</span><span>Ugyldig mengde: ${report.stats.invalid}</span><span>Mangler kode: ${report.stats.missingColumn}</span><span>Mangler enhet: ${report.stats.missingUnit}</span><span>Mangler gruppeverdi: ${report.stats.missingGroup}</span></div>${report.columns.length?matrix(report):(allColumns.length?'<p>Alle kolonner er skjult. Velg minst én kolonne for å vise tabellen eller eksportere.</p>':'<p>Ingen gyldige mengder for valgte egenskaper.</p>')}${report.issues.length?`<details><summary>Avvik (${report.issues.length})</summary><p>Avvik er informasjon om datagrunnlaget, ikke nødvendigvis modellfeil. Listen gjelder hele modellutvalget, også skjulte kolonner. Manglende gruppeverdier inngår i egen gruppe. Andre avvik utelates fra summeringen.</p><div class="qs-table-wrap"><table class="qs-issues"><thead><tr><th>Modell</th><th>Objektnavn</th><th>Objekttype</th><th>Objekt-ID</th><th>Avvik</th><th>Råverdi</th></tr></thead><tbody>${report.issues.slice(0,500).map(i=>`<tr><td>${esc(i.modelName)}</td><td title="${esc(i.nameSource||'Ingen navneegenskap tilgjengelig')}">${esc(i.entityName)}</td><td>${esc(i.entityType)}</td><td>${esc(i.entityId)}</td><td>${esc(i.reason)}</td><td>${esc(i.value)}</td></tr>`).join('')}</tbody></table></div>${report.issues.length>500?'<p>Viser de første 500 avvikene.</p>':''}</details>`:''}</section>`:''}<details><summary>Datagrunnlag og begrensninger</summary><p>Kun objektmetadata fra valgte IFC-modeller. IFC-prosjekt- og romlige strukturobjekter filtreres før egenskapsvalg, summering og avvik. Ukjent IFC-klasse sperrer beregning og eksport; objektnavn brukes ikke som klasse. Ingen demonstrasjonsverdier. Tall med punktum eller komma som desimalskilletegn støttes. Tusenskilletegn og tekst med enhet tolkes ikke automatisk. Standard er 0 desimaler. IFC-objektmengdene avrundes aldri. Kun sluttsum viser en egen avrundingsdifferanse. Avrundingen følger valgt gruppeplass (1, 2 eller 3), også når andre gruppeplasser ikke er i bruk. Avrundingsinfo ved nederste rad inngår allerede i raden; den skal ikke summeres en gang til. Endret gruppering kan endre avrundet totalsum. Opp betyr mot pluss uendelig, ned betyr mot minus uendelig, også for negative tall. Manglende celler vises som strek, gyldig null vises som 0.</p><p>Eksport: Excel, CSV og PDF. Excel/PDF inkluderer oppsett og avvik. CSV inneholder nederste rader, eventuell avrundingsdifferanse og merket totalsumrad. Ved videre summering brukes Mengde + Avrundingsdifferanse, ikke Totalsum. PDF støtter norske og vesteuropeiske tegn; andre tegn kan vises som ?. Lagring/import av oppsett er ikke inkludert.</p></details></div>`;
    host.querySelector('[data-action="load"]')?.addEventListener('click',load);
    host.querySelector('[data-class-diagnostics]')?.addEventListener('click',()=>{
      const data={build:BUILD,models:state.result?.results.map((r,i)=>({modelNumber:i+1,...r.classDiagnostics}))};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='DocLib-IFC-class-diagnostics.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    });
    host.querySelector('[data-action="export"]')?.addEventListener('click',()=>{
      if(!report||!report.columns.length||state.loading||state.signature!==signature(inspectSelectedMetadata(context).models)){state.error='Oppdater objektindeksen før eksport.';render();return;}
      try{const snapshot=makeSnapshot(report,state.config,{build:BUILD,columnSelection:{total:allColumns.length,visible:report.columns.length,hidden:allColumns.filter(c=>state.hiddenColumns.has(c.key)).map(c=>({code:c.code,unit:c.unit}))},warning:state.error,ifcFilter:{excluded:state.result.excludedStructureCount??0,unknown:state.result.unknownClassCount??0,models:state.result.results.map(r=>({model:r.model.name,excludedByClass:r.excludedByClass}))},models:inspectSelectedMetadata(context).models.map(({id,name,versionId})=>({id,name,versionId}))});downloadExport(host.querySelector('[data-export-format]').value,snapshot);}
      catch(error){state.error='Eksportfeil: '+(error.message||String(error));render();}
    });
    host.querySelector('[data-setup]')?.addEventListener('toggle',event=>{state.setupOpen=event.currentTarget.open;});
    host.querySelector('[data-column-picker]')?.addEventListener('toggle',event=>{state.columnPickerOpen=event.currentTarget.open;});
    host.querySelectorAll('[data-column-key]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)state.hiddenColumns.delete(input.dataset.columnKey);else state.hiddenColumns.add(input.dataset.columnKey);render();}));
    host.querySelectorAll('[data-columns]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.columns==='all')state.hiddenColumns.clear();else allColumns.forEach(c=>state.hiddenColumns.add(c.key));render();}));
    host.querySelectorAll('[data-override]').forEach(select=>select.addEventListener('change',()=>{const key=select.dataset.key;const setting={mode:'inherit',step:10,...state.config.columnOverrides[key]};setting[select.dataset.override]=select.dataset.override==='step'?Number(select.value):select.value;state.config.columnOverrides[key]=setting;render();}));
    host.querySelectorAll('[data-info]').forEach(button=>button.addEventListener('click',()=>{const column=allColumns.find(c=>c.key===button.dataset.info);if(!column)return;const dialog=document.createElement('dialog');dialog.className='qs-info-dialog';dialog.innerHTML=`<h3>${esc(column.code)} [${esc(column.unit)}]</h3><pre>${esc(columnDescription(column))}</pre><button type="button">Lukk</button>`;document.body.appendChild(dialog);dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();}));
    host.querySelectorAll('[data-config]').forEach(select=>select.addEventListener('change',event=>{const key=event.target.dataset.config;if(key.startsWith('group'))state.config.groups[Number(key.slice(5))]=event.target.value;else state.config[key]=event.target.value;if(/^group[123]$/.test(state.config.roundScope)&&!state.config.groups[Number(state.config.roundScope.slice(-1))-1])state.config.roundScope='final';if(key==='column'||key==='unit'){state.hiddenColumns.clear();state.config.columnOverrides={};}state.collapsed.clear();render();}));
    host.querySelectorAll('[data-toggle]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.toggle;if(state.collapsed.has(key))state.collapsed.delete(key);else state.collapsed.add(key);render();}));
  }
  async function load(){
    const token=++generation,selection=inspectSelectedMetadata(context),models=selection.models.map(({id,name,versionId})=>({id,name,versionId}));
    state.loading=true;state.error='';state.progress='Starter objektlesing...';render();
    try{
      const result=await objectIndex.load(models,{onProgress:p=>{if(token!==generation)return;state.progress=p.stage==='definitions'?`Leser egenskaper: ${p.model.name}`:`${p.model.name}: ${p.done} av ${p.total} objekter`;render();}});
      if(token!==generation)return;
      state.result=result;state.signature=signature(models);state.collapsed.clear();
      state.error=result.errors.map(e=>`${e.modelName}: ${e.message}`).join(' | ');
      if(result.errors.length)state.error='Ufullstendig datagrunnlag. Summene gjelder bare modeller som ble lest komplett. '+state.error;
      const available=catalog(entities());
      for(const key of ['column','quantity','unit','nameProperty','descriptionProperty'])if(state.config[key]&&!available.includes(state.config[key]))state.config[key]='';
      state.config.groups=state.config.groups.map(key=>key===MODEL||available.includes(key)?key:'');
      defaults(available);if(/^group[123]$/.test(state.config.roundScope)&&!state.config.groups[Number(state.config.roundScope.slice(-1))-1])state.config.roundScope='final';state.progress=`${result.entityCount} objekter lest.`;
    }catch(error){if(token===generation&&error.name!=='AbortError')state.error=error.message||String(error);}
    finally{if(token===generation){state.loading=false;render();}}
  }
  const api={id:'quantity-summary',mount(container){if(destroyed)throw Error('Verktøyet er lukket permanent.');host=container;active=true;
    if(!document.querySelector('link[data-quantity-summary-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./styles.css?v='+BUILD,import.meta.url).href;link.dataset.quantitySummaryStyle=BUILD;document.head.appendChild(link);}else{document.querySelector('link[data-quantity-summary-style]').href=new URL('./styles.css?v='+BUILD,import.meta.url).href;}
    render();},render,update(){render();},canLeave(){return true;},unmount(){generation++;objectIndex.abort();state.loading=false;active=false;if(host)host.replaceChildren();host=null;return true;},activate(){active=true;render();},deactivate(){active=false;},destroy(){api.unmount();objectIndex.clear();state.result=null;destroyed=true;},snapshot(){return {active,destroyed,stage:BUILD,selection:JSON.parse(JSON.stringify(state.config)),view:{setupOpen:state.setupOpen,columnPickerOpen:state.columnPickerOpen,hiddenColumns:[...state.hiddenColumns]},indexStatus:state.loading?'loading':state.result?'ready':'idle',indexResult:state.result,indexCache:objectIndex.snapshot(),stale:!!state.result&&state.signature!==signature(inspectSelectedMetadata(context).models)};}};
  return Object.freeze(api);
}
