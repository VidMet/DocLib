const text=value=>String(value??'').trim();
const fold=value=>text(value).toLowerCase().replace(/[ _-]+/g,' ');
const ADMIN_NAMES=new Set(['admin','administrator','project admin','project administrator','prosjektadministrator']);
const list=value=>Array.isArray(value)?value:value==null?[]:[value];
function roleTokens(member,roles){
 const byId=new Map(list(roles).map(role=>[text(role.id??role.roleId),role]));
 const values=[member?.role,member?.roleName,member?.projectRole,member?.projectRoleName,member?.roleId,...list(member?.roles),...list(member?.roleIds)];
 const tokens=[];
 for(const value of values){
  if(value&&typeof value==='object'){tokens.push(value.name,value.title,value.code,value.id);continue;}
  tokens.push(value);const mapped=byId.get(text(value));if(mapped)tokens.push(mapped.name,mapped.title,mapped.code);
 }
 return [...new Set(tokens.map(text).filter(Boolean))];
}
export function evaluateProjectAccess(payload={}){
 const projectId=text(payload.projectId),userId=text(payload.userId),status=Number(payload.status||0),rolesStatus=Number(payload.rolesStatus||0);
 if(!projectId||!userId)return Object.freeze({state:'unknown',isAdmin:false,reason:'missing-context',projectId,userId,roles:[]});
 if(status!==200)return Object.freeze({state:'unknown',isAdmin:false,reason:`member-http-${status||'error'}`,projectId,userId,roles:[]});
 const roles=roleTokens(payload.member,payload.roles);
 const isAdmin=roles.some(role=>ADMIN_NAMES.has(fold(role)));
 return Object.freeze({state:isAdmin?'administrator':'user',isAdmin,reason:isAdmin?'explicit-admin-role':'no-explicit-admin-role',projectId,userId,roles,rolesStatus});
}
export function createProjectAccessController(){
 let current=Object.freeze({state:'loading',isAdmin:false,reason:'not-resolved',projectId:'',userId:'',roles:[]});const listeners=new Set();
 const publish=value=>{current=Object.freeze({...value,roles:[...(value.roles||[])]});listeners.forEach(fn=>{try{fn(current)}catch{}});return current;};
 return Object.freeze({snapshot:()=>current,subscribe(fn){listeners.add(fn);fn(current);return()=>listeners.delete(fn);},resolve:async loader=>{try{return publish(evaluateProjectAccess(await loader()));}catch(error){return publish({state:'unknown',isAdmin:false,reason:'lookup-failed',projectId:'',userId:'',roles:[],message:error.message});}}});
}
