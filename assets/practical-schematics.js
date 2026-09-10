// Shared lesson templates. Sources and omitted implementation details belong
// in adjacent HTML captions, keeping labels clear of component bodies.
(function(){
const S=AD.Schematic;
function make(host,w=760,h=400){host.innerHTML='';return S.create(host,{width:w,height:h});}
function block(s,x,y,w,h,title,pins=[]){
    s.rect(x,y,w,h,{fill:'none',stroke:S.COLORS.component});s.text(x+w/2,y+h/2,title,{size:13,bold:true});
    pins.forEach(([px,py,t,dx=0,dy=-12])=>{s.nodeRegistry.register(px,py,null,'pin');if(t)s.text(px+dx,py+dy,t,{size:10});});
}
S.currentSenseTemplate=function(host,low=false,bidirectional=false){
    const s=make(host,760,460),y=low?160:90;
    s.voltageSource(65,250,'vertical',{label:'Vbus'});s.ground(65,300);
    if(low){s.wire([[65,250],[65,55],[155,55],[155,80]]);s.resistor(155,80,'vertical',{label:'Load'});s.wire([[155,130],[155,y],[250,y]]);}
    else{s.wire([[65,250],[65,y],[250,y]]);}
    s.resistor(250,y,'horizontal',{label:'Rsense'});s.wire([[300,y],[610,y]]);
    if(low){s.wire([[610,y],[610,200]]);s.ground(610,200);}
    else{s.wire([[610,y],[610,130]]);if(bidirectional)s.voltageSource(610,130,'vertical',{label:'Battery'});else s.resistor(610,130,'vertical',{label:'Load'});s.wire([[610,180],[610,200]]);s.ground(610,200);}
    // Separate Kelvin taps, terminating at IN+ and IN−.
    s.junction(220,y);s.junction(340,y);s.wire([[220,y],[220,220],[250,220],[250,270]]);s.wire([[340,y],[340,235],[365,235],[365,270]]);
    block(s,210,270,200,115,'INA181',[[250,270,'IN+',0,18],[365,270,'IN−',0,18],[305,270,'VS',0,18],[410,330,'OUT',-23,-12],[250,385,'GND',0,-12],[365,385,'REF',0,-12]]);
    s.wire([[305,270],[305,240]]);s.vcc(305,240,{label:'Vs'});s.wire([[410,330],[625,330]]);s.nodeLabel(625,330,'Vout');
    s.wire([[250,385],[250,420]]);s.ground(250,420);s.wire([[365,385],[365,420]]);if(bidirectional)s.nodeLabel(365,420,'Vref',{dy:20});else s.ground(365,420);
    s.capacitor(540,365,'vertical',{label:'Cbypass',value:'0.1 µF'});s.vcc(540,365,{label:'Vs'});s.ground(540,415);
    s.finalize();return s;
};
S.buckLedTemplate=function(host){
    const s=make(host,790,410);
    s.voltageSource(65,215,'vertical',{label:'Vin'});s.wire([[65,215],[65,65],[245,65],[245,100]]);s.ground(65,265);
    s.pmos(225,130,{label:'Q1'});s.wire([[245,160],[245,195],[400,195]]);s.nodeLabel(315,195,'SW');
    s.wire([[205,130],[130,130]]);s.nodeLabel(130,130,'Gate drive');
    s.inductor(400,195,'horizontal',{label:'L1'});s.wire([[450,195],[580,195],[580,215]]);
    s.diode(580,215,'vertical');s.text(610,242,'LED string',{anchor:'start',size:12});
    s.wire([[580,265],[580,290]]);s.resistor(580,290,'vertical',{label:'Rsense'});s.wire([[580,340],[580,370],[320,370]]);s.ground(320,370);
    s.junction(320,195);s.wire([[320,195],[320,270]]);s.diode(320,270,'vertical',{flip:true});s.text(345,296,'Dfreewheel',{anchor:'start',size:11});s.wire([[320,320],[320,370]]);
    s.junction(580,280);s.wire([[580,280],[710,280]]);s.nodeLabel(710,280,'Sense +');s.wire([[580,355],[710,355]]);s.junction(580,355);s.nodeLabel(710,355,'Sense −');
    // Photon arrows identify the series LED load, independent of power wiring.
    s.currentArrow(598,226,613,211);s.currentArrow(607,235,622,220);
    s.finalize();return s;
};
S.inputProtectionTemplate=function(host){
    const s=make(host,820,320);
    s.voltageSource(55,175,'vertical',{label:'Vin'});s.wire([[55,175],[55,90],[125,90]]);s.ground(55,225);
    block(s,125,75,65,30,'Fuse',[[125,90],[190,90]]);s.wire([[190,90],[240,90]]);
    s.diode(240,90,'horizontal');s.text(265,57,'Dreverse',{size:11,bold:true});s.wire([[290,90],[350,90],[440,90]]);
    s.junction(350,90);s.wire([[350,90],[350,175]]);block(s,320,175,60,55,'TVS',[[350,175],[350,230]]);s.wire([[350,230],[350,270]]);s.ground(350,270);
    s.inductor(440,90,'horizontal',{label:'Lfilter'});s.wire([[490,90],[560,90],[650,90]]);s.junction(560,90);s.wire([[560,90],[560,180]]);s.capacitor(560,180,'vertical',{label:'Cin'});s.wire([[560,230],[560,270]]);s.ground(560,270);
    block(s,650,65,120,75,'Regulator',[[650,90],[710,140],[770,90]]);s.wire([[710,140],[710,270]]);s.ground(710,270);s.wire([[770,90],[800,90]]);
    s.finalize();return s;
};
S.inampTemplate=function(host,device="AD8421"){
    const s=make(host,790,420);
    block(s,310,100,230,180,device,[[310,130,'+IN',24,0],[310,245,'−IN',24,0],[310,175,'RG',22,0],[310,205,'RG',22,0],[430,100,'+VS',0,18],[430,280,'−VS',0,-12],[490,280,'REF',0,-12],[540,190,'OUT',-23,-15]]);
    s.wire([[70,130],[145,130]]);s.resistor(145,130,'horizontal',{label:'Rin+'});s.wire([[195,130],[310,130]]);s.nodeLabel(70,130,'Vin+');
    s.wire([[70,245],[145,245]]);s.resistor(145,245,'horizontal',{label:'Rin−'});s.wire([[195,245],[310,245]]);s.nodeLabel(70,245,'Vin−');
    s.wire([[310,175],[260,175],[260,165],[215,165]]);s.resistor(215,165,'vertical');s.text(185,191,'Rg',{anchor:'end',size:11});s.wire([[215,215],[280,215],[280,205],[310,205]]);
    s.wire([[430,100],[430,60]]);s.vcc(430,60,{label:'+Vs'});s.wire([[430,280],[430,325]]);s.nodeLabel(430,325,'−Vs',{dy:20});s.wire([[490,280],[490,365]]);s.ground(490,365);
    s.wire([[540,190],[690,190],[690,245]]);s.nodeLabel(640,190,'Vout');s.resistor(690,245,'vertical',{label:'Load'});s.wire([[690,295],[690,365]]);s.ground(690,365);
    [80,170].forEach((x,i)=>{s.capacitor(x,325,'vertical');s.nodeLabel(x,325,i?'−Vs':'+Vs');s.ground(x,375);});s.text(125,407,'Local supply bypass',{size:11});s.finalize();return s;
};

S.hallElementTemplate=function(host){
    const s=make(host,740,330);
    s.rect(200,100,290,120,{fill:'none',stroke:S.COLORS.component});
    s.currentArrow(65,160,180,160,{label:'I →'});s.currentArrow(510,160,665,160);
    s.currentArrow(345,170,345,125);s.text(275,265,'Electron magnetic force ↑',{size:12});
    s.text(270,65,'B into page: × × × ×',{size:13});
    s.wire([[430,100],[430,40],[570,40]]);s.nodeLabel(570,40,'Vtop (−)');s.wire([[430,220],[430,290],[570,290]]);s.nodeLabel(570,290,'Vbottom (+)',{dy:22});
    s.text(230,123,'−',{size:18});s.text(270,123,'−',{size:18});s.text(230,207,'+',{size:18});s.text(270,207,'+',{size:18});
    s.finalize();return s;
};
S.esdClampTemplate=function(host){
    const s=make(host,720,340);
    s.nodeLabel(70,170,'Signal in');s.wire([[70,170],[200,170],[440,170]]);s.junction(200,170);
    s.diode(200,80,'vertical',{flip:true});s.wire([[200,130],[200,170],[200,210]]);s.diode(200,210,'vertical',{flip:true});s.wire([[200,80],[200,50]]);s.vcc(200,50,{label:'Clamp rail'});s.ground(200,260);
    s.text(235,110,'Dupper',{anchor:'start',size:11});s.text(235,238,'Dlower',{anchor:'start',size:11});
    block(s,440,140,145,95,'Protected IC',[[440,170],[510,235]]);s.wire([[510,235],[510,280]]);s.ground(510,280);s.finalize();return s;
};
S.simpleArchitecture=function(host,labels){
    const s=make(host,760,210);const w=140,gap=38,start=35;
    s.wire([[15,103],[35,103]]);s.nodeLabel(15,103,'In',{dx:0,dy:-16});s.nodeLabel(745,103,'Out',{dx:0,dy:-16});s.wire([[35+(labels.length-1)*(w+gap)+w,103],[745,103]]);
    labels.forEach((label,i)=>{const x=start+i*(w+gap);block(s,x,65,w,75,label,[[x,103],[x+w,103]]);if(i)s.wire([[x-gap,103],[x,103]],{arrow:'end'});});s.finalize();return s;
};
S.batteryProtectionTemplate=function(host){
        const s=AD.Schematic.create(host,{width:930,height:450});
        s.voltageSource(90,195,'vertical',{label:'Cell'});
        s.wire([[90,195],[90,60],[810,60]]);s.nodeLabel(90,60,'B+',{dy:-18});s.nodeLabel(810,60,'P+',{dy:-18});
        s.wire([[90,245],[90,380],[300,380],[300,360]]);s.nodeLabel(90,380,'B−',{dy:20});
        s.nmos(280,330,{label:'Q1'});s.nmos(560,330,{label:'Q2'});
        s.wire([[300,300],[580,300]]);
        s.wire([[580,360],[580,380],[810,380]]);s.nodeLabel(810,380,'P−',{dy:20});
        s.wire([[260,330],[200,330]]);s.nodeLabel(200,330,'DOUT',{dy:-18});
        s.wire([[540,330],[475,330]]);s.nodeLabel(475,330,'COUT',{dy:-18});
        // Equivalent internal body-diode paths: source (bottom) to drain (top).
        [360,640].forEach((x,i)=>{
            const qx=i?580:300;
            s.diode(x,305,'vertical',{flip:true});
            s.wire([[qx,300],[x,300],[x,305]]);
            s.wire([[x,355],[x,380],[qx,380]]);s.junction(qx,380);
        });
        s.rect(500,100,185,150,{fill:'none',stroke:'#6ee7ff'});
        s.text(592,82,'BQ2970',{bold:true});
        [[500,130,'BAT',18],[500,225,'VSS',18],[685,130,'V−',-18],[685,170,'COUT',-28],[685,210,'DOUT',-28]].forEach(([x,y,t,dx])=>{
            s.text(x+dx,y,t,{size:10});s.nodeRegistry.register(x,y,null,'pin');
        });
        s.wire([[340,60],[340,130],[380,130]]);s.junction(340,60);
        s.resistor(380,130,'horizontal',{label:'R1',value:'330 Ω'});s.wire([[430,130],[460,130],[500,130]]);
        s.wire([[460,130],[460,170],[410,170],[410,185]]);s.junction(460,130);
        s.capacitor(410,185,'vertical');s.text(390,200,'C1',{anchor:'end',bold:true});s.text(390,220,'0.1 µF',{anchor:'end',size:10});
        s.wire([[410,235],[410,260],[460,260],[460,225],[500,225]]);
        s.wire([[410,260],[150,260],[150,380]]);s.junction(150,380);s.junction(410,260);
        s.wire([[685,170],[740,170]]);s.nodeLabel(740,170,'COUT',{dy:-18});
        s.wire([[685,210],[740,210]]);s.nodeLabel(740,210,'DOUT',{dy:-18});
        s.wire([[685,130],[810,130],[810,240]]);
        s.resistor(810,240,'vertical',{label:'R2',value:'2.2 kΩ'});s.wire([[810,290],[810,380]]);
        s.text(285,416,'Discharge FET',{size:10});s.text(575,416,'Charge FET',{size:10});
        s.finalize();
    
};
S.boostPowerTemplate=function(host){
        const s = AD.Schematic.create(host, {width: 680, height: 350});
        s.voltageSource(65, 170, 'vertical', {label: 'Vin'});
        s.wire([[65, 170], [65, 85], [145, 85]]);
        s.inductor(145, 85, 'horizontal'); s.text(170, 60, 'L1', {bold: true});
        s.wire([[195, 85], [260, 85], [350, 85]]);
        s.nodeLabel(110, 85, 'in', 'top');
        s.junction(260, 85); s.nodeLabel(260, 85, 'sw', 'top');
        s.nmos(240, 190, {label: 'Q1', showType: true});
        const q = AD.Schematic.nmosTerminals(240, 190);
        s.wire([[260, 85], [q.drain.x, q.drain.y]]);
        s.wire([[q.source.x, q.source.y], [260, 290]]);
        s.diode(350, 85, 'horizontal'); s.text(375, 60, 'D1', {bold: true});
        s.wire([[400, 85], [450, 85], [550, 85], [610, 85]]);
        s.nodeLabel(610, 85, 'out / Vout', 'top');
        s.junction(450, 85); s.junction(550, 85);
        s.wire([[450, 85], [450, 170]]);
        s.capacitor(450, 170, 'vertical', {label: 'Cout'});
        s.wire([[450, 220], [450, 290]]);
        s.wire([[550, 85], [550, 170]]);
        s.resistor(550, 170, 'vertical', {label: 'Rload'});
        s.wire([[550, 220], [550, 290]]);
        s.wire([[65, 220], [65, 290], [550, 290]]);
        [160, 260, 450, 550].forEach(x => s.junction(x, 290));
        s.ground(260, 290);
        s.voltageSource(160, 220, 'vertical', {label: 'Vpwm'});
        s.wire([[160, 220], [160, 190], [q.gate.x, q.gate.y]]);
        s.nodeLabel(160, 190, 'pwm', 'top');
        s.wire([[160, 270], [160, 290]]);
        s.finalize();
    
};

// Power-stage teaching templates: device selection, gate drivers and control are
// specified by the linked application notes rather than invented in the picture.
S.halfBridgeTemplate=function(host,options={}){
 const s=make(host,780,440);
 s.nodeLabel(100,60,'Vhigh');s.wire([[100,60],[320,60],[320,95]]);
 s.nmos(300,125,{label:'QH'});s.nmos(300,325,{label:'QL'});
 s.wire([[320,155],[320,220],[320,295]]);s.junction(320,220);s.nodeLabel(320,220,'SW',{dx:-20,dy:-18});
 s.wire([[280,125],[195,125]]);s.nodeLabel(195,125,'GH');s.wire([[280,325],[195,325]]);s.nodeLabel(195,325,'GL');
 s.wire([[320,355],[320,395],[660,395]]);s.ground(320,395);
 s.capacitor(100,195,'vertical',{label:'Cin'});s.wire([[100,60],[100,195]]);s.wire([[100,245],[100,395],[320,395]]);
 s.wire([[320,220],[420,220]]);s.inductor(420,220,'horizontal',{label:'L1'});s.wire([[470,220],[560,220],[660,220]]);s.nodeLabel(660,220,'Vlow');
 s.capacitor(560,290,'vertical',{label:'Cout'});s.wire([[560,220],[560,290]]);s.wire([[560,340],[560,395]]);s.junction(560,220);s.junction(560,395);
 if(options.battery)s.voltageSource(660,290,'vertical',{label:'Battery'});else s.resistor(660,290,'vertical',{label:'Load'});
 s.wire([[660,220],[660,290]]);s.wire([[660,340],[660,395]]);
 s.finalize();return s;
};
S.fullBridgeTemplate=function(host){
 const s=make(host,800,460);
 s.nodeLabel(90,60,'Vdc');s.wire([[90,60],[240,60],[640,60],[640,105]]);s.wire([[240,60],[240,105]]);s.junction(240,60);
 [[220,135,'Q1','GH1'],[220,345,'Q2','GL1'],[620,135,'Q3','GH2'],[620,345,'Q4','GL2']].forEach(([x,y,q,g])=>{s.nmos(x,y,{label:q});s.wire([[x-20,y],[x-90,y]]);s.nodeLabel(x-90,y,g);});
 [240,640].forEach(x=>{s.wire([[x,165],[x,240],[x,315]]);s.junction(x,240);s.wire([[x,375],[x,420]]);});
 s.wire([[90,420],[640,420]]);s.ground(240,420);s.capacitor(90,210,'vertical',{label:'Cdc'});s.wire([[90,60],[90,210]]);s.wire([[90,260],[90,420]]);
 s.wire([[240,240],[330,240]]);s.capacitor(330,240,'horizontal',{label:'Cseries'});s.wire([[380,240],[455,240]]);s.inductor(455,240,'horizontal',{label:'Ltx'});s.wire([[505,240],[640,240]]);
 s.nodeLabel(240,240,'SW1',{dx:-30,dy:-17});s.nodeLabel(640,240,'SW2',{dx:30,dy:-17});s.finalize();return s;
};
S.rtdFourWireTemplate=function(host){
 const s=make(host,800,410);
 block(s,65,55,180,300,'ADC / IDAC',[[245,90,'Force +',-40,0],[245,150,'AIN+',-28,0],[245,280,'AIN−',-28,0],[245,340,'Force −',-40,0]]);
 s.resistor(620,190,'vertical',{label:'RTD'});s.wire([[620,190],[620,110]]);s.wire([[620,240],[620,325]]);
 s.wire([[245,90],[350,90]]);s.resistor(350,90,'horizontal',{label:'Rlead1'});s.wire([[400,90],[620,90],[620,110]]);
 s.wire([[245,150],[420,150]]);s.resistor(420,150,'horizontal',{label:'Rlead2'});s.wire([[470,150],[560,150],[560,170],[620,170]]);s.junction(620,170);
 s.wire([[245,280],[420,280]]);s.resistor(420,280,'horizontal',{label:'Rlead3'});s.wire([[470,280],[560,280],[560,260],[620,260]]);s.junction(620,260);
 s.wire([[245,340],[350,340]]);s.resistor(350,340,'horizontal',{label:'Rlead4'});s.wire([[400,340],[620,340],[620,325]]);
 s.nodeLabel(620,170,'Sense +',{dx:60,dy:0});s.nodeLabel(620,260,'Sense −',{dx:60,dy:0});s.finalize();return s;
};
S.mosCapTemplate=function(host){
 const s=make(host,740,430);
 s.nmos(360,220,{label:'M1'});s.wire([[340,220],[170,220],[80,220]]);s.nodeLabel(80,220,'G');
 s.wire([[380,190],[380,90],[600,90]]);s.nodeLabel(600,90,'D');s.wire([[380,250],[380,355],[600,355]]);s.nodeLabel(600,355,'S');
 s.wire([[170,220],[170,90],[230,90]]);s.capacitor(230,90,'horizontal',{label:'Cgd'});s.wire([[280,90],[380,90]]);
 s.wire([[170,220],[170,270]]);s.capacitor(170,270,'vertical',{label:'Cgs'});s.wire([[170,320],[170,355],[380,355]]);
 s.capacitor(555,195,'vertical',{label:'Cds'});s.wire([[555,90],[555,195]]);s.wire([[555,245],[555,355]]);
 [[170,220],[380,90],[380,355],[555,90],[555,355]].forEach(p=>s.junction(...p));s.finalize();return s;
};
S.rs485TerminationTemplate=function(host,ac=false){
 const s=make(host,690,360);
 s.wire([[70,80],[580,80]]);s.wire([[70,300],[580,300]]);s.nodeLabel(70,80,'A');s.nodeLabel(70,300,'B');
 s.resistor(350,125,'vertical',{label:'RT',value:'Z0'});s.wire([[350,80],[350,125]]);
 if(ac){s.capacitor(350,220,'vertical',{label:'CT'});s.wire([[350,175],[350,220]]);s.wire([[350,270],[350,300]]);}else s.wire([[350,175],[350,300]]);
 s.junction(350,80);s.junction(350,300);s.nodeLabel(580,80,'Bus end',{dy:-16});s.nodeLabel(580,300,'Bus end',{dy:22});s.finalize();return s;
};
S.rs485BiasTemplate=function(host){
 const s=make(host,690,420);
 s.vcc(245,40,{label:'Vcc'});s.resistor(245,40,'vertical',{label:'Rpull-up'});s.wire([[245,90],[245,135]]);
 s.wire([[70,135],[570,135]]);s.wire([[70,270],[570,270]]);s.nodeLabel(70,135,'A');s.nodeLabel(70,270,'B');
 s.resistor(400,170,'vertical',{label:'RT'});s.wire([[400,135],[400,170]]);s.wire([[400,220],[400,270]]);
 s.wire([[245,270],[245,305]]);s.resistor(245,305,'vertical',{label:'Rpull-down'});s.ground(245,355);
 [[245,135],[245,270],[400,135],[400,270]].forEach(p=>s.junction(...p));s.nodeLabel(570,135,'A / +');s.nodeLabel(570,270,'B / −');s.finalize();return s;
};
S.referenceTemplate=function(host){
 const s=make(host,740,350);
 block(s,270,80,180,135,'REF5025',[[270,120,'VIN',24,-16],[450,120,'VOUT',-32,-16],[360,215,'GND',0,-12]]);
 s.wire([[70,120],[170,120],[270,120]]);s.nodeLabel(70,120,'Vsupply');s.wire([[450,120],[550,120],[680,120]]);s.nodeLabel(680,120,'2.5 V');
 s.capacitor(170,195,'vertical',{label:'Cin'});s.wire([[170,120],[170,195]]);s.ground(170,245);s.junction(170,120);
 s.capacitor(550,195,'vertical',{label:'Cout'});s.wire([[550,120],[550,195]]);s.ground(550,245);s.junction(550,120);s.wire([[360,215],[360,275]]);s.ground(360,275);
 s.finalize();return s;
};
S.vbeMultiplierTemplate=function(host,r1='R1',r2='R2'){
 const s=make(host,650,380);
 s.npn(380,190,{label:'Qbias'});s.wire([[400,160],[400,60],[250,60],[250,95]]);s.nodeLabel(400,60,'Vbias +');
 s.resistor(250,95,'vertical',{label:'R1',value:r1});s.wire([[250,145],[250,190],[365,190]]);s.junction(250,190);
 s.wire([[250,190],[250,235]]);s.resistor(250,235,'vertical',{label:'R2',value:r2});s.wire([[250,285],[250,325],[400,325],[400,220]]);s.nodeLabel(400,325,'Vbias −',{dy:22});
 s.finalize();return s;
};
S.lnaDegenTemplate=function(host,Lg,Ls){
 const s=make(host,770,440);
 s.nmos(440,230,{label:'M1'});s.inductor(460,95,'vertical',{label:'Ld'});s.vcc(460,95,{label:'VDD'});s.wire([[460,145],[460,175],[460,200]]);
 s.wire([[460,175],[575,175]]);s.capacitor(575,175,'horizontal',{label:'Cout'});s.wire([[625,175],[705,175]]);s.nodeLabel(705,175,'RF out');s.junction(460,175);
 s.inductor(460,315,'vertical',{label:'Ls',value:Ls});s.wire([[460,260],[460,315]]);s.ground(460,365);
 s.nodeLabel(60,230,'RF in');s.wire([[60,230],[125,230]]);s.capacitor(125,230,'horizontal',{label:'Cblock'});s.wire([[175,230],[245,230]]);s.inductor(245,230,'horizontal',{label:'Lg',value:Lg});s.wire([[295,230],[370,230],[420,230]]);
 s.resistor(370,90,'vertical',{label:'Rbias'});s.vcc(370,90,{label:'Vbias'});s.wire([[370,140],[370,230]]);s.junction(370,230);s.finalize();return s;
};
S.lcLadderTemplate=function(host,components,Z0){
 const w=Math.max(760,390+components.length*95),s=make(host,w,340),end=w-80;
 s.voltageSource(55,190,'vertical',{label:'Vs'});s.ground(55,240);s.wire([[55,190],[55,105],[115,105]]);s.resistor(115,105,'horizontal',{label:'Rs',value:Z0+' Ω'});s.wire([[165,105],[220,105]]);
 let x=220;
 components.forEach((c,i)=>{if(c.type==='C'){s.wire([[x,105],[x,190]]);s.capacitor(x,190,'vertical',{label:'C'+(i/2+1),value:(c.value*1e12).toFixed(2)+' pF'});s.ground(x,240);s.junction(x,105);if(i<components.length-1)s.wire([[x,105],[x+95,105]]);}else{s.inductor(x,105,'horizontal',{label:'L'+((i+1)/2),value:(c.value*1e9).toFixed(2)+' nH'});if(i<components.length-1)s.wire([[x+50,105],[x+95,105]]);}x+=95;});
 s.wire([[x-95+(components.at(-1).type==='L'?50:0),105],[end,105],[end,190]]);s.resistor(end,190,'vertical',{label:'RL',value:Z0+' Ω'});s.ground(end,240);s.nodeLabel(end,105,'Vout');s.finalize();return s;
};
S.bridgeTemplate=function(host,values=['R1','R2','R3','R4']){
 const s=make(host,730,430);
 s.vcc(365,50,{label:'Vexc'});s.wire([[365,50],[365,85],[220,85],[220,120]]);s.wire([[365,85],[510,85],[510,120]]);s.junction(365,85);
 // Same arm numbering and output sign as the bridge equations in M18L7.
 [[220,120,0],[510,120,1],[220,270,2],[510,270,3]].forEach(([x,y,i])=>s.resistor(x,y,'vertical',{label:'R'+(i+1),value:values[i]}));
 [220,510].forEach(x=>{s.wire([[x,170],[x,220],[x,270]]);s.junction(x,220);s.wire([[x,320],[x,365]]);});s.wire([[220,365],[510,365]]);s.ground(365,365);
 s.wire([[220,220],[110,220]]);s.nodeLabel(110,220,'V+');s.wire([[510,220],[620,220]]);s.nodeLabel(620,220,'V−');s.finalize();return s;
};
S.logRatioCoreTemplate=function(host){
 const s=make(host,760,380);
 [230,530].forEach((x,i)=>{s.npn(x,215,{label:'Q'+(i+1)});s.wire([[x+20,185],[x+20,95]]);s.nodeLabel(x+20,95,i?'Iref in':'Iin');s.currentArrow(x+20,115,x+20,160);s.wire([[x-15,215],[x-65,215],[x-65,170],[x+20,170]]);s.junction(x+20,170);s.wire([[x+20,245],[x+20,300]]);s.ground(x+20,300);s.nodeLabel(x-65,170,i?'VBE2':'VBE1',{dy:-20});});
 s.finalize();return s;
};


// SLVA662 Fig. 7: Zi = R1 || (R3 + 1/sC2), Zf = (R2 + 1/sC1) || 1/sC3.
S.typeThreeTemplate=function(host){
 const s=make(host,840,460);
 s.opamp(480,290,{label:'EA'});s.wire([[70,275],[140,275]]);s.nodeLabel(70,275,'Vo');
 s.resistor(140,275,'horizontal',{label:'R1'});s.wire([[190,275],[350,275],[465,275]]);
 s.wire([[105,275],[105,175],[140,175]]);s.junction(105,275);s.resistor(140,175,'horizontal',{label:'R3'});s.wire([[190,175],[245,175]]);s.capacitor(245,175,'horizontal',{label:'C2'});s.wire([[295,175],[350,175],[350,275]]);s.junction(350,275);
 s.wire([[400,275],[400,120],[460,120]]);s.junction(400,275);s.capacitor(460,120,'horizontal',{label:'C1'});s.wire([[510,120],[570,120]]);s.resistor(570,120,'horizontal',{label:'R2'});s.wire([[620,120],[700,120],[700,290]]);
 s.wire([[400,120],[400,50],[545,50]]);s.junction(400,120);s.capacitor(545,50,'horizontal',{label:'C3'});s.wire([[595,50],[700,50],[700,120]]);s.junction(700,120);
 s.wire([[545,290],[700,290],[770,290]]);s.junction(700,290);s.nodeLabel(770,290,'Ve');
 s.wire([[350,275],[350,350]]);s.resistor(350,350,'vertical',{label:'R4'});s.ground(350,400);
 s.wire([[465,305],[435,305],[435,385]]);s.nodeLabel(435,385,'Vref',{dy:22});s.finalize();return s;
};
S.threePhaseTemplate=function(host){
 const s=make(host,960,630);
 s.wire([[90,60],[780,60]]);s.nodeLabel(90,60,'VDC');s.capacitor(90,250,'vertical',{label:'Cdc'});s.wire([[90,60],[90,250]]);s.wire([[90,300],[90,450]]);s.ground(90,450);
 [220,500,780].forEach((x,i)=>{const p=['U','V','W'][i];s.nmos(x-20,140,{label:'QH'+p});s.nmos(x-20,320,{label:'QL'+p});s.wire([[x,60],[x,110]]);if(i<2)s.junction(x,60);s.wire([[x,170],[x,220],[x,290]]);s.junction(x,220);
 [140,320].forEach((y,k)=>{s.wire([[x-40,y],[x-100,y]]);s.nodeLabel(x-100,y,(k?'GL':'GH')+p);});
 s.wire([[x,350],[x,375]]);s.resistor(x,375,'vertical',{label:'Rs'+p});s.wire([[x,425],[x,450]]);s.ground(x,450);s.wire([[x,220],[x+80,220],[x+80,510]]);
 });
 block(s,140,510,740,90,'Three-phase motor',[[300,510,'U',0,20],[580,510,'V',0,20],[860,510,'W',0,20]]);s.finalize();return s;
};
S.hybridPiTemplate=function(host){
 const s=make(host,740,340);
 s.wire([[70,90],[180,90],[180,150]]);s.nodeLabel(70,90,'B');s.resistor(180,150,'vertical',{label:'rπ'});s.wire([[180,200],[180,270],[650,270]]);s.nodeLabel(650,270,'E',{dy:22});
 s.wire([[400,90],[650,90]]);s.nodeLabel(650,90,'C');s.wire([[400,90],[400,150]]);s.wire([[400,200],[400,270]]);s.junction(400,270);
 const diamond=document.createElementNS('http://www.w3.org/2000/svg','polygon');diamond.setAttribute('points','400,150 420,175 400,200 380,175');diamond.setAttribute('fill','none');diamond.setAttribute('stroke','#6ee7ff');diamond.setAttribute('stroke-width','1.5');s.componentGroup.appendChild(diamond);[[400,150],[400,200]].forEach(p=>s.nodeRegistry.register(...p,null,'pin'));s.currentArrow(400,161,400,189);s.text(440,179,'gm·vπ',{anchor:'start',size:12});
 s.wire([[580,90],[580,150]]);s.junction(580,90);s.resistor(580,150,'vertical',{label:'ro'});s.wire([[580,200],[580,270]]);s.junction(580,270);s.text(130,144,'+',{size:12});s.text(130,180,'vπ',{size:12});s.text(130,217,'−',{size:12});s.finalize();return s;
};
S.emiInputTemplate=function(host){
 const s=make(host,830,470);
 s.nodeLabel(60,90,'L in');s.nodeLabel(60,265,'N in');s.wire([[60,90],[160,90],[300,90]]);s.wire([[60,265],[160,265],[300,265]]);
 s.inductor(300,90,'horizontal',{label:'Lcm-1'});s.inductor(300,265,'horizontal',{label:'Lcm-2'});s.wire([[350,90],[760,90]]);s.wire([[350,265],[760,265]]);s.nodeLabel(760,90,'L out');s.nodeLabel(760,265,'N out');
 s.text(325,173,'Coupled',{size:12});s.text(325,195,'windings',{size:12});s.text(285,78,'•',{size:15});s.text(285,253,'•',{size:15});
 s.capacitor(160,160,'vertical',{label:'CX',value:'X rated'});s.wire([[160,90],[160,160]]);s.wire([[160,210],[160,265]]);s.junction(160,90);s.junction(160,265);
 // Two separate Y branches; PE is a third conductor, never a connection inside a capacitor.
 s.wire([[500,90],[500,125]]);s.capacitor(500,125,'vertical',{label:'CY1',value:'Y rated'});s.wire([[500,175],[500,205],[590,205],[590,405]]);s.junction(500,90);
 s.wire([[700,265],[700,320]]);s.capacitor(700,320,'vertical',{label:'CY2',value:'Y rated'});s.wire([[700,370],[700,405],[590,405],[80,405]]);s.nodeLabel(80,405,'PE');s.junction(700,265);s.junction(590,405);s.finalize();return s;
};
S.bridgeRectifierTemplate=function(host){
 const s=make(host,800,450);
 [250,450].forEach((x,i)=>{s.diode(x,120,'vertical',{label:'D'+(i+1),flip:true});s.diode(x,280,'vertical',{label:'D'+(i+3),flip:true});s.wire([[x,80],[x,120]]);s.wire([[x,170],[x,220],[x,280]]);s.wire([[x,330],[x,360]]);s.junction(x,220);});
 s.wire([[250,80],[700,80]]);s.wire([[250,360],[700,360]]);s.junction(450,80);s.junction(450,360);
 s.acSource(325,220,'horizontal');s.text(350,172,'AC input',{size:12});s.wire([[250,220],[325,220]]);s.wire([[375,220],[450,220]]);
 s.capacitor(590,195,'vertical',{label:'Cbulk'});s.resistor(700,195,'vertical',{label:'Load'});[590,700].forEach(x=>{s.wire([[x,80],[x,195]]);s.wire([[x,245],[x,360]]);});s.junction(590,80);s.junction(590,360);s.nodeLabel(700,80,'DC +');s.nodeLabel(700,360,'DC −',{dy:22});s.finalize();return s;
};

S.fdaAdcTemplate=function(host){
 const s=make(host,1050,510);
 block(s,420,160,190,180,'FDA',[[420,190,'IN+',30,-15],[420,310,'IN−',30,23],[610,190,'OUT−',-32,-15],[610,310,'OUT+',-32,23],[515,340,'VOCM',0,-15]]);
 s.nodeLabel(65,190,'Vin');s.wire([[65,190],[150,190]]);s.resistor(150,190,'horizontal',{label:'Rg1'});s.wire([[200,190],[300,190],[420,190]]);
 s.resistor(150,310,'horizontal',{label:'Rg2'});s.wire([[150,310],[80,310],[80,400]]);s.ground(80,400);s.wire([[200,310],[300,310],[420,310]]);
 [[190,75,'Rf1'],[310,425,'Rf2']].forEach(([y,fy,label])=>{s.wire([[300,y],[300,fy],[430,fy]]);s.resistor(430,fy,'horizontal',{label});s.wire([[480,fy],[660,fy],[660,y]]);s.junction(300,y);s.wire([[610,y],[660,y],[715,y]]);s.resistor(715,y,'horizontal',{label:y===190?'Rs1':'Rs2'});s.wire([[765,y],[845,y],[910,y]]);s.junction(660,y);s.junction(845,y);});
 s.capacitor(845,225,'vertical',{label:'Cdiff'});s.wire([[845,190],[845,225]]);s.wire([[845,275],[845,310]]);
 block(s,910,160,105,180,'ADC',[[910,190,'AIN−',35,22],[910,310,'AIN+',35,-15]]);
 s.wire([[515,340],[515,465]]);s.nodeLabel(515,465,'Vcm',{dy:22});s.finalize();return s;
};
S.focFlowTemplate=function(host){
 const s=make(host,1020,530);
 block(s,90,100,210,110,'Current PI d, q',[[90,140,'id*, iq*',35,-16],[195,210,'id, iq',0,-15],[300,155,'vd, vq',-35,-22]]);
 block(s,390,110,170,90,'Inverse Park',[[390,155,'',0,0],[475,200,'θe',0,-15],[560,155,'',0,0]]);
 block(s,680,110,160,90,'SVPWM',[[680,155,'',0,0],[840,155,'',0,0]]);
 s.nodeLabel(30,140,'References',{dy:-25});s.wire([[30,140],[90,140]]);s.wire([[300,155],[390,155]],{arrow:'end'});s.wire([[560,155],[680,155]],{arrow:'end'});s.text(620,133,'vα, vβ',{size:12});s.wire([[840,155],[950,155]],{arrow:'end'});s.nodeLabel(950,155,'To inverter',{dy:25});
 block(s,650,325,170,90,'Clarke + Park',[[820,370,'',0,0],[650,370,'',0,0],[735,415,'θe',0,-15]]);
 s.wire([[950,370],[820,370]],{arrow:'end'});s.nodeLabel(950,370,'ia, ib, ic',{dy:-22});s.wire([[650,370],[195,370],[195,210]],{arrow:'end'});s.text(315,350,'Measured id, iq (−)',{size:12});
 s.nodeLabel(475,475,'Electrical rotor angle θe',{dy:25});s.wire([[475,475],[475,200]],{arrow:'end'});s.wire([[475,455],[735,455],[735,415]],{arrow:'end'});s.junction(475,455);s.finalize();return s;
};
S.batteryDisconnectTemplate=function(host){
 const s=make(host,870,360);
 s.voltageSource(90,160,'vertical',{label:'Pack'});s.wire([[90,160],[90,60],[810,60]]);s.nodeLabel(810,60,'P+');
 s.wire([[90,210],[90,290],[300,290],[300,270]]);s.nodeLabel(90,290,'B−',{dy:25});s.nmos(280,240,{label:'Qdis'});s.nmos(560,240,{label:'Qchg'});s.wire([[300,210],[580,210]]);s.wire([[580,270],[580,290],[810,290]]);s.nodeLabel(810,290,'P−',{dy:25});
 s.wire([[260,240],[190,240]]);s.nodeLabel(190,240,'DSG');s.wire([[540,240],[470,240]]);s.nodeLabel(470,240,'CHG');
 [360,640].forEach((x,i)=>{const qx=i?580:300;s.diode(x,215,'vertical',{flip:true});s.wire([[qx,210],[x,210],[x,215]]);s.wire([[x,265],[x,290],[qx,290]]);s.junction(qx,290);});s.finalize();return s;
};
S.lisnSetupTemplate=function(host){
 const s=make(host,940,430);
 block(s,50,80,140,170,'AC supply',[[190,120,'L',-15,-12],[190,200,'N',-15,-12]]);
 block(s,320,80,180,170,'LISN',[[320,120,'L',15,-12],[320,200,'N',15,-12],[500,120,'L',-15,-12],[500,200,'N',-15,-12],[410,250,'RF',0,-15]]);
 block(s,710,80,140,170,'EUT',[[710,120,'L',15,-12],[710,200,'N',15,-12]]);
 [120,200].forEach(y=>{s.wire([[190,y],[320,y]]);s.wire([[500,y],[710,y]]);});
 block(s,560,315,250,80,'EMI receiver',[[560,355,'RF',20,-15]]);s.wire([[410,250],[410,355],[560,355]]);s.text(450,335,'50 Ω coax',{size:12});s.finalize();return s;
};
S.bootstrapTemplate=function(host){
    const s=make(host,790,440);
    s.voltageSource(80,200,'vertical');s.wire([[80,200],[80,80],[120,80]]);s.nodeLabel(80,80,'VDRV',{dy:-18});
    s.resistor(120,80,'horizontal',{label:'Rboot'});s.wire([[170,80],[200,80]]);s.diode(200,80,'horizontal');s.text(225,55,'Dboot',{bold:true});
    s.wire([[250,80],[300,80],[300,150],[360,150]]);
    s.wire([[300,150],[300,200]]);s.capacitor(300,200,'vertical');s.text(278,226,'Cboot',{anchor:'end',size:11});s.junction(300,150);
    s.wire([[300,250],[300,280],[360,280]]);s.nodeLabel(300,280,'VS / switch node',{dx:-15,dy:20,anchor:'end'});
    s.capacitor(160,200,'vertical',{label:'Cdrv'});s.wire([[80,160],[160,160],[160,200]]);s.junction(80,160);
    s.wire([[80,250],[80,335],[160,335],[160,250]]);s.ground(80,335);
    s.rect(360,130,180,210,{fill:'none',stroke:'#6ee7ff'});
    s.text(450,235,'Half-bridge',{size:12,bold:true});s.text(450,255,'gate driver',{size:12});
    [[360,150,'VB',18],[360,280,'VS',18],[540,180,'HO',-18],[540,280,'LO',-18]].forEach(([x,y,t,dx])=>{s.text(x+dx,y,t,{size:10});s.nodeRegistry.register(x,y,null,'pin');});
    s.text(400,322,'VCC',{size:10});s.text(480,322,'COM',{size:10});
    s.wire([[400,340],[400,385]]);s.nodeLabel(400,385,'VDRV',{dy:20});
    s.wire([[480,340],[480,385]]);s.ground(480,385);
    s.wire([[540,180],[670,180]]);s.nodeLabel(670,180,'To high-side gate',{dy:-18});
    s.wire([[540,280],[670,280]]);s.nodeLabel(670,280,'To low-side gate',{dy:-18});
    [[400,340],[480,340]].forEach(p=>s.nodeRegistry.register(p[0],p[1],null,'pin'));
    s.finalize();return s;
};

AD.circuitPlot=function(canvas,{xMin,xMax,yMin,yMax,xLabel='',yLabel='',log=false,curves=[]}){
 const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height,left=85,right=W-35,top=55,bottom=H-65,pw=right-left,ph=bottom-top;
 c.clearRect(0,0,W,H);c.font='15px system-ui';c.lineWidth=1;
 const xx=x=>left+pw*(log?Math.log(x/xMin)/Math.log(xMax/xMin):(x-xMin)/(xMax-xMin));
 const yy=y=>bottom-ph*(y-yMin)/(yMax-yMin);
 const num=v=>Math.abs(v)>=1e4||Math.abs(v)>0&&Math.abs(v)<.01?v.toExponential(1):Number(v.toPrecision(3)).toString();
 for(let i=0;i<=5;i++){const y=yMin+(yMax-yMin)*i/5;c.strokeStyle='#283645';c.beginPath();c.moveTo(left,yy(y));c.lineTo(right,yy(y));c.stroke();c.fillStyle='#a8b9c9';c.textAlign='right';c.fillText(num(y),left-12,yy(y)+5);const x=log?xMin*(xMax/xMin)**(i/5):xMin+(xMax-xMin)*i/5;c.beginPath();c.moveTo(xx(x),top);c.lineTo(xx(x),bottom);c.stroke();c.textAlign='center';c.fillText(num(x),xx(x),bottom+25);}
 c.fillStyle='#dce8f1';c.textAlign='center';c.fillText(xLabel,W/2,H-12);c.save();c.translate(20,(top+bottom)/2);c.rotate(-Math.PI/2);c.fillText(yLabel,0,0);c.restore();
 curves.forEach((curve,k)=>{const color=curve.color||['#6ee7ff','#34d399','#f8cf70'][k%3];c.strokeStyle=color;c.lineWidth=2.2;c.save();c.beginPath();c.rect(left,top,pw,ph);c.clip();c.beginPath();let pen=false;for(let i=0;i<=500;i++){const x=log?xMin*(xMax/xMin)**(i/500):xMin+(xMax-xMin)*i/500,y=curve.fn(x);if(!Number.isFinite(y)){pen=false;continue;}if(pen)c.lineTo(xx(x),yy(y));else{c.moveTo(xx(x),yy(y));pen=true;}}c.stroke();c.restore();c.fillStyle=color;c.textAlign='left';c.fillText(curve.label||'',left+k*(pw/curves.length),25);});
};
})();
