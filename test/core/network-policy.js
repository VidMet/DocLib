'use strict';
const testNativeFetch=window.fetch.bind(window);
const doclibSignedWrites=new Map();
window.DocLibApproveSignedUpload=url=>{
 const target=new URL(String(url),location.href);
 if(target.protocol!=='https:')throw Error('Kun HTTPS-adresser kan godkjennes for opplasting.');
 doclibSignedWrites.set(target.href,Date.now()+5*60*1000);
 return target.href;
};
window.fetch=(input,options={})=>{
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(['GET','HEAD'].includes(method))return testNativeFetch(input,options);
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
 const coreOrigin=new URL(CORE).origin;
 const coreWrite=url.protocol==='https:'&&url.origin===coreOrigin&&headers.get('X-DocLib-Write')==='rule-json';
 const expiry=doclibSignedWrites.get(url.href)||0;
 const signedPut=method==='PUT'&&url.protocol==='https:'&&expiry>Date.now();
 if(!coreWrite&&!signedPut)return Promise.reject(Error('TEST: nettverksskriving er sperret utenfor godkjent regelpublisering.'));
 if(coreWrite)headers.delete('X-DocLib-Write');
 if(signedPut)doclibSignedWrites.delete(url.href);
 return testNativeFetch(input instanceof Request?new Request(input,{...options,headers}):input,{...options,headers});
};
