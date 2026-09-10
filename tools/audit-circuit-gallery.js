#!/usr/bin/env node
'use strict';
// Review every lesson, including drawings which do not use AD.Schematic.
// This is an inventory and diagnostic report, not a claim of electrical proof.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createLessonContext, extractScripts } = require('./validate-schematics');
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function serialize(el) {
    const attrs = [...el.attributes].map(([k,v]) => ` ${k}="${escape(v)}"`).join('');
    const tag = el.tagName.toLowerCase();
    return `<${tag}${attrs}>${escape(el.textContent || '')}${el.innerHTML || ''}${(el.children || []).map(serialize).join('')}</${tag}>`;
}
function defaults(html, document) {
    for (const m of html.matchAll(/<input\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
        const el = document.getElementById(m[1]);
        for (const attr of ['value', 'min', 'max']) {
            const v = new RegExp('\\b' + attr + '="([^"]+)"').exec(m[0]);
            if (v) { el.setAttribute(attr, v[1]); if (attr === 'value') el.value = el.defaultValue = v[1]; }
        }
        el.checked = /\bchecked\b/.test(m[0]);
    }
    for (const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
        const opts = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
        const opt = opts.find(o => /\bselected\b/.test(o[1])) || opts[0];
        if (opt) document.getElementById(m[1]).value = (/\bvalue="([^"]*)"/.exec(opt[1]) || [null, opt[2]])[1];
    }
}
function scan(file) {
    const html = fs.readFileSync(file, 'utf8');
    const {context, document, runQueuedTasks} = createLessonContext(html);
    defaults(html, document);
    const native = new Map(), finalized = new Set(), builders = [], failures = [], figures = [];
    const finalize = context.AD.Schematic.Schematic.prototype.finalize;
    context.AD.Schematic.Schematic.prototype.finalize = function(opts) {
        finalized.add(this); return finalize.call(this, opts);
    };
    const create = context.AD.Schematic.create;
    context.AD.Schematic.create = (host, opts) => {
        const s = create(host, opts); native.set(host.id, s); return s;
    };
    const Builder = context.SchematicSVG;
    context.SchematicSVG = new Proxy(Builder, { construct(Target, args) {
        const b = new Target(...args); builders.push(b); return b;
    }});
    for (const lib of ['component-models.js', 'checkpoints.js']) {
        new vm.Script(fs.readFileSync('assets/' + lib, 'utf8')).runInContext(context);
    }
    for (const [i, script] of extractScripts(html).entries()) {
        try { new vm.Script(script, {filename:file}).runInContext(context, {timeout:2000}); }
        catch (e) { failures.push({script:i+1, message:e.message}); }
    }
    try { runQueuedTasks(); } catch (e) { failures.push({message:'queued: ' + e.message}); }
    for (const s of finalized) {
        const host = [...document._byId].find(([, el]) => el.children?.includes(s.svg));
        if (host) native.set(host[0], s);
    }
    for (const [id, s] of native) {
        const r = s.finalize({validate:true});
        figures.push({id, type:'AD.Schematic', svg:serialize(s.svg), findings:[...r.errors,...r.warnings]});
    }
    for (const [i, b] of builders.entries()) {
        const svg = b.render();
        const host = [...document._byId].find(([,el])=>el.innerHTML === svg);
        const id = host ? host[0] : b._containerEl?.id || 'builder-' + (i+1);
        figures.push({id, type:'SchematicSVG', svg, findings:[]});
    }
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    for (const [i, m] of [...markup.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)].entries()) {
        figures.push({id:'literal-' + (i+1), type:'literal SVG', svg:m[0], findings:[]});
    }
    // Dynamic literal SVGs, including figures produced through innerHTML.
    for (const [id, el] of document._byId) {
        for (const m of (el.innerHTML || '').matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi)) {
            if (!figures.some(f=>f.svg === m[0])) figures.push({id,type:'dynamic SVG',svg:m[0],findings:[]});
        }
    }
    const canvas = [...html.matchAll(/<canvas\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
    const canvasInk=canvas.map(id=>({id,texts:document.getElementById(id).getContext('2d').operations.filter(op=>/^(fill|stroke)Text\(/.test(op)).map(op=>op.replace(/^(fill|stroke)Text\(/,'').replace(/,[^,]*,[^,]*\)$/,''))}));
    return {file, title:(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html)||[])[1]||file, failures, canvas, canvasInk, figures};
}
function main() {
    const files = fs.readdirSync('lessons',{recursive:true}).filter(f=>f.endsWith('.html')).sort().map(f=>'lessons/'+f.replace(/\\/g,'/'));
    const report=[];
    for (const file of files) { report.push(scan(file)); if (global.gc) global.gc(); }
    fs.mkdirSync('_audit', {recursive:true});
    fs.writeFileSync('_audit/circuit-inventory.json',JSON.stringify(report.map(r=>({...r,figures:r.figures.map(({svg,...f})=>f)})),null,2));
    const all=report.flatMap(r=>r.figures.map(f=>({...f,file:r.file,title:r.title})));
    const data=JSON.stringify(all).replace(/</g,'\\u003c');
    fs.writeFileSync('_audit/circuit-gallery.html',`<!doctype html><html><head><meta charset="utf-8"><title>Circuit review gallery</title><link rel="stylesheet" href="../assets/styles.css"><style>body{margin:0;padding:12px;background:#0b0f16;color:#e6edf3;display:block}header{display:flex;gap:12px;align-items:center;position:sticky;top:0;background:#0b0f16;padding:8px;z-index:2}input{width:300px}#grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.item{border:1px solid #405366;border-radius:8px;padding:8px;min-width:0}.item h3{font-size:13px;margin:0 0 4px}.drawing{height:300px;display:flex;align-items:center;justify-content:center;overflow:auto}.drawing>svg{max-width:100%;max-height:100%!important;min-height:0!important;width:100%!important;height:auto!important}.meta{font:11px monospace;color:#9fb0c0}#page{width:70px}</style></head><body><header><button id="prev">Previous</button><input id="page" type="number" min="1" value="1"><button id="next">Next</button><input id="filter" placeholder="Filter module, figure, renderer"><span id="count"></span></header><div id="grid"></div><script src="../assets/schematic-normalize.js?audit=${Date.now()}"></script><script>const data=${data};let selected=data;function draw(){const p=Math.max(1,+document.getElementById('page').value||1);document.getElementById('count').textContent=selected.length+' figures · '+Math.ceil(selected.length/4)+' pages';document.getElementById('grid').innerHTML=selected.slice((p-1)*4,p*4).map((f,i)=>'<section class="item"><h3>'+f.file+' · '+f.id+'</h3><div class="meta">'+f.type+' · '+f.findings.length+' diagnostics</div><div class="drawing">'+f.svg.replace(/id="([^"]+)"/g,(_,id)=>'id="g'+i+'-'+id+'"').replace(/url\\(#([^)]+)\\)/g,(_,id)=>'url(#g'+i+'-'+id+')')+'</div></section>').join('');SchematicNormalizer.run(document.getElementById('grid'));}document.getElementById('filter').oninput=e=>{selected=data.filter(f=>(f.file+' '+f.id+' '+f.type+' '+f.title).toLowerCase().includes(e.target.value.toLowerCase()));document.getElementById('page').value=1;draw();};document.getElementById('page').oninput=draw;document.getElementById('prev').onclick=()=>{document.getElementById('page').value=Math.max(1,+document.getElementById('page').value-1);draw();};document.getElementById('next').onclick=()=>{document.getElementById('page').value=+document.getElementById('page').value+1;draw();};draw();</script><script src="../tools/circuit-gallery-client.js?audit=${Date.now()}"></script></body></html>`);
    console.log(JSON.stringify({lessons:report.length,figures:all.length,renderers:all.reduce((o,f)=>(o[f.type]=(o[f.type]||0)+1,o),{}),nativeFindings:all.reduce((n,f)=>n+f.findings.length,0),exceptions:report.filter(r=>r.failures.length).map(r=>({file:r.file,errors:r.failures})),output:'_audit/circuit-gallery.html'},null,2));
}
if(require.main===module)main();
module.exports={scan,defaults};
