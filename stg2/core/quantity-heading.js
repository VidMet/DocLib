// Scoped correction for the legacy heading while Quantity Summary is mounted.
export function installQuantityHeading(doc=document,Observer=MutationObserver){
 const title=doc.getElementById('currentFolder'),host=doc.getElementById('workspacePlaceholder');
 if(!title||!host)return ()=>{};
 let owned=false,previous='';
 const sync=()=>{
  const visible=!host.hidden&&!!host.querySelector('.qs-shell');
  if(visible){if(!owned){previous=title.textContent;owned=true;}if(title.textContent!=='Mengdesammenstilling')title.textContent='Mengdesammenstilling';}
  else if(owned){owned=false;if(title.textContent==='Mengdesammenstilling')title.textContent=previous;}
 };
 const observer=new Observer(sync);observer.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});observer.observe(title,{childList:true,characterData:true,subtree:true});sync();
 return ()=>observer.disconnect();
}
if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined')installQuantityHeading();
