export const TYPES=Object.freeze([
 {value:'string',label:'Tekst'},
 {value:'number',label:'Tall'},
 {value:'integer',label:'Heltall'},
 {value:'boolean',label:'Ja/nei'},
 {value:'date-no',label:'Dato (dd.MM.yyyy)'},
 {value:'date-iso',label:'Dato (yyyy-MM-dd)'}
]);
export function emptyDraft(){return {pset:'',id:'',required:true,allowedExtraProperties:true,properties:[emptyProperty()]};}
export function emptyProperty(){return {key:crypto.randomUUID(),name:'',requirement:'required',type:'string',allowedText:'',format:'',target:'',pairsText:''};}
export function idFromPset(value){const id=String(value||'').trim().replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');return (id||'rule').slice(0,200);}
function tokenList(text){return [...new Set(String(text||'').split(/[;\n\r]+/).map(x=>x.trim()).filter(Boolean))];}
export function parseValue(text,type){const value=String(text).trim();
 if(type==='number'){const n=Number(value.replace(',','.'));if(!Number.isFinite(n))throw Error('Forventet tall: '+value);return n;}
 if(type==='integer'){if(!/^-?\d+$/.test(value))throw Error('Forventet heltall: '+value);return Number(value);}
 if(type==='boolean'){const n=value.toLowerCase();if(['true','ja','1'].includes(n))return true;if(['false','nei','0'].includes(n))return false;throw Error('Ja/nei-verdi må være true/false, ja/nei eller 1/0.');}
 return value;
}
export function normalizedType(type){return type.startsWith('date-')?'string':type;}
export function valuesFromText(text,type){return tokenList(text).map(x=>parseValue(x,type));}
export function pairsFromText(text,source,target){const rows=String(text||'').split(/[\n\r;]+/).map(x=>x.trim()).filter(Boolean);return rows.map((row,index)=>{
 const at=row.indexOf('=>');if(at<1||at>=row.length-2)throw Error(`Avhengighet linje ${index+1} må skrives kilde => mål.`);
 return [parseValue(row.slice(0,at),source.type),parseValue(row.slice(at+2),target.type)];
});}
export function buildRule(draft){const pset=String(draft.pset||'').trim(),id=String(draft.id||'').trim()||idFromPset(pset);if(!pset)throw Error('Navn på egenskapssett mangler.');
 const props={},byName=new Map();for(const p of draft.properties){const name=String(p.name||'').trim();if(!name)throw Error('Alle egenskaper må ha navn.');if(byName.has(name))throw Error('Duplisert egenskapsnavn: '+name);byName.set(name,p);}
 for(const [name,p] of byName){const out={requirement:p.requirement,type:normalizedType(p.type)};const allowed=valuesFromText(p.allowedText,p.type);if(allowed.length)out.allowedValues=allowed;
  const format=String(p.format||'').trim();if(format){if(out.type!=='string')throw Error(name+': regex kan bare brukes for tekst/dato.');out.format=format;}
  if(p.type==='date-no')out.dateFormat='dd.MM.yyyy';if(p.type==='date-iso')out.dateFormat='yyyy-MM-dd';
  if(p.target){const target=byName.get(p.target);if(!target||p.target===name)throw Error(name+': velg en annen definert målegenskap.');const pairs=pairsFromText(p.pairsText,p,target);if(!pairs.length)throw Error(name+': legg inn minst én tillatt kombinasjon.');out.crossReference={target:p.target,validPairs:pairs.map(([a,b])=>({[name]:a,[p.target]:b}))};}
  props[name]=out;
 }
 return {schema:'DocLibPropertyRules',schemaVersion:2,id,pset,scope:{mode:'allEntities'},required:!!draft.required,allowedExtraProperties:!!draft.allowedExtraProperties,properties:props};
}
export function fileNameFor(rule){return String(rule.pset).replace(/[^A-Za-z0-9_.-]+/g,'_').replace(/^\.+/,'')+'.json';}
