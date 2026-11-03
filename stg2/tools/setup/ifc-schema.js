export const IFC_SCHEMAS=Object.freeze(['IFC2X3','IFC4','IFC4X3']);
export function normalizeIfcRequirement(raw){return {enabled:raw?.enabled===true,allowedSchemas:Array.isArray(raw?.allowedSchemas)?IFC_SCHEMAS.filter(id=>raw.allowedSchemas.includes(id)):[...IFC_SCHEMAS]};}
export function mountIfcEditor(host,raw,doc=document){
 const cfg=normalizeIfcRequirement(raw);host.replaceChildren();const legend=doc.createElement('legend');legend.textContent='Tillatte IFC-schema i prosjektet';host.append(legend);
 const label=doc.createElement('label'),enabled=doc.createElement('input');enabled.type='checkbox';enabled.checked=cfg.enabled;label.append(enabled,doc.createTextNode(' Aktiver prosjektkrav til IFC-schema'));host.append(label);
 const choices=IFC_SCHEMAS.map((id,i)=>{const label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.checked=cfg.allowedSchemas.includes(id);label.append(input,doc.createTextNode(' '+['IFC 2x3','IFC 4','IFC 4.3'][i]));host.append(label);return {id,input};});
 const note=doc.createElement('small');note.textContent='Prosjektkravet lagres felles. Automatisk kontroll av modellens schema er ikke koblet til i denne previewen. Avsl\u00e5tt krav betyr ingen schema-begrensning.';host.append(note);
 const sync=()=>choices.forEach(({input})=>input.disabled=!enabled.checked);enabled.onchange=sync;sync();
 return {get(){const allowedSchemas=choices.filter(c=>c.input.checked).map(c=>c.id);if(enabled.checked&&!allowedSchemas.length)throw new Error('Velg minst ett tillatt IFC-schema, eller sl\u00e5 av prosjektkravet.');return {enabled:enabled.checked,allowedSchemas};}};
}
