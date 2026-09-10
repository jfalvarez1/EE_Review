#!/usr/bin/env node
'use strict';
const assert=require('assert');const {render}=require('./test-diagram-geometry');
const on=(p,s)=>s.x1===s.x2?p[0]===s.x1&&p[1]>=Math.min(s.y1,s.y2)&&p[1]<=Math.max(s.y1,s.y2):p[1]===s.y1&&p[0]>=Math.min(s.x1,s.x2)&&p[0]<=Math.max(s.x1,s.x2);
function connected(s,a,b){
    const segs=[...s.segmentRegistry.segments.values()],points=[a],seen=new Set();
    while(points.length){const p=points.pop();if(p[0]===b[0]&&p[1]===b[1])return true;
        segs.forEach((seg,i)=>{if(!seen.has(i)&&on(p,seg)){seen.add(i);points.push([seg.x1,seg.y1],[seg.x2,seg.y2]);for(const other of segs)for(const t of [[other.x1,other.y1],[other.x2,other.y2]])if(on(t,seg))points.push(t);if(on(b,seg))points.push(b);}});
    }return false;
}
function checkBoost(s){
    for(const [a,b] of [[[65,170],[145,85]],[[195,85],[260,160]],[[195,85],[350,85]],[[400,85],[450,170]],[[400,85],[550,170]],[[260,220],[65,290]],[[220,190],[160,220]]])assert(connected(s,a,b),`Missing boost net ${a} to ${b}`);
    for(const [a,b] of [[[65,170],[65,290]],[[195,85],[65,290]],[[195,85],[400,85]],[[220,190],[195,85]]])assert(!connected(s,a,b),`Shorted boost nets ${a} to ${b}`);
}
const f='lessons/module-14/lesson-04.html';checkBoost(render(f).figures.get('boost-schematic'));
const broken=render(f).figures.get('boost-schematic');broken.wire([[65,170],[65,290]]);assert.throws(()=>checkBoost(broken),/Shorted/);
const filter=render('lessons/module-25/lesson-15.html').figures.get('daq-antialias');
assert(connected(filter,[165,190],[365,65])); // R1/R2 junction -> feedback capacitor.
assert(connected(filter,[415,65],[565,175])); // Feedback capacitor -> op-amp output.
assert(connected(filter,[485,190],[400,250])); // Non-inverting input -> grounded capacitor.
assert(!connected(filter,[165,190],[485,190])); // R2 is not bypassed.
console.log('PASS - boost power/drive/return nets and Sallen–Key capacitor placement; an input-ground short is rejected.');
// Shared templates: exercise actual wire graphs, including the old bypass failure.
const stage=render('lessons/module-25/lesson-06.html').figures.get('motor-three-phase');
for(const x of [220,500,780]){assert(connected(stage,[90,60],[x,110]));assert(connected(stage,[x,170],[x,290]));assert(connected(stage,[x,220],[x+80,510]));assert(connected(stage,[x,350],[x,375]));assert(!connected(stage,[x,375],[x,425]));assert(!connected(stage,[x,110],[x,170]));}
const comp=render('lessons/module-13/lesson-07.html').figures.get('type3-template');
assert(connected(comp,[105,275],[140,175]));assert(connected(comp,[295,175],[465,275]));assert(connected(comp,[400,275],[460,120]));assert(connected(comp,[620,120],[545,290]));assert(!connected(comp,[140,275],[190,275]));assert(!connected(comp,[465,275],[545,290]));
const {context,document}=render('lessons/module-21/lesson-05.html');
for(let n=1;n<=5;n++){
 const components=Array.from({length:n},(_,i)=>({type:i%2?'L':'C',value:i%2?1e-8:1e-11}));
 const s=context.AD.Schematic.lcLadderTemplate(document.createElement('div'),components,50);
 for(let i=0;i<n;i++){const x=220+95*i;if(i%2)assert(!connected(s,[x,105],[x+50,105]),`Order ${n}: L${i} bypassed`);else assert(connected(s,[x,105],[x,190]));}
}
const rect=render('lessons/module-13/lesson-08.html').figures.get('bridge-rectifier-template');
assert(connected(rect,[250,220],[325,220]));assert(connected(rect,[375,220],[450,220]));assert(!connected(rect,[325,220],[375,220]));assert(!connected(rect,[700,80],[700,360]));
console.log('PASS - three-phase shunts/gates, Type III branches, LC orders 1–5 (no bypassed inductors) and rectifier AC/DC isolation.');
