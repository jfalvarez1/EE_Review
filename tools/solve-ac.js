#!/usr/bin/env node
/**
 * solve-ac - the frequency response of a build table.
 *
 * Why this exists
 * ---------------
 * solve-dc unlocked expected values for the tables that settle to a number.
 * About a quarter of the rest are filters and amplifiers, where the quantities
 * worth checking are corner frequencies, midband gains and the slopes between
 * them - and those were still being worked out by hand, with the same failure
 * mode as before. A corner I derive as 159 Hz and the circuit puts at 145 Hz is
 * a reader's evening.
 *
 * Same modified nodal analysis as solve-dc, in complex arithmetic, at a swept
 * frequency. Capacitors become jwC, inductors jwL, and sources contribute their
 * AC amplitude rather than their DC value.
 *
 * What it reports
 * ---------------
 * For each output node: the midband (or low-frequency) gain, every -3 dB corner
 * it can find by bisection, and the asymptotic slope in dB/decade above the top
 * of the sweep. Those three things are what a filter lesson actually asserts.
 *
 * A corner is found by bisecting for the crossing of gain/gain_ref = 1/sqrt(2),
 * which is exact rather than eyeballed off a grid, and is reported only when the
 * response is monotonic across the bracket - a resonant peak is not a corner and
 * saying it is would be worse than saying nothing.
 *
 *   node tools/solve-ac.js lessons/module-26/lesson-06.html
 *   node tools/solve-ac.js <file> --node out       just that node
 *   node tools/solve-ac.js <file> --at 1000        the response at one frequency
 *   node tools/solve-ac.js                         every lesson it can handle
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const TARGET = args.find(a => !a.startsWith('--') && !/^\d/.test(a));
const ONLY = (() => { const i = args.indexOf('--node'); return i === -1 ? null : args[i + 1]; })();
const AT = (() => { const i = args.indexOf('--at'); return i === -1 ? null : parseFloat(args[i + 1]); })();
// Machine-readable, for check-sim-values. Parsing the human output would work
// today and break the first time a label is reworded.
const JSON_OUT = args.includes('--json');
const FLO = 1e-2, FHI = 1e10;

// --- complex arithmetic, kept explicit so the stamps read like the algebra ---
const cx = (re, im) => ({ re, im: im || 0 });
const add = (a, b) => cx(a.re + b.re, a.im + b.im);
const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
const abs = a => Math.hypot(a.re, a.im);

/** Complex Gauss-Jordan with partial pivoting. Null when singular. */
function csolve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (abs(M[r][col]) > abs(M[piv][col])) piv = r;
        if (abs(M[piv][col]) < 1e-18) return null;
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const f = div(M[r][col], M[col][col]);
            if (f.re === 0 && f.im === 0) continue;
            for (let c = col; c <= n; c++) M[r][c] = sub(M[r][c], mul(f, M[col][c]));
        }
    }
    return M.map((row, i) => div(row[n], row[i]));
}

/** Node voltages at one frequency, as complex numbers. */
function at(parts, idx, f) {
    const w = 2 * Math.PI * f;
    const nn = idx.size;
    const branches = parts.filter(x => x.type === 'V' || x.type === 'E' || x.type === 'OA');
    const size = nn + branches.length;
    const A = Array.from({ length: size }, () => Array.from({ length: size }, () => cx(0)));
    const rhs = Array.from({ length: size }, () => cx(0));
    const nd = n => (N.isGround(n) ? -1 : idx.get(n));
    const G = (r, c, v) => { if (r >= 0 && c >= 0) A[r][c] = add(A[r][c], v); };
    const col = (r, c, v) => { if (r >= 0) A[r][c] = add(A[r][c], v); };
    const rowS = (r, c, v) => { if (c >= 0) A[r][c] = add(A[r][c], v); };

    let bi = 0;
    for (const q of parts) {
        const a = nd(q.n[0]), b = nd(q.n[1]);
        if (q.type === 'R' || q.type === 'C' || q.type === 'L') {
            let y;
            if (q.type === 'R') y = cx(1 / q.v);
            else if (q.type === 'C') y = cx(0, w * q.v);
            else y = w * q.v === 0 ? cx(1e12) : cx(0, -1 / (w * q.v));
            G(a, a, y); G(b, b, y);
            G(a, b, cx(-y.re, -y.im)); G(b, a, cx(-y.re, -y.im));
        } else if (q.type === 'I') {
            if (b >= 0) rhs[b] = add(rhs[b], cx(q.v));
            if (a >= 0) rhs[a] = sub(rhs[a], cx(q.v));
        } else if (q.type === 'V') {
            const k = nn + bi++;
            col(a, k, cx(1)); col(b, k, cx(-1));
            rowS(k, a, cx(1)); rowS(k, b, cx(-1));
            rhs[k] = cx(q.v);
        } else if (q.type === 'E') {
            const k = nn + bi++;
            col(a, k, cx(1)); col(b, k, cx(-1));
            rowS(k, a, cx(1)); rowS(k, b, cx(-1));
            rowS(k, nd(q.n[2]), cx(-q.v)); rowS(k, nd(q.n[3]), cx(q.v));
        } else if (q.type === 'OA') {
            const k = nn + bi++;
            col(nd(q.n[2]), k, cx(1));
            rowS(k, nd(q.n[0]), cx(1)); rowS(k, nd(q.n[1]), cx(-1));
        }
    }
    const x = csolve(A, rhs);
    if (!x) return null;
    const v = {};
    idx.forEach((i, n) => { v[n] = x[i]; });
    return v;
}

/**
 * Find where |H| crosses `target` between two frequencies, by bisection.
 * Returns null unless the bracket really does straddle the crossing.
 */
function bisect(mag, lo, hi, target) {
    let a = lo, b = hi;
    const fa = mag(a), fb = mag(b);
    if ((fa - target) * (fb - target) > 0) return null;
    for (let i = 0; i < 80; i++) {
        const m = Math.sqrt(a * b);                 // geometric midpoint
        if ((mag(a) - target) * (mag(m) - target) <= 0) b = m; else a = m;
    }
    return Math.sqrt(a * b);
}

const eng = f => {
    if (f >= 1e9) return (f / 1e9).toPrecision(4) + ' GHz';
    if (f >= 1e6) return (f / 1e6).toPrecision(4) + ' MHz';
    if (f >= 1e3) return (f / 1e3).toPrecision(4) + ' kHz';
    if (f >= 1) return f.toPrecision(4) + ' Hz';
    return (f * 1e3).toPrecision(4) + ' mHz';
};
const dB = g => (20 * Math.log10(g)).toFixed(2) + ' dB';

function report(rel, rows, tableNo) {
    const p = N.parse(rows, 'ac');
    const tag = rel + (tableNo > 0 ? ' [table ' + (tableNo + 1) + ']' : '');
    if (p.error) return { skip: p.error, tag };
    const parts = p.parts;
    if (!parts.some(q => (q.type === 'V' || q.type === 'I') && q.v !== 0)) {
        return { skip: 'no AC stimulus: every source is DC only', tag };
    }
    if (!parts.some(q => q.type === 'C' || q.type === 'L')) {
        return { skip: 'no reactive parts: the response is flat and solve-dc already has it', tag };
    }
    const idx = N.nodeIndex(parts);
    if (idx.size > 60) return { skip: 'too large', tag };

    const probe = f => at(parts, idx, f);
    if (!probe(1e3)) return { skip: 'singular', tag };

    const nodes = ONLY ? [ONLY] : [...idx.keys()].sort();
    const lines = [];
    const data = {};
    nodes.forEach(node => {
        if (!idx.has(node)) return;      // a Map: "in" would never match
        const mag = f => { const v = probe(f); return v ? abs(v[node]) : 0; };

        if (AT !== null) {
            const v = probe(AT);
            const m = abs(v[node]);
            data[node] = { mag: m, db: 20 * Math.log10(m),
                           phase: Math.atan2(v[node].im, v[node].re) * 180 / Math.PI };
            lines.push('  V(' + node + ') at ' + eng(AT) + ' = ' + m.toPrecision(5) +
                       '  (' + dB(m) + ', ' + data[node].phase.toFixed(1) + ' deg)');
            return;
        }

        // Sample a decade grid, then look for -3 dB crossings against whichever
        // end is the passband.
        const pts = [];
        for (let e = Math.log10(FLO); e <= Math.log10(FHI); e += 0.25) {
            const f = Math.pow(10, e);
            pts.push([f, mag(f)]);
        }
        const peak = Math.max(...pts.map(p => p[1]));
        if (peak < 1e-12) return;                      // node carries nothing

        const lo = pts[0][1], hi = pts[pts.length - 1][1];
        const dec = (a, b) => (a < 1e-18 || b < 1e-18) ? null : 20 * Math.log10(b / a);
        const loSlope = dec(mag(FLO), mag(FLO * 10));
        const hiSlope = dec(mag(FHI / 10), mag(FHI));

        // Which end is the flat one? A corner is 3 dB away from a FLAT region,
        // and which direction depends on what the other end does. Referencing
        // against max(lo,hi) unconditionally - the obvious first guess - puts a
        // rising impedance's corner at the top of the sweep, because a plane
        // that goes from 1 mohm to 3 ohms has no high-frequency passband at all:
        // it rises forever, and its corner is where wL = R, which is 3 dB ABOVE
        // the flat part rather than below anything.
        const loFlat = loSlope !== null && Math.abs(loSlope) < 1;
        const hiFlat = hiSlope !== null && Math.abs(hiSlope) < 1;
        let ref = null, target = null, refEnd = '';
        if (loFlat && (!hiFlat || lo >= hi)) { ref = lo; refEnd = 'LF'; target = hi > lo ? lo * Math.SQRT2 : lo / Math.SQRT2; }
        else if (hiFlat) { ref = hi; refEnd = 'HF'; target = lo > hi ? hi * Math.SQRT2 : hi / Math.SQRT2; }

        const corners = [];
        if (target !== null) {
            for (let i = 0; i + 1 < pts.length; i++) {
                const [f1, m1] = pts[i], [f2, m2] = pts[i + 1];
                if ((m1 - target) * (m2 - target) <= 0 && m1 !== m2) {
                    const c = bisect(mag, f1, f2, target);
                    if (c) corners.push(c);
                }
            }
        }

        let s = '  V(' + node + ')  ';
        if (ref !== null) s += refEnd + ' gain ' + dB(ref);
        else s += 'no flat region';
        if (ref !== null && peak > ref * 1.01) s += ', peaks ' + dB(peak);
        if (corners.length) s += ', 3 dB at ' + corners.map(eng).join(', ');
        if (hiSlope !== null && Math.abs(hiSlope) > 1) s += ', ' + hiSlope.toFixed(0) + ' dB/decade at the top';
        lines.push(s);
        data[node] = { ref, refDb: ref === null ? null : 20 * Math.log10(ref),
                       corners, hiSlope, peak };
    });
    return { tag, lines, data };
}

const files = TARGET ? [path.resolve(ROOT, TARGET)] : N.walk(LESSONS, []).sort();
let tables = 0, done = 0;
const skips = new Map();

files.forEach(file => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    N.tablesIn(fs.readFileSync(file, 'utf8')).forEach((rows, i) => {
        tables++;
        const r = report(rel, rows, i);
        if (r.skip) {
            const key = r.skip.replace(/:.*$/, '');
            skips.set(key, (skips.get(key) || 0) + 1);
            if (TARGET && !JSON_OUT) console.log('skip    ' + r.tag + '   ' + r.skip);
            return;
        }
        if (!r.lines.length) return;
        done++;
        if (JSON_OUT) { console.log(JSON.stringify({ table: r.tag, nodes: r.data })); return; }
        console.log('AC      ' + r.tag);
        r.lines.forEach(l => console.log(l));
    });
});

if (!TARGET && !JSON_OUT) {
    console.log('');
    console.log('AC RESPONSES\n');
    console.log('  build tables        ' + String(tables).padStart(4));
    console.log('  swept               ' + String(done).padStart(4));
    console.log('');
    [...skips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([why, n]) => {
        console.log('     ' + String(n).padStart(4) + '  ' + why);
    });
}
