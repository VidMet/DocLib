const td=(x)=>`<td>${x}</td>`;
function selectedIfcRows(context){
 const rows=context?.explorerPort?.selectedRows?.()||[];
 return rows.filter(r=>String(r?.file?.name||'').toLowerCase().endsWith('.ifc'));
}
function modelName(row){return row?.file?.name||'Ukjent IFC-modell';}
function mockRows(models){
 const source=models.length?models:[{file:{name:'Ingen IFC-modell valgt'}}];
 return source.flatMap((m,i)=>[
  {model:modelName(m),type:'IfcWall',count:128+i*17,length:'-',area:(848.3+i*91.2).toFixed(1),volume:(112.4+i*13.7).toFixed(1)},
  {model:modelName(m),type:'IfcSlab',count:34+i*4,length:'-',area:(1267.8+i*117.5).toFixed(1),volume:(286.9+i*25.4).toFixed(1)},
  {model:modelName(m),type:'IfcBeam',count:76+i*9,length:(932.6+i*84.2).toFixed(1),area:'-',volume:(41.8+i*4.9).toFixed(1)},
  {model:modelName(m),type:'IfcColumn',count:42+i*5,length:(158.4+i*15.7).toFixed(1),area:'-',volume:(19.6+i*2.6).toFixed(1)}
 ]);
}
export default Object.freeze({id:'quantity-summary',title:'Mengdesammenstilling',legacyMode:'quantities',status:'module',create});
export function create(context={}){
 let active=false,destroyed=false,host=null,notice='Forhåndsvisning med demonstrasjonsmengder. Faktisk IFC-utlesing kobles i neste trinn.';
 function render(){if(!active||!host)return;const models=selectedIfcRows(context);const rows=mockRows(models);host.innerHTML=`<div class="quantity-summary-tool">
  <section class="quantity-hero"><div><span class="quantity-kicker">PREVIEW.4 FIX.2</span><h2>Mengdeoversikt</h2><p>Modellvalg fra Utforsker er nå koblet til verktøyet.</p></div><button class="primary" data-action="refresh">Oppdater fra valgte modeller</button></section>
  <div class="quantity-notice">${notice}</div>
  <section class="quantity-card"><div class="quantity-card-head"><div><h3>Valgte IFC-modeller</h3><p>${models.length?models.map(modelName).join(' · '):'Velg én eller flere IFC-filer i Utforsker, og åpne Mengdeoversikt.'}</p></div><strong>${models.length}</strong></div></section>
  <section class="quantity-grid"><label>Gruppering<select id="qGroup"><option>IFC-type</option><option>Modell</option><option>IFC-type og modell</option></select></label><label>Mengdefelt<select id="qField"><option>Alle basisfelt</option><option>Antall</option><option>Lengde</option><option>Areal</option><option>Volum</option></select></label><label>Visning<select><option>Detaljert tabell</option><option>Summerte typer</option></select></label></section>
  <section class="quantity-card"><div class="quantity-card-head"><div><h3>Mengder per IFC-type</h3><p>Datakontrakt for preview.4: modell, IFC-type, antall, lengde, areal og volum.</p></div><span>${rows.length} rader</span></div><div class="quantity-table-wrap"><table><thead><tr><th>Modell</th><th>IFC-type</th><th>Antall</th><th>Lengde (m)</th><th>Areal (m²)</th><th>Volum (m³)</th></tr></thead><tbody>${rows.map(r=>`<tr>${td(r.model)}${td(r.type)}${td(r.count)}${td(r.length)}${td(r.area)}${td(r.volume)}</tr>`).join('')}</tbody></table></div></section>
  <div class="quantity-actions"><button disabled>Eksporter Excel</button><button disabled>Lagre oppsett</button><span>Eksport og reelle IFC-mengder kommer etter godkjent prøveflyt.</span></div>
 </div>`;host.querySelector('[data-action="refresh"]')?.addEventListener('click',()=>{notice=`Oppdatert ${new Date().toLocaleTimeString('nb-NO')} fra ${models.length} valgte IFC-modell${models.length===1?'':'er'}.`;render()});}
 return Object.freeze({id:'quantity-summary',mount(hostElement){if(destroyed)throw Error('Mengdesammenstilling er lukket permanent.');host=hostElement;active=true;render()},render,update(){render()},canLeave(){return true},unmount(){active=false;if(host)host.replaceChildren();host=null;return true},activate(){active=true;render()},deactivate(){active=false},destroy(){destroyed=true;active=false;if(host)host.replaceChildren();host=null},snapshot(){return Object.freeze({active,destroyed,selectedModels:selectedIfcRows(context).length,stage:'preview.4-fix.2'})}})
}
