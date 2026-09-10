// Lossless lumped L match between positive, purely resistive terminations.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RFMatch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
    const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
    const div=(a,b)=>{const d=b[0]*b[0]+b[1]*b[1];return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];};
    const parallel=(a,b)=>div(mul(a,b),add(a,b));
    function design(Rs,Rl,f,type='lowpass'){
        if(![Rs,Rl,f].every(v=>Number.isFinite(v)&&v>0)||!['lowpass','highpass'].includes(type))throw new RangeError('Positive resistances and frequency, and a supported topology, are required');
        const low=Math.min(Rs,Rl),high=Math.max(Rs,Rl),Q=Math.sqrt(high/low-1),w=2*Math.PI*f;
        if(Q===0)return {Rs,Rl,f,type,Q,L:0,C:0,bypass:true,shuntAtSource:false};
        const xs=Q*low,xp=high/Q;
        return {Rs,Rl,f,type,Q,L:(type==='lowpass'?xs:xp)/w,C:1/(w*(type==='lowpass'?xp:xs)),shuntAtSource:Rs>Rl,bypass:false};
    }
    function inputZ(r,L=r.L,C=r.C,f=r.f){
        if(r.bypass)return [r.Rl,0];
        const w=2*Math.PI*f,zl=[0,w*L],zc=[0,-1/(w*C)],series=r.type==='lowpass'?zl:zc,shunt=r.type==='lowpass'?zc:zl;
        return r.shuntAtSource?parallel(shunt,add(series,[r.Rl,0])):add(series,parallel(shunt,[r.Rl,0]));
    }
    function reflection(z,z0){return div(add(z,[-z0,0]),add(z,[z0,0]));}
    function returnLoss(r,L=r.L,C=r.C,f=r.f){const g=Math.hypot(...reflection(inputZ(r,L,C,f),r.Rs));return g<1e-14?Infinity:-20*Math.log10(g);}
    function e24(v){if(!(v>0))return 0;const d=10**Math.floor(Math.log10(v)),m=v/d;return [1,1.1,1.2,1.3,1.5,1.6,1.8,2,2.2,2.4,2.7,3,3.3,3.6,3.9,4.3,4.7,5.1,5.6,6.2,6.8,7.5,8.2,9.1,10].reduce((best,c)=>Math.abs(Math.log(c/m))<Math.abs(Math.log(best/m))?c:best,1)*d;}

    // Bessel poles: scipy.signal.besselap(n, norm="mag"), orders 1–7.
    // Reproduction/independent response checks: tools/test-rf-filter-models.js.
    const besselPoles={"1":[[-0.9999999999999993,0.0]],"2":[[-1.1016013305921613,0.6360098247570343],[-1.1016013305921613,-0.6360098247570343]],"3":[[-1.0474091610089349,0.999264436280637],[-1.3226757999104441,0.0],[-1.0474091610089349,-0.999264436280637]],"4":[[-0.9952087643502722,1.2571057394546645],[-1.3700678305514427,0.4102497174937515],[-1.3700678305514427,-0.4102497174937515],[-0.9952087643502722,-1.2571057394546645]],"5":[[-0.9576765485626808,1.4711243207303935],[-1.380877325860438,0.7179095876267678],[-1.5023162714474771,0.0],[-1.380877325860438,-0.7179095876267678],[-0.9576765485626808,-1.4711243207303935]],"6":[[-0.9306565229468591,1.6618632689425918],[-1.3818580975965642,0.9714718907115716],[-1.5714904036160318,0.320896374222624],[-1.5714904036160318,-0.320896374222624],[-1.3818580975965642,-0.9714718907115716],[-0.9306565229468591,-1.6618632689425918]],"7":[[-0.9098677806234717,1.8364513530363968],[-1.378903216795477,1.1915667778006545],[-1.6120387662261275,0.5892445069314727],[-1.6843681792731837,0.0],[-1.6120387662261275,-0.5892445069314727],[-1.378903216795477,-1.1915667778006545],[-0.9098677806234717,-1.8364513530363968]]};
    function lowpass(type,n,w){
        if(!Number.isInteger(n)||n<1||n>7||!['butterworth','chebyshev','bessel'].includes(type)||!Number.isFinite(w)||w<0)throw new RangeError('Unsupported normalized prototype');
        const eps=Math.sqrt(10**.05-1),mu=Math.asinh(1/eps)/n;
        const poles=type==='bessel'?besselPoles[n]:Array.from({length:n},(_,k)=>{const a=Math.PI*(2*k+1)/(2*n);return type==='butterworth'?[-Math.sin(a),Math.cos(a)]:[-Math.sinh(mu)*Math.sin(a),Math.cosh(mu)*Math.cos(a)];});
        let db=type==='chebyshev'&&n%2===0?-.5:0,phase=0,delay=0;
        for(const [a,b] of poles){db+=20*Math.log10(Math.hypot(a,b)/Math.hypot(a,w-b));phase+=Math.atan2(-b,-a)-Math.atan2(w-b,-a);delay+=-a/(a*a+(w-b)*(w-b));}
        return {db,phase:phase*180/Math.PI,delay}; // delay in 1/(normalizing rad/s)
    }
    function degeneration(f,gm,Cgs,R){
        if(![f,gm,Cgs,R].every(x=>Number.isFinite(x)&&x>0))throw new RangeError('Positive LNA design inputs required');
        const w=2*Math.PI*f,wt=gm/Cgs,Ls=R/wt,Lg=1/(w*w*Cgs)-Ls;
        return {Ls,Lg,ft:wt/(2*Math.PI),realizable:Lg>=0};
    }
    return {design,inputZ,reflection,returnLoss,e24,lowpass,degeneration};
});
