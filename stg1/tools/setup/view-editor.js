import {mountColumnEditor} from './column-editor.js?v=2.04-preview.7';
import {normalizeProjectTools} from './project-tools.js?v=2.04-preview.7';
const clone=value=>JSON.parse(JSON.stringify(value));
const nextId=views=>{let id;do{id='view-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}while(views.some(v=>v.id===id));return id;};
export function mountViewEditor(host,config,metadata,doc=document){
 const explorer=normalizeProjectTools(config).explorer;let views=clone(explorer.views),active=explorer.defaultViewId,defaultId=explorer.defaultViewId,editor;
 host.replaceChildren();const note=doc.createElement('p'),bar=doc.createElement('div'),select=doc.createElement('select'),name=doc.createElement('input'),standard=doc.createElement('input'),label=doc.createElement('label'),body=doc.createElement('div');
 note.className='setup-view-note';note.textContent='Velg en eksisterende visning for å redigere den, eller bruk «Ny visning» for å beholde den eksisterende og lage en kopi.';
 select.setAttribute('aria-label','Fellesvisning');name.setAttribute('aria-label','Navn på fellesvisning');name.maxLength=120;standard.type='checkbox';label.append(standard,doc.createTextNode(' Standard for prosjektet'));bar.className='setup-view-toolbar';bar.append(select,name,label);host.append(note,bar,body);
 const current=()=>views.find(v=>v.id===active);
 const commit=()=>{if(!editor)return;const v=current();if(!v)throw Error('Den valgte visningen finnes ikke lenger.');const data=editor.snapshot();Object.assign(v,data);v.name=name.value.trim()||v.name;};
 const render=()=>{select.replaceChildren();for(const v of views){const o=doc.createElement('option');o.value=v.id;o.textContent=v.name+(v.id===defaultId?' (standard)':'');select.append(o);}select.value=active;const v=current();if(!v)throw Error('Den valgte visningen finnes ikke.');name.value=v.name;standard.checked=active===defaultId;editor=mountColumnEditor(body,{...config,explorer:v},metadata,doc);};
 select.onchange=()=>{try{commit();active=select.value;render();}catch(e){select.value=active;window.alert(e.message);}};
 name.onchange=()=>{try{commit();render();}catch(e){window.alert(e.message);}};
 standard.onchange=()=>{if(standard.checked){defaultId=active;render();return;}if(active!==defaultId)return;if(views.length===1){standard.checked=true;window.alert('Prosjektet må ha én standardvisning. Opprett en ny visning før standardmarkeringen flyttes.');return;}defaultId=views.find(v=>v.id!==active).id;render();};
 const actions=[
  ['Ny visning',()=>{commit();const source=current();const id=nextId(views);views.push({...clone(source),id,name:'Ny visning'});active=id;render();name.focus();name.select();}],
  ['Slett visning',()=>{if(views.length===1){window.alert('Prosjektet må ha minst én visning.');return;}if(!window.confirm('Slette denne fellesvisningen? Endringen gjelder først etter lagring av prosjektoppsettet.'))return;const removed=active;views=views.filter(v=>v.id!==removed);if(removed===defaultId)defaultId=views[0].id;active=views[0].id;render();}]
 ];
 for(const [text,action] of actions){const button=doc.createElement('button');button.type='button';button.textContent=text;button.onclick=()=>{try{action();}catch(e){window.alert(e.message);}};bar.append(button);}
 render();return {snapshot(){commit();if(!views.some(v=>v.id===defaultId))defaultId=views[0].id;const v=views.find(v=>v.id===defaultId);return {...clone(v),views:clone(views),defaultViewId:defaultId};}};
}
