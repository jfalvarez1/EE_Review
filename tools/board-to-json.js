#!/usr/bin/env node
/**
 * board-to-json - a .kicad_pcb reduced to what a lesson figure needs.
 *
 * Why not just plot with kicad-cli? Because its SVG carries no net
 * information. Every track is an anonymous line, so a reader cannot tell which
 * copper belongs to which net, and nothing can be made interactive.
 *
 * This emits geometry WITH the net name attached to every segment, via and
 * pad, so the lesson can draw the board itself, label the nets, and let the
 * reader highlight one by hovering or clicking it.
 *
 * Output shape:
 *   {
 *     name, layers: ["F.Cu", ...], bbox: {x, y, w, h},
 *     nets: [{name, len, segs, layers:[...]}],       // sorted longest first
 *     tracks:  [{x1,y1,x2,y2,w,layer,net}],
 *     vias:    [{x,y,d,drill,net}],
 *     pads:    [{x,y,w,h,shape,layer,net,ref}],
 *     zones:   [{layer,net,polys:[[[x,y],...]]}],
 *     parts:   [{ref,x,y,layer}]
 *   }
 *
 * Usage: node tools/board-to-json.js <board.kicad_pcb> <out.json>
 */

const fs = require('fs');

function parse(text) {
    let i = 0;
    const skip = () => { while (i < text.length && /\s/.test(text[i])) i++; };
    function atom() {
        if (text[i] === '"') {
            let s = ''; i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\') i++;
                s += text[i++];
            }
            i++; return s;
        }
        let s = '';
        while (i < text.length && !/[\s()]/.test(text[i])) s += text[i++];
        return s;
    }
    function list() {
        const out = []; i++;
        for (;;) {
            skip();
            if (i >= text.length) break;
            if (text[i] === ')') { i++; break; }
            out.push(text[i] === '(' ? list() : atom());
        }
        return out;
    }
    skip();
    return list();
}

const kids = (n, name) => n.filter(c => Array.isArray(c) && c[0] === name);
const kid = (n, name) => n.find(c => Array.isArray(c) && c[0] === name);
const num = v => { const f = parseFloat(v); return isFinite(f) ? f : null; };
const xy = n => n ? [num(n[1]), num(n[2])] : null;

const file = process.argv[2], out = process.argv[3];
if (!file || !out) { console.error('usage: board-to-json.js <board.kicad_pcb> <out.json>'); process.exit(2); }

const tree = parse(fs.readFileSync(file, 'utf8'));

// ---- nets ---------------------------------------------------------------
const netName = {};
kids(tree, 'net').forEach(n => { netName[n[1]] = n[2] || ''; });
// Three forms in the wild, and getting this wrong silently blanks every net:
//   (net 5 "GND")   footprint pads, all versions
//   (net 5)         tracks and vias up to KiCad 9 - an index into the table
//   (net "GND")     KiCad 10 - the NAME directly, no table lookup
// The KiCad 10 form looks exactly like the KiCad 9 form to a naive reader, so
// a board that parsed fine came back with one net across 273 tracks.
const nameOf = node => {
    const n = kid(node, 'net');
    if (!n) return '';
    if (n[2] !== undefined) return n[2] || '';
    const v = n[1];
    if (v === undefined) return '';
    return /^\d+$/.test(v) ? (netName[v] || '') : v;
};

// ---- layers -------------------------------------------------------------
const layerNode = kid(tree, 'layers') || [];
const copper = layerNode.slice(1)
    .filter(l => Array.isArray(l) && /\.Cu$/.test(l[1]))
    .map(l => l[1]);

// ---- tracks and vias ----------------------------------------------------
const tracks = [];
kids(tree, 'segment').forEach(s => {
    const a = xy(kid(s, 'start')), b = xy(kid(s, 'end'));
    if (!a || !b) return;
    tracks.push({
        x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        w: num((kid(s, 'width') || [])[1]) || 0.2,
        layer: (kid(s, 'layer') || [])[1] || 'F.Cu',
        net: nameOf(s)
    });
});

// KiCad 8+ can also store arcs; treat them as their chord so nothing vanishes.
kids(tree, 'arc').forEach(s => {
    const a = xy(kid(s, 'start')), b = xy(kid(s, 'end'));
    if (!a || !b) return;
    tracks.push({
        x1: a[0], y1: a[1], x2: b[0], y2: b[1],
        w: num((kid(s, 'width') || [])[1]) || 0.2,
        layer: (kid(s, 'layer') || [])[1] || 'F.Cu',
        net: nameOf(s), arc: true
    });
});

const vias = kids(tree, 'via').map(v => {
    const a = xy(kid(v, 'at'));
    return {
        x: a ? a[0] : 0, y: a ? a[1] : 0,
        d: num((kid(v, 'size') || [])[1]) || 0.6,
        drill: num((kid(v, 'drill') || [])[1]) || 0.3,
        net: nameOf(v)
    };
});

// ---- footprints: their pads carry the net, and the refdes locates them ----
const pads = [], parts = [];
kids(tree, 'footprint').forEach(f => {
    const fat = kid(f, 'at');
    const fx = fat ? num(fat[1]) : 0, fy = fat ? num(fat[2]) : 0;
    const frot = fat && fat[3] !== undefined ? num(fat[3]) || 0 : 0;

    let ref = '';
    kids(f, 'fp_text').forEach(t => { if (t[1] === 'reference') ref = t[2]; });
    if (!ref) kids(f, 'property').forEach(p => { if (p[1] === 'Reference') ref = p[2]; });

    parts.push({ ref, x: fx, y: fy, layer: (kid(f, 'layer') || [])[1] || 'F.Cu' });

    kids(f, 'pad').forEach(p => {
        const pat = kid(p, 'at');
        if (!pat) return;
        const px = num(pat[1]), py = num(pat[2]);
        // Rotate the pad offset into board coordinates.
        const th = -frot * Math.PI / 180;
        const rx = px * Math.cos(th) - py * Math.sin(th);
        const ry = px * Math.sin(th) + py * Math.cos(th);
        const sz = kid(p, 'size');
        const layersNode = kid(p, 'layers') || [];
        pads.push({
            x: +(fx + rx).toFixed(4), y: +(fy + ry).toFixed(4),
            w: sz ? num(sz[1]) : 1, h: sz ? num(sz[2]) : 1,
            shape: p[2] || 'rect',
            layer: layersNode.slice(1).join(' '),
            net: nameOf(p),
            ref: ref + '.' + (p[1] || '')
        });
    });
});

// ---- zones --------------------------------------------------------------
const zones = [];
kids(tree, 'zone').forEach(z => {
    const layer = (kid(z, 'layer') || [])[1] ||
                  ((kid(z, 'layers') || []).slice(1)[0]) || '';
    // KiCad 9 writes (net 5) plus (net_name "GND"); KiCad 10 writes (net "GND")
    // and no net_name at all. Reading only net_name left every KiCad 10 plane
    // unattributed, so a ground pour did not light up when GND was selected -
    // which is exactly the thing the figure exists to show.
    const net = nameOf(z) || (kid(z, 'net_name') || [])[1] || '';
    const polys = [];
    kids(z, 'filled_polygon').forEach(fp => {
        const pts = kid(fp, 'pts');
        if (!pts) return;
        let ring = kids(pts, 'xy').map(p => [num(p[1]), num(p[2])]);
        if (ring.length <= 2) return;

        // A poured plane's outline follows every thermal relief and antipad, so
        // it can run to tens of thousands of points - one board came out at
        // 384 kB of JSON, which is not a web figure. These are drawn a few
        // hundred pixels wide over a 136 mm board, so anything under about
        // 0.05 mm is invisible. Drop points closer than that to the last one
        // kept, and round the rest to 2 dp.
        const MIN = 0.05;
        const simp = [];
        ring.forEach(p => {
            if (p[0] === null || p[1] === null) return;
            const q = [+p[0].toFixed(2), +p[1].toFixed(2)];
            const last = simp[simp.length - 1];
            if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= MIN) simp.push(q);
        });
        if (simp.length > 2) polys.push(simp);
    });
    if (polys.length) zones.push({ layer, net, polys });
});

// ---- board outline, from Edge.Cuts, else from everything -----------------
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const grow = (x, y) => {
    if (x === null || y === null) return;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
};
['gr_line', 'gr_arc', 'gr_rect'].forEach(k => {
    kids(tree, k).forEach(l => {
        if (((kid(l, 'layer') || [])[1]) !== 'Edge.Cuts') return;
        ['start', 'end', 'mid'].forEach(p => { const c = xy(kid(l, p)); if (c) grow(c[0], c[1]); });
    });
});
if (!isFinite(minX)) {
    tracks.forEach(t => { grow(t.x1, t.y1); grow(t.x2, t.y2); });
    pads.forEach(p => grow(p.x, p.y));
    vias.forEach(v => grow(v.x, v.y));
    const pad = 2;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
}

// ---- per-net summary, longest first --------------------------------------
const netAgg = {};
tracks.forEach(t => {
    const k = t.net || '(none)';
    const len = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
    if (!netAgg[k]) netAgg[k] = { name: k, len: 0, segs: 0, layers: {} };
    netAgg[k].len += len;
    netAgg[k].segs++;
    netAgg[k].layers[t.layer] = 1;
});
vias.forEach(v => {
    const k = v.net || '(none)';
    if (!netAgg[k]) netAgg[k] = { name: k, len: 0, segs: 0, layers: {} };
});
const nets = Object.values(netAgg)
    .map(n => ({ name: n.name, len: +n.len.toFixed(2), segs: n.segs,
                 layers: Object.keys(n.layers).sort() }))
    .sort((a, b) => b.len - a.len);

const round = (o, k, d) => { o[k] = +o[k].toFixed(d); };
tracks.forEach(t => { ['x1', 'y1', 'x2', 'y2', 'w'].forEach(k => round(t, k, 4)); });
vias.forEach(v => { ['x', 'y', 'd', 'drill'].forEach(k => round(v, k, 4)); });

const doc = {
    name: file.split(/[\\/]/).pop().replace(/\.kicad_pcb$/, ''),
    layers: copper,
    bbox: { x: +minX.toFixed(3), y: +minY.toFixed(3),
            w: +(maxX - minX).toFixed(3), h: +(maxY - minY).toFixed(3) },
    nets, tracks, vias, pads, zones, parts
};

fs.mkdirSync(require('path').dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc));
console.log(out + '  ' + fs.statSync(out).size + ' bytes  ' +
            '(' + copper.length + ' layers, ' + tracks.length + ' tracks, ' +
            vias.length + ' vias, ' + zones.length + ' zones, ' +
            nets.length + ' nets)');
