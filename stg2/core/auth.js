'use strict';
function doclibExtractToken(value){
 let candidate=typeof value==='string'?value:value&&typeof value==='object'?(value.accessToken||value.token):null;
 if(typeof candidate!=='string')return null;
 candidate=candidate.trim().replace(/^Bearer\s+/i,'');
 if(!candidate||/\s/.test(candidate)||['undefined','null','true','false','pending','denied','granted'].includes(candidate.toLowerCase()))return null;
 return candidate;
}
let doclibAuthFlight=null;
async function auth(){
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
