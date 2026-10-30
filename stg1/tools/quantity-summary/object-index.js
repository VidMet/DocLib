// DocLib Mengdesammenstilling - objektindeks for v2.03-preview.5 trinn 3A.
// Read-only Model API access. Cache is kept in memory for the tool session.
const memoryCache = new Map();
const list = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
const cacheKey = model => `${model.id}:${model.versionId || 'none'}`;

function definitions(data) {
  const map = new Map();
  for (const item of list(data)) {
    map.set(Number(item.idx), {
      name: String(item.name || `Pset ${item.idx}`),
      properties: (item.props || []).map(prop => String(prop?.name || '')).filter(Boolean)
    });
  }
  return map;
}

function entityRecord(entity, model, defs) {
  const properties = {};
  for (const pset of entity?.psets || []) {
    const definition = defs.get(Number(pset.idx));
    if (!definition) continue;
    for (let index = 0; index < definition.properties.length; index += 1) {
      const value = pset.values?.[index];
      if (value == null || String(value).trim() === '') continue;
      properties[`${definition.name}::${definition.properties[index]}`] = String(value);
    }
  }
  return {
    modelId: String(model.id),
    modelName: String(model.name || model.id),
    versionId: model.versionId == null ? null : String(model.versionId),
    entityId: String(entity?.id ?? ''),
    entityType: String(entity?.type || entity?.entityType || entity?.class || ''),
    properties
  };
}

export function createObjectIndex(context = {}) {
  let controller = null;
  const api = context.objectContext || {};

  async function request(url, signal) {
    if (typeof api.req !== 'function') throw Error('Model API-port mangler i Mengdesammenstilling.');
    if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError');
    const response = await api.req(url);
    if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError');
    return response;
  }

  async function loadModel(model, options = {}) {
    const key = cacheKey(model);
    if (!options.force && memoryCache.has(key)) return {...memoryCache.get(key), fromCache:true};
    const signal = options.signal;
    const encodedId = encodeURIComponent(model.id);
    const version = model.versionId ? `&versionId=${encodeURIComponent(model.versionId)}` : '';
    const modelBase = api.MODEL;
    const pageSize = Number(api.PAGE || 1000);
    if (!modelBase) throw Error('MODEL-endepunkt mangler i Mengdesammenstilling.');

    options.onProgress?.({model,stage:'definitions',done:0,total:null});
    const definitionsResponse = await request(`${modelBase}/models/${encodedId}/psetdefs?offset=0&top=30000${version}`, signal);
    if (!definitionsResponse?.ok || definitionsResponse.status === 206) throw Object.assign(Error(`Egenskapsdefinisjoner kunne ikke leses for ${model.name} (HTTP ${definitionsResponse?.status ?? 'ukjent'}).`), {status:definitionsResponse?.status});
    const defs = definitions(definitionsResponse.data);

    const entities = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const url = `${modelBase}/models/${encodedId}/entities?offset=${offset}&top=${pageSize}&fields=id&fields=type&fields=psets${version}`;
      const response = await request(url, signal);
      if (!response?.ok || response.status === 206) throw Object.assign(Error(`Objektmetadata kunne ikke leses komplett for ${model.name} (HTTP ${response?.status ?? 'ukjent'}).`), {status:response?.status});
      const page = list(response.data);
      for (const entity of page) entities.push(entityRecord(entity, model, defs));
      total = Number(response.data?.total ?? page.length);
      const count = Number(response.data?.count ?? page.length);
      if (count <= 0) {
        if (offset < total) throw Error(`Objektlisten for ${model.name} stoppet før oppgitt total.`);
        break;
      }
      offset += count;
      options.onProgress?.({model,stage:'entities',done:Math.min(offset,total),total});
    }

    const propertyKeys = new Set();
    let withProperties = 0;
    for (const entity of entities) {
      const keys = Object.keys(entity.properties);
      if (keys.length) withProperties += 1;
      keys.forEach(keyName => propertyKeys.add(keyName));
    }
    const result = {
      key,model:{...model},entities,
      entityCount:entities.length,
      entitiesWithProperties:withProperties,
      propertyCount:propertyKeys.size,
      definitionCount:defs.size,
      loadedAt:new Date().toISOString(),
      fromCache:false
    };
    memoryCache.set(key,result);
    return result;
  }

  async function load(models, options = {}) {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const results = [], errors = [];
    for (const model of models) {
      try { results.push(await loadModel(model,{...options,signal})); }
      catch (error) {
        if (error?.name === 'AbortError') throw error;
        errors.push({modelId:String(model.id),modelName:String(model.name || model.id),message:error?.message || String(error),status:error?.status ?? null});
      }
    }
    return {
      results,errors,
      modelsRequested:models.length,
      modelsLoaded:results.length,
      entityCount:results.reduce((sum,item)=>sum+item.entityCount,0),
      entitiesWithProperties:results.reduce((sum,item)=>sum+item.entitiesWithProperties,0),
      propertyCount:new Set(results.flatMap(item=>item.entities.flatMap(entity=>Object.keys(entity.properties)))).size,
      cacheHits:results.filter(item=>item.fromCache).length
    };
  }

  function abort(){controller?.abort();controller=null;}
  function clear(){abort();memoryCache.clear();}
  function snapshot(){return {cacheEntries:memoryCache.size,keys:[...memoryCache.keys()]};}
  return Object.freeze({load,abort,clear,snapshot});
}
