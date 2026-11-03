// Private ControlPlan feature registrations; all host services arrive through context.
export function install(cp, context){
cp.cpExportLinks = (async function(){
 if(cp.cpExportBusy||!cp.cpPendingLinks.length)return;const snapshot=context.cloneData(cp.cpPendingLinks),base=cp.cpPendingBase,pid=cp.cpPendingProject;cp.cpExportBusy=true;cp.cpRender();
 try{if(String(context.project.id)!==cp.cpPendingProject||context.publisherCanonical(context.projectConfiguration)!==cp.cpPendingBase)throw Error('Utkastene gjelder et annet prosjekt eller konfigurasjonsgrunnlag.');
 const context=await context.publisherReadContext();if(String(context.project.id)!==pid||cp.cpPendingBase!==base||context.publisherCanonical(cp.cpPendingLinks)!==context.publisherCanonical(snapshot))throw Error('Utkast eller prosjekt er endret under eksport.');if(String(context.configFile?.id)!==String(context.projectConfigurationFile?.id)||context.publisherCanonical(context.config)!==cp.cpPendingBase)throw Error('Prosjektkonfigurasjonen er endret. Ingen fil lastet ned. Last inn på nytt og opprett koblingene fra gjeldende grunnlag.');
 for(const link of cp.cpPendingLinks)for(const ref of [link.delivery,...link.documentation,...link.controlledModels]){const f=cp.cpFile(ref);if(!f||String(f.versionId)!==ref.versionId)throw Error('En filreferanse er endret. Oppdater grunnlaget før eksport.');}
 const cfg=cp.cpMergeLinkConfig(context.config,snapshot);context.assistedDownload('doclib.config.json',cfg);
 const el=context.$('workspacePlaceholder').querySelector('[data-cp-batch-message]');if(el)el.textContent='Komplett konfigurasjon lastet ned. Ikke publisert. Samordne med andre forvaltere, last opp manuelt til Extension_config/DocLib/doclib.config.json og last DocLib på nytt. Ekstra lesing beskytter ikke mot senere samtidige endringer.';
 }catch(e){const el=context.$('workspacePlaceholder').querySelector('[data-cp-batch-message]');if(el)el.textContent=e.message;}finally{cp.cpExportBusy=false;const b=context.$('workspacePlaceholder').querySelector('[data-cp-export]');if(b)b.disabled=false;}
});

cp.cpTestLocalKey = (function(){return 'control-links:'+String(context.project?.id||'')+':'+String(context.mineUser?.id||'unresolved')});

cp.cpTestReadLocal = (function(){try{const p=JSON.parse(context.testStorage.getItem(cp.cpTestLocalKey())||'null');if(!p)return [];if(p.projectId!==String(context.project.id)||p.userId!==String(context.mineUser?.id||'unresolved'))throw Error('Feil prosjekt eller bruker.');return cp.cpValidateConfig({...context.projectConfiguration.controlPlan,links:p.links}).links}catch(e){cp.cpIssues.push('Lokale testkoblinger kunne ikke leses: '+e.message);return []}});
}

export function compose(cp,context){
cp.cpExportLinks=async function(){if(cp.cpExportBusy||!cp.cpPendingLinks.length)return;try{if(cp.cpPendingProject!==String(context.project.id)||cp.cpPendingBase!==context.publisherCanonical(context.projectConfiguration))throw Error('Prosjektgrunnlaget er endret.');for(const l of cp.cpPendingLinks)for(const ref of [l.delivery,...l.documentation,...l.controlledModels]){const f=cp.cpFile(ref);if(!f||String(f.versionId)!==ref.versionId)throw Error('Filgrunnlaget er endret.');}const old=cp.cpTestReadLocal(),links=[...old,...context.cloneData(cp.cpPendingLinks)];cp.cpValidateConfig({...context.projectConfiguration.controlPlan,links});context.testStorage.setItem(cp.cpTestLocalKey(),JSON.stringify({projectId:String(context.project.id),userId:String(context.mineUser?.id||'unresolved'),links}));const ids=new Set(cp.cpConfig.links.map(l=>l.id));for(const l of links)if(!ids.has(l.id)){cp.cpConfig.links.push(l);ids.add(l.id)}cp.cpPendingLinks=[];cp.cpPendingBase=null;cp.cpPendingProject=null;cp.cpRender();context.status('TEST: koblinger lagret kun i denne nettleseren. Ikke publisert.','ok')}catch(e){context.status(e.message,'bad')}};
}
