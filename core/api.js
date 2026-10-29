'use strict';
async function req(url,options={}){
 const target=new URL(url);const allowed=[new URL(CORE).origin,new URL(MODEL).origin];
 if(target.protocol!=='https:'||!allowed.includes(target.origin))throw Error('Autentisert kall til ukjent API-adresse er sperret.');
 const started=performance.now();let used=doclibExtractToken(token);if(!used){used=await auth();token=used}
 for(let attempt=0;attempt<2;attempt++){
  let response;
  try{response=await fetch(url,{method:'GET',signal:options.signal,headers:{Authorization:'Bearer '+used,Accept:'application/json'}})}
  catch(error){if(error?.name==='AbortError')throw error;log('FETCH ERROR',{url:target.origin+target.pathname,reason:'network_failure'});return{ok:false,status:0,data:null}}
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


async function reqWrite(url,options={}){
 const target=new URL(url);const allowed=[new URL(CORE).origin];
 if(target.protocol!=='https:'||!allowed.includes(target.origin))throw Error('Skrivekall til ukjent API-adresse er sperret.');
 let used=doclibExtractToken(token);if(!used){used=await auth();token=used}
 for(let attempt=0;attempt<2;attempt++){
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+used);
  if(!headers.has('Accept'))headers.set('Accept','application/json');
  let response;
  try{response=await fetch(url,{...options,method:String(options.method||'POST').toUpperCase(),headers})}
  catch(error){if(error?.name==='AbortError')throw error;throw Error('Nettverksskriving feilet: '+error.message)}
  if(response.status===401&&attempt===0){try{await response.body?.cancel()}catch{}used=await auth();token=used;continue}
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
  return{ok:response.ok,status:response.status,data,headers:response.headers};
 }
}
