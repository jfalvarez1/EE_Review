#!/usr/bin/env node
/**
 * solve-dc - actually solve the build tables, instead of asserting their answers.
 *
 * Why this exists
 * ---------------
 * Every time a lesson gained expected values, the same thing happened: writing
 * down what a node should read meant solving the circuit by hand, and solving it
 * by hand is where the broken netlists were found. That worked, and it is slow,
 * and hand arithmetic is exactly the thing this repository already has three
 * checkers for because it goes wrong.
 *
 * So: modified nodal analysis over the netlist that check-build-nets already
 * parses. Where a table is linear at DC, this prints the operating point, and
 * those numbers can go into a SimCheck knowing they were computed rather than
 * remembered.
 *
 * What it handles
 * ---------------
 *   Resistor            conductance stamp
 *   Voltage source      DC value, one extra unknown for its branch current
 *   Current source      DC value, injected at the node it points AT
 *   VCVS                V(out+) - V(out-) = gain x (V(sense+) - V(sense-))
 *   Capacitor           open circuit  (DC)
 *   Inductor            short circuit (DC)
 *   Op-Amp              ideal, as a nullor: forces V(+) = V(-), output current free
 *
 * What it refuses
 * ---------------
 * Anything nonlinear or switched - diodes, transistors, switches, latches,
 * gates, transmission lines, sub-circuit blocks, "Real Op-Amp" - and any op-amp
 * marked open loop, because a comparator has no operating point to find. A table
 * containing one of those is reported as SKIP with the reason, never guessed at.
 *
 * An ideal op-amp with no feedback path also produces a singular matrix, which
 * is the correct answer to "where does an open-loop amplifier settle" and is
 * reported as such rather than as a number.
 *
 *   node tools/solve-dc.js                        summary across every lesson
 *   node tools/solve-dc.js --list                 one line per table
 *   node tools/solve-dc.js lessons/module-17/lesson-01.html    solve one file
 *   node tools/solve-dc.js <file> --verbose       show the parsed netlist too
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const VERBOSE = args.includes('--verbose');
const TARGET = args.find(a => !a.startsWith('--'));

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** Tags out, entities to something parseable. */
const text = html => html
    .replace(/<(em|small|i)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')   // asides are prose
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&thinsp;/g, ' ')
    .replace(/&minus;|&#8722;|&ndash;/g, '-')
    .replace(/&Omega;/g, 'ohm')
    .replace(/&micro;|&mu;/g, 'u')
    .replace(/&amp;/g, '&')
    .replace(/&frac12;/g, '0.5')
    .replace(/\s+/g, ' ')
    .trim();

const SI = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };

/**
 * The leading magnitude of a Value cell.
 *
 * "10 kohm" -> 10000, "2.50 V DC" -> 2.5, "1 mA DC" -> 0.001, "gain -1" -> -1.
 * Deliberately takes only the FIRST number: values here often carry a trailing
 * note, and "20 kohm (the 2R termination - not 10 k)" must not come back as 10.
 */
function magnitude(cell) {
    const s = cell.replace(/\(.*$/, '').trim();
    const m = /(-?\d+(?:\.\d+)?)\s*([TGMkKmunpf])?\s*(ohm|F|H|V|A)?\b/.exec(s);
    if (!m) return null;
    let v = parseFloat(m[1]);
    // A bare "M" before "ohm" is mega; before nothing it is ambiguous, but these
    // tables only ever use it for resistance.
    if (m[2]) v *= SI[m[2]];
    return v;
}

/** Node names out of one Connect cell, in the order they are named. */
function terminals(cell) {
    const s = cell.trim();
    const out = { kind: null, nodes: [] };
    let m;

    if ((m = /\bbetween\s+([A-Za-z0-9_+\-]+)\s+and\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        out.kind = 'two'; out.nodes = [m[1], m[2]]; return out;
    }
    if ((m = /\boutput\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)[^]*?\bsensing\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        out.kind = 'vcvs'; out.nodes = [m[1], m[2], m[3], m[4]]; return out;
    }
    if ((m = /\+\s*input\s+([A-Za-z0-9_+\-]+)\s*,\s*-\s*input\s+([A-Za-z0-9_+\-]+)\s*,\s*output\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        out.kind = 'opamp'; out.nodes = [m[1], m[2], m[3]]; return out;
    }
    if ((m = /\bfrom\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        out.kind = 'two'; out.nodes = [m[1], m[2]]; return out;
    }
    return out;
}

const isGround = n => /^(?:ground|gnd|agnd|dgnd|0)$/i.test(n);

/**
 * Parts this solver has no business pretending to know the answer for.
 *
 * The short alternatives all carry word boundaries on purpose. Without them
 * "led" matches inside "contro-LLED- source" and silently skipped every VCVS in
 * the course, which is most of what this tool exists to solve.
 */
const NONLINEAR = new RegExp([
    'diode', 'transistor', 'mosfet', 'nmos', 'pmos', 'bjt', 'jfet', 'switch',
    'latch', '\\bgate\\b', 'flip-flop', 'counter', 'shift register', 'adder',
    '\\bmux\\b', 'decoder', 'block', 'sub-circuit', 'transmission line',
    'crystal', 'transformer', 'coupling', 'motor', 'lamp', '\\bled\\b',
    'opto', 'thermistor', 'photo', 'memristor', 'varactor', 'tunnel', '\\bujt\\b',
    '\\bmcu\\b', '\\badc\\b', '\\bdac\\b', '\\bpll\\b', '\\bvco\\b', 'real op-amp',
    'battery', '\\bfuse\\b', 'antenna', 'tri-state', 'programmable'
].join('|'), 'i');

/**
 * The DC value of a source whose description is a waveform.
 *
 * A sine sits at its offset, or at zero without one. A pulse has no single DC
 * value at all and is reported rather than averaged, because averaging it would
 * quietly answer a different question than the one the lesson asks.
 */
function sourceDC(value) {
    if (/\bpulse\b|\bsawtooth\b|\btriangle\b|\bpwm\b|\bpwl\b|\bclock\b|\bnoise\b|\barb\b|3-phase|\bfm\b|\bam\b/i.test(value)) {
        return { skip: 'time-varying source, no single DC value' };
    }
    const off = /\boffset\s+(-?\d+(?:\.\d+)?)\s*([TGMkKmunpf])?/i.exec(value);
    if (off) return { v: parseFloat(off[1]) * (off[2] ? SI[off[2]] : 1) };
    if (/\bsine\b/i.test(value)) return { v: 0 };            // AC only, no offset
    const m = magnitude(value);
    return m === null ? { skip: 'no value' } : { v: m };
}

/**
 * Solve Ax = b by Gaussian elimination with partial pivoting.
 * Returns null when the matrix is singular, which for these circuits means the
 * question had no single answer rather than that something went wrong.
 */
function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-12) return null;
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const f = M[r][col] / M[col][col];
            if (f === 0) continue;
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    // Full Gauss-Jordan above, so the matrix is diagonal and each unknown is
    // just its own row's constant over its own pivot.
    return M.map((row, i) => row[n] / row[i]);
}

/** Build and solve one table. Returns {ok, why, voltages} */
function analyse(rows) {
    const parts = [];
    for (const [part, what, value, connect] of rows) {
        // Decide what the part IS before trying to read its terminals. A BJT's
        // "collector a, base b, emitter c" is not a form this solver parses, and
        // reporting that as an unparsed row buries the real reason - which is
        // simply that it is a transistor.
        // Only the What column names the part. Value is free text and routinely
        // explains what a component is FOR - "1 Mohm, capacitive coupling from
        // the mains" is a resistor, and matching "coupling" there skipped it.
        // The one exception is the op-amp flavour, which lives in Value.
        if (NONLINEAR.test(what) || /real op-?amp/i.test(value)) {
            return { ok: false, why: 'nonlinear or switched part: ' + part + ' (' + what + ')' };
        }
        if (/op-?amp/i.test(what) && /open loop|comparator/i.test(value)) {
            return { ok: false, why: 'open-loop comparator: ' + part };
        }

        const t = terminals(connect);
        if (!t.kind) return { ok: false, why: 'unparsed row: ' + part };

        const mag = magnitude(value);
        if (/resistor/i.test(what)) {
            if (mag === null || mag === 0) return { ok: false, why: 'no resistance for ' + part };
            parts.push({ type: 'R', part, n: t.nodes, v: mag });
        } else if (/capacitor/i.test(what)) {
            parts.push({ type: 'open', part, n: t.nodes });
        } else if (/inductor/i.test(what)) {
            parts.push({ type: 'short', part, n: t.nodes });
        } else if (/voltage source/i.test(what)) {
            const dc = sourceDC(value);
            if (dc.skip) return { ok: false, why: dc.skip + ': ' + part };
            parts.push({ type: 'V', part, n: t.nodes, v: dc.v });
        } else if (/current source/i.test(what)) {
            const dc = sourceDC(value);
            if (dc.skip) return { ok: false, why: dc.skip + ': ' + part };
            parts.push({ type: 'I', part, n: t.nodes, v: dc.v });
        } else if (/vcvs|controlled source/i.test(what)) {
            if (t.kind !== 'vcvs') return { ok: false, why: 'controlled source not in "output A to B, sensing C to D" form: ' + part };
            if (mag === null) return { ok: false, why: 'no gain for ' + part };
            parts.push({ type: 'E', part, n: t.nodes, v: mag });
        } else if (/op-?amp/i.test(what)) {
            if (t.kind !== 'opamp') return { ok: false, why: 'op-amp terminals not recognised: ' + part };
            parts.push({ type: 'OA', part, n: t.nodes });
        } else {
            return { ok: false, why: 'unknown part type: ' + part + ' (' + what + ')' };
        }
    }
    if (!parts.length) return { ok: false, why: 'no parts' };

    // Number the nodes. Ground is 0 and is not an unknown.
    const idx = new Map();
    parts.forEach(p => p.n.forEach(n => {
        if (isGround(n) || idx.has(n)) return;
        idx.set(n, idx.size);
    }));
    const N = idx.size;
    const branches = parts.filter(p => p.type === 'V' || p.type === 'E' || p.type === 'OA' || p.type === 'short');
    const B = branches.length;
    const size = N + B;
    if (size === 0 || size > 200) return { ok: false, why: 'no unknowns' };

    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const rhs = new Array(size).fill(0);
    const at = n => (isGround(n) ? -1 : idx.get(n));
    const G = (r, c, val) => { if (r >= 0 && c >= 0) A[r][c] += val; };
    const col = (r, c, val) => { if (r >= 0) A[r][c] += val; };
    const rowStamp = (r, c, val) => { if (c >= 0) A[r][c] += val; };

    let bi = 0;
    for (const p of parts) {
        const a = at(p.n[0]), b = at(p.n[1]);
        if (p.type === 'R') {
            const g = 1 / p.v;
            G(a, a, g); G(b, b, g); G(a, b, -g); G(b, a, -g);
        } else if (p.type === 'I') {
            // "from A to B": the source pushes current out at B and takes it at A.
            if (b >= 0) rhs[b] += p.v;
            if (a >= 0) rhs[a] -= p.v;
        } else if (p.type === 'V' || p.type === 'short') {
            const k = N + bi++;
            col(a, k, 1); col(b, k, -1);
            rowStamp(k, a, 1); rowStamp(k, b, -1);
            rhs[k] = p.type === 'V' ? p.v : 0;
        } else if (p.type === 'E') {
            const k = N + bi++;
            const cp = at(p.n[2]), cn = at(p.n[3]);
            col(a, k, 1); col(b, k, -1);
            rowStamp(k, a, 1); rowStamp(k, b, -1);
            rowStamp(k, cp, -p.v); rowStamp(k, cn, p.v);
            rhs[k] = 0;
        } else if (p.type === 'OA') {
            // Nullor: output carries a free current, inputs are forced equal.
            const plus = at(p.n[0]), minus = at(p.n[1]), out = at(p.n[2]);
            const k = N + bi++;
            col(out, k, 1);
            rowStamp(k, plus, 1); rowStamp(k, minus, -1);
            rhs[k] = 0;
        }
    }

    const x = solve(A, rhs);
    if (!x) return { ok: false, why: 'singular - no unique operating point (an amplifier with no feedback, or a floating section)' };
    if (x.some(v => !isFinite(v))) return { ok: false, why: 'no finite solution' };

    const voltages = {};
    idx.forEach((i, n) => { voltages[n] = x[i]; });
    return { ok: true, voltages, parts };
}

const fmt = v => {
    const a = Math.abs(v);
    if (a < 1e-9) return '0 V';
    if (a < 1e-3) return (v * 1e6).toPrecision(5) + ' uV';
    if (a < 1) return (v * 1e3).toPrecision(5) + ' mV';
    return v.toPrecision(6) + ' V';
};

const files = TARGET ? [path.resolve(ROOT, TARGET)] : walk(LESSONS, []).sort();
let tables = 0, solved = 0;
const skips = new Map();

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm, idx = 0;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        idx++;
        const rows = [];
        const rRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
        let rm;
        while ((rm = rRe.exec(body))) {
            const cells = [];
            const cRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
            let cm;
            while ((cm = cRe.exec(rm[1]))) cells.push(text(cm[1]));
            if (cells.length >= 4) rows.push(cells);
        }
        if (rows.length < 2) continue;
        tables++;

        const r = analyse(rows);
        const tag = rel + (idx > 1 ? ' [table ' + idx + ']' : '');
        if (r.ok) {
            solved++;
            const names = Object.keys(r.voltages).sort();
            console.log('SOLVED  ' + tag);
            names.forEach(n => console.log('           V(' + n + ') = ' + fmt(r.voltages[n])));
            if (VERBOSE) r.parts.forEach(p => console.log('           . ' + p.type + ' ' + p.part + ' ' + p.n.join(',') + (p.v !== undefined ? ' = ' + p.v : '')));
        } else {
            const key = r.why.replace(/:.*$/, '');
            skips.set(key, (skips.get(key) || 0) + 1);
            if (LIST || TARGET) console.log('skip    ' + tag + '   ' + r.why);
        }
    }
});

if (!TARGET) {
    console.log('');
    console.log('DC OPERATING POINTS\n');
    console.log('  build tables        ' + String(tables).padStart(4));
    console.log('  solved              ' + String(solved).padStart(4) +
                '   (' + Math.round(100 * solved / tables) + '%)');
    console.log('  not attempted       ' + String(tables - solved).padStart(4));
    console.log('');
    [...skips.entries()].sort((a, b) => b[1] - a[1]).forEach(([why, n]) => {
        console.log('     ' + String(n).padStart(4) + '  ' + why);
    });
    console.log('');
    console.log('This is a tool for deriving expected values, not a gate. A table it');
    console.log('cannot solve is usually just a table with a transistor in it.');
}
