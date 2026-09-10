#!/usr/bin/env node
'use strict';
const assert=require('assert'),M=require('../assets/rf-matching');
const ref=require('./fixtures/rf-lowpass-reference.json');
const near=(a,b,t=1e-8)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
for(const c of ref.cases){const r=M.lowpass(c.type,c.n,c.w);near(r.db,c.db);near(Math.sin(r.phase*Math.PI/180),Math.sin(c.phase));near(Math.cos(r.phase*Math.PI/180),Math.cos(c.phase));near(r.delay,c.delay);const h=1e-6;near(-(M.lowpass(c.type,c.n,c.w+h).phase-M.lowpass(c.type,c.n,c.w-h).phase)*Math.PI/180/(2*h),r.delay,1e-7);}
for(let n=1;n<=7;n++){near(M.lowpass('butterworth',n,1).db,-10*Math.log10(2));near(M.lowpass('bessel',n,1).db,-10*Math.log10(2));near(M.lowpass('chebyshev',n,0).db,n%2?0:-.5);}
const d=M.degeneration(1e9,.02,1e-12,50);near(d.Ls,2.5e-9,1e-20);near((d.Ls+d.Lg)*(2*Math.PI*1e9)**2*1e-12,1);assert(d.realizable);assert(!M.degeneration(10e9,.02,1e-12,50).realizable);
assert.throws(()=>M.lowpass('bessel',2,Infinity),RangeError);
console.log(`PASS - ${ref.cases.length} independent analog-filter response fixtures, continuous phase/group delay, cutoff normalization and LNA realizability.`);
