/* Lumped, small-signal teaching model. No package or PCB parasitic is inferred. */
(function (root) {
    'use strict';
    const inv = z => { const d = z.re * z.re + z.im * z.im; return { re: z.re / d, im: -z.im / d }; };
    const abs = z => Math.hypot(z.re, z.im);
    function branch(f, c, r, l) {
        if (!(f > 0 && c > 0 && r > 0 && l >= 0)) throw new RangeError('Positive frequency, capacitance and ESR; nonnegative inductance required');
        return { re: r, im: 2 * Math.PI * f * l - 1 / (2 * Math.PI * f * c) };
    }
    function bank(f, caps, r, l, shared = 0) {
        if (!caps.length || !(shared >= 0)) throw new RangeError('Nonempty bank and nonnegative shared inductance required');
        const y = caps.map(c => inv(branch(f, c, r, l))).reduce((a,b) => ({ re:a.re+b.re, im:a.im+b.im }), {re:0,im:0});
        const z = inv(y);
        return { re:z.re, im:z.im + 2 * Math.PI * f * shared };
    }
    function compare({retention=1, esr=.01, mounted=1e-9, shared=0}={}) {
        if (!(retention > 0 && retention <= 1)) throw new RangeError('Retention must be in (0,1]');
        return [
            {label:'A: 3 × 10 µF', caps:[10e-6,10e-6,10e-6]},
            {label:'B: 10 / 1 / 0.1 µF', caps:[10e-6,1e-6,.1e-6]},
            {label:'C: 3 × 3.7 µF', caps:[3.7e-6,3.7e-6,3.7e-6]}
        ].map(x => ({...x, total:x.caps.reduce((a,b)=>a+b)*retention,
            z:f=>bank(f,x.caps.map(c=>c*retention),esr,mounted,shared)}));
    }
    const api = { inv, abs, branch, bank, compare };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.PDN = api;
    if (!root.AD) return;
    const S = root.AD.Schematic;
    function make(host,w,h) { const el=document.getElementById(host);el.classList.add('pdn-drawing');return S.create(el,{width:w,height:h}); }
    function block(s,x,y,w,h,label,ports) {
        s.rect(x,y,w,h,{fill:'none',stroke:'#6ee7ff'});s.text(x+w/2,y+h/2,label,{size:14,bold:true});
        ports.forEach(([px,py,t,dx,dy])=>{s.nodeRegistry.register(px,py,null,'pin');if(t)s.text(px+dx,py+dy,t,{size:11});});
    }
    api.bankDiagram = function(host,shared=false) {
        const s=make(host,800,420);
        s.voltageSource(65,220,'vertical',{label:'VAC',value:'AC 1 V'});
        s.wire([[65,220],[65,80],[120,80]]);
        if(shared)s.inductor(120,80,'horizontal',{label:'Lshared'});else s.wire([[120,80],[170,80]]);
        s.wire([[170,80],[700,80]]);s.nodeLabel(65,80,'Port',{dy:-25});s.wire([[65,270],[65,370]]);s.ground(65,370);
        [300,500,700].forEach((x,i)=>{
            s.junction(x,80);s.wire([[x,80],[x,120]]);s.resistor(x,120,'vertical',{label:'R'+(i+1),value:'ESR'});
            s.wire([[x,170],[x,200]]);s.inductor(x,200,'vertical',{label:'L'+(i+1),value:'Mounted ESL'});
            s.wire([[x,250],[x,280]]);s.capacitor(x,280,'vertical',{label:'C'+(i+1),value:'Effective C'});
            s.wire([[x,330],[x,370]]);s.ground(x,370);
        });s.finalize();return s;
    };
    api.buckDiagram = function(host) {
        const s=make(host,1020,510);
        block(s,180,100,170,170,'Buck IC',[[180,145,'VIN',25,-15],[350,145,'SW',-20,-15],[350,230,'FB',-20,-15],[265,270,'PGND',0,-15]]);
        s.nodeLabel(60,90,'VIN',{dy:-20});s.wire([[60,90],[130,90],[130,145],[180,145]]);s.junction(130,145);
        s.capacitor(130,205,'vertical',{label:'Cin'});s.wire([[130,145],[130,205]]);s.wire([[130,255],[130,300],[265,300],[265,270]]);s.ground(130,300);
        s.wire([[350,145],[410,145]]);s.inductor(410,145,'horizontal',{label:'L'});s.wire([[460,145],[800,145]]);
        s.capacitor(540,205,'vertical',{label:'Cout'});s.wire([[540,145],[540,205]]);s.junction(540,145);s.wire([[540,255],[540,300]]);s.ground(540,300);
        s.resistor(800,145,'horizontal',{label:'Rpath'});s.wire([[850,145],[880,145]]);s.inductor(880,145,'horizontal',{label:'Lpath'});s.wire([[930,145],[980,145],[980,205]]);s.nodeLabel(980,145,'Load rail',{dy:-70,dx:-10,anchor:'end'});
        s.capacitor(980,205,'vertical',{label:'Clocal',labelDx:-65});s.wire([[980,255],[980,300]]);s.ground(980,300);
        s.nodeLabel(640,145,'VOUT sense',{dy:-25});s.junction(640,145);s.wire([[640,145],[640,205]]);s.resistor(640,205,'vertical',{label:'Rtop'});
        s.wire([[640,255],[640,350]]);s.resistor(640,350,'vertical',{label:'Rbot'});s.wire([[640,400],[640,450]]);s.ground(640,450);
        s.wire([[640,320],[400,320],[400,230],[350,230]]);s.junction(640,320);
        s.capacitor(740,205,'vertical',{label:'Cff'});s.wire([[640,180],[740,180],[740,205]]);s.junction(640,180);s.wire([[740,255],[740,320],[640,320]]);
        s.finalize();return s;
    };
    api.mountDiagram = function(host) {
        const s=make(host,810,370);
        block(s,300,70,220,210,'PMIC / BGA',[[300,125,'VIN',25,-15],[300,225,'PGND',35,-15],[520,125,'Rail B',-35,-15],[520,225,'PGND',-35,-15]]);
        s.capacitor(130,150,'vertical',{label:'Cin A'});s.wire([[130,150],[130,125],[300,125]]);s.wire([[130,200],[130,225],[300,225]]);
        s.capacitor(690,150,'vertical',{label:'Cin B'});s.wire([[690,150],[690,125],[520,125]]);s.wire([[690,200],[690,225],[520,225]]);
        s.nodeLabel(130,125,'Supply A',{dy:-45});s.nodeLabel(690,125,'Supply B',{dy:-45});
        s.junction(130,225);s.wire([[130,225],[130,300]]);s.ground(130,300);s.junction(690,225);s.wire([[690,225],[690,300]]);s.ground(690,300);
        s.finalize();return s;
    };
    api.distributionDiagram = function(host) {
        const s=make(host,960,460);
        s.voltageSource(70,200,'vertical',{label:'VREG',value:'1 V'});s.wire([[70,200],[70,80],[140,80]]);
        s.resistor(140,80,'horizontal',{label:'Rreg',value:'5 mΩ'});s.wire([[190,80],[380,80]]);
        s.resistor(380,80,'horizontal',{label:'Rpath',value:'5 mΩ'});s.wire([[430,80],[490,80]]);s.inductor(490,80,'horizontal',{label:'Lpath'});s.wire([[540,80],[850,80],[850,200]]);
        [[280,'Bulk','100 µF'],[660,'Local','Sweep C']].forEach(([x,label,value])=>{
            s.junction(x,80);s.wire([[x,80],[x,140]]);s.resistor(x,140,'vertical',{label:'ESR',value:'10 mΩ'});
            s.wire([[x,190],[x,220]]);s.inductor(x,220,'vertical',{label:'ESL',value:'1 nH'});
            s.wire([[x,270],[x,300]]);s.capacitor(x,300,'vertical',{label:label,value:value});s.wire([[x,350],[x,400]]);s.ground(x,400);
        });
        s.nodeLabel(660,80,'Load port',{dy:-45});s.currentSource(850,200,'vertical',{label:'Load',value:'0–4 A',direction:'down'});
        s.wire([[850,250],[850,400]]);s.ground(850,400);s.wire([[70,250],[70,400]]);s.ground(70,400);s.finalize();return s;
    };
    api.treeDiagram = function(host) {
        const s=make(host,900,410);
        block(s,60,140,140,100,'Input bus',[[200,190,'',0,0]]);
        block(s,330,50,230,90,'N-phase VR / TLVR',[[330,95,'',0,0],[560,95,'',0,0]]);
        block(s,330,245,230,90,'LDO',[[330,290,'',0,0],[560,290,'',0,0]]);
        block(s,680,50,170,90,'Core load',[[680,95,'',0,0]]);
        block(s,680,245,170,90,'Load switch',[[680,290,'',0,0],[765,335,'',0,0]]);
        s.wire([[200,190],[260,190],[260,95],[330,95]],{arrow:'end'});s.wire([[260,190],[260,290],[330,290]],{arrow:'end'});s.junction(260,190);
        s.wire([[560,95],[680,95]],{arrow:'end'});s.wire([[560,290],[680,290]],{arrow:'end'});s.wire([[765,335],[765,375]],{arrow:'end'});s.nodeLabel(765,375,'Switched domain',{dy:24});s.finalize();return s;
    };
    api.plot = function(canvas,curves) {
        root.AD.circuitPlot(canvas,{xMin:1e3,xMax:1e8,yMin:-3,yMax:curves.length>3?4:2,xLabel:'Frequency (Hz)',yLabel:'log10 |Z / Ω|',log:true,
            curves:curves.map((c,i)=>({label:c.label,color:['#6ee7ff','#34d399','#ffce71','#fb7185'][i%4],fn:f=>Math.log10(abs(c.z(f)))}))});
    };
    api.initCompare = function() {
        api.bankDiagram('pdn-bank',true);
        const ids=['pdn-retain','pdn-esr','pdn-mounted','pdn-shared','pdn-target'];
        function update(){
            const v=ids.map(id=>Number(document.getElementById(id).value));
            const good=v.every(Number.isFinite)&&v[0]>0&&v[0]<=100&&v[1]>0&&v[2]>=0&&v[3]>=0&&v[4]>0;
            document.getElementById('pdn-error').textContent=good?'':'Enter positive retention (up to 100%), ESR and target; inductances may be zero.';
            if(!good)return;
            const curves=compare({retention:v[0]/100,esr:v[1]/1000,mounted:v[2]*1e-9,shared:v[3]*1e-9});
            api.plot(document.getElementById('pdn-canvas'),curves);
            const rows=[1e4,1e5,1e6,3e6,1e7,1e8].map(f=>'<tr><td>'+f.toExponential(0)+'</td>'+curves.map(c=>'<td>'+ (abs(c.z(f))*1000).toFixed(2)+'</td>').join('')+'</tr>');
            document.getElementById('pdn-samples').innerHTML=rows.join('');
            document.getElementById('pdn-totals').textContent=curves.map(c=>c.label+': '+(c.total*1e6).toFixed(2)+' µF effective').join(' · ');
            const sweep=Array.from({length:1001},(_,i)=>{const f=1e3*1e5**(i/1000);return [f,...curves.map(c=>abs(c.z(f)))];});
            document.getElementById('pdn-peaks').textContent=curves.map((c,i)=>{
                const z=Math.max(...sweep.filter(r=>r[0]>=1e5&&r[0]<=1e7).map(r=>r[i+1]));
                return c.label+': peak '+(z*1000).toFixed(1)+' mΩ ('+(z<=v[4]/1000?'within':'above')+' target)';
            }).join(' · ');
            const csv='# Calculated isolated bank, not measured PCB data\n# retention='+v[0]+'%, ESR='+v[1]+' mOhm, mounted_L='+v[2]+' nH, shared_L='+v[3]+' nH\nfrequency_Hz,A_ohm,B_ohm,C_ohm\n'+sweep.map(r=>r.join(',')).join('\n');
            document.getElementById('pdn-csv').href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
        }
        ids.forEach(id=>document.getElementById(id).addEventListener('input',update));update();
    };
})(typeof window !== 'undefined' ? window : globalThis);
