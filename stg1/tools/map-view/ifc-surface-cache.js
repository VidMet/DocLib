const DB_NAME='doclib-ifc-surface-cache';
const DB_VERSION=2;
const STORE_NAME='surfaces';
const OBJECT_STORE_NAME='object-layers';
export const WEAR_SURFACE_PROCESSOR_VERSION='wear-reader-v1';
export const IFC_OBJECT_LAYER_PROCESSOR_VERSION='ifc-object-reader-v6';

let databasePromise=null;

function ownerKey(projectId,fileId){
 return JSON.stringify([String(projectId),String(fileId)]);
}

export function wearSurfaceCacheKey(projectId,file){
 if(!projectId||!file?.id||!file?.versionId)return null;
 return JSON.stringify([String(projectId),String(file.id),String(file.versionId),WEAR_SURFACE_PROCESSOR_VERSION]);
}

function openDatabase(){
 if(!('indexedDB'in window))return Promise.reject(Error('Nettleseren støtter ikke lokal IFC-cache.'));
 if(databasePromise)return databasePromise;
 databasePromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
   const database=request.result;
   if(!database.objectStoreNames.contains(STORE_NAME)){
    const store=database.createObjectStore(STORE_NAME,{keyPath:'key'});
    store.createIndex('owner','owner',{unique:false});
   }
   if(!database.objectStoreNames.contains(OBJECT_STORE_NAME)){
    const store=database.createObjectStore(OBJECT_STORE_NAME,{keyPath:'key'});
    store.createIndex('owner','owner',{unique:false});
   }
  };
  request.onsuccess=()=>{
   const database=request.result;
   database.onversionchange=()=>database.close();
   resolve(database);
  };
  request.onerror=()=>reject(request.error||Error('Kunne ikke åpne lokal IFC-cache.'));
  request.onblocked=()=>reject(Error('Lokal IFC-cache er blokkert av en annen fane.'));
 });
 databasePromise.catch(()=>{databasePromise=null;});
 return databasePromise;
}

export function ifcObjectLayerCacheKey(projectId,file,configKey){
 if(!projectId||!file?.id||!file?.versionId)return null;
 return JSON.stringify([String(projectId),String(file.id),String(file.versionId),IFC_OBJECT_LAYER_PROCESSOR_VERSION,String(configKey)]);
}

function expandObjectRecord(record){
 if(!record||!Number.isInteger(record.triangleCount)||record.triangleCount<1)return null;
 const coordinates=record.coordinates instanceof Float64Array?record.coordinates:new Float64Array(record.coordinates||[]);
 if(coordinates.length!==record.triangleCount*9)return null;
 const triangles=new Array(record.triangleCount);let offset=0;
 for(let index=0;index<triangles.length;index++)triangles[index]=[[coordinates[offset++],coordinates[offset++],coordinates[offset++]],[coordinates[offset++],coordinates[offset++],coordinates[offset++]],[coordinates[offset++],coordinates[offset++],coordinates[offset++]]];
 const colors=Array.isArray(record.colors)?record.colors:[];
 const triangleObjectIds=Array.isArray(record.triangleObjectIds)?record.triangleObjectIds:[];
 const objects=Array.isArray(record.objects)?record.objects:[];
 if(colors.length!==record.triangleCount||triangleObjectIds.length!==record.triangleCount)return null;
 return{triangles,colors,triangleObjectIds,objects,labels:Array.isArray(record.labels)?record.labels:[],candidateCount:Number(record.candidateCount)||0,truncated:Boolean(record.truncated),colorDiagnostics:record.colorDiagnostics||null};
}

export async function readIfcObjectLayerCache(key){
 if(!key)return null;
 const database=await openDatabase();
 return new Promise((resolve,reject)=>{
  const transaction=database.transaction(OBJECT_STORE_NAME,'readonly'),request=transaction.objectStore(OBJECT_STORE_NAME).get(key);
  request.onsuccess=()=>resolve(expandObjectRecord(request.result));
  request.onerror=()=>reject(request.error||Error('Kunne ikke lese IFC-objektslag fra lokal cache.'));
 });
}

export async function writeIfcObjectLayerCache(projectId,file,key,model){
 if(!key||!projectId||!file?.id||!file?.versionId||!model?.triangles?.length||model.colors?.length!==model.triangles.length)return false;
 const database=await openDatabase(),coordinates=new Float64Array(model.triangles.length*9);let offset=0;
 for(const triangle of model.triangles)for(const point of triangle)for(const coordinate of point)coordinates[offset++]=coordinate;
 const record={key,owner:ownerKey(projectId,file.id),projectId:String(projectId),fileId:String(file.id),versionId:String(file.versionId),processorVersion:IFC_OBJECT_LAYER_PROCESSOR_VERSION,triangleCount:model.triangles.length,coordinates,colors:model.colors,triangleObjectIds:Array.from(model.triangleObjectIds||[]),objects:Array.isArray(model.objects)?model.objects:[],labels:Array.isArray(model.labels)?model.labels:[],candidateCount:Number(model.candidateCount)||0,truncated:Boolean(model.truncated),colorDiagnostics:model.colorDiagnostics||null,savedAt:Date.now()};
 return new Promise((resolve,reject)=>{
  const transaction=database.transaction(OBJECT_STORE_NAME,'readwrite'),store=transaction.objectStore(OBJECT_STORE_NAME),cursor=store.index('owner').openCursor(IDBKeyRange.only(record.owner));
  cursor.onsuccess=()=>{const item=cursor.result;if(item){if(item.value.key!==key)item.delete();item.continue();}else store.put(record);};
  cursor.onerror=()=>transaction.abort();
  transaction.oncomplete=()=>resolve(true);
  transaction.onerror=()=>reject(transaction.error||Error('Kunne ikke lagre IFC-objektslag lokalt.'));
  transaction.onabort=()=>reject(transaction.error||Error('Lagring av IFC-objektslag ble avbrutt.'));
 });
}

function expandRecord(record){
 if(!record||!Number.isInteger(record.triangleCount)||record.triangleCount<1)return null;
 const coordinates=record.coordinates instanceof Float64Array?record.coordinates:new Float64Array(record.coordinates||[]);
 if(coordinates.length!==record.triangleCount*9)return null;
 const triangles=new Array(record.triangleCount);
 let offset=0;
 for(let index=0;index<triangles.length;index++){
  triangles[index]=[
   [coordinates[offset++],coordinates[offset++],coordinates[offset++]],
   [coordinates[offset++],coordinates[offset++],coordinates[offset++]],
   [coordinates[offset++],coordinates[offset++],coordinates[offset++]],
  ];
 }
 return{
  triangles,
  labels:Array.isArray(record.labels)?record.labels:[],
  candidateCount:Number(record.candidateCount)||0,
  truncated:Boolean(record.truncated),
 };
}

export async function readWearSurfaceCache(key){
 if(!key)return null;
 const database=await openDatabase();
 return new Promise((resolve,reject)=>{
  const transaction=database.transaction(STORE_NAME,'readonly');
  const request=transaction.objectStore(STORE_NAME).get(key);
  request.onsuccess=()=>resolve(expandRecord(request.result));
  request.onerror=()=>reject(request.error||Error('Kunne ikke lese IFC fra lokal cache.'));
 });
}

export async function writeWearSurfaceCache(projectId,file,key,model){
 if(!key||!projectId||!file?.id||!file?.versionId||!model?.triangles?.length)return false;
 const database=await openDatabase();
 const coordinates=new Float64Array(model.triangles.length*9);
 let offset=0;
 for(const triangle of model.triangles)for(const point of triangle)for(const coordinate of point)coordinates[offset++]=coordinate;
 const record={
  key,
  owner:ownerKey(projectId,file.id),
  projectId:String(projectId),
  fileId:String(file.id),
  versionId:String(file.versionId),
  processorVersion:WEAR_SURFACE_PROCESSOR_VERSION,
  triangleCount:model.triangles.length,
  coordinates,
  labels:Array.isArray(model.labels)?model.labels:[],
  candidateCount:Number(model.candidateCount)||0,
  truncated:Boolean(model.truncated),
  savedAt:Date.now(),
 };
 return new Promise((resolve,reject)=>{
  const transaction=database.transaction(STORE_NAME,'readwrite');
  const store=transaction.objectStore(STORE_NAME);
  const cursor=store.index('owner').openCursor(IDBKeyRange.only(record.owner));
  cursor.onsuccess=()=>{
   const item=cursor.result;
   if(item){
    if(item.value.key!==key)item.delete();
    item.continue();
   }else store.put(record);
  };
  cursor.onerror=()=>transaction.abort();
  transaction.oncomplete=()=>resolve(true);
  transaction.onerror=()=>reject(transaction.error||Error('Kunne ikke lagre IFC i lokal cache.'));
  transaction.onabort=()=>reject(transaction.error||Error('Lagring i lokal IFC-cache ble avbrutt.'));
 });
}
