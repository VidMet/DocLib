'use strict';
// Loaded after app.js, before the window load event. No tokens are logged.
function doclibExtractToken(value){
 let candidate=typeof value==='string'?value:value&&typeof value==='object'?(value.accessToken||value.token):null;
 if(typeof candidate!=='string')return null;
 candidate=candidate.trim().replace(/^Bearer\s+/i,'');
 if(!candidate||/\s/.test(candidate)||['undefined','null','true','false','pending','denied','granted'].includes(candidate.toLowerCase()))return null;
 return candidate;
}
let doclibAuthFlight=null;
auth=async function(){
 if(doclibAuthFlight)return doclibAuthFlight;
 doclibAuthFlight=(async()=>{
  for(const method of ['requestPermission','getPermission']){
   try{const fn=API?.extension?.[method];if(typeof fn!=='function')continue;
    const value=await fn.call(API.extension,'accesstoken'),result=doclibExtractToken(value);
    log('AUTH_RESULT',{method,returnType:value===null?'null':typeof value,extracted:!!result});
    if(result)return result;
   }catch{log('AUTH_RESULT',{method,result:'permission_call_failed'})}
  }
  throw Error('Ingen gyldig tilgangstoken mottatt. Åpne testutvidelsen på nytt og kontroller tilgangstillatelsen.');
 })();
 try{return await doclibAuthFlight}finally{doclibAuthFlight=null}
};
req=async function(url){
 const target=new URL(url);const allowed=[new URL(CORE).origin,new URL(MODEL).origin];
 if(target.protocol!=='https:'||!allowed.includes(target.origin))throw Error('Autentisert kall til ukjent API-adresse er sperret.');
 const started=performance.now();let used=doclibExtractToken(token);if(!used){used=await auth();token=used}
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+used,Accept:'application/json'}})}
  catch{log('FETCH ERROR',{url:target.origin+target.pathname,reason:'network_failure'});return{ok:false,status:0,data:null}}
  log('HTTP',{status:response.status,attempt:attempt+1,ms:Math.round(performance.now()-started),url:target.origin+target.pathname});
  if(response.status===401&&attempt===0){
   try{await response.body?.cancel()}catch{}
   // Reuse a token refreshed by a concurrent request, otherwise request one.
   const latest=doclibExtractToken(token);used=latest&&latest!==used?latest:await auth();token=used;continue;
  }
  if(response.status===401)throw Error('API-lesing avvist: HTTP 401 etter nytt tokenforsøk. Kontroller testutvidelsens tilgang.');
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok&&target.pathname===new URL(CORE).pathname+'/projects/'+encodeURIComponent(project.id))throw Error('Prosjektlesing avvist: HTTP '+response.status);
  return{ok:response.ok,status:response.status,data};
 }
};
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
