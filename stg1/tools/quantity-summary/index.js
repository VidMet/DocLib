const V='2.03-preview.1';
const SAMPLE=[
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_01.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:1842.50,enhet:'m³'},
 {sted:'Sted 01',element:'Vegoverbygning',fil:'VEI_02.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:612.25,enhet:'m³'},
 {sted:'Sted 01',element:'Kantstein',fil:'VEI_01.ifc',kode:'71.3',beskrivelse:'Kantstein',mengde:1426,enhet:'m'},
 {sted:'Sted 02',element:'Vegoverbygning',fil:'VEI_02.ifc',kode:'21.2',beskrivelse:'Sprengning',mengde:2190,enhet:'m³'},
 {sted:'Sted 02',element:'Kantstein',fil:'VEI_02.ifc',kode:'71.3',beskrivelse:'Kantstein',mengde:204,enhet:'m'}
];
const FIELDS=['sted','element','kode','beskrivelse','fil'];
const LABEL={sted:'Sted',element:'Element',kode:'Kode',beskrivelse:'Beskrivelse',fil:'Filnavn'};
function aggregate(rows,groups){
 const root={children:new Map(),totals:new Map(),count:0};
 const add=(node,row)=>{node.count++;node.totals.set(row.enhet,(node.totals.get(row.enhet)||0)+row.mengde)};
 rows.forEach(row=>{let node=root;add(node,row);groups.forEach(field=>{const value=row[field]||'Ikke angitt';if(!node.children.has(value))node.children.set(value,{field,value,children:new Map(),totals:new Map(),count:0,rows:[]});node=node.children.get(value);add(node,row)});node.rows.push(row)});return root;
}
function totalsHtml(map){return [...map].map(([u,v])=>`<span class="qs-total">${v.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2})} ${u}</span>`).join('')}
function treeHtml(node,depth=0){return [...node.children.values()].sort((a,b)=>a.value.localeCompare(b.value,'nb',{numeric:true})).map(n=>`<div class="qs-node" style="--depth:${depth}"><details open><summary><b>${LABEL[n.field]}:</b> ${n.value}<span class="qs-count">${n.count} poster</span>${totalsHtml(n.totals)}</summary><div>${n.children.size?treeHtml(n,depth+1):n.rows.map(r=>`<div class="qs-row"><span>${r.kode}</span><span>${r.beskrivelse}</span><span>${r.fil}</span><strong>${r.mengde.toLocaleString('nb-NO',{minimumFractionDigits:2})} ${r.enhet}</strong></div>`).join('')}<div class="qs-subtotal">Sum ${n.value}${totalsHtml(n.totals)}</div></div></details></div>`).join('')}
function create(){let host=null,mounted=false,project=null;const state={groups:['sted','element','fil'],sources:{sted:'Sted',element:'Element',kode:'Prosesskode',beskrivelse:'Prosessnavn',mengde:'Mengde',enhet:'Enhet'}};
 function render(){if(!host)return;host.innerHTML=`<section class="qs-shell"><header><div><h2>Mengdesammenstilling <small>${V}</small></h2><p>Teknisk forhåndsvisning med konfigurerbare egenskapsnavn, tre grupperingsnivåer og summer per enhet.</p></div><button class="btn" id="qsDemo">Last eksempeldata</button></header><div class="qs-grid"><aside><h3>Datakilder</h3>${Object.entries(state.sources).map(([k,v])=>`<label>${LABEL[k]||k}<input data-source="${k}" value="${v}"></label>`).join('')}<p class="qs-help">Egenskapsnavn kan være f.eks. NS-kode, ISY Prosesskode eller A200_Prosesskode. Matching mot IFC kommer i neste preview.</p><h3>Gruppering</h3>${[0,1,2].map(i=>`<label>Nivå ${i+1}<select data-group="${i}">${FIELDS.map(f=>`<option value="${f}" ${state.groups[i]===f?'selected':''}>${LABEL[f]}</option>`).join('')}</select></label>`).join('')}<button class="btn primary" id="qsApply">Oppdater tabell</button></aside><main><div class="qs-kpis"><span>Prosjekt: ${project?.projectName||'ikke lastet'}</span><span>${SAMPLE.length} eksempelposter</span><span>Ulike enheter holdes adskilt</span></div><div id="qsTable">${treeHtml(aggregate(SAMPLE,state.groups))}<div class="qs-grand"><b>Totalt</b>${totalsHtml(aggregate(SAMPLE,state.groups).totals)}</div></div></main></div></section>`;
 host.querySelectorAll('[data-source]').forEach(el=>el.oninput=()=>state.sources[el.dataset.source]=el.value);
 host.querySelectorAll('[data-group]').forEach(el=>el.onchange=()=>state.groups[+el.dataset.group]=el.value);
 host.querySelector('#qsApply').onclick=render;host.querySelector('#qsDemo').onclick=render;
 }
 return Object.freeze({mount(h){host=h;mounted=true;render()},unmount(){mounted=false;if(host)host.innerHTML=''},render,update(change){if(change?.type==='project-state'){project=change.state;if(mounted)render()}},canLeave(){return true},destroy(){host=null},snapshot(){return{groups:[...state.groups],sources:{...state.sources}}}})}
export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'preview',create});
