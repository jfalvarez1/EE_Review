#!/usr/bin/env node
/**
 * check-raw-svg - the fourth way a lesson draws a circuit, and the one nothing
 * was looking at.
 *
 * Why this exists.
 *
 * A reader opened module 10 lesson 1 and found the 10x probe schematic broken.
 * Three checkers should have caught it and none of them could:
 *
 *   check-diagram-nets     only reads ComponentModels.diagram() part lists
 *   check-svg-nets         only reads the SchematicSVG / AD.Schematic API
 *   check-canvas-circuits  only reads <canvas> drawing code
 *
 * That probe circuit is none of those. It is hand-written <line x1=...> markup,
 * either inside a template literal assigned to innerHTML or written straight
 * into the lesson - a fourth drawing style used in sixty-odd lessons that had
 * never been checked at all. In it, a wire ran up from the ground bus and
 * stopped 65 pixels short of the node it was meant to reach.
 *
 * So this parses the raw geometry and rebuilds the connectivity from it:
 *
 *   DANGLING   a wire end that touches nothing. Gating, against a baseline.
 *   NO-DOT     three or more wires meeting with no junction dot, so a reader
 *              cannot tell a connection from a crossing. Advisory, because
 *              plenty of older figures do this and it is cosmetic next to a
 *              wire that goes nowhere.
 *
 * Most of the work is deciding what is a WIRE, because these figures are drawn
 * with one primitive for everything. A capacitor plate, a ground bar, an axis,
 * a dashed coupling arrow and an actual net are all <line>. Anything
 * classified as a symbol still counts for connectivity - a wire may legally
 * end on a capacitor plate - but is never itself reported as dangling, since
 * its own ends are open by construction.
 *
 * Transforms are honoured. Half these figures build a component once inside
 * <g transform="translate(...)"> and place it several times, so a parser that
 * ignores transforms reads every copy at the same coordinates and reports
 * connections that are not there.
 *
 *   node tools/check-raw-svg.js            summary + regressions
 *   node tools/check-raw-svg.js --all      every figure, including clean ones
 *   node tools/check-raw-svg.js --dots     also list the missing junction dots
 *   node tools/check-raw-svg.js --bless    record the current state as the baseline
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const BASELINE = path.join(ROOT, 'tools', 'raw-svg-baseline.json');
const SHOW_ALL = process.argv.includes('--all');
const SHOW_DOTS = process.argv.includes('--dots');
const BLESS = process.argv.includes('--bless');

const SNAP = 2.5;      // endpoints this close are the same node
const ON_LINE = 2.5;   // how close a point must be to lie "on" a segment
const MIN_WIRE = 14;   // shorter than this is a symbol stroke, not a wire
const TEXT_NEAR = 30;  // a labelled terminal may legally end in mid-air
const EDGE = 14;       // this close to the viewBox border is a frame or axis
const BODY_MAX_AREA = 0.30;

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** Every chunk of markup that could be one SVG figure. */
function svgChunks(src) {
    const out = [];
    let m;
    const tpl = /\.innerHTML\s*=\s*`([\s\S]*?)`\s*;/g;
    while ((m = tpl.exec(src))) out.push(m[1]);
    const lit = /<svg\b[\s\S]*?<\/svg>/g;
    while ((m = lit.exec(src))) out.push(m[0]);
    return out;
}

const num = s => parseFloat(s);
const attr = (tag, name) => {
    const m = new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"').exec(tag);
    return m ? m[1] : null;
};

/* ------------------------------------------------------------- transforms */

const IDENT = [1, 0, 0, 1, 0, 0];            // a b c d e f

const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
];

const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4],
                              y: m[1] * x + m[3] * y + m[5] });

/** Average scale, so lengths and stroke widths stay comparable. */
const scaleOf = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

function parseTransform(str) {
    if (!str) return IDENT;
    let out = IDENT;
    const re = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(str))) {
        const a = m[2].trim().split(/[\s,]+/).map(num).filter(isFinite);
        let t = IDENT;
        if (m[1] === 'translate') t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
        else if (m[1] === 'scale') t = [a[0] || 1, 0, 0, a.length > 1 ? a[1] : (a[0] || 1), 0, 0];
        else if (m[1] === 'matrix' && a.length === 6) t = a;
        else if (m[1] === 'rotate') {
            const r = (a[0] || 0) * Math.PI / 180;
            const c = Math.cos(r), s = Math.sin(r);
            t = [c, s, -s, c, 0, 0];
            if (a.length === 3) {
                t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
            }
        }
        out = mul(out, t);
    }
    return out;
}

/* ------------------------------------------------------------- geometry */

function viewBox(body) {
    const m = /viewBox\s*=\s*"([^"]*)"/.exec(body);
    if (!m) return null;
    const p = m[1].trim().split(/[\s,]+/).map(num);
    return p.length === 4 && p.every(isFinite)
        ? { x: p[0], y: p[1], w: p[2], h: p[3] } : null;
}

/**
 * One pass over the markup in document order, carrying a transform stack, so
 * every coordinate below is in root space.
 */
function parse(body, vb) {
    const segs = [], dots = [], texts = [], bodies = [];
    const stack = [IDENT];
    const top = () => stack[stack.length - 1];

    function pushSeg(x1, y1, x2, y2, tag, opts) {
        if (![x1, y1, x2, y2].every(isFinite)) return;
        const M = top();
        const a = apply(M, x1, y1), b = apply(M, x2, y2);
        const cls = attr(tag, 'class') || '';
        const sw = parseFloat(attr(tag, 'stroke-width') || '2') * scaleOf(M);
        const dashed = /stroke-dasharray/.test(tag);
        const len = Math.hypot(b.x - a.x, b.y - a.y);

        // Long and hugging the frame: an axis, a border or a divider rule.
        let atEdge = false;
        if (vb && len > 0.55 * Math.max(vb.w, vb.h)) {
            const nL = p => p <= vb.x + EDGE, nR = p => p >= vb.x + vb.w - EDGE;
            const nT = p => p <= vb.y + EDGE, nB = p => p >= vb.y + vb.h - EDGE;
            atEdge = (nL(a.x) && nL(b.x)) || (nR(a.x) && nR(b.x)) ||
                     (nT(a.y) && nT(b.y)) || (nB(a.y) && nB(b.y));
        }

        segs.push({
            x1: a.x, y1: a.y, x2: b.x, y2: b.y, len, cls, sw,
            symbol: (opts && opts.symbol) || dashed || atEdge ||
                    /comp|plate|body|symbol|arrow|axis|grid|tick|hatch|shade/i.test(cls) ||
                    /marker-(?:end|start|mid)\s*=/.test(tag) ||
                    sw >= 3 || len < MIN_WIRE
        });
    }

    const area = vb ? vb.w * vb.h : Infinity;

    // Content inside <defs>, <marker>, <symbol>, <clipPath> or <pattern> is a
    // template drawn at its own tiny coordinates and instantiated elsewhere.
    // Reading it as geometry puts phantom wires near the origin, which is what
    // two of this checker's last four failures turned out to be.
    body = body.replace(/<(defs|marker|symbol|clipPath|pattern)\b[\s\S]*?<\/\1>/gi, '');

    const tag = /<\/?\s*(g|svg|line|polyline|polygon|path|rect|circle|ellipse|text)\b[^>]*>/gi;
    let m;
    while ((m = tag.exec(body))) {
        const t = m[0];
        const name = m[1].toLowerCase();
        const closing = /^<\s*\//.test(t);

        if (name === 'g' || name === 'svg') {
            if (closing) { if (stack.length > 1) stack.pop(); }
            else if (!/\/>$/.test(t)) stack.push(mul(top(), parseTransform(attr(t, 'transform'))));
            continue;
        }
        if (closing) continue;

        if (name === 'line') {
            pushSeg(num(attr(t, 'x1')), num(attr(t, 'y1')),
                    num(attr(t, 'x2')), num(attr(t, 'y2')), t);

        } else if (name === 'polyline') {
            const pts = (attr(t, 'points') || '').trim()
                .split(/\s+/).map(p => p.split(',').map(num))
                .filter(p => p.length === 2 && p.every(isFinite));
            // A resistor zigzag is about eight points. Much longer than that
            // is a plotted waveform, whose two ends dangle by definition.
            // A resistor zigzag is about eight points, and so is a drawn
            // square wave - but the square wave visits only TWO distinct y
            // values and a zigzag visits three or more. Either way, a plotted
            // trace has two ends that dangle by definition.
            const levels = new Set(pts.map(q => Math.round(q[1])));
            const cols = new Set(pts.map(q => Math.round(q[0])));
            const wave = pts.length > 14 ||
                         (pts.length >= 6 && (levels.size <= 2 || cols.size <= 2));
            for (let i = 1; i < pts.length; i++) {
                pushSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], t,
                        { symbol: wave });
            }

        } else if (name === 'path') {
            const d = attr(t, 'd');
            if (!d || /[cqasCQAS]/.test(d)) continue;    // curves are decoration
            const toks = d.match(/[MLHVmlhv]|-?\d*\.?\d+/g) || [];
            let cx = NaN, cy = NaN, cmd = null;
            for (let i = 0; i < toks.length;) {
                if (/[MLHVmlhv]/.test(toks[i])) { cmd = toks[i++]; continue; }
                const px = cx, py = cy;
                if (cmd === 'M' || cmd === 'L') { cx = num(toks[i++]); cy = num(toks[i++]); }
                else if (cmd === 'H') { cx = num(toks[i++]); }
                else if (cmd === 'V') { cy = num(toks[i++]); }
                else { i++; continue; }
                if (cmd !== 'M' && isFinite(px)) pushSeg(px, py, cx, cy, t);
            }

        } else if (name === 'rect') {
            // A DASHED rectangle is an annotation frame - "Probe (10x)",
            // "Scope Input" - not a component. Treating one as a body swallows
            // every dangling wire drawn inside it, which is exactly how the
            // module 10 probe schematic survived the first version of this
            // check. A rectangle covering most of the drawing is a panel, for
            // the same reason.
            if (/stroke-dasharray/.test(t)) continue;
            const x = num(attr(t, 'x')), y = num(attr(t, 'y'));
            const w = num(attr(t, 'width')), h = num(attr(t, 'height'));
            if (![x, y, w, h].every(isFinite)) continue;
            const M = top(), s = scaleOf(M);
            if (w * h * s * s > BODY_MAX_AREA * area) continue;
            const p = apply(M, x, y), q = apply(M, x + w, y + h);
            bodies.push({ kind: 'rect',
                          x: Math.min(p.x, q.x), y: Math.min(p.y, q.y),
                          w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) });

        } else if (name === 'circle' || name === 'ellipse') {
            const cx = num(attr(t, 'cx')), cy = num(attr(t, 'cy'));
            const rx = num(attr(t, 'rx') || attr(t, 'r'));
            const ry = num(attr(t, 'ry') || attr(t, 'r'));
            if (![cx, cy, rx, ry].every(isFinite)) continue;
            const M = top(), s = scaleOf(M);
            const c = apply(M, cx, cy);
            if (rx * s <= 7 && name === 'circle') { dots.push(c); continue; }
            if (/stroke-dasharray/.test(t)) continue;
            if (Math.PI * rx * ry * s * s > BODY_MAX_AREA * area) continue;
            if (rx * s > 6) bodies.push({ kind: 'ellipse', cx: c.x, cy: c.y,
                                          rx: rx * s, ry: ry * s });

        } else if (name === 'polygon') {
            // Op-amps, comparators and buffers are triangles, and a wire
            // legitimately ends on the tip of one. Without this every op-amp
            // in the course reads as three wires going nowhere.
            const pts = (attr(t, 'points') || '').trim()
                .split(/\s+/).map(p => p.split(',').map(num))
                .filter(p => p.length === 2 && p.every(isFinite))
                .map(p => apply(top(), p[0], p[1]));
            if (pts.length >= 3) bodies.push({ kind: 'poly', pts });

        } else if (name === 'text') {
            const x = num(attr(t, 'x')), y = num(attr(t, 'y'));
            if (isFinite(x) && isFinite(y)) texts.push(apply(top(), x, y));
        }
    }

    const hasGround = markGroundStacks(segs);
    markBarPairs(segs);
    markCathodeBars(segs, bodies);
    markPlotRegions(segs, dots);
    return { segs, dots, texts, bodies, hasGround };
}

/**
 * A ground symbol is two to four horizontal bars, stacked a few pixels apart,
 * each shorter than the one above and centred on the same x. Drawn that way in
 * most of these figures, and every bar end would otherwise be reported as a
 * wire going nowhere - which was 40% of this checker's first run.
 */
function markGroundStacks(segs) {
    let found = false;
    const bars = segs
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => Math.abs(s.y1 - s.y2) < 1 && s.len >= 4 && s.len <= 60)
        .map(({ s, i }) => ({ i, y: s.y1, cx: (s.x1 + s.x2) / 2, len: s.len }));

    bars.forEach(a => {
        const stack = bars.filter(b =>
            Math.abs(b.cx - a.cx) <= 6 && b.y > a.y - 0.5 && b.y - a.y <= 22);
        if (stack.length < 2) return;
        stack.sort((p, q) => p.y - q.y);
        let shrinking = true;
        for (let k = 1; k < stack.length; k++) {
            if (stack[k].len >= stack[k - 1].len - 1) { shrinking = false; break; }
        }
        if (shrinking) { found = true; stack.forEach(b => { segs[b.i].symbol = true; }); }
    });

    // The one-bar case: a horizontal bar whose exact centre is met by the end
    // of a vertical stub, and which connects to nothing else. That is a supply
    // rail or a ground terminator drawn the lazy way - "3.3V" over a bar with
    // a stub hanging off the middle - and both of its ends are open on
    // purpose. Marking it only stops it being REPORTED; it still conducts, so
    // nothing downstream is affected.
    //
    // Widened from the ground-symbol size because rails get drawn long: the
    // 3.3 V rail in module 7 lesson 8 is a hundred pixels of bar.
    const verticals = segs.filter(s => Math.abs(s.x1 - s.x2) < 1);
    const allBars = segs
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => Math.abs(s.y1 - s.y2) < 1 && s.len >= 4 && s.len <= 240)
        .map(({ s, i }) => ({ i, y: s.y1, cx: (s.x1 + s.x2) / 2, len: s.len }));

    allBars.forEach(b => {
        if (segs[b.i].symbol) return;
        const met = verticals.some(v =>
            Math.abs(v.x1 - b.cx) <= 4 &&
            (Math.abs(v.y1 - b.y) <= 3 || Math.abs(v.y2 - b.y) <= 3));
        if (met) { found = true; segs[b.i].symbol = true; }
    });
    return found;
}

/**
 * The two parallel bars that make a transistor.
 *
 * A MOSFET hand-drawn from primitives is a gate bar and a channel bar, six to
 * twelve pixels apart; a BJT is a base bar beside its lead. Both bars have open
 * ends by construction - nothing is supposed to connect to the top of a gate
 * plate - and both were being reported. Capacitor plates are already caught by
 * their stroke width; these are not, because they are drawn at the same weight
 * as the wires.
 *
 * Two parallel axis-aligned segments, offset by less than a component's width
 * and overlapping along their shared axis, is a symbol. Two bus wires that
 * close together would be unreadable, so the pattern is unambiguous in
 * practice.
 */
/**
 * The bar on the end of a diode.
 *
 * A diode is a triangle and a bar across its tip, and an LED, a Schottky and a
 * Zener are the same with decoration. The bar is a component stroke with two
 * open ends, and it has no parallel partner to catch it the way a transistor's
 * two bars catch each other - so it needs its own rule: a short segment whose
 * MIDPOINT sits on a polygon's vertex is a cathode.
 */
function markCathodeBars(segs, bodies) {
    const verts = [];
    bodies.forEach(b => { if (b.kind === 'poly') verts.push(...b.pts); });
    if (!verts.length) return;

    segs.forEach(s => {
        if (s.symbol || s.len > 34) return;
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        if (verts.some(v => Math.hypot(v.x - mx, v.y - my) <= 5)) s.symbol = true;
    });
}

function markBarPairs(segs) {
    const axis = s => Math.abs(s.y1 - s.y2) < 1 ? 'h'
                    : Math.abs(s.x1 - s.x2) < 1 ? 'v' : null;

    for (let i = 0; i < segs.length; i++) {
        const a = segs[i], ax = axis(a);
        if (!ax || a.len < 15 || a.len > 90) continue;
        for (let j = i + 1; j < segs.length; j++) {
            const b = segs[j];
            if (axis(b) !== ax || b.len < 15 || b.len > 90) continue;

            const off = ax === 'v' ? Math.abs(a.x1 - b.x1) : Math.abs(a.y1 - b.y1);
            if (off < 4 || off > 16) continue;

            const [a0, a1] = ax === 'v' ? [Math.min(a.y1, a.y2), Math.max(a.y1, a.y2)]
                                        : [Math.min(a.x1, a.x2), Math.max(a.x1, a.x2)];
            const [b0, b1] = ax === 'v' ? [Math.min(b.y1, b.y2), Math.max(b.y1, b.y2)]
                                        : [Math.min(b.x1, b.x2), Math.max(b.x1, b.x2)];
            const overlap = Math.min(a1, b1) - Math.max(a0, b0);
            if (overlap < 0.5 * Math.min(a.len, b.len)) continue;

            a.symbol = true; b.symbol = true;
        }
    }
}

/**
 * Inset plots.
 *
 * Several schematics carry a little graph in a corner - "TC cancellation",
 * "gain vs frequency" - drawn with the same <line> elements as the circuit.
 * Its axes and its traces all end in mid-air by definition, and reporting them
 * buries the one wire that actually matters.
 *
 * A plot is an L of two long perpendicular segments meeting at a corner, with
 * at least two more segments living entirely inside the rectangle they span,
 * and no junction dots anywhere in it. A schematic corner passes the first
 * test and fails the other two: wires turning a corner have nodes near them.
 */
function markPlotRegions(segs, dots) {
    const H = segs.filter(s => Math.abs(s.y1 - s.y2) < 1 && s.len >= 60);
    const V = segs.filter(s => Math.abs(s.x1 - s.x2) < 1 && s.len >= 40);

    H.forEach(h => V.forEach(v => {
        const corner = [[h.x1, h.y1], [h.x2, h.y2]].some(([hx, hy]) =>
            [[v.x1, v.y1], [v.x2, v.y2]].some(([vx, vy]) =>
                Math.hypot(hx - vx, hy - vy) <= 5));
        if (!corner) return;

        const pad = 6;
        const x0 = Math.min(h.x1, h.x2, v.x1, v.x2) - pad;
        const x1 = Math.max(h.x1, h.x2, v.x1, v.x2) + pad;
        const y0 = Math.min(h.y1, h.y2, v.y1, v.y2) - pad;
        const y1 = Math.max(h.y1, h.y2, v.y1, v.y2) + pad;
        if ((x1 - x0) < 60 || (y1 - y0) < 30) return;

        const inside = s => s.x1 >= x0 && s.x1 <= x1 && s.x2 >= x0 && s.x2 <= x1 &&
                            s.y1 >= y0 && s.y1 <= y1 && s.y2 >= y0 && s.y2 <= y1;
        const within = segs.filter(s => s !== h && s !== v && inside(s));
        if (within.length < 2) return;
        if (dots.some(d => d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1)) return;

        h.symbol = true; v.symbol = true;
        within.forEach(s => { s.symbol = true; });
    }));
}

/**
 * A wire terminates ON a body, which means at its perimeter. Anywhere deep
 * inside a large block is a wire that stops in the middle of a chip, which is
 * a defect rather than a connection. Small bodies get containment, since a
 * twenty-pixel square is all perimeter anyway.
 */
function touchesBody(x, y, b) {
    const pad = 5;
    if (b.kind === 'poly') {
        // Distance to the nearest edge of the outline.
        for (let i = 0; i < b.pts.length; i++) {
            const p = b.pts[i], q = b.pts[(i + 1) % b.pts.length];
            const dx = q.x - p.x, dy = q.y - p.y;
            const L2 = dx * dx + dy * dy;
            let t = L2 ? ((x - p.x) * dx + (y - p.y) * dy) / L2 : 0;
            t = Math.max(0, Math.min(1, t));
            if (Math.hypot(x - (p.x + t * dx), y - (p.y + t * dy)) <= pad + 2) return true;
        }
        return false;
    }
    if (b.kind === 'rect') {
        const inside = x >= b.x - pad && x <= b.x + b.w + pad &&
                       y >= b.y - pad && y <= b.y + b.h + pad;
        if (!inside) return false;
        if (b.w <= 60 && b.h <= 60) return true;
        const edge = Math.min(Math.abs(x - b.x), Math.abs(x - (b.x + b.w)),
                              Math.abs(y - b.y), Math.abs(y - (b.y + b.h)));
        return edge <= pad + 3;
    }
    const dx = (x - b.cx) / (b.rx + pad), dy = (y - b.cy) / (b.ry + pad);
    return dx * dx + dy * dy <= 1;
}

/**
 * Is this chunk a circuit at all? Timing diagrams, block diagrams, mechanical
 * sketches and plots are drawn the same way and have no nets. A circuit is
 * distinguished by carrying component values with units, and by having enough
 * wires to be worth checking.
 */
const UNIT = /\d\s*(?:[munpkKMG]|&micro;|µ)?\s*(?:&Omega;|Ω|ohm|F\b|H\b|V\b|A\b)/;

function looksLikeCircuit(body, segs, dots, hasGround) {
    if (segs.filter(s => !s.symbol).length < 5) return false;
    if ((body.match(new RegExp(UNIT.source, 'g')) || []).length < 2) return false;

    // A figure that compares two SYMBOLS - a Schottky beside a sync FET, each
    // with a stub of wire either side - has values, has lines, and has no nets
    // at all. Its stubs are open on purpose and reporting them is noise. What
    // separates a circuit from a symbol gallery is evidence that nodes were
    // thought about: junction dots, or a ground.
    return dots.length >= 2 || hasGround;
}

const key = (x, y) => Math.round(x / SNAP) + ':' + Math.round(y / SNAP);

function onSegment(px, py, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const L2 = dx * dx + dy * dy;
    if (!L2) return false;
    const t = ((px - s.x1) * dx + (py - s.y1) * dy) / L2;
    if (t <= 0.02 || t >= 0.98) return false;
    return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy)) <= ON_LINE;
}

function analyse(body) {
    const vb = viewBox(body);
    const { segs, dots: D, texts: T, bodies: B, hasGround } = parse(body, vb);
    if (!looksLikeCircuit(body, segs, D, hasGround)) return null;

    const deg = new Map(), pos = new Map();
    const bump = (x, y, n) => {
        const k = key(x, y);
        deg.set(k, (deg.get(k) || 0) + n);
        if (!pos.has(k)) pos.set(k, { x, y });
    };
    segs.forEach(s => { bump(s.x1, s.y1, 1); bump(s.x2, s.y2, 1); });

    const ends = [];
    segs.forEach(s => {
        [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => {
            ends.push({ x, y, seg: s });
            segs.forEach(o => { if (o !== s && onSegment(x, y, o)) bump(x, y, 1); });
        });
    });

    const near = (x, y, list, r) => list.some(p => Math.hypot(p.x - x, p.y - y) <= r);

    // A PORT is an endpoint at the outside edge of the drawing with a label
    // near it - "Loop+", "Vin", "D+". Those are supposed to end in mid-air;
    // that is what makes them ports. The label can sit further away than an
    // internal annotation would, because there is nothing beside it to crowd,
    // so the distance allowance is larger and the position is what qualifies
    // it rather than the distance alone.
    const wires = segs.filter(s => !s.symbol);
    const bbox = wires.length ? {
        x0: Math.min(...wires.map(s => Math.min(s.x1, s.x2))),
        x1: Math.max(...wires.map(s => Math.max(s.x1, s.x2))),
        y0: Math.min(...wires.map(s => Math.min(s.y1, s.y2))),
        y1: Math.max(...wires.map(s => Math.max(s.y1, s.y2)))
    } : null;
    const isPort = (x, y) => {
        if (!bbox) return false;
        const edge = Math.min(Math.abs(x - bbox.x0), Math.abs(x - bbox.x1),
                              Math.abs(y - bbox.y0), Math.abs(y - bbox.y1));
        return edge <= 25 && near(x, y, T, 60);
    };

    const dangling = [], seen = new Set();
    ends.forEach(e => {
        if (e.seg.symbol) return;
        const k = key(e.x, e.y);
        if (seen.has(k) || (deg.get(k) || 0) > 1) return;
        if (near(e.x, e.y, D, 9)) return;                    // a marker sits there
        if (near(e.x, e.y, T, TEXT_NEAR)) return;            // labelled terminal
        if (isPort(e.x, e.y)) return;                        // labelled edge port
        if (B.some(b => touchesBody(e.x, e.y, b))) return;   // lands on a body
        seen.add(k);
        dangling.push({ x: Math.round(e.x), y: Math.round(e.y),
                        len: Math.round(e.seg.len) });
    });

    const noDot = [];
    deg.forEach((n, k) => {
        if (n < 3) return;
        const p = pos.get(k);
        if (!near(p.x, p.y, D, 9)) noDot.push(p);
    });

    return { segs: segs.length, wires: segs.filter(s => !s.symbol).length,
             dangling, noDot };
}

/* ------------------------------------------------------------------- run */

const files = walk(LESSONS, []).sort();
let figures = 0, dangleTotal = 0, dotTotal = 0;
const found = {};
const report = [];

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    svgChunks(src).forEach((body, i) => {
        const r = analyse(body);
        if (!r) return;
        figures++;
        dotTotal += r.noDot.length;
        dangleTotal += r.dangling.length;
        if (r.dangling.length) found[rel + '#' + (i + 1)] = r.dangling.length;
        if (r.dangling.length || SHOW_ALL) report.push({ rel, i, r });
    });
});

if (BLESS) {
    fs.writeFileSync(BASELINE, JSON.stringify({
        note: 'Figures with wires that go nowhere, recorded so new ones fail ' +
              'the build while the existing backlog is worked through. ' +
              'Never raise a number here to make a check pass - fix the figure.',
        figures: found
    }, null, 2) + '\n');
    console.log('Baseline written: ' + Object.keys(found).length + ' figure(s), ' +
                dangleTotal + ' dangling end(s).');
    process.exit(0);
}

const base = fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).figures || {}
    : {};

console.log('RAW INLINE SVG CIRCUITS\n');

report.forEach(({ rel, i, r }) => {
    const id = rel + '#' + (i + 1);
    const allowed = base[id] || 0;
    const isNew = r.dangling.length > allowed;
    console.log('  ' + (r.dangling.length ? (isNew ? 'FAIL' : 'debt') : 'ok  ') +
                '  ' + rel + '  (figure ' + (i + 1) + ', ' + r.wires + ' wires of ' +
                r.segs + ')' + (allowed && !isNew ? '   [known: ' + allowed + ']' : ''));
    if (isNew || SHOW_ALL) {
        r.dangling.forEach(d => {
            console.log('          wire ends at (' + d.x + ', ' + d.y +
                        ') and touches nothing  [' + d.len + ' px long]');
        });
    }
    if (SHOW_DOTS) {
        r.noDot.forEach(p => console.log('          ' + Math.round(p.x) + ', ' +
                                         Math.round(p.y) +
                                         ': wires meet with no junction dot'));
    }
});

const regressions = Object.keys(found).filter(k => found[k] > (base[k] || 0));
const fixed = Object.keys(base).filter(k => !found[k]);

console.log('');
console.log('  circuit figures found          ' + String(figures).padStart(4));
console.log('  dangling wire ends             ' + String(dangleTotal).padStart(4) +
            '   (baseline ' +
            Object.values(base).reduce((a, b) => a + b, 0) + ')');
console.log('  junctions drawn without a dot  ' + String(dotTotal).padStart(4) +
            '   (advisory' + (SHOW_DOTS ? '' : '; --dots to list') + ')');
if (fixed.length) console.log('  figures repaired since baseline ' + fixed.length);
console.log('');

if (regressions.length) {
    console.log('FAIL - ' + regressions.length + ' figure(s) have NEW wires that go nowhere:');
    regressions.forEach(k => console.log('    ' + k));
    process.exit(1);
}
console.log('PASS - no new dangling wires. ' + dangleTotal +
            ' known, in ' + Object.keys(found).length + ' figure(s).');
