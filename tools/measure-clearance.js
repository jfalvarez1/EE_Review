#!/usr/bin/env node
/**
 * measure-clearance - the actual minimum copper-to-copper spacing on a board,
 * and the voltage at which it stops being compliant.
 *
 * A clearance table is abstract until you measure a board against it. This
 * takes the board JSON from board-to-json.js, finds the closest approach
 * between copper belonging to DIFFERENT nets on the same layer, and reports
 * the tightest pairs with their coordinates - so a lesson figure can draw a
 * box round them and say "that one, there".
 *
 * It then reads the IPC-2221B table backwards: given the measured gap, what is
 * the highest voltage this board is rated for, on an internal layer, on an
 * uncoated external layer, and coated?
 *
 * Usage: node tools/measure-clearance.js <board.json> [--top N]
 */

const fs = require('fs');

// IPC-2221B Table 6-1: [Vmax, B1 internal, B2 external uncoated, B4 coated] mm
const IPC = [
    [15,  0.05, 0.10, 0.05],
    [30,  0.05, 0.10, 0.05],
    [50,  0.10, 0.60, 0.13],
    [100, 0.10, 0.60, 0.13],
    [150, 0.20, 0.60, 0.40],
    [170, 0.20, 1.25, 0.40],
    [250, 0.20, 1.25, 0.40],
    [300, 0.20, 1.25, 0.40],
    [500, 0.25, 2.50, 0.80]
];
const PER_VOLT = { internal: 0.0025, external: 0.005, coated: 0.00305 };

/** Highest voltage this gap satisfies, for a given column. */
function maxVoltageFor(gap, kind) {
    const col = kind === 'internal' ? 1 : (kind === 'coated' ? 3 : 2);
    let best = 0;
    for (let i = 0; i < IPC.length; i++) {
        if (gap >= IPC[i][col]) best = IPC[i][0];
    }
    if (best === 500) {
        const base = IPC[IPC.length - 1][col];
        if (gap > base) best = 500 + (gap - base) / PER_VOLT[kind];
    }
    return best;
}

// ---- geometry -----------------------------------------------------------
function segDist(a, b) {
    // Shortest distance between two segments, then subtract both half-widths.
    const d = segSegDistance(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2);
    return d - a.w / 2 - b.w / 2;
}

function segSegDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
    if (segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4)) return 0;
    return Math.min(
        pointSeg(x1, y1, x3, y3, x4, y4),
        pointSeg(x2, y2, x3, y3, x4, y4),
        pointSeg(x3, y3, x1, y1, x2, y2),
        pointSeg(x4, y4, x1, y1, x2, y2)
    );
}

function pointSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function orient(ax, ay, bx, by, cx, cy) {
    const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
    return v > 1e-12 ? 1 : (v < -1e-12 ? -1 : 0);
}

function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const o1 = orient(x1, y1, x2, y2, x3, y3);
    const o2 = orient(x1, y1, x2, y2, x4, y4);
    const o3 = orient(x3, y3, x4, y4, x1, y1);
    const o4 = orient(x3, y3, x4, y4, x2, y2);
    return o1 !== o2 && o3 !== o4;
}

// ---- main ---------------------------------------------------------------
const file = process.argv[2];
if (!file) { console.error('usage: measure-clearance.js <board.json> [--top N]'); process.exit(2); }
const topN = (() => {
    const i = process.argv.indexOf('--top');
    return i > 0 ? parseInt(process.argv[i + 1], 10) || 6 : 6;
})();

const board = JSON.parse(fs.readFileSync(file, 'utf8'));

// Treat pads and vias as short zero-length segments so one loop covers all.
const items = [];
board.tracks.forEach(t => {
    if (!t.net) return;
    items.push({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, w: t.w,
                 layer: t.layer, net: t.net, kind: 'track' });
});
board.vias.forEach(v => {
    if (!v.net) return;
    // A via exists on every layer, so it is compared against all of them.
    items.push({ x1: v.x, y1: v.y, x2: v.x, y2: v.y, w: v.d,
                 layer: '*', net: v.net, kind: 'via' });
});
board.pads.forEach(p => {
    if (!p.net) return;
    // A pad's worst case is its long axis, so model it as a segment of that
    // length with the short axis as the width.
    const horiz = p.w >= p.h;
    const half = (horiz ? p.w : p.h) / 2 - (horiz ? p.h : p.w) / 2;
    items.push({
        x1: p.x - (horiz ? half : 0), y1: p.y - (horiz ? 0 : half),
        x2: p.x + (horiz ? half : 0), y2: p.y + (horiz ? 0 : half),
        w: Math.min(p.w, p.h),
        layer: p.layer.indexOf('*.Cu') >= 0 ? '*' : p.layer.trim().split(/\s+/)[0],
        net: p.net, kind: 'pad ' + p.ref
    });
});

const sameLayer = (a, b) => a.layer === '*' || b.layer === '*' || a.layer === b.layer;

const pairs = [];
for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.net === b.net) continue;         // same net: touching is correct
        if (!sameLayer(a, b)) continue;
        const g = segDist(a, b);
        if (g < 0) continue;                   // overlapping same-net artefacts
        pairs.push({ gap: g, a, b });
    }
}
pairs.sort((p, q) => p.gap - q.gap);

const mid = (s) => [ (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 ];

console.log(board.name + '  —  ' + items.length + ' copper items, ' +
            pairs.length + ' cross-net pairs\n');

console.log('TIGHTEST CLEARANCES');
pairs.slice(0, topN).forEach((p, i) => {
    const ma = mid(p.a), mb = mid(p.b);
    console.log('  ' + (i + 1) + '. ' + p.gap.toFixed(3) + ' mm   ' +
                p.a.net + ' (' + p.a.kind + ') ↔ ' + p.b.net + ' (' + p.b.kind + ')');
    console.log('       at (' + ma[0].toFixed(2) + ', ' + ma[1].toFixed(2) + ') and (' +
                mb[0].toFixed(2) + ', ' + mb[1].toFixed(2) + ')  on ' +
                (p.a.layer === '*' ? p.b.layer : p.a.layer));
});

if (pairs.length) {
    const g = pairs[0].gap;
    console.log('\nAGAINST IPC-2221B, at a minimum gap of ' + g.toFixed(3) + ' mm:');
    ['internal', 'external', 'coated'].forEach(kind => {
        const v = maxVoltageFor(g, kind);
        console.log('  ' + kind.padEnd(9) + ' rated to ' +
                    (v ? (v >= 500 ? v.toFixed(0) : v) + ' V' : 'BELOW the 15 V minimum'));
    });
    const ma = mid(pairs[0].a), mb = mid(pairs[0].b);
    const bx = Math.min(ma[0], mb[0]), by = Math.min(ma[1], mb[1]);
    const bw = Math.abs(ma[0] - mb[0]), bh = Math.abs(ma[1] - mb[1]);
    console.log('\n  annotation box: { x: ' + (bx - 1.5).toFixed(2) +
                ', y: ' + (by - 1.5).toFixed(2) +
                ', w: ' + (bw + 3).toFixed(2) +
                ', h: ' + (bh + 3).toFixed(2) + ' }');
}
