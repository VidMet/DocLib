/** Project loading coordinator. No direct access to tokens or feature internals. */
export function createProjectController(host) {
  let flight = null;
  let destroyed = false;
  let current = Object.freeze({phase:'idle',stage:'',attempt:0,revision:0,stale:true,
    fileCount:0,metadataDone:0,metadataFailed:0,warnings:[],lastSuccessfulAt:null,lastAttemptAt:null,issues:[]});
  const listeners = new Set();
  const snapshot = () => Object.freeze({...current,issues:[...current.issues],warnings:current.warnings.map(x=>({...x}))});
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
    const warnings = [];
    let metadataDone = 0, metadataFailed = 0, cached = 0;
    const assertProject = () => {
      if (destroyed || host.projectId() !== projectId) throw Error('Prosjektgrunnlaget er endret. Last utvidelsen på nytt.');
    };
    const stage = (name) => {assertProject();publish({stage:name});};
    publish({phase:'loading',stage:'Prosjekt og mapper',attempt:current.attempt+1,stale:true,
      lastAttemptAt:new Date().toISOString(),metadataDone:0,metadataFailed:0,issues:[],warnings:[]});
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
            warnings.push({fileId:String(file.id),versionId:String(file.versionId||''),name:file.name,folder:file.folderPath||'',status:result.m?.metadataError?.status??null,message:result.m?.metadataError?.message||(!file.versionId?'IFC-filen mangler versjons-ID.':'Metadata kunne ikke bekreftes.')});
          }
        } catch (error) {
          assertProject();
          metadataFailed++;
          const detail={fileId:String(file.id),versionId:String(file.versionId||''),name:file.name,folder:file.folderPath||'',status:error.status??null,message:error.message||'Ukjent metadatafeil'};
          warnings.push(detail);
          result={c:false,m:{props:{},err:true,metadataError:detail}};
        }
        if(warnings.length&&warnings[warnings.length-1].fileId===String(file.id)){const warning=warnings[warnings.length-1];result.m={...result.m,err:true,metadataError:warning};host.log('FILE_METADATA_WARNING',warning);}
        if (result.c) cached++;
        host.commitRow(index,file,result.m);
        metadataDone++;
        host.progress(metadataDone,files.length,cached);
        host.render();
      });
      assertProject();
      host.metadataComplete(true); // The attempt completed; per-file evidence may still be unavailable.
      const phase = issues.length ? 'incomplete' : 'ready';
      publish({phase,stage:'',revision:current.revision+1,stale:phase!=='ready',
        fileCount:files.length,metadataDone,metadataFailed,warnings,issues:[...new Set(issues)],
        lastSuccessfulAt:phase==='ready'?new Date().toISOString():current.lastSuccessfulAt});
      host.progress(null);
      host.render();
      host.status(phase==='ready'?`Ferdig: ${files.length} filer, ${cached} fra cache${warnings.length?`, ${warnings.length} metadataadvarsler`:""}`:
        `Ufullstendig prosjektgrunnlag: ${issues.length} registrerte problemer`,phase==='ready'?'ok':'bad');
      return snapshot();
    } catch (error) {
      host.metadataComplete(false);
      host.progress(null);
      publish({phase:'error',stage:'',stale:true,metadataDone,metadataFailed,warnings,
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
