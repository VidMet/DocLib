'use strict';
const testNativeFetch=window.fetch.bind(window);
const doclibSignedWrites=new Map();
window.DocLibApproveSignedUpload=(url,uses=2)=>{
 const target=new URL(String(url),location.href);
 if(target.protocol!=='https:')throw Error('Kun HTTPS-adresser kan godkjennes for opplasting.');
 doclibSignedWrites.set(target.href,{expires:Date.now()+5*60*1000,uses:Math.max(1,Number(uses)||1)});
 return target.href;
};
window.fetch=(input,options={})=>{
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(['GET','HEAD'].includes(method))return testNativeFetch(input,options);
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));
 const coreOrigin=new URL(CORE).origin;
 const coreWrite=url.protocol==='https:'&&url.origin===coreOrigin&&headers.get('X-DocLib-Write')==='rule-json';
 const permit=doclibSignedWrites.get(url.href);
 const signedPut=method==='PUT'&&url.protocol==='https:'&&permit&&permit.expires>Date.now()&&permit.uses>0;
 if(!coreWrite&&!signedPut)return Promise.reject(Error('TEST: nettverksskriving er sperret utenfor godkjent regelpublisering.'));
 if(coreWrite)headers.delete('X-DocLib-Write');
 if(signedPut){permit.uses-=1;if(permit.uses<=0)doclibSignedWrites.delete(url.href);}
 return testNativeFetch(input instanceof Request?new Request(input,{...options,headers}):input,{...options,headers});
};
