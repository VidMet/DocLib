'use strict';
function log(a,d){const s=`[${new Date().toISOString()}] ${a}${d===undefined?'':'\n'+JSON.stringify(d,null,2)}`;lines.push(s);if(lines.length>1000)lines=lines.slice(-1000);$('log').textContent=lines.join('\n\n');console.log('[DOCLIB]',a,d??'')}
// Redact legacy diagnostics too, including any access-token permission events.
const doclibLogOriginal=log;
function doclibRedact(value,depth=0){
 if(depth>12)return '[utelatt]';
 if(typeof value==='string')return value.replace(/Bearer\s+\S+/gi,'Bearer [skjult]').replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token skjult]');
 if(Array.isArray(value))return value.map(x=>doclibRedact(x,depth+1));
 if(value&&typeof value==='object'){const out={};for(const [key,v] of Object.entries(value))out[key]=/token|authorization|secret/i.test(key)?'[skjult]':doclibRedact(v,depth+1);return out}
 return value;
}
log=function(label,data){if(/token|permission/i.test(String(label)+' '+String(data?.event||''))&&!['AUTH_RESULT'].includes(label))return doclibLogOriginal('AUTH_EVENT',{details:'skjult'});return doclibLogOriginal(label,doclibRedact(data))};
