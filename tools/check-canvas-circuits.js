#!/usr/bin/env node
'use strict';
// Exhaustive inventory, not a heuristic. The old scan stopped at the next DOM
// lookup and ignored any block that also plotted a graph, missing mixed figures.
// Every new canvas now requires review, even if its id/text resembles a plot.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),reviewed=new Set(require('./fixtures/reviewed-canvases.json')),found=[];
for(const file of fs.readdirSync(path.join(root,'lessons'),{recursive:true}).filter(f=>f.endsWith('.html'))){
 const rel='lessons/'+file.replace(/\\/g,'/'),html=fs.readFileSync(path.join(root,rel),'utf8');
 for(const m of html.matchAll(/<canvas\b[^>]*\bid="([^"]+)"/gi))found.push(rel+'#'+m[1]);
}
const added=found.filter(k=>!reviewed.has(k)),removed=[...reviewed].filter(k=>!found.includes(k));
if(process.argv.includes('--all'))console.log(found.join('\n'));
if(added.length||removed.length){console.error('Canvas review inventory changed. Render with tools/audit-circuit-gallery.js and tools/build-canvas-gallery.js --all, inspect new/mixed drawings, and update reviewed-canvases.json.\nAdded: '+added.join(', ')+'\nRemoved: '+removed.join(', '));process.exit(1);}
console.log(`PASS - all ${found.length} canvas elements accounted for; no plotting or name-based exemptions.`);
