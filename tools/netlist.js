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
    if ((m = /\bfrom\s+([A-Za-z0-9_+\-]+)\s+to\s+([A-Za-z0-9_+\-]+)/i.exec(s))) {
        return { kind: 'two', nodes: [m[1], m[2]] };
    }
    return { kind: null, nodes: [] };
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
    for (const [part, what, value, connect] of rows) {
        // Decide what the part IS before reading its terminals. A BJT's
        // "collector a, base b, emitter c" is not a form terminals() parses, and
        // reporting that as an unparsed row buries the real reason.
        if (NONLINEAR.test(what) || /real op-?amp/i.test(value)) {
            return { error: 'nonlinear or switched part: ' + part + ' (' + what + ')' };
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

module.exports = { text, magnitude, terminals, isGround, NONLINEAR, sourceDC, sourceAC, tablesIn, parse, nodeIndex, walk, SI };
