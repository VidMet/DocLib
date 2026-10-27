import {install,initialize} from './table.js?v=2.01-preview.4';
export default Object.freeze({id:'explorer',title:'Utforsker',legacyMode:'explorer',status:'module',create:createExplorer});
export function createExplorer(context){
 const state={};install(state,context);initialize(state,context);
 let active=false,destroyed=false,controller=null,host=null;
 const closeMenus=()=>{context.$('formatMenu').classList.remove('open');context.$('explorerContent').querySelectorAll('.column-menu.open').forEach(x=>x.classList.remove('open'));};
 const bind=(id,event,fn)=>context.$(id).addEventListener(event,fn,{signal:controller.signal});
 const api={
 id:'explorer',
 mount(container){if(destroyed)throw Error('Utforsker er lukket permanent.');if(active)return;active=true;host=container;controller=new AbortController();
  bind('search','input',()=>state.renderTable());
  bind('clearSelection','click',()=>{state.selected.clear();state.updateSelection();context.renderTree();state.renderTable();});
  bind('clearFolders','click',()=>{context.workspaceScope().clear();context.clearFolderFocus();context.renderTree();state.renderTable();});
  bind('formatButton','click',e=>{e.stopPropagation();context.$('formatMenu').classList.toggle('open');});
  bind('resetFilters','click',()=>state.resetFilters());
  bind('selectAll','change',e=>{state.visibleRows().forEach(r=>e.target.checked?state.selected.add(r.file.id):state.selected.delete(r.file.id));state.updateSelection();context.renderTree();state.renderTable();});
  document.addEventListener('click',e=>{if(!e.target.closest('.dropdown'))context.$('formatMenu').classList.remove('open');if(!e.target.closest('.colhead'))context.$('explorerContent').querySelectorAll('.column-menu.open').forEach(x=>x.classList.remove('open'));},{signal:controller.signal});
  state.renderFormats();state.renderDynamicHeaders();
 },
 render(){if(active)state.renderTable();},
 update(){if(active){state.renderFormats();state.renderDynamicHeaders();state.renderTable();state.updateSelection();}},
 canLeave(){return true;},
 unmount(){if(!active)return;active=false;controller?.abort();controller=null;closeMenus();context.$('body').replaceChildren();context.$('formatMenu').replaceChildren();context.$('explorerContent').querySelectorAll('.sort-hit,.filter-btn').forEach(x=>x.onclick=null);host=null;},
 destroy(){api.unmount();destroyed=true;},
 snapshot(){return Object.freeze({active,selectedCount:state.selected.size,visibleCount:state.visibleRows().length,sort:{...state.sortState},formats:[...state.formatFilters]});},
 port:Object.freeze({colDefs:(...args)=>state.colDefs(...args),
filterValue:(...args)=>state.filterValue(...args),
parseDate:(...args)=>state.parseDate(...args),
compareRows:(...args)=>state.compareRows(...args),
applyColumnFilters:(...args)=>state.applyColumnFilters(...args),
sortRows:(...args)=>state.sortRows(...args),
renderColumnFilter:(...args)=>state.renderColumnFilter(...args),
renderHeaders:(...args)=>state.renderHeaders(...args),
setSort:(...args)=>state.setSort(...args),
resetFilters:(...args)=>state.resetFilters(...args),
visibleRows:(...args)=>state.visibleRows(...args),
colorForValue:(...args)=>state.colorForValue(...args),
renderMetaCell:(...args)=>state.renderMetaCell(...args),
renderTable:(...args)=>state.renderTable(...args),
renderFormats:(...args)=>state.renderFormats(...args),
selectedIds:(...args)=>state.selectedIds(...args),
selectedRows:(...args)=>state.selectedRows(...args),
renderDynamicHeaders:(...args)=>state.renderDynamicHeaders(...args),
wireHeaders:(...args)=>state.wireHeaders(...args),
updateSelection:(...args)=>state.updateSelection(...args),
get selected(){return state.selected;},set selected(value){state.selected=value;},
get formatFilters(){return state.formatFilters;},set formatFilters(value){state.formatFilters=value;},
get allFormats(){return state.allFormats;},set allFormats(value){state.allFormats=value;},
get columnFilters(){return state.columnFilters;},set columnFilters(value){state.columnFilters=value;},
get sortState(){return state.sortState;},set sortState(value){state.sortState=value;}})
 };
 return Object.freeze(api);
}
