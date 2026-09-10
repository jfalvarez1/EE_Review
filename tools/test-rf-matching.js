#!/usr/bin/env node
'use strict';
const assert=require('assert'),m=require('../assets/rf-matching');
const {render,issues}=require('./test-diagram-geometry');
const near=(a,b,t=1e-8)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
let count=0;
for(const Rs of [10,50,200])for(const Rl of [10,150,500])for(const f of [1e6,433e6,3e9])for(const type of ['lowpass','highpass']){
    const r=m.design(Rs,Rl,f,type),z=m.inputZ(r);
    near(z[0],Rs);near(z[1],0);assert(m.returnLoss(r)>240);assert.equal(r.shuntAtSource,Rs>Rl);
    if(Rs!==Rl){assert(r.L>0&&r.C>0);const reverse=m.design(Rl,Rs,f,type);near(r.L,reverse.L,1e-18);near(r.C,reverse.C,1e-20);}
    for(const k of [.25,.5,1,2,4])assert(m.returnLoss(r,r.L,r.C,k*f)>=0);
    count++;
}
// ADI published example: 50 ohms to 1 kohm at 100 MHz.
const example=m.design(50,1000,100e6);near(example.Q,Math.sqrt(19));near(example.C*1e12,6.937403133,1e-8);
const r=m.design(50,150,433e6);near(m.e24(r.L)*1e9,27);near(m.e24(r.C)*1e12,3.6);near(m.returnLoss(r,27e-9,3.6e-12),26.8081961864,1e-8);
assert.throws(()=>m.design(0,100,1e6),RangeError);
// A topology which ignores source/load reversal must fail the match.
const wrong={...m.design(200,50,433e6),shuntAtSource:false};assert(m.returnLoss(wrong)<10);
// Render endpoint/equal-resistance states and both reactive arrangements.
const file='lessons/module-21/lesson-01.html';
for(const [Rs,Rl,type,values] of [[200,10,'highpass','ideal'],[50,50,'lowpass','e24'],[10,500,'lowpass','e24'],[200,150,'highpass','e24']]){
    const page=render(file,html=>html.replace(/(id="match-rs"[^>]*value=")[^"]+/,`$1${Rs}`).replace(/(id="match-rl"[^>]*value=")[^"]+/,`$1${Rl}`).replace(`value="${type}"`,`value="${type}" selected`).replace(`value="${values}"`,`value="${values}" selected`));
    assert.equal(issues(page.figures.get('match-schematic')).length,0);
}
console.log(`PASS - ${count} RF matching cases, published reference example, reversed/equal terminations and rendered control endpoints.`);
