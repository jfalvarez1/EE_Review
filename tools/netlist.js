/**
 * netlist - read a build table as a circuit.
 *
 * Why this is its own file
 * ------------------------
 * solve-dc and solve-ac must agree about what a table SAYS before they can
 * disagree about what it does. Two copies of "is this row a resistor, and what
 * is its value" would drift, and the drift would show up as one tool solving a
 * lesson the other refuses - which is exactly the kind of thing that looks like
 * a circuit problem and is not.
 *
 * Everything here is parsing. Nothing here solves anything.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
 * Deliberately takes only the FIRST number: values carry trailing notes, and
 * "20 kohm (the 2R termination - not 10 k)" must not come back as 10.
 */
function magnitude(cell) {
    const s = cell.replace(/\(.*$/, '').trim();
    const m = /(-?\d+(?:\.\d+)?)\s*([TGMkKmunpf])?\s*(ohm|F|H|V|A)?\b/.exec(s);
    if (!m) return null;
    return parseFloat(m[1]) * (m[2] ? SI[m[2]] : 1);
}

/** Node names out of one Connect cell, in the order they are named. */
function terminals(cell) {
    const s = cell.trim();
    let m;
    if ((m = /\bbetween\s+([A-Za-z0-9_+\-]+)\s+and\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'two', nodes: [m[1], m[2]] };
    }
    if ((m = /\boutput\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)[^]*?\bsensing\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'vcvs', nodes: [m[1], m[2], m[3], m[4]] };
    }
    if ((m = /\+\s*input\s+([A-Za-z0-9_+\-]+)\s*,\s*-\s*input\s+([A-Za-z0-9_+\-]+)\s*,\s*output\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'opamp', nodes: [m[1], m[2], m[3]] };
    }
    if ((m = /\banode\s+([A-Za-z0-9_+\-]+)\s*,\s*cathode\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'diode', nodes: [m[1], m[2]] };
    }
    if ((m = /\bcollector\s+([A-Za-z0-9_+\-]+)\s*,\s*base\s+([A-Za-z0-9_+\-]+)\s*,\s*emitter\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'bjt', nodes: [m[1], m[2], m[3]] };
    }
    if ((m = /\bdrain\s+([A-Za-z0-9_+\-]+)\s*,\s*gate\s+([A-Za-z0-9_+\-]+)\s*,\s*source\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'fet', nodes: [m[1], m[2], m[3]] };
    }
    if ((m = /\bfrom\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'two', nodes: [m[1], m[2]] };
    }
    return { kind: null, nodes: [] };
}

/**
 * Device models, by the name the build tables use.
 *
 * These are ordinary SPICE parameters for ordinary parts, and they matter more
 * than the linear element values do: a bipolar stage's collector current
 * depends on Is and BF, so two simulators with different models give different
 * answers to the same table. That is a real property of the circuit rather than
 * a defect in the tool, and it is why solve-op prints the model it used and why
 * a bias point derived from it deserves a wider tolerance than a divider does.
 *
 * The quantities that are NOT model-sensitive - a V_BE near 0.65 V, a collector
 * current set by an emitter resistor and a divider, a diode clamp one drop from
 * a rail - are the ones worth putting in a SimCheck.
 */
const MODELS = {
    '2N3904': { type: 'npn', Is: 6.734e-15, BF: 416.4, BR: 0.7371, NF: 1 },
    '2N3906': { type: 'pnp', Is: 1.41e-15, BF: 180.7, BR: 4.977, NF: 1 },
    '2N2222': { type: 'npn', Is: 1.4e-14, BF: 200, BR: 3, NF: 1 },
    'Q2N2222':{ type: 'npn', Is: 1.4e-14, BF: 200, BR: 3, NF: 1 },
    'NPN':    { type: 'npn', Is: 1e-14, BF: 100, BR: 1, NF: 1 },
    'PNP':    { type: 'pnp', Is: 1e-14, BF: 100, BR: 1, NF: 1 },
    '1N4148': { type: 'diode', Is: 2.52e-9, N: 1.752 },
    'D1N4148':{ type: 'diode', Is: 2.52e-9, N: 1.752 },
    'DIODE':  { type: 'diode', Is: 1e-14, N: 1 },
    'SCHOTTKY': { type: 'diode', Is: 3.17e-5, N: 1.37 },
    'MBR1060':  { type: 'diode', Is: 3.17e-5, N: 1.37 },
    'ZENER':  { type: 'diode', Is: 1e-14, N: 1, BV: 5.1 },
    'NMOS':   { type: 'nmos', Vth: 2.0, K: 1.0, lambda: 0.01 },
    'PMOS':   { type: 'pmos', Vth: 2.0, K: 1.0, lambda: 0.01 }
};

/** Pick a model from a Value cell, or null if it names none we know. */
function modelFor(value, what) {
    const hay = (value + ' ' + what).toUpperCase();
    // Longest names first, so "D1N4148" is not matched as "DIODE".
    const keys = Object.keys(MODELS).sort((a, b) => b.length - a.length);
    for (const k of keys) if (hay.indexOf(k) !== -1) return { name: k, m: MODELS[k] };
    return null;
}

const isGround = n => /^(?:ground|gnd|agnd|dgnd|0)$/i.test(n);

/**
 * Parts no linear solver has any business pretending to know the answer for.
 *
 * The short alternatives carry word boundaries on purpose. Without them "led"
 * matches inside "contro-LLED- source" and silently skips every VCVS in the
 * course, which is most of what these tools exist to solve.
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
 * value and is reported rather than averaged, because averaging it would quietly
 * answer a different question than the one the lesson asks.
 */
function sourceDC(value) {
    if (/\bpulse\b|\bsawtooth\b|\btriangle\b|\bpwm\b|\bpwl\b|\bclock\b|\bnoise\b|\barb\b|3-phase|\bfm\b|\bam\b/i.test(value)) {
        return { skip: 'time-varying source, no single DC value' };
    }
    const off = /\boffset\s+(-?\d+(?:\.\d+)?)\s*([TGMkKmunpf])?/i.exec(value);
    if (off) return { v: parseFloat(off[1]) * (off[2] ? SI[off[2]] : 1) };
    if (/\bsine\b/i.test(value)) return { v: 0 };            // AC only, no offset
    // "AC 1 mV for a frequency sweep" with no DC term in front of it is a
    // zero-DC stimulus; magnitude() would otherwise read the 1 mV as DC.
    if (/^\s*AC\b/i.test(value)) return { v: 0 };
    const m = magnitude(value);
    return m === null ? { skip: 'no value' } : { v: m };
}

/**
 * The AC drive amplitude of a source, for a small-signal sweep.
 *
 * "AC 1 V for a frequency sweep" and "sine 10 mV amplitude at 2.4 GHz" are both
 * one-volt-ish stimuli; a plain DC source is a short at AC, which is what a
 * zero amplitude means to the solver.
 */
function sourceAC(value) {
    let m = /\bAC\s+(\d+(?:\.\d+)?)\s*([TGMkKmunpf])?\s*[VA]?/i.exec(value);
    if (m) return { v: parseFloat(m[1]) * (m[2] ? SI[m[2]] : 1) };
    m = /\bsine\s+(-?\d+(?:\.\d+)?)\s*([TGMkKmunpf])?\s*[VA]?\s*amplitude/i.exec(value);
    if (m) return { v: Math.abs(parseFloat(m[1])) * (m[2] ? SI[m[2]] : 1) };
    if (/\bpulse\b|\bsawtooth\b|\btriangle\b|\bpwm\b|\bpwl\b|\bclock\b|\barb\b/i.test(value)) {
        return { skip: 'time-varying source: an AC sweep needs a sinusoidal stimulus' };
    }
    return { v: 0 };                                          // DC only: a short
}

/** Every build table in one file, as arrays of [part, what, value, connect]. */
function tablesIn(src) {
    const out = [];
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
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
        if (rows.length >= 2) out.push(rows);
    }
    return out;
}

/**
 * Rows to typed parts, or a reason this table cannot be solved linearly.
 *
 * `mode` is 'dc' or 'ac' and changes only how sources are read.
 */
function parse(rows, mode) {
    const parts = [];
    // Semiconductors are solvable in 'op' mode by Newton-Raphson, and simply
    // out of scope for the two linear ones.
    const SEMI = /diode|transistor|mosfet|nmos|pmos|\bbjt\b|darlington|\bujt\b|jfet/i;
    const SWITCHED = /switch|latch|\bgate\b|flip-flop|counter|shift register|adder|\bmux\b|decoder|block|sub-circuit|transmission line|crystal|transformer|coupling|motor|lamp|opto|memristor|\bmcu\b|\badc\b|\bdac\b|\bpll\b|\bvco\b|antenna|tri-state|programmable/i;

    for (const [part, what, value, connect] of rows) {
        // Decide what the part IS before reading its terminals. A BJT's
        // "collector a, base b, emitter c" is not a form terminals() parses, and
        // reporting that as an unparsed row buries the real reason.
        const semi = mode === 'op' && SEMI.test(what) && !SWITCHED.test(what);
        if (!semi && (NONLINEAR.test(what) || /real op-?amp/i.test(value))) {
            return { error: 'nonlinear or switched part: ' + part + ' (' + what + ')' };
        }
        if (mode === 'op' && SWITCHED.test(what)) {
            return { error: 'switched or behavioural part: ' + part + ' (' + what + ')' };
        }
        if (/op-?amp/i.test(what) && /open loop|comparator/i.test(value)) {
            return { error: 'open-loop comparator: ' + part };
        }

        const t = terminals(connect);
        if (!t.kind) return { error: 'unparsed row: ' + part };
        const mag = magnitude(value);

        if (/resistor/i.test(what)) {
            if (!mag) return { error: 'no resistance for ' + part };
            parts.push({ type: 'R', part, n: t.nodes, v: mag });
        } else if (/capacitor/i.test(what)) {
            if (mode === 'ac') {
                if (!mag) return { error: 'no capacitance for ' + part };
                parts.push({ type: 'C', part, n: t.nodes, v: mag });
            } else parts.push({ type: 'open', part, n: t.nodes });
        } else if (/inductor/i.test(what)) {
            if (mode === 'ac') {
                if (!mag) return { error: 'no inductance for ' + part };
                parts.push({ type: 'L', part, n: t.nodes, v: mag });
            } else parts.push({ type: 'short', part, n: t.nodes });
        } else if (/voltage source/i.test(what)) {
            const s = mode === 'ac' ? sourceAC(value) : sourceDC(value);
            if (s.skip) return { error: s.skip + ': ' + part };
            parts.push({ type: 'V', part, n: t.nodes, v: s.v });
        } else if (/current source/i.test(what)) {
            const s = mode === 'ac' ? sourceAC(value) : sourceDC(value);
            if (s.skip) return { error: s.skip + ': ' + part };
            parts.push({ type: 'I', part, n: t.nodes, v: s.v });
        } else if (/vcvs|controlled source/i.test(what)) {
            if (t.kind !== 'vcvs') return { error: 'controlled source not in "output A to B, sensing C to D" form: ' + part };
            if (mag === null) return { error: 'no gain for ' + part };
            parts.push({ type: 'E', part, n: t.nodes, v: mag });
        } else if (/op-?amp/i.test(what)) {
            if (t.kind !== 'opamp') return { error: 'op-amp terminals not recognised: ' + part };
            parts.push({ type: 'OA', part, n: t.nodes });
        } else if (semi) {
            const mod = modelFor(value, what);
            if (!mod) return { error: 'no model for ' + part + ' ("' + value + '")' };
            const want = { diode: 'diode', bjt: 'bjt', fet: 'fet' }[t.kind];
            if (!want) return { error: 'semiconductor terminals not recognised: ' + part };
            const kindOf = { diode: 'diode', npn: 'bjt', pnp: 'bjt', nmos: 'fet', pmos: 'fet' }[mod.m.type];
            if (kindOf !== want) {
                return { error: part + ' is wired as a ' + want + ' but its model "' + mod.name + '" is a ' + kindOf };
            }
            parts.push({ type: 'SEMI', part, n: t.nodes, model: mod.m, modelName: mod.name });
        } else {
            return { error: 'unknown part type: ' + part + ' (' + what + ')' };
        }
    }
    if (!parts.length) return { error: 'no parts' };
    return { parts };
}

/** Number the non-ground nodes. */
function nodeIndex(parts) {
    const idx = new Map();
    parts.forEach(p => p.n.forEach(n => {
        if (isGround(n) || idx.has(n)) return;
        idx.set(n, idx.size);
    }));
    return idx;
}

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

module.exports = { text, magnitude, terminals, isGround, NONLINEAR, sourceDC, sourceAC, tablesIn, parse, nodeIndex, walk, SI, MODELS, modelFor };
