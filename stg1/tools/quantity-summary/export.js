// Local exports only. No CDN, network requests, or external dependencies.
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
const order=(a,b)=>a.label.localeCompare(b.label,'nb',{numeric:true,sensitivity:'base'});
export function makeSnapshot(report,config,meta={}){
 const rows=[],leaves=[];
 function walk(parent,path=[]){for(const node of [...parent.children.values()].sort(order)){
  const labels=[...path,node.label],row={labels,depth:node.depth,type:node.children.size?'Delsum':'Mengde',count:node.count,values:report.columns.map(c=>node.cells.get(c.key)?.sum??null)};
  rows.push(row);if(!node.children.size)leaves.push(row);walk(node,labels);
 }}walk(report.root);
 if(!rows.length&&report.root.count){const row={labels:['Alle objekter'],depth:0,type:'Mengde',count:report.root.count,values:report.columns.map(c=>report.baseTotals.get(c.key)?.sum??null)};rows.push(row);leaves.push(row);}
 return {created:new Date().toISOString(),config:JSON.parse(JSON.stringify(config)),meta,columns:report.columns.map(c=>({...c})),rows,leaves,roundScope:report.roundScope,baseTotal:report.columns.map(c=>report.baseTotals.get(c.key)?.sum??null),difference:report.roundScope==='final'?report.columns.map(c=>report.differences.get(c.key)?.sum??null):null,total:report.columns.map(c=>report.root.cells.get(c.key)?.sum??null),issues:report.issues.map(i=>({...i})),stats:{...report.stats}};
}
const scope=s=>({final:'Kun sluttsum',model:'Per prosesskode per modell',leaf:'Nederste grupperingsnivå'})[s.roundScope||s.config.roundScope||'final'];
function settings(s){return [
 ['Bygg',s.meta.build||''],['Eksportert',s.created],['Datagrunnlag',s.meta.warning||'Ingen modellfeil rapportert'],['Kolonneegenskap',s.config.column],['Mengdeegenskap',s.config.quantity],['Enhetsegenskap',s.config.unit||'Ikke valgt: kontroller enheter'],
 ...s.config.groups.map((g,i)=>['Gruppering '+(i+1),g==='@model'?'Modellnavn':g||'Ikke valgt']),
 ['Desimaler',Number(s.config.decimals??0)],['Avrund på',scope(s)],['Avrundingsmåte',({normal:'Vanlig avrunding',up:'Rund opp',down:'Rund ned'})[s.config.roundMode||'normal']],['Avrundingstrinn',s.config.roundMode==='normal'?'Valgte desimaler':Number(s.config.roundStep)],['Negative tall','Opp mot pluss uendelig, ned mot minus uendelig'],['Summer',s.roundScope==='final'?'Modellsummer til valgte desimaler; sluttsum trinnavrundes; differanse vises separat':'Summerer avrundede modell-/bladverdier uten ny trinnavrunding'],['IFC-objekter','Avrundes aldri'],['Innhold','Alle grupper, uavhengig av sammenfolding'],
 ...Object.entries(s.stats).map(([k,v])=>[k,v])];}
const header=s=>s.columns.map(c=>`${c.code} [${c.unit||'enhet ikke valgt'}]`);
const csvCell=(v,numeric=false)=>{let t=String(v??'');if(!numeric&&typeof v==='string'&&/^[\s]*[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
export function csvText(s){
 const count=Math.max(1,s.config.groups.filter(Boolean).length),heads=Array.from({length:count},(_,i)=>'Gruppering '+(i+1));
 const common=[scope(s),s.config.roundMode||'normal',s.config.roundMode==='normal'?'desimaler':s.config.roundStep,s.config.decimals??0,s.meta.warning||''];
 const rows=[['Radtype',...heads,...header(s),'Avrund på','Avrundingsmåte','Trinn','Desimaler','Datagrunnlagsvarsel'],...s.leaves.map(r=>['Mengde',...Array.from({length:count},(_,i)=>r.labels[i]||''),...r.values,...common]),...(s.difference?[['Avrundingsdifferanse','Avrundingsdifferanse',...Array(count-1).fill(''),...s.difference,...common]]:[]),['Totalsum','Sum per kolonne',...Array(count-1).fill(''),...s.total,...common]];
 return '\ufeff'+rows.map(row=>row.map(v=>csvCell(typeof v==='number'?v.toFixed(Number(s.config.decimals??0)).replace('.',','):v,typeof v==='number')).join(';')).join('\r\n');
}
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
function record(size,values){const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);for(const [offset,value,length] of values)length===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true);return bytes;}
function zip(files){const locals=[],central=[];let offset=0;for(const [name,text] of Object.entries(files)){
 const n=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
 const local=join([record(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,n.length,2]]),n,data]);locals.push(local);
 central.push(join([record(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,n.length,2],[42,offset,4]]),n]));offset+=local.length;
 }const directory=join(central);return join([...locals,directory,record(22,[[0,0x06054b50,4],[8,central.length,2],[10,central.length,2],[12,directory.length,4],[16,offset,4]])]);}
const colName=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function sheet(rows,widths=[],decimals=0){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>{const ref=colName(j)+(i+1),style=i===0?1:['Delsum','Totalsum','Avrundingsdifferanse'].includes(r[0])?(typeof v==='number'?4:3):typeof v==='number'?2:0;return v==null?`<c r="${ref}"/>`:typeof v==='number'?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;}
export function xlsxBytes(s){
 const count=Math.max(1,s.config.groups.filter(Boolean).length),groups=Array.from({length:count},(_,i)=>'Gruppering '+(i+1));
 const table=[['Radtype',...groups,'Objekter',...header(s)],...s.rows.map(r=>[r.type,...Array.from({length:count},(_,i)=>r.labels[i]||''),r.count,...r.values]),...(s.difference?[['Avrundingsdifferanse','Avrundingsdifferanse',...Array(count-1).fill(''),null,...s.difference]]:[]),['Totalsum','Sum per kolonne',...Array(count-1).fill(''),s.stats.included,...s.total]];
 const sheets=[['Mengder',table,[15,...Array(count).fill(42),12,...s.columns.map(()=>20)]],['Oppsett',[['Innstilling','Verdi'],...settings(s)],[30,95]],['Avvik',[['Modell','Objekt-ID','Avvik','Råverdi'],...s.issues.map(i=>[i.modelName,i.entityId,i.reason,i.value])],[45,38,32,35]],['Modeller',[['Modell','Modell-ID','Versjon'],...(s.meta.models||[]).map(m=>[m.name,m.id,m.versionId||''])],[45,38,38]]];
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const files={
 '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
 '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
 'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map(([name],i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
 'xl/styles.xml':`<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0${Number(s.config.decimals)?'.'+'0'.repeat(Number(s.config.decimals)):''}"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4EDF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`};
 sheets.forEach(([,rows,widths],i)=>files[`xl/worksheets/sheet${i+1}.xml`]=sheet(rows,widths));return zip(files);
}
// PDF uses built-in Helvetica / WinAnsi (Norwegian and Western European text).
const ansi=v=>String(v??'').replace(/\u202f|\u00a0/g,' ').replace(/–|—/g,'-').replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
const pdfString=v=>ansi(v).replace(/[\\()]/g,'\\$&');
function wrap(text,max){const lines=[];for(const line of ansi(text).split(/\r?\n/)){let rest=line;while(rest.length>max){let cut=rest.lastIndexOf(' ',max);if(cut<max/2)cut=max;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}lines.push(rest);}return lines;}
export function pdfBytes(s){
 const pages=[],W=1191,H=842,margin=32,labelWidth=360,colWidth=125,perPanel=6;
 const fmt=new Intl.NumberFormat('nb-NO',{minimumFractionDigits:Number(s.config.decimals??0),maximumFractionDigits:Number(s.config.decimals??0)});
 const rows=[...s.rows,...(s.difference?[{labels:['Avrundingsdifferanse'],depth:0,type:'Avrundingsdifferanse',values:s.difference}]:[]),{labels:['Sum per kolonne'],depth:0,type:'Totalsum',values:s.total}];
 const panels=Math.max(1,Math.ceil(s.columns.length/perPanel));
 function text(cmd,x,y,value,size=9,bold=false){cmd.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfString(value)}) Tj ET`);}
 function pageTitle(cmd,title){text(cmd,margin,H-35,'Mengdesammenstilling - '+title,15,true);text(cmd,margin,H-53,`v${s.meta.build||''} | ${s.created}`,9);}
 for(let panel=0;panel<panels;panel++){
  const cols=s.columns.slice(panel*perPanel,(panel+1)*perPanel);let cmd=[],y=0;
  function begin(){cmd=[];pageTitle(cmd,`kolonnedel ${panel+1} av ${panels}`);text(cmd,margin,H-70,`${scope(s)} | ${s.config.roundMode||'normal'} | trinn ${s.config.roundMode==='normal'?'desimaler':s.config.roundStep} | desimaler ${s.config.decimals??0}`,9);text(cmd,margin,H-85,s.meta.warning?'UFULLSTENDIG DATAGRUNNLAG - se oppsett':'Alle grupper inkludert. Se oppsett og avvik bakerst.',9);y=H-110;text(cmd,margin,y,'Gruppering',10,true);cols.forEach((c,i)=>{text(cmd,margin+labelWidth+i*colWidth,y,c.code,Math.min(10,110/Math.max(1,ansi(c.code).length*0.6)),true);text(cmd,margin+labelWidth+i*colWidth,y-13,c.unit||'Enhet ikke valgt',Math.min(8,110/Math.max(1,ansi(c.unit||'Enhet ikke valgt').length*0.6)));});y-=32;}
  function finish(){pages.push(cmd.join('\n'));}
  begin();
  for(const row of rows){const lines=wrap('  '.repeat(row.depth)+(row.labels.at(-1)||''),62),height=Math.max(24,lines.length*12+8);if(y-height<45){finish();begin();}if(row.type!=='Mengde')cmd.push(`0.91 0.94 0.97 rg ${margin} ${y-height+8} ${W-margin*2} ${height} re f 0 0 0 rg`);lines.forEach((line,i)=>text(cmd,margin,y-i*12,line,9,row.type!=='Mengde'));cols.forEach((c,i)=>{const v=row.values[panel*perPanel+i];const label=v==null?'-':fmt.format(v);text(cmd,margin+labelWidth+i*colWidth,y,label,Math.min(9,110/Math.max(1,ansi(label).length*0.6)),row.type!=='Mengde');});y-=height;}
  finish();
 }
 let cmd=[],y=0;
 function newDetail(title){if(cmd.length)pages.push(cmd.join('\n'));cmd=[];pageTitle(cmd,title);y=H-85;}
 function detail(line,bold=false){for(const part of wrap(line,175)){if(y<45)newDetail('Oppsett / avvik (forts.)');text(cmd,margin,y,part,9,bold);y-=14;}}
 newDetail('Oppsett og datagrunnlag');for(const [k,v] of settings(s))detail(k+': '+v);
 detail('Modeller',true);for(const m of s.meta.models||[])detail(`${m.name} | ID ${m.id} | versjon ${m.versionId||'ukjent'}`);
 detail(`Avvik (${s.issues.length})`,true);for(const i of s.issues)detail(`${i.modelName} | ${i.entityId} | ${i.reason} | ${i.value}`);
 pages.push(cmd.join('\n'));
 const objects=[null,'','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'],kids=[];
 pages.forEach((content,i)=>{content+=`\nBT /F1 8 Tf 1 0 0 1 1080 22 Tm (Side ${i+1} av ${pages.length}) Tj ET`;const pageId=objects.length,streamId=pageId+1;kids.push(`${pageId} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);});
 objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
 let out='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const start=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return Uint8Array.from(out,c=>c.charCodeAt(0));
}
export function downloadExport(format,s){
 const name='Mengdesammenstilling_'+s.created.slice(0,19).replace(/[:T]/g,'-');let data,mime;
 if(format==='csv'){data=csvText(s);mime='text/csv;charset=utf-8';}else if(format==='xlsx'){data=xlsxBytes(s);mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}else if(format==='pdf'){data=pdfBytes(s);mime='application/pdf';}else throw Error('Ukjent eksportformat.');
 const url=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=url;a.download=name+'.'+format;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
