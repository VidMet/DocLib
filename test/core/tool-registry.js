export function createToolRegistry(){
 const tools=new Map();
 return Object.freeze({register(tool){if(!tool||!tool.id||tools.has(tool.id))throw Error('Ugyldig eller duplisert verktøy-ID');tools.set(tool.id,Object.freeze(tool));},list(){return [...tools.values()];},get(id){return tools.get(id);}});
}
