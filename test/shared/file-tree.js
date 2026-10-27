// Shared tree: independent of the active tool, with separate workspace selections.
export function createFileTree(context){
const state={};
state.makeNode = (function(id,name,path,parent=null){return{id,name,path,parent,folders:[],files:[]}});

state.scanFolder = (async function(id,name,path,parent){const node=state.makeNode(id,name,path,parent),r=await context.req(`${context.CORE}/folders/${id}/items`);if(!r.ok)throw Error('Mappen '+(path||'/')+' kunne ikke leses (HTTP '+r.status+').');const data=r.data,its=Array.isArray(data)?data:data?.items,folders=[];if(!Array.isArray(its))throw Error('Ukjent mappelisteformat for '+(path||'/'));if(r.status===206||data?.nextPageToken||data?.nextLink||data?.['@odata.nextLink']||(data?.total!==undefined&&Number(data.total)!==its.length))throw Error('Ufullstendig mappeliste for '+(path||'/'));for(const x of its){if(x.type==='FILE'){x.folderId=id;x.folderPath=path;x.format=context.fileExt(x.name);node.files.push(x)}else if(x.type==='FOLDER'){const hidden=path===''&&['extensionconfig','projectconfig'].includes(context.norm(x.name));if(!hidden)folders.push(x)}}node.folders=await Promise.all(folders.map(x=>state.scanFolder(x.id,x.name,`${path}/${x.name}`,node)));return node});

state.flatten = (function(node,out=[]){for(const f of node.files)out.push(f);for(const n of node.folders)state.flatten(n,out);return out});

state.descendants = (function(node,out=[]){for(const f of node.files)out.push(f.id);for(const n of node.folders)state.descendants(n,out);return out});

state.findNode = (function(node,id){if(node.id===id)return node;for(const n of node.folders){const x=state.findNode(n,id);if(x)return x}return null});

state.renderTree = (function(){if(!context.treeRoot)return;const scope=context.workspaceScope();function fileHtml(f){return `<div class="node-row ws-file" title="${context.esc(f.folderPath||'/')} / ${context.esc(f.name)}"><span class="twisty"></span><input type="checkbox" data-scope-file="${context.esc(f.id)}" aria-label="Velg fil ${context.esc(f.name)}" ${scope.has(f.id)?'checked':''}><span aria-hidden="true">📄</span><span class="ws-name">${context.esc(f.name)}</span><span class="format">${context.esc(f.format||'')}</span></div>`}function nodeHtml(n){const open=state.expanded.has(n.id),ids=[...new Set(state.descendants(n,[]))],checked=ids.length>0&&ids.every(id=>scope.has(id)),some=ids.some(id=>scope.has(id));return `<div class="node"><div class="node-row"><button type="button" class="twisty ws-toggle" data-toggle="${context.esc(n.id)}" aria-label="Utvid eller skjul ${context.esc(n.name)}" aria-expanded="${open}">${open?'▼':'▶'}</button><input type="checkbox" data-folder-check="${context.esc(n.id)}" aria-label="Velg mappe ${context.esc(n.name)} med undermapper" ${checked?'checked':''} ${some&&!checked?'data-indeterminate="1"':''} ${!ids.length?'disabled':''}><button type="button" class="ws-folder-name" data-toggle="${context.esc(n.id)}" title="${context.esc(n.path)}">📁 ${context.esc(n.name)}</button><span class="count">(${ids.length})</span></div>${open?`<div class="children">${n.folders.map(nodeHtml).join('')}${n.files.map(fileHtml).join('')}</div>`:''}</div>`}context.$('tree').innerHTML=context.treeRoot.folders.map(nodeHtml).join('')+context.treeRoot.files.map(fileHtml).join('');if(!context.$('tree').innerHTML)context.$('tree').textContent='Ingen tilgjengelige mapper eller filer.';context.$('tree').querySelectorAll('[data-indeterminate]').forEach(x=>x.indeterminate=true);context.$('tree').querySelectorAll('[data-toggle]').forEach(x=>x.onclick=()=>{const id=x.dataset.toggle;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);state.renderTree()});context.$('tree').querySelectorAll('[data-folder-check]').forEach(x=>x.onchange=()=>{const n=state.findNode(context.treeRoot,x.dataset.folderCheck);if(n)state.descendants(n,[]).forEach(id=>x.checked?scope.add(id):scope.delete(id));context.workspaceSelectionChanged()});context.$('tree').querySelectorAll('[data-scope-file]').forEach(x=>x.onchange=()=>{x.checked?scope.add(x.dataset.scopeFile):scope.delete(x.dataset.scopeFile);context.workspaceSelectionChanged()});context.workspaceModeUI()});
state.currentFolder = ('__ALL__');
state.expanded = (new Set(['__ROOT__']));
state.folderFilters = (new Set());
state.allExpanded = (false);
let controller=null;
return Object.freeze({port:Object.freeze({makeNode:(...args)=>state.makeNode(...args),
scanFolder:(...args)=>state.scanFolder(...args),
flatten:(...args)=>state.flatten(...args),
descendants:(...args)=>state.descendants(...args),
findNode:(...args)=>state.findNode(...args),
renderTree:(...args)=>state.renderTree(...args),
get currentFolder(){return state.currentFolder;},set currentFolder(value){state.currentFolder=value;},
get expanded(){return state.expanded;},set expanded(value){state.expanded=value;},
get folderFilters(){return state.folderFilters;},set folderFilters(value){state.folderFilters=value;},
get allExpanded(){return state.allExpanded;},set allExpanded(value){state.allExpanded=value;}}),
 mount(){if(controller)return;controller=new AbortController();context.$('expandAll').addEventListener('click',()=>{state.allExpanded=!state.allExpanded;state.expanded.clear();if(state.allExpanded&&context.treeRoot){(function add(n){state.expanded.add(n.id);n.folders.forEach(add)})(context.treeRoot)}else state.expanded.add('__ROOT__');state.renderTree();},{signal:controller.signal});},
 destroy(){controller?.abort();controller=null;context.$('tree').replaceChildren();}
});}
