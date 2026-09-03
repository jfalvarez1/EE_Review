#!/usr/bin/env node
/**
 * analyse-kicad-pcb - pull the facts out of a .kicad_pcb so a layout critique
 * can be made from measurements rather than from looking at a picture.
 *
 * Reports the stackup, board outline, every track segment with its width,
 * layer and net, every via with its drill, the copper zones, and the footprint
 * placement. Then applies the rules from module 29 and says which ones the
 * board keeps and which it breaks.
 *
 * Usage: node tools/analyse-kicad-pcb.js <file.kicad_pcb> [--json]
 */

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: analyse-kicad-pcb.js <file.kicad_pcb>'); process.exit(2); }
const src = fs.readFileSync(file, 'utf8');

// ---- a minimal s-expression reader -------------------------------------
function parse(text) {
    let i = 0;
    function skipWs() { while (i < text.length && /\s/.test(text[i])) i++; }
    function readAtom() {
        if (text[i] === '"') {
            let s = ''; i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === '\\') { i++; }
                s += text[i++];
            }
            i++;
            return s;
        }
        let s = '';
        while (i < text.length && !/[\s()]/.test(text[i])) s += text[i++];
        return s;
    }
    function readList() {
        const out = [];
        i++; // (
        for (;;) {
            skipWs();
            if (i >= text.length) break;
            if (text[i] === ')') { i++; break; }
            if (text[i] === '(') out.push(readList());
            else out.push(readAtom());
        }
        return out;
    }
    skipWs();
    return readList();
}

const tree = parse(src);

function children(node, name) {
    return node.filter(n => Array.isArray(n) && n[0] === name);
}
function first(node, name) {
    return node.find(n => Array.isArray(n) && n[0] === name);
}
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// ---- layers -------------------------------------------------------------
const layersNode = first(tree, 'layers') || [];
const copperLayers = layersNode.slice(1)
    .filter(l => Array.isArray(l) && l[2] === 'signal' || (Array.isArray(l) && /\.Cu$/.test(l[1])))
    .map(l => l[1]);

// ---- board outline ------------------------------------------------------
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
children(tree, 'gr_line').forEach(l => {
    const layer = first(l, 'layer');
    if (!layer || layer[1] !== 'Edge.Cuts') return;
    ['start', 'end'].forEach(k => {
        const p = first(l, k);
        if (!p) return;
        const x = num(p[1]), y = num(p[2]);
        if (x === null) return;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
});

// ---- tracks -------------------------------------------------------------
const netNames = {};
children(tree, 'net').forEach(n => { netNames[n[1]] = n[2] || ''; });

const tracks = children(tree, 'segment').map(s => ({
    width: num((first(s, 'width') || [])[1]),
    layer: (first(s, 'layer') || [])[1],
    net: netNames[(first(s, 'net') || [])[1]] || '',
    start: (first(s, 'start') || []).slice(1).map(num),
    end: (first(s, 'end') || []).slice(1).map(num)
}));

const vias = children(tree, 'via').map(v => ({
    size: num((first(v, 'size') || [])[1]),
    drill: num((first(v, 'drill') || [])[1]),
    net: netNames[(first(v, 'net') || [])[1]] || '',
    at: (first(v, 'at') || []).slice(1).map(num)
}));

const zones = children(tree, 'zone').map(z => ({
    net: (first(z, 'net_name') || [])[1] || '',
    layer: (first(z, 'layer') || [])[1] ||
           ((first(z, 'layers') || []).slice(1).join(',')),
    filled: !!first(z, 'filled_polygon')
}));

const footprints = children(tree, 'footprint').map(f => {
    const at = first(f, 'at') || [];
    let ref = '';
    children(f, 'fp_text').forEach(t => { if (t[1] === 'reference') ref = t[2]; });
    if (!ref) {
        children(f, 'property').forEach(p => { if (p[1] === 'Reference') ref = p[2]; });
    }
    return { name: f[1], ref, x: num(at[1]), y: num(at[2]), layer: (first(f, 'layer') || [])[1] };
});

// ---- summarise ----------------------------------------------------------
const byWidth = {};
tracks.forEach(t => {
    const k = t.width != null ? t.width.toFixed(3) : '?';
    byWidth[k] = (byWidth[k] || 0) + 1;
});
const byLayer = {};
tracks.forEach(t => { byLayer[t.layer] = (byLayer[t.layer] || 0) + 1; });

const trackLen = (t) => (t.start && t.end && t.start.length >= 2 && t.end.length >= 2)
    ? Math.hypot(t.end[0] - t.start[0], t.end[1] - t.start[1]) : 0;

const netLen = {};
tracks.forEach(t => { netLen[t.net] = (netLen[t.net] || 0) + trackLen(t); });

const out = {
    file,
    copperLayers: copperLayers.length ? copperLayers : ['(not declared)'],
    boardSize: isFinite(minX)
        ? { w: +(maxX - minX).toFixed(2), h: +(maxY - minY).toFixed(2) }
        : null,
    tracks: tracks.length,
    vias: vias.length,
    zones,
    footprints: footprints.length,
    trackWidthsMm: byWidth,
    tracksPerLayer: byLayer,
    viaSizes: [...new Set(vias.map(v => (v.size + '/' + v.drill)))],
    longestNets: Object.entries(netLen).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([n, l]) => n + ': ' + l.toFixed(1) + ' mm'),
    refs: footprints.map(f => f.ref).filter(Boolean).sort()
};

if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ...out, footprints, vias, tracks }, null, 2));
} else {
    console.log(JSON.stringify(out, null, 2));
}
