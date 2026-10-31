'use strict';
const assert=require('assert');
const p=require('../assets/pdn-layout-model');
const near=(a,b)=>assert(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
// Independent rectangular-admittance calculation, including the shared series path.
for(const f of [1e3,1e5,1e6,3e6,1e7,1e8]){
    let g=0,b=0;
    for(const c of [10e-6,1e-6,.1e-6]){const x=2*Math.PI*f*1e-9-1/(2*Math.PI*f*c),d=.01**2+x*x;g+=.01/d;b-=x/d;}
    const z=p.bank(f,[10e-6,1e-6,.1e-6],.01,1e-9,.2e-9);
    near(z.re,g/(g*g+b*b));near(z.im,-b/(g*g+b*b)+2*Math.PI*f*.2e-9);
    const one=p.branch(f,10e-6,.01,1e-9),three=p.bank(f,[10e-6,10e-6,10e-6],.01,1e-9);
    near(three.re,one.re/3);near(three.im,one.im/3);
}
const f=3.5e6,caps=[10e-6,1e-6,.1e-6];
const wrong=1/caps.reduce((a,c)=>a+1/p.abs(p.branch(f,c,.01,1e-9)),0);
assert(p.abs(p.bank(f,caps,.01,1e-9))>2*wrong,'Magnitude-parallel regression must expose antiresonance');
near(p.compare({retention:.5})[1].total,5.55e-6);
near(p.abs(p.bank(1e3,[10e-6],.01,0)),p.abs(p.branch(1e3,10e-6,.01,0)));
assert.throws(()=>p.bank(0,[1e-6],.01,1e-9),RangeError);
assert.throws(()=>p.compare({retention:0}),RangeError);
// Independent worked-example arithmetic used in the lessons.
near(8*Math.sqrt((1/12)*(11/12)),2.211083193570267);
near(2/(8*1e6*22e-6)*1000,11.363636363636363);
near(100e-6*3.3/.001,.33);
console.log('PDN: complex-bank, shared-path, derating and worked-example checks pass');
// Retained external solver evidence must continue to agree with the browser model.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const manifest=require('../docs/data/pdn/manifest.json');
for(const [name,caps,shared] of [
    ['bank-a',[10e-6,10e-6,10e-6],0],['bank-b',[10e-6,1e-6,.1e-6],0],
    ['bank-c',[3.7e-6,3.7e-6,3.7e-6],0],['shared-02',[10e-6,10e-6,10e-6],.2e-9],
    ['shared-05',[10e-6,10e-6,10e-6],.5e-9]]){
    const rows=fs.readFileSync(path.join(root,'docs/data/pdn/pdn-'+name+'.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(r=>r.split(',').map(Number));
    assert.strictEqual(rows.length,1001);
    for(const [f,re,im,mag] of rows){const z=p.bank(f,caps,.01,1e-9,shared);assert(Math.hypot(z.re-re,z.im-im)/mag<1e-9);}
}
for(const [name,record] of Object.entries(manifest.runs)){
    const deck=fs.readFileSync(path.join(root,'docs/examples/pdn-'+name+'.cir'),'utf8').replace(/\r\n/g,'\n');
    assert.strictEqual(crypto.createHash('sha256').update(deck).digest('hex'),record.deck_sha256,'Simulation deck changed without rerunning: '+name);
    if(record.fine_run){
        const fine=fs.readFileSync(path.join(root,'docs/examples/pdn-'+name+'-fine.cir'),'utf8').replace(/\r\n/g,'\n');
        assert.strictEqual(crypto.createHash('sha256').update(fine).digest('hex'),record.fine_run.deck_sha256);
        assert(record.max_timestep_difference_V<.002);
        const rows=fs.readFileSync(path.join(root,'docs/data/pdn/pdn-'+name+'.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(r=>r.split(',').map(Number));
        assert.strictEqual(rows.length,record.points);near(Math.min(...rows.map(r=>r[1])),record.min_load_V);near(Math.max(...rows.map(r=>r[1])),record.max_load_V);
    }
}
console.log('PDN evidence: 5,005 LTspice AC samples, five transient exports and 15 circuit hashes verified');
for(const [name,check] of Object.entries(require('../docs/data/pdn/native-checks.json'))){
    const asc=fs.readFileSync(path.join(root,'docs/examples/'+name+'.asc'),'utf8').replace(/\r\n/g,'\n');
    assert.strictEqual(crypto.createHash('sha256').update(asc).digest('hex'),check.asc_sha256,'Native drawing changed without simulation: '+name);
    if(check.max_relative_complex_error!==undefined) assert(check.max_relative_complex_error<1e-9);
    if(check.max_interpolated_voltage_difference_V!==undefined) assert(check.max_interpolated_voltage_difference_V<.002);
}
console.log('PDN native drawings: verified schematic hashes and LTspice-to-CSV comparison tolerances');
