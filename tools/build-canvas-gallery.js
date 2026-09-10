#!/usr/bin/env node
'use strict';
// Render remaining canvas diagrams through the real lesson loader, not the VM.
const fs=require('fs');
const inventory=JSON.parse(fs.readFileSync('_audit/circuit-inventory.json','utf8'));
const known=new Set(['cs-canvas','compensation-canvas','auto-protection-canvas','hall-physics-canvas','hall-architecture-canvas','pit-network-canvas','sensing-comparison-canvas','highside-csa-canvas','current-sense-canvas','automotive-led-canvas','esd-devices-canvas','inamp-canvas','antialiasing-canvas','boost-pfc-canvas','electrode-protection-canvas','bb-canvas','degen-canvas']);
const candidates=process.argv.includes('--candidates');
const figures=candidates?JSON.parse(fs.readFileSync('_audit/canvas-candidates.json','utf8')):inventory.flatMap(r=>r.canvas.filter(id=>process.argv.includes('--all')||known.has(id)||/schematic|architecture|circuit|protection|network|sensing/.test(id)).map(id=>({file:r.file,id})));
const output=candidates?'_audit/canvas-candidates.html':'_audit/canvas-gallery.html';
fs.writeFileSync(output,`<!doctype html><meta charset="utf-8"><title>Canvas circuit review</title><style>body{background:#0b0f16;color:#e6edf3;font:14px system-ui;margin:12px}header{display:flex;gap:10px;margin-bottom:16px}#grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}article{border:1px solid #405366;border-radius:8px;padding:8px;min-width:0}h3{font-size:12px}img{width:100%;max-height:280px;object-fit:contain}input{width:60px}</style><header><button id="load">Load canvas diagrams</button><span id="status"></span><button id="prev">Previous</button><input id="page" type="number" min="1" value="1"><button id="next">Next</button></header><div id="grid"></div><script>
const figures=${JSON.stringify(figures)},results=[];
function draw(){let p=Math.max(1,+document.querySelector('#page').value||1);document.querySelector('#grid').innerHTML=results.slice((p-1)*4,p*4).map(r=>'<article><h3>'+r.file+' · '+r.id+'</h3>'+(r.image?'<img alt="Rendered canvas '+r.id+'" src="'+r.image+'">':'<p>'+r.error+'</p>')+'</article>').join('');}
document.querySelector('#page').oninput=draw;document.querySelector('#prev').onclick=()=>{document.querySelector('#page').value=Math.max(1,+document.querySelector('#page').value-1);draw();};document.querySelector('#next').onclick=()=>{document.querySelector('#page').value=+document.querySelector('#page').value+1;draw();};
document.querySelector('#load').onclick=async()=>{
    results.length=0;const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:-1400px;top:0;width:1200px;height:850px;visibility:hidden';document.body.append(frame);
    let previousFile=null;
    for(const f of figures){
        const m=f.file.match(/module-(\\d+)\\/lesson-(\\d+)/),hash='module-'+(+m[1])+'/lesson-'+(+m[2]);
        if(previousFile!==f.file){frame.src='../index.html?canvas-audit='+Date.now()+'#'+hash;previousFile=f.file;}
        try{
            await new Promise((resolve,reject)=>{let n=0;const poll=()=>{const doc=frame.contentDocument,cv=doc&&doc.getElementById(f.id),lesson=doc&&doc.querySelector('.lesson-content[data-module="'+(+m[1])+'"][data-lesson="'+(+m[2])+'"]');if(cv&&doc.URL.endsWith('#'+hash)){requestAnimationFrame(()=>requestAnimationFrame(resolve));return;}if(++n>120){reject(new Error('Canvas did not load'));return;}setTimeout(poll,100);};poll();});
            results.push({...f,image:frame.contentDocument.getElementById(f.id).toDataURL()});
        }catch(e){results.push({...f,error:e.message});}
        document.querySelector('#status').textContent=results.length+'/'+figures.length+' loaded · '+results.filter(r=>r.error).length+' failures';draw();
    }
    frame.remove();
};</script>`);
console.log('Canvas review: '+figures.length+' figures in '+output);
