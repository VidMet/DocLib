export const VERSION = Object.freeze({
  value: "2.02",
  label: "DocLib v2.02",
  cacheKey: "2.02"
});
export function applyVersionDisplay(root=document){if(document.title!==VERSION.label)document.title=VERSION.label;const title=root.querySelector?.('.title b');if(title&&title.textContent!==VERSION.label)title.textContent=VERSION.label;root.querySelectorAll?.('[data-doclib-version]').forEach(node=>{if(node.textContent!==VERSION.label)node.textContent=VERSION.label;});}
export function installVersionDisplay(){let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;applyVersionDisplay();});});applyVersionDisplay();observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});return observer;}
