// Private ControlPlan feature registrations; all host services arrive through context.
export function install(cp, context){
cp.cpFile = (function(ref){return context.treeRoot?context.flatten(context.treeRoot).find(f=>String(f.id)===String(ref.fileId)):null});

cp.cpLinkEvaluation = (function(file){const current=[],stale=[];for(const link of cp.cpConfig?.links||[])if(String(link.delivery.fileId)===String(file.id)){if(String(link.delivery.versionId)===String(file.versionId||''))current.push(link);else stale.push(link)}const evaluated=current.map(link=>{const issues=[],documentation=link.documentation.map(ref=>{const f=cp.cpFile(ref),entry=cp.cpReports.get(String(ref.fileId));if(!f)issues.push('Kontrolldokument finnes ikke: '+ref.fileId);else{if(!cp.cpControlIds.has(String(f.id)))issues.push('Kontrolldokumentet ligger utenfor kontrollmappene: '+f.name);if(f.format!=='json')issues.push('Kontrolldokumentet er ikke JSON: '+f.name);if(String(f.versionId||'')!==String(ref.versionId))issues.push('Kontrolldokumentets versjon avviker: '+f.name);if(!entry?.ok)issues.push('Kontrolldokumentet kunne ikke leses: '+f.name+(entry?.error?' · '+entry.error:''));else for(const id of ref.controlIds||[])if(!entry.report.points.some(p=>p.id===id))issues.push(`Kontroll-ID ${id} finnes ikke i ${f.name}.`)}return{ref,file:f,entry}}),controlledModels=link.controlledModels.map(ref=>{const f=cp.cpFile(ref);if(!f)issues.push('Kontrollmodell finnes ikke: '+ref.fileId);else{if(!cp.cpControlIds.has(String(f.id)))issues.push('Kontrollmodellen ligger utenfor kontrollmappene: '+f.name);if(!cp.cpConfig.modelFormats.includes(f.format))issues.push('Kontrollreferansen er ikke et konfigurert modellformat: '+f.name);if(String(f.versionId||'')!==String(ref.versionId))issues.push('Kontrollmodellens versjon avviker: '+f.name)}return{ref,file:f}});for(const m of controlledModels)if(m.file&&!documentation.some(d=>{if(!d.entry?.ok)return false;const ids=cp.cpReportModelIds(d.entry.report);return ids.size?ids.has(String(m.file.id)):d.entry.report.models.includes(m.file.name)}))issues.push('Ingen koblet rapport refererer kontrollmodellen '+m.file.name+'.');return{link,documentation,controlledModels,issues}});return{current:evaluated,stale}});

cp.cpEligible = (function(){return cp.cpDeliveryFiles.filter(f=>cp.cpText(String(f.versionId||''),200))});

cp.cpPendingFor = (function(file){return cp.cpPendingLinks.filter(l=>l.delivery.fileId===String(file.id)&&l.delivery.versionId===String(file.versionId))});

cp.cpResetLinkDrafts = (function(){cp.cpChecked.clear();cp.cpPendingLinks=[];cp.cpPendingBase=null;cp.cpPendingProject=null;cp.cpLinkSession=null;const d=context.$('cpLinkDialog');if(d?.open)d.close()});

cp.cpLinkDocs = (function(){return cp.cpControlFiles.filter(f=>f.format==='json'&&f.versionId&&cp.cpReports.get(String(f.id))?.ok)});

cp.cpBuildBatch = (function(mappings,docIds,note=''){
 if(!mappings.length)throw Error('Velg minst én leveransefil.');if(!docIds.length)throw Error('Velg minst én JSON-rapport under Kontrolldokumentasjon.');
 const docs=[...new Set(docIds)].map(id=>{const f=cp.cpControlFiles.find(f=>String(f.id)===id);if(!f||!f.versionId||f.format!=='json'||!cp.cpReports.get(id)?.ok)throw Error('En valgt rapport er utilgjengelig eller ugyldig.');return f});
 const seen=new Set(),existing=[...(cp.cpConfig.links||[]),...cp.cpPendingLinks],built=[];
 for(const mapping of mappings){const delivery=cp.cpDeliveryFiles.find(f=>String(f.id)===mapping.delivery.fileId);if(!delivery||String(delivery.versionId)!==mapping.delivery.versionId)throw Error('Leveransefil eller versjon er endret.');if(seen.has(String(delivery.id)))throw Error('Samme leveransefil er valgt flere ganger.');seen.add(String(delivery.id));
 const models=[...new Set(mapping.modelIds)].map(id=>{const f=cp.cpControlFiles.find(f=>String(f.id)===id);if(!f||!f.versionId||!cp.cpConfig.modelFormats.includes(f.format))throw Error('Kontrollmodell eller versjon mangler.');return f});if(!models.length)throw Error('Velg kontrollmodell for '+delivery.name+'.');
 const relevant=docs.filter(doc=>{const r=cp.cpReports.get(String(doc.id)).report,ids=cp.cpReportModelIds(r);return models.some(m=>ids.size?ids.has(String(m.id)):r.models.includes(m.name))});
 for(const m of models)if(!relevant.some(doc=>{const r=cp.cpReports.get(String(doc.id)).report,ids=cp.cpReportModelIds(r);return ids.size?ids.has(String(m.id)):r.models.includes(m.name)}))throw Error('Ingen valgt rapport refererer kontrollmodellen '+m.name+'. Valgt modell-ID: '+String(m.id)+'. Rapportenes modell-ID-er: '+docs.map(d=>[...cp.cpReportModelIds(cp.cpReports.get(String(d.id)).report)].join(', ')||'(mangler)').join(' / ')+'. Last rapportene på nytt dersom eksporten nylig er erstattet.');
 const link={id:'link-'+crypto.randomUUID(),delivery:{fileId:String(delivery.id),versionId:String(delivery.versionId)},documentation:relevant.map(f=>({fileId:String(f.id),versionId:String(f.versionId),controlIds:[]})),controlledModels:models.map(f=>({fileId:String(f.id),versionId:String(f.versionId)})),note:('Manuelt bekreftet dokumentasjonskobling. Kontrollert modellversjon i eldre eksport er ikke verifisert. '+note).slice(0,1000)};
 const signature=l=>context.publisherCanonical({delivery:l.delivery,docs:l.documentation.map(x=>x.fileId+':'+x.versionId).sort(),models:l.controlledModels.map(x=>x.fileId+':'+x.versionId).sort()});
 if(existing.some(x=>signature(x)===signature(link)))throw Error('Tilsvarende kobling finnes allerede for '+delivery.name+'.');built.push(link);
 }
 return built;
});

cp.cpMergeLinkConfig = (function(base,links){const cfg=context.cloneData(base);if(!cfg.controlPlan)throw Error('Kontrollplan-konfigurasjon mangler.');cfg.controlPlan.links=[...(cfg.controlPlan.links||[]),...context.cloneData(links)];cp.cpValidateConfig(cfg.controlPlan);context.publisherValidateConfig(cfg);return cfg});
}
