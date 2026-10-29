const V='2.03-preview.2';
const SAMPLE=[
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_01.ifc',kode:'21.1',beskrivelse:'Rensk',mengde:245,enhet:'m³'},
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_01.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:1842.50,enhet:'m³'},
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_02.ifc',kode:'21.1',beskrivelse:'Rensk',mengde:83,enhet:'m³'},
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_02.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:612.25,enhet:'m³'},
 {sted:'Sted 01',element:'Kantstein',fil:'VEI_01.ifc',kode:'71.3',beskrivelse:'Kantstein',mengde:1426,enhet:'m'},
 {sted:'Sted 01',element:'Kantstein',fil:'VEI_02.ifc',kode:'71.3',beskrivelse:'Kantstein',mengde:204,enhet:'m'},
 {sted:'Sted 02',element:'Vegoverbygning',fil:'VEI_02.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:2190,enhet:'m³'},
 {sted:'Sted 02',element:'Kantstein',fil:'VEI_02.ifc',kode:'71.3',beskrivelse:'Kantstein',mengde:765,enhet:'m'},
 {sted:'Sted 02',element:'Skilt',fil:'VEI_02.ifc',kode:'75.1',beskrivelse:'Trafikkskilt',mengde:14,enhet:'stk'}
];
const ROW_FIELDS=['sted','element','fil','beskrivelse'];
const LABEL={sted:'Sted',element:'Element',fil:'Modellnavn',kode:'Kode',beskrivelse:'Beskrivelse',mengde:'Mengde',enhet:'Enhet'};
const fmt=value=>Number(value).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2});
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const natural=(a,b)=>String(a).localeCompare(String(b),'nb',{numeric:true,sensitivity:'base'});
const columnKey=row=>`${row.kode}\u001f${row.enhet}`;
function columnsFor(rows){
 const map=new Map();
 rows.forEach(row=>{const key=columnKey(row);if(!map.has(key))map.set(key,{key,code:row.kode||'Ikke angitt',unit:row.enhet||'Ukjent',description:row.beskrivelse||''});});
 return [...map.values()].sort((a,b)=>natural(a.code,b.code)||natural(a.unit,b.unit));
}
function addTotals(target,row){const key=columnKey(row);target.set(key,(target.get(key)||0)+Number(row.mengde||0));}
function buildTree(rows,groups,depth=0){
 const node={depth,rows,totals:new Map(),children:[]};rows.forEach(row=>addTotals(node.totals,row));
 if(depth<groups.length){const field=groups[depth],buckets=new Map();rows.forEach(row=>{const value=String(row[field]||'Ikke angitt');if(!buckets.has(value))buckets.set(value,[]);buckets.get(value).push(row)});node.children=[...buckets].sort((a,b)=>natural(a[0],b[0])).map(([value,items])=>({field,value,...buildTree(items,groups,depth+1)}));}
 return node;
}
function cellsHtml(totals,columns,kind=''){return columns.map(col=>`<td class="qs-number ${kind}" data-column="${escapeHtml(col.key)}">${totals.has(col.key)?fmt(totals.get(col.key)):''}</td>`).join('')}
function rowsHtml(node,columns,groups,depth=0){
 return node.children.map(child=>{
  const isModel=depth===groups.length-1;
  const rowClass=isModel?'qs-model-row':'qs-group-row';
  const caret=isModel?'':'<button class="qs-toggle" type="button" aria-label="Åpne eller lukk gruppe">▾</button>';
  const count=`<span class="qs-count">${child.rows.length} post${child.rows.length===1?'':'er'}</span>`;
  const own=`<tr class="${rowClass}" data-depth="${depth}"><th scope="row"><span class="qs-indent" style="--depth:${depth}">${caret}<span class="qs-level">${escapeHtml(LABEL[child.field])}</span><b>${escapeHtml(child.value)}</b>${count}</span></th>${cellsHtml(child.totals,columns,isModel?'':'qs-subtotal')}</tr>`;
  const nested=isModel?'':rowsHtml(child,columns,groups,depth+1);
  return own+nested;
 }).join('');
}
function matrixHtml(rows,groups){
 const columns=columnsFor(rows),tree=buildTree(rows,groups);
 return `<div class="qs-table-wrap"><table class="qs-matrix"><thead><tr><th class="qs-axis">${groups.map(g=>escapeHtml(LABEL[g])).join(' → ')}</th>${columns.map(col=>`<th title="${escapeHtml(col.description)}"><span class="qs-code">${escapeHtml(col.code)}</span><span class="qs-desc">${escapeHtml(col.description)}</span><span class="qs-unit">${escapeHtml(col.unit)}</span></th>`).join('')}</tr></thead><tbody>${rowsHtml(tree,columns,groups)}</tbody><tfoot><tr><th>Totalt alle steder</th>${cellsHtml(tree.totals,columns,'qs-grand-total')}</tr></tfoot></table></div>`;
}
function create(){
 let host=null,mounted=false,project=null;
 const state={groups:['sted','element','fil'],sources:{sted:'Sted',element:'Element',kode:'Prosesskode',beskrivelse:'Prosessnavn',mengde:'Mengde',enhet:'Enhet'}};
 function render(){if(!host)return;host.innerHTML=`<section class="qs-shell"><header><div><h2>Mengdesammenstilling <small>${V}</small></h2><p>Mengdematrise med radgrupper, kodekolonner og vertikale summer per kolonne.</p></div><button class="btn" id="qsDemo">Nullstill eksempel</button></header><div class="qs-grid"><aside><h3>Datakilder</h3>${Object.entries(state.sources).map(([key,value])=>`<label>${escapeHtml(LABEL[key]||key)}<input data-source="${key}" value="${escapeHtml(value)}"></label>`).join('')}<p class="qs-help">Egenskapsnavn kan være for eksempel NS-kode, ISY Prosesskode eller A200_Prosesskode. IFC-matching kommer i neste preview.</p><h3>Radgrupper</h3>${[0,1].map(index=>`<label>Nivå ${index+1}<select data-group="${index}">${ROW_FIELDS.filter(f=>f!=='fil').map(field=>`<option value="${field}" ${state.groups[index]===field?'selected':''}>${LABEL[field]}</option>`).join('')}</select></label>`).join('')}<label>Nivå 3<input value="Modellnavn" disabled><small>Fast nederste nivå</small></label><h3>Kolonnefelt</h3><label>Kode<input value="${escapeHtml(state.sources.kode)}" disabled></label><p class="qs-help">Hver unik kombinasjon av kode og enhet blir en egen kolonne.</p><button class="btn primary" id="qsApply">Oppdater matrise</button></aside><main><div class="qs-kpis"><span>Prosjekt: ${escapeHtml(project?.projectName||'ikke lastet')}</span><span>${SAMPLE.length} eksempelposter</span><span>Ingen radtotal</span><span>Sum per kodekolonne</span></div>${matrixHtml(SAMPLE,state.groups)}</main></div></section>`;
  host.querySelectorAll('[data-source]').forEach(el=>el.oninput=()=>state.sources[el.dataset.source]=el.value);
  host.querySelectorAll('[data-group]').forEach(el=>el.onchange=()=>{state.groups[Number(el.dataset.group)]=el.value});
  host.querySelector('#qsApply').onclick=render;host.querySelector('#qsDemo').onclick=()=>{state.groups=['sted','element','fil'];render()};
  host.querySelectorAll('.qs-toggle').forEach(button=>button.onclick=()=>{const row=button.closest('tr'),depth=Number(row.dataset.depth),collapsed=row.classList.toggle('is-collapsed');button.textContent=collapsed?'▸':'▾';let next=row.nextElementSibling;while(next&&Number(next.dataset.depth)>depth){if(collapsed)next.hidden=true;else if(!hasCollapsedParent(next))next.hidden=false;next=next.nextElementSibling;}});
 }
 function hasCollapsedParent(row){let previous=row.previousElementSibling,depth=Number(row.dataset.depth);while(previous){const pd=Number(previous.dataset.depth);if(pd<depth){if(previous.classList.contains('is-collapsed'))return true;depth=pd;}previous=previous.previousElementSibling;}return false;}
 return Object.freeze({mount(target){host=target;mounted=true;render()},unmount(){mounted=false;if(host)host.innerHTML=''},render,update(change){if(change?.type==='project-state'){project=change.state;if(mounted)render()}},canLeave(){return true},destroy(){host=null},snapshot(){return{groups:[...state.groups],sources:{...state.sources}}}})
}
export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'preview',create});
