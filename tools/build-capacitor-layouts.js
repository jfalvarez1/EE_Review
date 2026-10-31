#!/usr/bin/env node
'use strict';

// Physical placement illustrations, not electrical schematics or extracted PCB
// geometry. Keep every footprint and label editable here; no raster artwork.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const output = path.resolve(__dirname, '../assets/figures/placement');
const C = { bg:'#0b1720', board:'#122d2d', grid:'#254342', ink:'#f1f6fa', muted:'#b4c8d1',
    power:'#f4b65f', ground:'#6abcf3', sw:'#e694df', sense:'#8ee1ae', body:'#263c4e', pad:'#dbe6ec' };
const esc = text => String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
class Layout {
    constructor(name, title, width=520, height=390) {
        this.name=name; this.width=width; this.height=height; this.parts=[];
        this.parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
            `<title id="title">${esc(title)}</title>`,
            '<desc id="desc">Illustrative PCB placement, not to scale or a vendor pinout. Amber is supply, blue is ground, violet is the switch node, green is quiet sensing. Rings are vias. Rectangular component ends are solder pads.</desc>',
            `<rect width="${width}" height="${height}" fill="${C.bg}"/>`,
            '<g font-family="Arial, sans-serif">');
        this.text(24,35,title,22);
        this.rect(24,60,width-48,height-118,C.board,'#416363',12);
        for(let x=44;x<width-24;x+=24) for(let y=80;y<height-58;y+=24) this.circle(x,y,1,C.grid);
    }
    rect(x,y,w,h,fill,stroke='none',radius=0,extra='') {
        this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${extra}/>`);
    }
    circle(x,y,r,fill,stroke='none',extra='') {
        this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${extra}/>`);
    }
    text(x,y,value,size=18,fill=C.ink,anchor='start') {
        this.parts.push(`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${esc(value)}</text>`);
    }
    trace(points,color,width=12,dash='') {
        for(let i=1;i<points.length;i++) assert(points[i][0]===points[i-1][0] || points[i][1]===points[i-1][1], 'Nonorthogonal route');
        this.parts.push(`<polyline data-route="true" points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
    }
    pad(x,y,color,w=30,h=26) { this.rect(x-w/2,y-h/2,w,h,color,C.pad,3); }
    via(x,y,color) { this.circle(x,y,11,color); this.circle(x,y,5,C.bg); }
    // Pads are separate terminals; the body between them is not copper.
    passive(x,y,label,{vertical=true,span=80,colors=[C.power,C.ground],labelX=x,labelY=y-62}={}) {
        if(vertical) {
            this.rect(x-12,y-span/2+13,24,span-26,'#465364',C.pad,3);
            this.pad(x,y-span/2,colors[0]); this.pad(x,y+span/2,colors[1]);
        } else {
            this.rect(x-span/2+13,y-12,span-26,24,'#465364',C.pad,3);
            this.pad(x-span/2,y,colors[0],26,30); this.pad(x+span/2,y,colors[1],26,30);
        }
        if(label) this.text(labelX,labelY,label,19,C.ink,'middle');
    }
    arrow(x,y,direction) {
        const p = direction==='right' ? [[x-7,y-6],[x+7,y],[x-7,y+6]] : [[x+7,y-6],[x-7,y],[x+7,y+6]];
        this.parts.push(`<polygon points="${p.map(p=>p.join(',')).join(' ')}" fill="${C.ink}"/>`);
    }
    finish(note='Illustrative placement · not to scale') {
        this.text(24,this.height-19,note,16,C.muted);
        this.parts.push('</g></svg>');
        return this.parts.join('\n')+'\n';
    }
}

function local(detour=false) {
    const d = new Layout(detour?'return-detour':'local-pair',detour?'Near the pin, long return':'Short supply AND return');
    d.rect(340,120,130,150,C.body,'#8ba5b8',8);
    d.text(405,208,'IC',23,C.ink,'middle');
    d.text(349,166,'VDD'); d.text(349,246,'GND');
    d.trace([[60,160],[320,160]],C.power);
    d.pad(60,160,C.power); d.text(43,129,'Rail');
    if(detour) {
        d.trace([[190,240],[100,240],[100,300],[290,300],[290,240],[320,240]],C.ground);
        d.via(100,300,C.ground);
        d.text(130,279,'Return detour',18,C.ground);
        d.arrow(140,240,'right'); d.arrow(200,300,'left');
    } else {
        d.trace([[190,240],[320,240]],C.ground);
        d.via(255,240,C.ground);
        d.text(195,293,'GND via',18,C.ground);
        d.arrow(295,240,'left');
    }
    d.pad(320,160,C.power,40,26); d.pad(320,240,C.ground,40,26);
    d.passive(190,200,'Cdec',{labelY:115});
    d.arrow(265,160,'right');
    return [d.name,d.finish('Top view · arrows: one transient-current direction')];
}

function underside() {
    const d=new Layout('bga-underside','Under a BGA: reach the rail',520,430);
    d.rect(205,90,265,255,'#1e343e','#91a4b0',7,'stroke-dasharray="7 5"');
    for(let x=235;x<=435;x+=40) for(let y=115;y<=235;y+=40) {
        if(y===235 && (x===275 || x===315)) continue;
        d.circle(x,y,8,'#506474');
    }
    d.trace([[275,235],[275,275]],C.power,8);
    d.trace([[315,235],[315,275]],C.ground,8);
    d.trace([[275,275],[275,315]],C.power,7,'5 3');
    d.trace([[315,275],[315,315]],C.ground,7,'5 3');
    d.passive(295,315,'',{vertical:false,span:40});
    d.circle(275,235,12,C.power); d.circle(315,235,12,C.ground);
    d.text(275,240,'P',14,C.bg,'middle'); d.text(315,240,'G',14,C.bg,'middle');
    d.via(275,275,C.power); d.via(315,275,C.ground);
    d.text(42,128,'Top BGA'); d.text(42,153,'transparent',16,C.muted);
    d.text(42,268,'Paired vias'); d.trace([[155,263],[250,263],[250,275],[264,275]],C.muted,1.5);
    d.text(42,325,'Bottom C'); d.trace([[140,320],[240,320],[240,315],[262,315]],C.muted,1.5);
    d.text(350,286,'P / G',16,C.muted);
    return [d.name,d.finish('Projection from above · not a mirrored fab view')];
}

function section() {
    const d=new Layout('bga-section','Side view: inspect the via pair',520,450);
    d.rect(140,90,260,50,C.body,'#8ba5b8',6); d.text(270,122,'BGA package',20,C.ink,'middle');
    d.circle(200,155,14,C.power); d.circle(340,155,14,C.ground);
    d.rect(80,180,390,150,'#344644','#91a4b0');
    // Antipads interrupt the unlike-net planes; no accidental short in the drawing.
    d.trace([[80,220],[183,220]],C.ground,6); d.trace([[217,220],[470,220]],C.ground,6);
    d.trace([[80,280],[323,280]],C.power,6); d.trace([[357,280],[470,280]],C.power,6);
    d.trace([[200,169],[200,350]],C.power,10); d.trace([[340,169],[340,350]],C.ground,10);
    d.trace([[200,350],[230,350]],C.power,8); d.trace([[310,350],[340,350]],C.ground,8);
    d.passive(270,350,'Cdec',{vertical:false,labelY:389});
    d.text(31,185,'Top',15,C.muted); d.text(31,225,'GND',15,C.ground); d.text(31,285,'PWR',15,C.power);
    d.text(31,334,'Bottom',13,C.muted);
    d.circle(200,280,7,C.power,C.pad); d.circle(340,220,7,C.ground,C.pad);
    d.text(371,251,'Clearance',15); d.text(371,270,'at other rail',15);
    return [d.name,d.finish('Example through-vias · layer depths are not scaled')];
}

function neck() {
    const d=new Layout('shared-neck','A bank behind a shared neck');
    d.rect(45,125,145,60,C.power);
    d.trace([[190,160],[330,160]],C.power,7);
    d.rect(350,125,120,140,C.body,'#8ba5b8',8); d.text(410,207,'Load IC',20,C.ink,'middle');
    d.text(359,166,'VDD',16); d.text(359,246,'GND',16);
    d.pad(330,160,C.power,40,26); d.pad(330,240,C.ground,40,26);
    d.trace([[110,160],[110,190]],C.power);
    d.trace([[110,270],[110,300]],C.ground); d.via(110,300,C.ground);
    d.trace([[330,240],[310,240],[310,300]],C.ground); d.via(310,300,C.ground);
    d.passive(110,230,'C bank',{labelX:178,labelY:235});
    d.rect(207,139,90,42,'none',C.ink,5,'stroke-dasharray="5 4"');
    d.text(200,105,'Shared neck',19); d.trace([[250,113],[250,139]],C.muted,1.5);
    d.text(55,110,'Rail copper',17,C.power);
    return [d.name,d.finish('Blue vias join the same solid GND plane below')];
}

function buck() {
    const d=new Layout('buck-floorplan','Buck: Cin, Cout, load decoupling and quiet feedback',920,560);
    d.rect(225,150,150,155,C.body,'#8ba5b8',8); d.text(300,223,'Buck IC',22,C.ink,'middle');
    d.text(235,196,'VIN',16); d.text(235,276,'PGND',16); d.text(344,196,'SW',16);
    d.trace([[55,190],[205,190]],C.power,14); d.pad(55,190,C.power); d.text(40,156,'VIN',18);
    d.trace([[145,270],[205,270]],C.ground,14);
    d.trace([[175,270],[175,300]],C.ground,10); d.via(175,300,C.ground);
    d.passive(145,230,'Cin',{labelY:156});
    d.pad(205,190,C.power,40,26); d.pad(205,270,C.ground,40,26);
    d.trace([[395,190],[440,190]],C.sw,18); d.pad(395,190,C.sw,40,26);
    d.rect(454,163,92,54,'#57565b',C.pad,6); d.text(500,197,'L1',22,C.ink,'middle');
    d.pad(440,190,C.sw); d.pad(560,190,C.power);
    d.trace([[560,190],[795,190]],C.power,18);
    d.rect(815,150,80,155,C.body,'#8ba5b8',8); d.text(855,225,'Load',21,C.ink,'middle');
    d.pad(795,190,C.power,40,26); d.pad(795,270,C.ground,40,26);
    d.trace([[795,270],[795,300]],C.ground,10); d.via(795,300,C.ground);
    for(const [x,name] of [[610,'Cout'],[745,'Clocal']]) {
        d.passive(x,230,name,{labelY:156});
        d.trace([[x,270],[x,300]],C.ground,10); d.via(x,300,C.ground);
    }
    d.text(631,124,'VOUT after L',19,C.power);
    d.rect(110,172,110,116,'none',C.ink,8,'stroke-dasharray="6 4"');
    d.arrow(180,190,'right'); d.arrow(185,270,'left');
    d.text(46,345,'Compact input loop',18);
    // Divider beside FB, with a separate pickup after L. Cff bridges only Rtop.
    d.trace([[650,190],[675,190],[675,380],[440,380]],C.sense,3);
    d.circle(650,190,5,C.ink);
    d.trace([[360,380],[300,380],[300,325]],C.sense,3); d.pad(300,325,C.sense,26,40);
    d.text(260,332,'FB',17,C.sense);
    d.trace([[300,380],[300,410]],C.sense,3); d.circle(300,380,4,C.sense);
    d.passive(400,380,'Rtop',{vertical:false,colors:[C.sense,C.sense],labelY:349});
    d.passive(300,440,'Rbot',{span:60,colors:[C.sense,C.ground],labelX:235,labelY:445});
    d.trace([[300,470],[300,490]],C.ground,7); d.via(300,490,C.ground);
    d.trace([[360,380],[360,440]],C.sense,3); d.trace([[440,380],[440,440]],C.sense,3);
    d.passive(400,440,'Cff*',{vertical:false,colors:[C.sense,C.sense],labelY:485});
    d.text(510,363,'Quiet VOUT pickup',18,C.sense);
    d.text(474,446,'* Only if the controller specifies it',17,C.muted);
    d.text(42,494,'Quiet return',17,C.ground);
    d.text(42,516,'per data sheet',17,C.ground);
    return [d.name,d.finish('Top-view concept · GND plane below · other required components omitted')];
}

function ldo() {
    const d=new Layout('ldo-floorplan','LDO: keep both capacitors local',520,410);
    d.rect(210,145,120,125,C.body,'#8ba5b8',8);
    d.text(270,223,'LDO',23,C.ink,'middle'); d.text(218,180,'IN',16); d.text(292,180,'OUT',16);
    d.trace([[45,175],[190,175]],C.power); d.trace([[350,175],[475,175]],C.power);
    d.pad(45,175,C.power); d.pad(475,175,C.power);
    d.text(40,140,'VIN',17,C.power); d.text(430,140,'VOUT',17,C.power);
    d.pad(190,175,C.power,40,26); d.pad(350,175,C.power,40,26);
    // One component-side ground connection also reaches the plane through vias.
    d.trace([[110,265],[110,300],[420,300],[420,265]],C.ground,16);
    d.trace([[270,290],[270,300]],C.ground,16); d.pad(270,290,C.ground,26,40);
    d.text(270,259,'GND',16,C.ground,'middle');
    d.via(160,300,C.ground); d.via(380,300,C.ground);
    d.passive(110,220,'Cin',{span:90,labelY:116});
    d.passive(420,220,'Cout',{span:90,labelY:116});
    d.text(62,339,'Wide local ground copper + plane vias',17,C.ground);
    return [d.name,d.finish('Generic pinout · thermal/sense/NR details omitted')];
}

const drawings=[local(),local(true),underside(),section(),neck(),buck(),ldo()];
if(!process.argv.includes('--check')) fs.mkdirSync(output,{recursive:true});
for(const [name,svg] of drawings) {
    const file=path.join(output,name+'.svg');
    if(process.argv.includes('--check')) assert.strictEqual(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),svg, name+': stale generated drawing');
    else fs.writeFileSync(file,svg);
}
console.log(`${process.argv.includes('--check')?'Checked':'Built'} ${drawings.length} editable capacitor-placement SVGs`);
