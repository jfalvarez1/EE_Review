'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/data/protocol');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
const rows={};
for(const [name,r] of Object.entries(manifest.runs)){
    assert.strictEqual(hash(path.join(root,'docs/examples',name+'.cir')),r.deck_sha256);
    assert.strictEqual(hash(path.join(root,'docs/examples',name+'-fine.cir')),r.fine_run.deck_sha256);
    const file=path.join(dir,name+'.csv');assert.strictEqual(hash(file),r.csv_sha256);
    assert(r.simulator.includes('LTspice 26.1.1'));
    assert(Math.max(...Object.values(r.voltage_convergence_V))<.0014);
    const data=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1).map(l=>l.split(',').map(Number));
    assert.strictEqual(data.length,r.points);
    data.forEach((row,i)=>{assert(row.every(Number.isFinite));if(i)assert(row[0]>=data[i-1][0]);});
    rows[name]=data;
}
const near=(a,b,tol)=>assert(Math.abs(a-b)<tol,`${a} vs ${b}`);
const sample=(name,t)=>rows['protocol-'+name].reduce((best,r)=>Math.abs(r[0]-t)<Math.abs(best[0]-t)?r:best);
// Independent KCL: opposing output resistances plus a weak 1 Mohm pulldown.
for(const [name,lo] of [['balanced',22.01],['unequal',66.01]]){
    const r=sample(name,4e-6),v=3.3/(1+22.01/lo+22.01/1e6);
    near(r[1],v,1e-6);near(r[2],(3.3-v)/22.01,1e-8);
    for(const row of rows['protocol-'+name])assert(row[1]>-1e-6&&row[1]<3.300001);
}
near(sample('open-drain',3e-6)[1],3.3*22.01/(2200+22.01),1e-6);
near(sample('open-drain',5e-6)[1],3.3*11.005/(2200+11.005),1e-6);
// Compare the transient against an independent analytical second-order response,
// integrating that step response over the actual finite source ramp.
const L=100e-9,C=100e-12,R=20,alpha=R/(2*L),wd=Math.sqrt(1/(L*C)-alpha*alpha);
const step=t=>t<=0?0:1-Math.exp(-alpha*t)*(Math.cos(wd*t)+alpha/wd*Math.sin(wd*t));
let analyticalError=0;
for(const r of rows['protocol-ringing']){
    const n=100,dt=2e-9/n;
    let integral=0;for(let j=0;j<n;j++)integral+=step(r[0]-50e-9-(j+.5)*dt)/n;
    analyticalError=Math.max(analyticalError,Math.abs(r[1]-3.3*(1-integral)));
}
assert(analyticalError<.001,analyticalError); // <0.031% of the 3.3 V step.
console.log('Independent RLC ramp solution: maximum difference '+(analyticalError*1000).toFixed(3)+' mV');
assert(Math.min(...rows['protocol-ringing'].map(r=>r[1]))< -1.13);
assert(Math.min(...rows['protocol-damped'].map(r=>r[1]))> -.00001);
for(const r of rows['protocol-reference'])near(r[3],r[1]-r[2],1e-10);
for(const [index,res] of [[2,1e5],[3,1e4]]){
    const r=sample('released',12.005e-6),initial=3.3*res/(res+22.01);
    near(r[index],initial*Math.exp(-(r[0]-2.005e-6)/(res*100e-12)),.0002);
}
const native=JSON.parse(fs.readFileSync(path.join(dir,'native-checks.json'),'utf8'));
assert.strictEqual(hash(path.join(root,'docs/examples/protocol-ringing-native.asc')),native.asc_sha256);
assert(native.maximum_difference_from_csv_V<1e-6);
console.log('Protocol evidence: 16 LTspice runs, CSV/deck hashes, KCL, RLC solution, Hi-Z decay and native schematic verified');
