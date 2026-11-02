import {normalizeColumns,normalizeDefinitions} from '../explorer/columns.js?v=2.04-preview.5';
export function mountColumnEditor(box,config,fallback,doc=document){
 const clone=x=>JSON.parse(JSON.stringify(x));
 let columns=clone(normalizeDefinitions(config.explorer?.definitions)??normalizeDefinitions(fallback)??[]);
 let flags=normalizeColumns(config.explorer?.columns);
 if(!config.explorer?.definitions)columns.forEach(c=>{if(typeof flags[c.id]==='boolean')c.visible=flags[c.id];});
 const initial=clone(columns);
 const el=(tag,text)=>{const x=doc.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const render=()=>{
 box.replaceChildren();
 const fixed=el('div');fixed.className='setup-fixed-columns';
 for(const [id,title] of [['name','Filnavn (alltid synlig)'],['format','Format']]){const label=el('label'),check=el('input');check.type='checkbox';check.checked=flags[id]!==false;check.disabled=id==='name';check.onchange=()=>{flags[id]=check.checked;};label.append(check,doc.createTextNode(' '+title));fixed.append(label);}box.append(fixed);
 const catalog=[...(window.DocLibLegacyBridge?.getColumnPropertyCatalog?.()||[]),...columns.filter(c=>c.pset&&c.property)];
 const groups=new Map();for(const x of catalog){if(!x.pset||!x.property)continue;if(!groups.has(x.pset))groups.set(x.pset,new Set());groups.get(x.pset).add(x.property);}
 columns.forEach((c,i)=>{
 const row=el('div');row.className='setting-row setup-column-row';
 const title=el('input');title.value=c.title;title.setAttribute('aria-label','Kolonnenavn');title.oninput=()=>{c.title=title.value;};
 const select=el('select');select.setAttribute('aria-label','IFC Property Set/egenskap');const auto=el('option','Auto/alias');auto.value='';select.append(auto);
 for(const ps of [...groups.keys()].sort((a,b)=>a.localeCompare(b,'no'))){const group=el('optgroup');group.label=ps;for(const pr of [...groups.get(ps)].sort((a,b)=>a.localeCompare(b,'no'))){const option=el('option',pr);option.value=ps+'::'+pr;group.append(option);}select.append(group);}
 select.value=c.pset&&c.property?c.pset+'::'+c.property:'';
 select.onchange=()=>{if(select.value){const [ps,...pr]=select.value.split('::');c.pset=ps;c.property=pr.join('::');delete c.aliases;}else{delete c.pset;delete c.property;c.aliases=[c.title||c.id];}};
 row.append(title,select);
 for(const [key,text] of [['visible','Vis'],['colorize','Fargelegg']]){const label=el('label'),check=el('input');check.type='checkbox';check.checked=key==='visible'?c[key]!==false:c[key]===true;check.onchange=()=>{c[key]=check.checked;};label.append(check,doc.createTextNode(' '+text));row.append(label);}
 const up=button('↑',()=>{[columns[i-1],columns[i]]=[columns[i],columns[i-1]];render();});up.disabled=i===0;up.title='Flytt opp';
 const down=button('↓',()=>{[columns[i+1],columns[i]]=[columns[i],columns[i+1]];render();});down.disabled=i===columns.length-1;down.title='Flytt ned';
 row.append(up,down,button('×',()=>{columns.splice(i,1);render();}));box.append(row);
 });
 const actions=el('div');actions.className='setup-column-actions';actions.append(button('+ Legg til kolonne',()=>{columns.push({id:'custom_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)),title:'Ny kolonne',aliases:['Ny kolonne'],visible:true,colorize:false});render();}),button('Tilbakestill endringer',()=>{columns=clone(initial);flags=normalizeColumns(config.explorer?.columns);render();}));box.append(actions);
 };
 render();return {snapshot(){const definitions=normalizeDefinitions(columns);const visibility={...flags,...Object.fromEntries(definitions.map(c=>[c.id,c.visible]))};return {columns:normalizeColumns(visibility),definitions};}};
}
