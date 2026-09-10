// Ideal two-phase CCM/forced-PWM magnetics model. No controller or core-loss model.
(function(root) {
    'use strict';
    function interleaving(d, n) {
        if (!(d > 0 && d < 1 && Number.isInteger(n) && n >= 1)) throw new Error('Require 0 < D < 1 and integer N >= 1');
        const x = n * d, m = Math.floor(x);
        return Math.max(0, (m + 1 - x) * (x - m) / (n * d * (1 - d)));
    }
    function pair({vin, vout, fsw, ltr, rho, load = 40, samples = 480}) {
        if (![vin,vout,fsw,ltr,rho,load].every(Number.isFinite) || !(vin > vout && vout > 0 && fsw > 0 && ltr > 0 && rho > -1 && rho < 1 && load >= 0)) throw new Error('Invalid two-winding operating point');
        const d = vout / vin, L = ltr / (1 + rho), M = rho * L, det = L * L - M * M;
        const edges = [...new Set([0,d,0.5,(0.5+d)%1,1])].sort((a,b)=>a-b);
        const states = [{t:0,a:0,b:0}];
        for (let j=1;j<edges.length;j++) {
            const t0=edges[j-1],t1=edges[j],mid=(t0+t1)/2;
            const v1=(mid<d?vin:0)-vout, v2=(((mid+0.5)%1)<d?vin:0)-vout;
            const p=states[states.length-1],dt=(t1-t0)/fsw;
            states.push({t:t1,a:p.a+(L*v1-M*v2)/det*dt,b:p.b+(L*v2-M*v1)/det*dt});
        }
        let meanA=0,meanB=0;
        for(let j=1;j<states.length;j++) {
            const p=states[j-1],q=states[j],dt=q.t-p.t;
            meanA+=(p.a+q.a)/2*dt; meanB+=(p.b+q.b)/2*dt;
        }
        for(const p of states) { p.a+=load/2-meanA; p.b+=load/2-meanB; }
        const pp=a=>Math.max(...a)-Math.min(...a);
        const a=states.map(p=>p.a),b=states.map(p=>p.b),sum=states.map(p=>p.a+p.b);
        const waves=[[],[],[]];
        for(let j=0;j<=samples;j++) {
            const t=j/samples;
            let k=1;while(k<states.length-1&&states[k].t<t)k++;
            const p=states[k-1],q=states[k],f=(t-p.t)/(q.t-p.t);
            const i1=p.a+f*(q.a-p.a),i2=p.b+f*(q.b-p.b);
            waves[0].push(i1);waves[1].push(i2);waves[2].push(i1+i2);
        }
        return {d,L,M,ltr,ldiff:L-M,states,waves,phaseRipple:pp(a),sumRipple:pp(sum),minimum:Math.min(...a,...b),closure:[states.at(-1).a-states[0].a,states.at(-1).b-states[0].b]};
    }
    const api={pair,interleaving};
    if(typeof module==='object'&&module.exports)module.exports=api;
    else root.CoupledVR=api;
})(typeof window!=='undefined'?window:this);
