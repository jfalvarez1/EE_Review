// Local review tool only. Measures actual browser text extents for every SVG.
function inkQuad(el) {
    const b=el.getBBox(),m=el.getScreenCTM();
    return [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]]
        .map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
}
function quadsOverlap(a,b) {
    for(const poly of [a,b]) for(let i=0;i<4;i++) {
        const p=poly[i],q=poly[(i+1)%4],axis={x:q.y-p.y,y:p.x-q.x};
        const aa=a.map(v=>v.x*axis.x+v.y*axis.y),bb=b.map(v=>v.x*axis.x+v.y*axis.y);
        if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa)) return false;
    }
    return true;
}
function inspectDrawing(svg) {
    const findings=[];
    const root=svg.getBoundingClientRect();
    const view=svg.viewBox.baseVal;
    const texts=[...svg.querySelectorAll('text')].filter(t=>t.textContent.trim().length>0 && !t.closest('defs'));
    const labels=texts.map(t=>({index:[...svg.querySelectorAll('text')].indexOf(t),text:t.textContent.trim(),box:t.getBoundingClientRect(),quad:inkQuad(t)})).filter(t=>t.box.width&&t.box.height);
    for(let i=0;i<labels.length;i++) {
        const a=labels[i];
        if(a.box.left<root.left-2||a.box.right>root.right+2||a.box.top<root.top-2||a.box.bottom>root.bottom+2)
            findings.push({type:'clipped-label',text:a.text,index:a.index});
        for(let j=i+1;j<labels.length;j++) {
            const b=labels[j];
            const w=Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left);
            const h=Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top);
            if(w>2 && h>2 && w*h>0.12*Math.min(a.box.width*a.box.height,b.box.width*b.box.height) && quadsOverlap(a.quad,b.quad))
                findings.push({type:'overlap',a:a.text,b:b.text,indices:[a.index,b.index]});
        }
    }
    // Test actual painted wire/component strokes too. Bounding-box checks alone
    // missed the RF lesson's explanation printed over its load and ground.
    const inside=(p,q)=>{
        let sign=0;
        for(let i=0;i<4;i++){
            const a=q[i],b=q[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y,cross=dx*(p.y-a.y)-dy*(p.x-a.x);
            if(Math.abs(cross)/Math.hypot(dx,dy)<2)return false;
            const n=Math.sign(cross);if(sign&&n!==sign)return false;sign=n;
        }return true;
    };
    const painted=[...svg.querySelectorAll('*')];
    const covers=painted.filter(el=>{
        if(!['rect','circle','ellipse','polygon','path'].includes(el.tagName)||el.closest('defs'))return false;
        const st=getComputedStyle(el),alpha=st.fill.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
        return st.fill!=='none'&&parseFloat(st.opacity)>=.95&&parseFloat(st.fillOpacity)>=.95&&(!alpha||+alpha[1]>=.95);
    });
    const strokes=[...svg.querySelectorAll('line,path,polyline')].filter(el=>!el.closest('defs'));
    for(const el of strokes){
        const style=getComputedStyle(el);
        if(style.stroke==='none'||parseFloat(style.opacity)<.4||parseFloat(style.strokeOpacity)<.4)continue;
        const color=style.stroke.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
        if(color&&+color[1]<.4)continue;
        let length;try{length=el.getTotalLength();}catch(_){continue;}
        if(!length||length>10000)continue;
        const m=el.getScreenCTM(),box=el.getBoundingClientRect();
        const above=covers.filter(c=>painted.indexOf(c)>painted.indexOf(el));
        const obscured=p=>above.some(c=>{const q=c.getScreenCTM().inverse();return c.isPointInFill(new DOMPoint(q.a*p.x+q.c*p.y+q.e,q.b*p.x+q.d*p.y+q.f));});
        const candidates=labels.filter(a=>a.box.right>=box.left&&a.box.left<=box.right&&a.box.bottom>=box.top&&a.box.top<=box.bottom);
        if(!candidates.length)continue;
        for(const a of candidates){
            let hits=0;
            for(let d=0;d<=length;d+=2){const p=el.getPointAtLength(d),pt={x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};if(inside(pt,a.quad)&&!obscured(pt)&&++hits>=3)break;}
            if(hits>=3&&!findings.some(f=>f.type==='text-crosses-stroke'&&f.index===a.index))findings.push({type:'text-crosses-stroke',text:a.text,index:a.index});
        }
    }
    return findings;
}
const auditButton=document.createElement('button');auditButton.textContent='Audit all SVG layouts';
document.querySelector('header').append(auditButton);
const output=document.createElement('pre');output.id='layout-report';output.style.whiteSpace='pre-wrap';document.body.append(output);
auditButton.onclick=async()=>{
    const test=document.createElement('div');test.style.cssText='position:absolute;left:0;top:1000px;width:900px;visibility:hidden';document.body.append(test);
    const result=[];
    for(const f of data){
        test.innerHTML=f.svg;
        const svg=test.querySelector('svg');
        if(!svg){result.push({file:f.file,id:f.id,findings:[{type:'missing-svg'}]});continue;}
        svg.style.cssText='width:900px;height:auto;max-height:none;max-width:none';
        SchematicNormalizer.run(test);
        const findings=inspectDrawing(svg);
        if(findings.length)result.push({file:f.file,id:f.id,findings});
    }
    test.remove();
    const report={audited:data.length,flagged:result.length,results:result};
    output.textContent=JSON.stringify(report,null,2);
    const saved=await fetch('/__audit_report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
    if(!saved.ok)output.textContent+='\nReport was not saved; use tools/serve-audit.py.';
    auditButton.textContent='Audit complete: '+result.length+' flagged';
};

// Review-only layout suggestions. These are exported for explicit source edits;
// the production lesson never runs an automatic label-moving algorithm.
const propose=document.createElement('button');propose.textContent='Suggest SVG label clearances';document.querySelector('header').append(propose);
propose.onclick=async()=>{
    const test=document.createElement('div');test.style.cssText='position:absolute;left:0;top:1000px;width:900px;visibility:hidden';document.body.append(test);
    const moves=[],unresolved=[];
    const offsets=[];for(let dx=-72;dx<=72;dx+=12)for(let dy=-72;dy<=72;dy+=12)if(dx||dy)offsets.push([dx,dy]);offsets.sort((a,b)=>a[0]*a[0]+a[1]*a[1]-b[0]*b[0]-b[1]*b[1]);
    for(const f of data){
        test.innerHTML=f.svg;const svg=test.querySelector('svg');svg.style.cssText='width:900px;height:auto;max-height:none;max-width:none';SchematicNormalizer.run(test);
        const labels=[...svg.querySelectorAll('text')],original=inspectDrawing(svg);
        const affected=new Set(original.flatMap(v=>v.indices||[v.index]));
        for(const [index,t] of labels.entries()){
            const text=t.textContent.trim();if(!affected.has(index))continue;
            const bad=()=>inspectDrawing(svg).some(v=>v.index===index||v.indices?.includes(index));
            if(!bad())continue;
            const initial=t.getAttribute('transform')||'',before=t.getBoundingClientRect();
            const owners=[...svg.querySelectorAll('rect')].map(r=>r.getBoundingClientRect()).filter(r=>r.left<=before.left&&r.right>=before.right&&r.top<=before.top&&r.bottom>=before.bottom&&r.width*r.height>before.width*before.height*2).sort((a,b)=>a.width*a.height-b.width*b.height);
            const owner=owners[0];let accepted=null;
            for(const [dx,dy] of offsets){
                t.setAttribute('transform',`translate(${dx} ${dy}) ${initial}`);const b=t.getBoundingClientRect();
                if(owner&&(b.left<owner.left+3||b.right>owner.right-3||b.top<owner.top+3||b.bottom>owner.bottom-3))continue;
                if(!bad()){accepted={file:f.file,id:f.id,index,text,x:t.getAttribute('x'),y:t.getAttribute('y'),dx,dy,initial};break;}
            }
            if(accepted)moves.push(accepted);else{t.setAttribute('transform',initial);unresolved.push({file:f.file,id:f.id,index,text,x:t.getAttribute('x'),y:t.getAttribute('y')});}
            propose.textContent=`Suggesting clearances: ${moves.length} placements`;
            await new Promise(requestAnimationFrame);
        }
    }
    test.remove();const report={kind:'label-proposals',moves,unresolved};output.textContent=JSON.stringify(report,null,2);
    await fetch('/__audit_report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
    propose.textContent=`Suggestions ready: ${moves.length} placements, ${unresolved.length} manual`;
};
