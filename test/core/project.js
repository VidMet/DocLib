/** Project loading coordinator. No direct access to tokens or feature internals. */
export function createProjectController(host) {
  let flight = null;
  let destroyed = false;
  let current = Object.freeze({phase:'idle',stage:'',attempt:0,revision:0,stale:true,
    fileCount:0,metadataDone:0,metadataFailed:0,lastSuccessfulAt:null,lastAttemptAt:null,issues:[]});
  const listeners = new Set();
  const snapshot = () => Object.freeze({...current,issues:[...current.issues]});
  function publish(patch) {
    current = Object.freeze({...current,...patch});
    host.present(snapshot());
    for (const listener of listeners) {
      try { listener(snapshot()); } catch (error) { host.log('PROJECT_OBSERVER_ERROR',{message:error.message}); }
    }
  }
  async function execute(force) {
    const projectId = host.projectId();
    const issues = [];
    let metadataDone = 0, metadataFailed = 0, cached = 0;
    const assertProject = () => {
      if (destroyed || host.projectId() !== projectId) throw Error('Prosjektgrunnlaget er endret. Last utvidelsen på nytt.');
    };
    const stage = (name) => {assertProject();publish({stage:name});};
    publish({phase:'loading',stage:'Prosjekt og mapper',attempt:current.attempt+1,stale:true,
      lastAttemptAt:new Date().toISOString(),metadataDone:0,metadataFailed:0,issues:[]});
    try {
      host.prepare(force);
      const response = await host.readProject(projectId);
      assertProject();
      if (!response.ok) throw Error('Prosjektlesing feilet: HTTP '+response.status);
      const data = response.data;
      const rootId = data?.rootId || data?.rootFolder?.id || data?.rootFolderId;
      if (!rootId) throw Error('Prosjektsvaret mangler rotmappe-ID.');
      // Scan first. Do not replace a previously visible tree with a failed/partial scan.
      const tree = await host.scanTree(rootId,data?.name||'Prosjekt');
      assertProject();
      tree.id = '__ROOT__';
      const files = host.flatten(tree);
      host.commitTree(tree,files);
      stage('Prosjektoppsett og profiler');
      await host.loadProfiles(rootId);
      assertProject();
      issues.push(...host.configurationIssues());
      stage('Kontrolldokumentasjon');
      await host.reloadControlPlan();
      assertProject();
      issues.push(...host.controlIssues());
      await host.loadPersonalProfiles(rootId);
      assertProject();
      host.applyProfiles();
      host.prepareRows(files);
      stage('Metadata');
      publish({fileCount:files.length});
      await host.pool(files,async(file,index)=>{
        assertProject();
        let result;
        try {
          result = await host.metadata(file);
          assertProject();
          if (result.m?.err || (file.format==='ifc'&&!file.versionId)) {
            metadataFailed++;
            issues.push('Metadata kunne ikke bekreftes for '+file.name+'.');
          }
        } catch (error) {
          assertProject();
          metadataFailed++;
          issues.push('Metadatafeil for '+file.name+': '+error.message);
          result={c:false,m:{props:{},err:true}};
        }
        if (result.c) cached++;
        host.commitRow(index,file,result.m);
        metadataDone++;
        host.progress(metadataDone,files.length,cached);
        host.render();
      });
      assertProject();
      host.metadataComplete(metadataFailed===0);
      const phase = issues.length ? 'incomplete' : 'ready';
      publish({phase,stage:'',revision:current.revision+1,stale:phase!=='ready',
        fileCount:files.length,metadataDone,metadataFailed,issues:[...new Set(issues)],
        lastSuccessfulAt:phase==='ready'?new Date().toISOString():current.lastSuccessfulAt});
      host.progress(null);
      host.render();
      host.status(phase==='ready'?`Ferdig: ${files.length} filer, ${cached} fra cache`:
        `Ufullstendig prosjektgrunnlag: ${issues.length} registrerte problemer`,phase==='ready'?'ok':'bad');
      return snapshot();
    } catch (error) {
      host.metadataComplete(false);
      host.progress(null);
      publish({phase:'error',stage:'',stale:true,metadataDone,metadataFailed,
        issues:[error.message||'Ukjent innlastingsfeil']});
      host.log('PROJECT_LOAD_ERROR',{message:error.message});
      host.status('Prosjektinnlasting feilet: '+error.message,'bad');
      host.render();
      return snapshot();
    }
  }
  return Object.freeze({
    snapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    reload(force=false){
      if (destroyed) return Promise.reject(Error('Prosjekttjenesten er lukket.'));
      if (flight) return flight; // Coalesce, do not start overlapping project updates.
      if (!host.canReload()) return Promise.resolve(snapshot());
      flight = Promise.resolve().then(()=>execute(!!force)).finally(()=>{flight=null;});
      return flight;
    },
    destroy(){destroyed=true;listeners.clear();}
  });
}
