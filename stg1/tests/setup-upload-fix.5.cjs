const fs=require('fs'),vm=require('vm'),assert=require('assert');
const base=require('path').resolve(__dirname,'..')+'/';
const model=fs.readFileSync(base+'tools/setup/project-tools.js','utf8').replace(/export /g,'');
const repo=fs.readFileSync(base+'tools/setup/repository.js','utf8').replace(/^import .*\n/,'').replace(/export /g,'');
const results=[];
async function run(name,opts={}){
 let writes=0,puts=0,polls=0,done=false,approved=0;
 const desired={schema:'DocLibProjectTools',schemaVersion:1,tools:{validation:{enabled:true}}};
 const response=(data,status=200)=>({ok:status>=200&&status<300,status,data});
 const context={CORE:'https://api.example.test/tc/api/2.0',projectId:'project-secret',apiRead:async(url)=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/projects/project-secret'))return response({rootId:'root'});
  if(u.pathname.endsWith('/folders/root/items'))return response([{id:'ext',name:'Extension_config',type:'FOLDER'}]);
  if(u.pathname.endsWith('/folders/ext/items'))return response([{id:'folder-secret',name:'DocLib',type:'FOLDER'}]);
  if(u.pathname.endsWith('/folders/folder-secret/items'))return response((done||opts.exists)?[{id:'file',name:'doclib.tools.json',type:'FILE'}]:[]);
  if(u.pathname.endsWith('/downloadurl'))return response({url:'https://storage.example.test/download'});
  if(u.pathname.endsWith('/files/fs/upload')){
   assert.equal(u.searchParams.get('uploadId'),'upload-secret');polls++;
   if(opts.pollHttp)return response({},403);
   const status=opts.state||(polls===1?'UPLOADABLE':'DONE');if(status==='DONE')done=true;
   return response({status});
  }
  throw Error('Unexpected read '+url);
 },apiWrite:async(url,options)=>{
  writes++;const u=new URL(url);assert.equal(u.pathname,'/tc/api/2.0/files/fs/upload');
  assert.deepEqual([...u.searchParams.keys()].sort(),['parentId','parentType']);assert.equal(u.searchParams.get('parentType'),'FOLDER');
  assert.deepEqual(JSON.parse(options.body),{name:'doclib.tools.json'});
  if(opts.startError)return response({title:'Bad Request',detail:'Failed project-secret folder-secret https://secret.test/?Signature=SECRET'},400);
  return response({uploadId:'upload-secret',contents:opts.missing?[]:[{format:'THUMBNAIL',url:'https://wrong.test/'},{url:opts.badUrl?'http://bad.test/':'https://storage.example.test/upload?Signature=synthetic',multipart:!!opts.multipart}]},202);
 }};
 const sandbox={URL,URLSearchParams,TextEncoder,AbortSignal,setTimeout:fn=>{fn();},window:{DocLibApproveSignedUpload:(url,uses)=>{assert.equal(uses,1);approved++;}},fetch:async(url,options={})=>{
  if(options.method==='PUT'){
   puts++;assert.equal(url,'https://storage.example.test/upload?Signature=synthetic');assert.equal(options.headers,undefined);assert.equal(options.credentials,'omit');assert(options.body instanceof Uint8Array);assert.equal(new Request(url,options).headers.has('Content-Type'),false);
   if(opts.network)throw Error('network');return {ok:!opts.putError,status:opts.putError?403:200};
  }
  return {ok:true,json:async()=>opts.mismatch?{schema:'DocLibProjectTools',schemaVersion:1,tools:{}}:desired};
 }};
 vm.createContext(sandbox);vm.runInContext(model+'\n'+repo+'\nglobalThis.make=createProjectToolsRepository;',sandbox);
 let error;try{await sandbox.make(context).save(desired);}catch(e){error=e;}
 if(opts.fail){assert(error,name+' should fail');if(opts.startError){const d=JSON.stringify(error.setupDiagnostics);assert(d.includes('Failed'));assert(!d.includes('project-secret'));assert(!d.includes('folder-secret'));assert(!d.includes('Signature'));}}
 else {assert(!error,error?.stack);assert.equal(writes,1);assert.equal(puts,1);assert.equal(polls,2);assert(done);}
 if(opts.exists)assert.equal(writes,0);
 if(opts.startError||opts.missing||opts.multipart||opts.badUrl)assert.equal(puts,0);
 assert(puts<=1);results.push({name,passed:true,writes,puts,polls});
}
(async()=>{
 await run('Source-only contract and readback');
 for(const [name,opts] of Object.entries({existing:{exists:true},start400:{startError:true},missingSource:{missing:true},multipart:{multipart:true},insecureURL:{badUrl:true},put403:{putError:true},networkFailure:{network:true},uploadError:{state:'ERROR'},expired:{state:'EXPIRED'},poll403:{pollHttp:true},timeout:{state:'UPLOADABLE'},readbackMismatch:{mismatch:true}}))await run(name,{...opts,fail:true});
 fs.writeFileSync(base+'TEST_RESULTS-fix.5.json',JSON.stringify({version:'2.04-preview.2-fix.5',type:'Local mocked contract tests, not live API',results},null,2));
 console.log(results.length+' local mocked contract tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
