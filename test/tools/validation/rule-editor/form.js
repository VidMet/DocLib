import {TYPES,emptyProperty} from './model.js?v=2.02-preview.1';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function propertyCard(property,index,all){return `<fieldset class="re-property" data-key="${esc(property.key)}"><legend>Egenskap ${index+1}</legend>
 <div class="re-actions"><button type="button" class="btn" data-remove-property>Fjern</button></div>
 <div class="re-grid"><label>Navn<input data-field="name" maxlength="200" value="${esc(property.name)}" placeholder="f.eks. MMI"></label>
 <label>Krav<select data-field="requirement"><option value="required" ${property.requirement==='required'?'selected':''}>Påkrevd</option><option value="optional" ${property.requirement==='optional'?'selected':''}>Valgfri</option></select></label>
 <label>Format/type<select data-field="type">${TYPES.map(t=>`<option value="${t.value}" ${property.type===t.value?'selected':''}>${t.label}</option>`).join('')}</select></label></div>
 <label>Tillatte verdier<textarea data-field="allowedText" rows="2" placeholder="Én per linje eller adskilt med semikolon">${esc(property.allowedText)}</textarea></label>
 <label>Regex-format<input data-field="format" maxlength="512" value="${esc(property.format)}" placeholder="f.eks. ^[A-Z]{2}-[0-9]{3}$"></label>
 <details class="re-dependency" ${property.target?'open':''}><summary>Avhengighet / tillatte kombinasjoner</summary>
 <p>Velg en målegenskap og list alle gyldige kombinasjoner som <code>kildeverdi =&gt; målverdi</code>, én per linje. Dette er en liste over tillatte par, ikke en wildcard-regel.</p>
 <label>Målegenskap<select data-field="target"><option value="">Ingen</option>${all.filter(x=>x.key!==property.key&&x.name.trim()).map(x=>`<option value="${esc(x.name.trim())}" ${property.target===x.name.trim()?'selected':''}>${esc(x.name.trim())}</option>`).join('')}</select></label>
 <label>Tillatte kombinasjoner<textarea data-field="pairsText" rows="3" placeholder="a => b">${esc(property.pairsText)}</textarea></label></details></fieldset>`;}
export function renderProperties(host,draft){host.innerHTML=draft.properties.map((p,i)=>propertyCard(p,i,draft.properties)).join('');}
export function addProperty(draft){draft.properties.push(emptyProperty());}
