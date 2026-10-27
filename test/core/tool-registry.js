export function createToolRegistry(){
 const tools=new Map(),instances=new Map(),hosts=new Map();let active=null;
 return Object.freeze({
 register(tool){if(!tool?.id||tools.has(tool.id))throw Error('Ugyldig eller duplisert verktøy-ID');tools.set(tool.id,Object.freeze(tool));},
 list(){return [...tools.values()];},get(id){return tools.get(id);},
 attach(id,instance,host){if(!tools.has(id)||instances.has(id))throw Error('Ugyldig verktøytilkobling');instances.set(id,instance);hosts.set(id,host);},
 activate(mode){const next=[...tools.values()].find(t=>t.legacyMode===mode)?.id||null;if(next===active)return true;const old=instances.get(active);if(old&&!old.canLeave())return false;old?.unmount();active=next;instances.get(active)?.mount(hosts.get(active));return true;},
 render(mode){const tool=[...tools.values()].find(t=>t.legacyMode===mode);if(tool?.id===active)instances.get(active)?.render();},
 update(id,change){return instances.get(id)?.update(change);},canLeave(){return instances.get(active)?.canLeave()??true;},
 destroy(){for(const i of instances.values())i.destroy();instances.clear();hosts.clear();active=null;}
 });
}
