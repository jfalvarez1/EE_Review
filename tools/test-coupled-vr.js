#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { pair, interleaving } = require('../assets/coupled-vr-model');
const near = (a,b,tol=1e-9) => assert(Math.abs(a-b) < tol, `${a} != ${b}`);
const base = {vin:12,vout:1.2,fsw:600e3,ltr:75e-9,load:40};
const plain = pair({...base,rho:0});
const coupled = pair({...base,rho:-0.5});
near(plain.phaseRipple,24);near(coupled.phaseRipple,136/9);
near(coupled.sumRipple,64/3);near(coupled.L,150e-9,1e-18);
near(coupled.M,-75e-9,1e-18);
near(interleaving(0.1,8),2/9);near(interleaving(0.1,10),0);

// Independent reference: sum N uncoupled triangular currents at switching edges.
function sumRipple(d,n) {
    const phase = t => {const u=((t%1)+1)%1;return u<d ? (1-d)*u : d*(1-u);};
    const edges = [0,1];
    for(let j=0;j<n;j++) edges.push(j/n,(j/n+d)%1);
    const sums=edges.map(t=>Array.from({length:n},(_,j)=>phase(t-j/n)).reduce((a,b)=>a+b,0));
    return (Math.max(...sums)-Math.min(...sums))/(d*(1-d));
}
let points=0;
for(const d of [0.01,0.1,0.3,0.5,0.63,0.9,0.99]) {
    for(const n of [1,2,3,8,10,20]) near(interleaving(d,n),sumRipple(d,n),1e-10);
    for(const rho of [-0.75,-0.5,0,0.5]) {
        const p=pair({...base,vout:base.vin*d,rho});
        near(p.closure[0],0);near(p.closure[1],0);
        near(p.sumRipple,base.vin*d*(1-d)/(base.ltr*base.fsw)*interleaving(d,2));
        assert(p.L+p.M>0 && p.L-p.M>0, 'Both magnetic modes must store positive energy');
        let avgA=0,avgB=0;
        for(let i=1;i<p.states.length;i++) {
            const a=p.states[i-1],b=p.states[i],dt=b.t-a.t;
            avgA+=(a.a+b.a)*dt/2;avgB+=(a.b+b.b)*dt/2;
            const da=(b.a-a.a)*base.fsw/dt,db=(b.b-a.b)*base.fsw/dt,mid=(a.t+b.t)/2;
            near(p.L*da+p.M*db,(mid<d?base.vin:0)-base.vin*d);
            near(p.M*da+p.L*db,((mid+0.5)%1<d?base.vin:0)-base.vin*d);
        }
        near(avgA,base.load/2);near(avgB,base.load/2);
        assert(p.waves.flat().every(Number.isFinite));points++;
    }
}
for(const rho of [-1,1,NaN]) assert.throws(()=>pair({...base,rho}));
assert.throws(()=>pair({...base,rho:0,vout:13}));
assert.throws(()=>interleaving(0.2,2.5));
assert(pair({...base,rho:0,load:1}).minimum<0, 'Forced-PWM/DCM warning must be reachable');
console.log(`PASS - coupled VR: ${points} magnetic operating points, interval equations, energy, mean current, periodicity and independent interleaving reference.`);
