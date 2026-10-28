'use strict';
const testNativeFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(['GET','HEAD'].includes(method))return testNativeFetch(input,options);
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
 const coreOrigin=new URL(CORE).origin;
 const allowed=url.protocol==='https:'&&url.origin===coreOrigin&&headers.get('X-DocLib-Write')==='rule-json';
 if(!allowed)return Promise.reject(Error('TEST: nettverksskriving er sperret utenfor godkjent regelpublisering.'));
 headers.delete('X-DocLib-Write');
 return testNativeFetch(input instanceof Request?new Request(input,{...options,headers}):input,{...options,headers});
};
