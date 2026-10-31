/* Draw the explicit lumped LTspice test fixtures. Device-specific I/O is not implied. */
(function(root){
    'use strict';
    const api=root.ProtocolSignals={};
    function make(host,w,h){const el=document.getElementById(host);el.classList.add('pdn-drawing');return root.AD.Schematic.create(el,{width:w,height:h});}
    function block(s,x,y,label){
        s.rect(x,y,140,60,{fill:'none',stroke:'#6ee7ff'});s.text(x+70,y+34,label,{size:14});
        s.nodeRegistry.register(x,y+30,null,'pin');s.nodeRegistry.register(x+140,y+30,null,'pin');
    }
    function verticalEnable(s,x,y,label){
        s.rect(x-70,y,140,60,{fill:'none',stroke:'#6ee7ff'});s.text(x,y+34,label,{size:14});
        s.nodeRegistry.register(x,y,null,'pin');s.nodeRegistry.register(x,y+60,null,'pin');
    }
    api.contention=function(host){
        const s=make(host,800,420);
        s.voltageSource(60,230,'vertical',{label:'VH',value:'3.3 V'});
        s.wire([[60,230],[60,100],[110,100]]);block(s,110,70,'Enable A');
        s.wire([[250,100],[300,100]]);s.resistor(300,100,'horizontal',{label:'RA',value:'22 Ω'});
        s.wire([[350,100],[680,100],[680,180]]);s.resistor(680,180,'vertical',{label:'Rleak',value:'1 MΩ'});
        s.wire([[680,230],[680,340]]);s.ground(680,340);
        s.junction(450,100);s.nodeLabel(450,100,'BUS',{dy:-35});s.wire([[450,100],[450,180]]);
        s.capacitor(450,180,'vertical',{label:'CB',value:'100 pF'});s.wire([[450,230],[450,340]]);s.ground(450,340);
        s.wire([[60,280],[60,340]]);s.ground(60,340);
        s.wire([[560,100],[560,150]]);s.junction(560,100);s.resistor(560,150,'vertical',{label:'RB',value:'22 / 66 Ω'});
        s.wire([[560,200],[560,250]]);verticalEnable(s,560,250,'Enable B');
        s.wire([[560,310],[560,340]]);s.ground(560,340);
        s.finalize();return s;
    };
    api.openDrain=function(host){
        const s=make(host,800,420);
        s.nodeLabel(90,70,'3.3 V',{dy:-25});s.wire([[90,70],[190,70]]);
        s.resistor(190,70,'horizontal',{label:'RP',value:'2.2 kΩ'});s.wire([[240,70],[680,70]]);
        [170,430].forEach((x,i)=>{
            s.wire([[x,160],[x,210]]);s.resistor(x,210,'vertical',{label:'R'+(i+1),value:'22 Ω'});
            verticalEnable(s,x,290,'LOW enable '+(i+1));s.wire([[x,260],[x,290]]);
            s.wire([[x,350],[x,370]]);s.ground(x,370);
        });
        s.wire([[170,160],[680,160],[680,70]]);s.nodeLabel(680,160,'BUS',{dx:55,dy:5});s.junction(430,160);
        s.wire([[680,160],[680,240]]);s.junction(680,160);s.capacitor(680,240,'vertical',{label:'CB',value:'100 pF'});
        s.wire([[680,290],[680,370]]);s.ground(680,370);s.finalize();return s;
    };
    api.ringing=function(host){
        const s=make(host,760,330);
        s.voltageSource(80,170,'vertical',{label:'VIN',value:'3.3 → 0 V'});
        s.wire([[80,170],[80,90],[220,90]]);s.resistor(220,90,'horizontal',{label:'RS',value:'20 / 63.25 Ω'});
        s.wire([[270,90],[410,90]]);s.inductor(410,90,'horizontal',{label:'LP',value:'100 nH'});
        s.wire([[460,90],[620,90],[620,170]]);s.nodeLabel(620,90,'PIN',{dy:-35});
        s.capacitor(620,170,'vertical',{label:'CP',value:'100 pF'});s.wire([[620,220],[620,280]]);s.ground(620,280);
        s.wire([[80,220],[80,280]]);s.ground(80,280);s.finalize();return s;
    };
    api.released=function(host){
        const s=make(host,820,390);
        s.voltageSource(60,200,'vertical',{label:'VDD',value:'3.3 V'});
        s.wire([[60,200],[60,100],[140,100]]);block(s,140,70,'Enable');
        s.wire([[280,100],[360,100]]);s.resistor(360,100,'horizontal',{label:'RD',value:'22 Ω'});
        s.wire([[410,100],[720,100],[720,200]]);s.capacitor(720,200,'vertical',{label:'C',value:'100 pF'});
        s.wire([[580,100],[580,200]]);s.junction(580,100);s.resistor(580,200,'vertical',{label:'Rbias',value:'See cases'});
        s.nodeLabel(650,100,'Released line',{dy:-30});
        [60,580,720].forEach(x=>{s.wire([[x,250],[x,320]]);s.ground(x,320);});s.finalize();return s;
    };
    api.reference=function(host){
        const s=make(host,860,320);
        [[80,'VPIN','3.3 → 0 V','pin'],[340,'VREF','0 → 1 → 0 V','ref'],[620,'BMEAS','V(pin) − V(ref)','measured']].forEach(([x,label,value,node])=>{
            s.voltageSource(x,140,'vertical',{label,value});s.wire([[x,140],[x,80]]);s.nodeLabel(x,80,node,{dy:-25});
            s.wire([[x,190],[x,260]]);s.ground(x,260);
        });s.finalize();return s;
    };
})(window);
