#!/usr/bin/env node
/**
 * export-spice - the build tables as one SPICE-ish netlist file per circuit.
 *
 * Why this exists
 * ---------------
 * export-netlists.js emits netlists.json, which is what solve-dc/op/ac parse.
 * That file is shaped for an operating point and throws away everything an
 * operating point does not need: a capacitor becomes `open`, an inductor
 * becomes `short`, and any table containing a pulse source or a sub-circuit
 * block is recorded as `unparsed` with no parts at all. 89 of 194 tables come
 * out empty that way.
 *
 * Circuit Toy's netlist reader has transient, AC and device models, so those 89
 * are not out of reach for it - they are only out of reach for us. This emits
 * from the raw `rows` instead, which keep the Value cell verbatim, so a
 * capacitor keeps its farads and a pulse source keeps its waveform.
 *
 * Output: _audit/review/spice/<id>.cir, one per build table, plus index.json.
 *
 * The dialect is the one the Circuit Toy reader documents:
 *   - `=` is a delimiter, so `W=90u` and `W 90u` read alike
 *   - SPICE suffixes, M is milli and MEG is mega
 *   - `*` starts a comment
 *   - E and G are written output-first
 *   - T takes two nodes, a characteristic impedance and a one-way delay
 *
 * Lines we cannot express in that dialect are emitted as `* UNSUPPORTED:`
 * comments rather than dropped, so a file is never silently short a part. The
 * count of those is the interesting output: it is the gap list, per circuit.
 *
 * Run: node tools/export-spice.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist.js');

const ROOT = path.dirname(__dirname);
const IN = path.join(ROOT, '_audit', 'review', 'netlists.json');
const OUTDIR = path.join(ROOT, '_audit', 'review', 'spice');

const text = s => N.text(String(s == null ? '' : s));

/** A number as SPICE engineering notation. M is milli here, so mega is MEG. */
function eng(x) {
    if (x === 0) return '0';
    if (!isFinite(x)) return String(x);
    const sign = x < 0 ? '-' : '';
    const a = Math.abs(x);
    const units = [
        [1e12, 'T'], [1e9, 'G'], [1e6, 'MEG'], [1e3, 'k'],
        [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'],
    ];
    for (const [scale, suf] of units) {
        if (a >= scale) {
            const v = a / scale;
            return sign + trim(v) + suf;
        }
    }
    return sign + trim(a / 1e-15) + 'f';
}

function trim(v) {
    let s = v.toPrecision(6);
    if (s.indexOf('e') !== -1) return String(v);
    if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
}

/** Leading magnitude of a Value cell, in base units. Shares netlist.js's rule. */
const mag = cell => N.magnitude(text(cell));

/**
 * A name safe for a netlist line, WITHOUT collapsing polarity.
 *
 * The obvious sanitiser maps every character outside [A-Za-z0-9_] to "_", and
 * that silently merges the two halves of every differential pair in the course:
 * VIN+ and VIN- both became VIN_, so three files carried two elements sharing
 * one refdes, which real SPICE refuses outright. Worse, m26l06's NODES did it
 * too - IN+ and IN- collapsed to IN_, which does not rename a net, it welds two
 * distinct nets into one and puts two independent sources across the result.
 * Polarity is the whole content of a differential name, so it maps to a letter.
 */
const safe = s => text(s).replace(/\+/g, 'P').replace(/-/g, 'N').replace(/[^A-Za-z0-9_]/g, '_');

/**
 * A node name safe for a netlist line.
 *
 * Ground collapses to 0 through netlist.js's own isGround, which also takes
 * agnd and dgnd. That merge is a modelling choice - a lesson about a star
 * ground means them as separate nodes - but it is the choice our three solvers
 * already made, and the twelve values Circuit Toy reproduced were solved with
 * it. Keeping it means a disagreement is about physics, not about grounding.
 */
function node(n) {
    const s = safe(n);
    return N.isGround(s) ? '0' : s;
}

/** Seconds out of "period 500 us" / "10 us on" / "at 1 kHz". */
function timeAfter(s, re) {
    const m = re.exec(s);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const suf = m[2];
    return v * (suf && N.SI[suf] !== undefined ? N.SI[suf] : 1);
}

/**
 * A source's Value cell as a SPICE source spec, plus anything we could not say.
 *
 * Returns { spec, note } - note is non-null when the waveform has no form in
 * this dialect, and the caller turns that into an UNSUPPORTED comment beside a
 * best-effort line rather than dropping the source.
 */
function sourceSpec(raw) {
    const s = text(raw);
    const parts = [];
    let note = null;

    // "pulse: 0 V until 10 ms, then 3.3 V" - a single step, which is a PWL.
    let m = /pulse:?\s*(-?[\d.]+)\s*([TGMkKmunpf])?\s*[VA]?\s*until\s*([\d.]+)\s*([TGMkKmunpf])?\s*s?,?\s*then\s*(-?[\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
    if (m) {
        const v1 = parseFloat(m[1]) * (m[2] ? N.SI[m[2]] : 1);
        const t = parseFloat(m[3]) * (m[4] ? N.SI[m[4]] : 1);
        const v2 = parseFloat(m[5]) * (m[6] ? N.SI[m[6]] : 1);
        return { spec: `PWL(0 ${eng(v1)} ${eng(t)} ${eng(v1)} ${eng(t * 1.0001)} ${eng(v2)})`, note: null };
    }

    // "pulse 0 V to 5 V, period 900 ns, high 450-850 ns" and its variants.
    m = /\bpulse\s+(-?[\d.]+)\s*([TGMkKmunpf])?\s*[VA]?\s*to\s+(-?[\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
    if (m) {
        const v1 = parseFloat(m[1]) * (m[2] ? N.SI[m[2]] : 1);
        const v2 = parseFloat(m[3]) * (m[4] ? N.SI[m[4]] : 1);
        let per = timeAfter(s, /\bperiod\s+([\d.]+)\s*([TGMkKmunpf])?\s*s\b/i);
        if (per === null) {
            const f = timeAfter(s, /\b([\d.]+)\s*([TGMkKmunpf])?Hz\b/i);
            if (f) per = 1 / f;
        }
        if (per === null) per = 1e-3;                      // no period stated

        // On-time, in the four ways the tables say it.
        let pw = null;
        const duty = /([\d.]+)\s*%\s*duty/i.exec(s);
        if (duty) pw = per * parseFloat(duty[1]) / 100;
        if (pw === null) pw = timeAfter(s, /\b([\d.]+)\s*([TGMkKmunpf])?s\s+on\b/i);
        if (pw === null) {
            const hi = /\bhigh\s+(?:from\s+)?([\d.]+)\s*([TGMkKmunpf])?s?\s*(?:-|to)\s*([\d.]+)\s*([TGMkKmunpf])?s?/i.exec(s);
            if (hi) {
                const a = parseFloat(hi[1]) * (hi[2] ? N.SI[hi[2]] : 1);
                const b = parseFloat(hi[3]) * (hi[4] ? N.SI[hi[4]] : 1);
                pw = b - a;
            }
        }
        if (pw === null) pw = per / 2;                     // "period P" alone is a square wave

        let rise = timeAfter(s, /\b([\d.]+)\s*([TGMkKmunpf])?s\s+rise\b/i);
        if (rise === null) rise = Math.min(per / 1000, 1e-9);
        parts.push(`PULSE(${eng(v1)} ${eng(v2)} 0 ${eng(rise)} ${eng(rise)} ${eng(pw)} ${eng(per)})`);
    }

    // "sine 1.50 V amplitude at 100 Hz, offset 2.50 V"
    m = /\bsine\s+(-?[\d.]+)\s*([TGMkKmunpf])?\s*[VA]?\s*amplitude(?:\s+at\s+([\d.]+)\s*([TGMkKmunpf])?\s*Hz)?/i.exec(s);
    if (m) {
        const amp = parseFloat(m[1]) * (m[2] ? N.SI[m[2]] : 1);
        const f = m[3] ? parseFloat(m[3]) * (m[4] ? N.SI[m[4]] : 1) : 1e3;
        const off = /\boffset\s+(-?[\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
        const o = off ? parseFloat(off[1]) * (off[2] ? N.SI[off[2]] : 1) : 0;
        parts.push(`SIN(${eng(o)} ${eng(amp)} ${eng(f)})`);
    }

    // "AC 100 mV for a frequency sweep" - an AC term, orthogonal to the above.
    const ac = N.sourceAC(s);
    if (!ac.skip && ac.v) parts.push(`AC ${eng(ac.v)}`);

    // Waveforms with no form here at all.
    if (!parts.length && /\btriangle\b|\bsawtooth\b|\bpwm\b|\bclock\b|\bnoise\b|3-phase|\barb\b/i.test(s)) {
        note = 'waveform has no SPICE form in this dialect: ' + s;
        const a = mag(s);
        parts.push(`DC ${eng(a === null ? 0 : a)}`);
    }

    if (!parts.length) {
        const dc = N.sourceDC(s);
        parts.push(`DC ${eng(dc.skip ? 0 : dc.v)}`);
    } else if (!/^DC\b/.test(parts[0])) {
        // A pulse or sine still needs a DC term for the operating point.
        const off = /\boffset\s+(-?[\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
        if (off) parts.unshift(`DC ${eng(parseFloat(off[1]) * (off[2] ? N.SI[off[2]] : 1))}`);
    }

    return { spec: parts.join(' '), note };
}

/** Pin names out of a Connect cell that `nodes` did not resolve. */
function pinsFrom(connect) {
    const s = text(connect).replace(/^\s*(?:pins|input|output|couples)\s*/i, '');
    return s.split(/\s*(?:,|\band\b|\boutput\b|\binput\b)\s*/)
        .map(t => t.trim()).filter(Boolean).map(node);
}

/**
 * A MOSFET's model line, carrying everything the reader can set from text.
 *
 * LAMBDA is emitted ALWAYS, even at its default. Circuit Toy read an earlier
 * export, saw a bare `NMOS`, and got no operating point at all for m06l09 -
 * because a MOSFET with no stated LAMBDA falls back to an ideal stamp with
 * infinite output resistance, and a cascode of ideal devices has nothing to
 * fix the upper pair's drain voltage. The value was in the export's `params`
 * all along; it just was not on the netlist line. A parameter this load-bearing
 * does not get to be implicit.
 *
 * W/L likewise: the tables state a ratio, not two lengths, so L is pinned at
 * 1 um and W scaled to match. Same ratio, and expressible from text.
 */
function fetTail(value, what) {
    const s = text(value);
    const tail = [];
    const hit = N.modelFor(s, text(what));
    const m = hit ? hit.m : null;

    const w = /\bW\s*=\s*([\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
    const l = /\bL\s*=\s*([\d.]+)\s*([TGMkKmunpf])?/i.exec(s);
    if (w && l) {
        tail.push('W=' + eng(parseFloat(w[1]) * (w[2] ? N.SI[w[2]] : 1)));
        tail.push('L=' + eng(parseFloat(l[1]) * (l[2] ? N.SI[l[2]] : 1)));
    } else if (m && m.WL) {
        tail.push('W=' + eng(m.WL * 1e-6), 'L=1u');
    }

    const lam = /\bLAMBDA\s*=?\s*([\d.]+)/i.exec(s);
    if (lam) tail.push('LAMBDA=' + trim(parseFloat(lam[1])));
    else if (m && m.lambda) tail.push('LAMBDA=' + trim(m.lambda));

    if (m && m.Vth) tail.push('VTO=' + trim(m.Vth));
    if (m && m.Kp) tail.push('KP=' + eng(m.Kp));
    return tail;
}

function modelName(value, what) {
    const s = text(value);
    const hit = N.modelFor(s, text(what));
    if (hit) return hit.name.split(/\s+/)[0].toUpperCase();
    const named = /\b([0-9]?[A-Z]{1,3}[0-9]{2,5}[A-Z]?)\b/.exec(s.toUpperCase());
    if (named) return named[1];
    return null;
}

/** One row as netlist lines. Returns { lines, unsupported }. */
function emit(row) {
    const ref = safe(row.ref);
    const what = text(row.what);
    const value = text(row.value);
    const nodes = (row.nodes || []).map(node);
    const lines = [];
    const unsupported = [];
    // Keep the reader's own refdes letter in front, then the rest of the ref.
    const named = t => (ref.toUpperCase()[0] === t ? ref : t + ref);

    if (/^Resistor$/i.test(what)) {
        const v = mag(value);
        if (v === null) { unsupported.push(`${ref}: no resistance in "${value}"`); return { lines, unsupported }; }
        lines.push(`${named('R')} ${nodes[0]} ${nodes[1]} ${eng(v)}`);
    } else if (/^Capacitor$/i.test(what)) {
        const v = mag(value);
        if (v === null) { unsupported.push(`${ref}: no capacitance in "${value}"`); return { lines, unsupported }; }
        lines.push(`${named('C')} ${nodes[0]} ${nodes[1]} ${eng(v)}`);
    } else if (/^Inductor$/i.test(what)) {
        const v = mag(value);
        if (v === null) { unsupported.push(`${ref}: no inductance in "${value}"`); return { lines, unsupported }; }
        lines.push(`${named('L')} ${nodes[0]} ${nodes[1]} ${eng(v)}`);
    } else if (/^Voltage [Ss]ource$/i.test(what)) {
        const { spec, note } = sourceSpec(value);
        if (note) unsupported.push(`${ref}: ${note}`);
        lines.push(`${named('V')} ${nodes[0]} ${nodes[1]} ${spec}`);
    } else if (/^Current [Ss]ource$/i.test(what)) {
        const { spec, note } = sourceSpec(value);
        if (note) unsupported.push(`${ref}: ${note}`);
        lines.push(`${named('I')} ${nodes[0]} ${nodes[1]} ${spec}`);
    } else if (row.kind === 'vcvs') {
        const g = /gain\s*(-?[\d.]+(?:e-?\d+)?)/i.exec(value) || /^(-?[\d.]+(?:e-?\d+)?)$/.exec(value.trim());
        const gain = g ? parseFloat(g[1]) : mag(value);
        // Output first, which is how the reader takes E and G.
        lines.push(`${named('E')} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${nodes[3]} ${gain === null ? 1 : trim(gain)}`);
    } else if (row.kind === 'bjt') {
        const m = modelName(value, what) || (/pnp/i.test(value) ? 'PNP' : 'NPN');
        lines.push(`${named('Q')} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${m}`);
    } else if (row.kind === 'fet') {
        let m = modelName(value, what);
        if (!m) m = /pmos|p-channel/i.test(value + what) ? 'PMOS' : 'NMOS';
        const tail = fetTail(value, what);
        lines.push(`${named('M')} ${nodes[0]} ${nodes[1]} ${nodes[2]} ${m}${tail.length ? ' ' + tail.join(' ') : ''}`);
    } else if (row.kind === 'diode') {
        const m = modelName(value, what) || 'DIODE';
        const declared = N.modelFor(value, what);
        if (m === 'ZENER' && declared && declared.m.BV !== N.MODELS.ZENER.BV) {
            // The companion dialect has no verified per-instance BV syntax.
            // Do not emit a default-5.1 V diode for an authored 8.2 V clamp.
            // rows/netlists.json retains the explicit parameter for importers.
            const reason = `${ref}: explicit zener BV=${declared.m.BV} V requires a configured model; default ZENER is ${N.MODELS.ZENER.BV} V`;
            unsupported.push(reason);
            lines.push(`* UNSUPPORTED: ${reason}; anode ${nodes[0]}, cathode ${nodes[1]}`);
            return { lines, unsupported };
        }
        lines.push(`${named('D')} ${nodes[0]} ${nodes[1]} ${m}`);
        if (m === 'ZENER' && !/\d\s*(?:\.\d+)?\s*V/i.test(value)) {
            // "Zener Diode" with no voltage is not a part, it is a category.
            // The answer depends entirely on which one the reader places, and
            // the generic 5.1 V here is a guess standing in for a stated value.
            unsupported.push(`${ref}: zener with no stated breakdown voltage (assumed BV = 5.1 V)`);
        }
        if (/\bLED\b/i.test(value)) {
            // No LED model exists here, so it resolves to a 0.7 V silicon
            // diode. An LED drops two volts and more; anything downstream of
            // one is off by that much.
            unsupported.push(`${ref}: LED modelled as a silicon diode (Vf is wrong by over a volt)`);
        }
    } else if (row.kind === 'opamp') {
        // netlist.js orders an op-amp [+in, -in, out]. There is no SPICE
        // primitive for it and the reader has no X line yet, so this is one of
        // the 91 the gap list is about. The E fallback beside it is what our
        // own solvers use: a finite-gain VCVS, no supply rails, no slew.
        lines.push(`X${named('X').replace(/^X/, '')} ${nodes[0]} ${nodes[1]} ${nodes[2]} OPAMP`);
        lines.push(`* fallback if X is unavailable: E${ref} ${nodes[2]} 0 ${nodes[0]} ${nodes[1]} 100k`);
    } else if (/^Transmission Line$/i.test(what)) {
        const z = mag(value);
        const d = timeAfter(value, /([\d.]+)\s*([TGMkKmunpf])?s\s+delay/i);
        lines.push(`${named('T')} ${nodes[0]} ${nodes[1]} ${z === null ? 50 : trim(z)} ${d === null ? '1n' : eng(d)}`);
    } else if (/^Magnetic coupling$/i.test(what)) {
        const c = /couples\s+(\w+)\s+and\s+(\w+)/i.exec(text(row.connect));
        const k = mag(value);
        lines.push(`${named('K')} ${c ? c[1] + ' ' + c[2] : 'L1 L2'} ${k === null ? 0.98 : trim(k)}`);
    } else {
        // Blocks, switches, gates, latches: a sub-circuit instance, which is
        // exactly the X line the reader does not have yet.
        const pins = nodes.length ? nodes : pinsFrom(row.connect);
        // "Block (analog switch) &mdash; charge phase" must not become
        // ANALOG_SWITCH_MDASH_CHARGE_PHASE: an aside after a dash is prose, and
        // an entity text() does not decode is not part of anybody's part name.
        // Prefer the `what` cell, which names the block; fall back to `value`
        // only when `what` says nothing more than "Sub-Circuit".
        const clean = s => String(s)
            .replace(/&[a-z]+;/gi, ' ')                 // any entity left over
            .replace(/\s+[-–—]\s+.*$/, '')    // an aside after a dash
            .replace(/^Block\s*\(|\)\s*$/g, '')
            .replace(/[^A-Za-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .toUpperCase();
        const fromWhat = clean(what);
        // "Sub-Circuit , gain 1" says nothing about what the block IS, so it
        // never wins - but it must be recognised with its trailing clause on.
        const fromValue = /^\s*Sub-?Circuit\b/i.test(value) ? '' : clean(value);
        const name = (fromWhat && !/^SUB_?CIRCUIT$/.test(fromWhat) ? fromWhat : fromValue)
            || 'BLOCK';
        lines.push(`${named('X')} ${pins.join(' ')} ${name}`);
        unsupported.push(`${ref}: subcircuit instance (${what})`);
    }
    return { lines, unsupported };
}

/** Model name -> the parameters our three solvers stamp for it. */
const MODEL_CARDS = (() => {
    const out = {};
    for (const [name, m] of Object.entries(N.MODELS)) {
        out[name.toUpperCase()] = Object.entries(m)
            .filter(([k]) => k !== 'type')
            .map(([k, v]) => `${k}=${typeof v === 'number' ? trim(v) : v}`)
            .join(' ') + `  (${m.type})`;
    }
    return out;
})();

function main() {
    const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
    fs.mkdirSync(OUTDIR, { recursive: true });
    for (const f of fs.readdirSync(OUTDIR)) {
        if (/\.(cir|json)$/.test(f)) fs.unlinkSync(path.join(OUTDIR, f));
    }

    const index = [];
    let totalUnsupported = 0;

    for (const rec of records) {
        const body = [];
        const gaps = [];
        for (const row of rec.rows || []) {
            const { lines, unsupported } = emit(row);
            for (const l of lines) body.push(l);
            for (const u of unsupported) gaps.push(u);
        }

        // Two guards for the class of fault that produced VIN_ twice: a name
        // that is not unique after sanitising, and two DISTINCT authored nodes
        // that sanitise to one. The second is the dangerous one - it welds two
        // nets together and every downstream number stays plausible.
        const seen = new Map();
        for (const l of body) {
            if (/^\*/.test(l)) continue;
            const ref = l.split(/\s+/)[0];
            seen.set(ref, (seen.get(ref) || 0) + 1);
        }
        for (const [ref, n] of seen) {
            if (n > 1) gaps.push(`DUPLICATE REFDES ${ref} appears ${n} times - real SPICE refuses this`);
        }
        const collide = new Map();
        for (const row of rec.rows || []) {
            for (const raw of row.nodes || []) {
                const k = node(raw);
                const was = collide.get(k);
                if (was && was !== text(raw)) {
                    gaps.push(`NODE COLLISION: "${was}" and "${text(raw)}" both sanitise to ${k}`);
                }
                collide.set(k, text(raw));
            }
        }

        const head = [
            `* ${rec.title} - ${rec.id}`,
            `* from ${rec.source} (build table ${rec.table})`,
            `* EE_Review corpus. Node 'ground', 'gnd', 'agnd', 'dgnd' all map to 0.`,
        ];
        if (rec.unparsed) head.push(`* EE_Review's own solvers skip this one: ${text(rec.unparsed)}`);
        if (rec.solver) {
            head.push(`* EE_Review solve-dc: ${text(rec.solver.dc || 'n/a')}`);
            head.push(`* EE_Review solve-op: ${text(rec.solver.op || 'n/a')}`);
        }
        for (const g of gaps) head.push(`* UNSUPPORTED: ${g}`);

        // Every model the file names, with the parameters our solvers used.
        // Written as comments so a reader that has no .model line still takes
        // the file; the point is that a disagreement about a number can be
        // traced to a disagreement about a parameter without asking us.
        const used = new Set();
        for (const l of body) {
            const m = /^[QMD]\S+(?:\s+\S+){2,3}\s+([A-Z0-9_\/=.]+)/.exec(l);
            if (m && MODEL_CARDS[m[1]]) used.add(m[1]);
        }
        const cards = [...used].sort().map(k => `* MODEL ${k}: ${MODEL_CARDS[k]}`);
        if (cards.length) head.push('*', ...cards);

        const out = head.concat([''], body, ['', '.end', '']).join('\n');
        fs.writeFileSync(path.join(OUTDIR, rec.id + '.cir'), out);

        totalUnsupported += gaps.length;
        index.push({
            id: rec.id,
            file: rec.id + '.cir',
            source: rec.source,
            title: rec.title,
            table: rec.table,
            elements: body.filter(l => !/^\*/.test(l)).length,
            gaps,
            eeReviewSolves: !!rec.solver && Object.values(rec.solver).includes('solved'),
            eeReviewSkip: rec.solver && Object.values(rec.solver).includes('solved') ? null :
                text(rec.unparsed || (rec.solver && rec.solver.op) || 'no solver verdict'),
        });
    }

    fs.writeFileSync(path.join(OUTDIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

    const withGaps = index.filter(r => r.gaps.length).length;
    const elements = index.reduce((a, r) => a + r.elements, 0);
    console.log(`${index.length} circuits, ${elements} element lines -> ${path.relative(ROOT, OUTDIR)}`);
    console.log(`${withGaps} circuits carry at least one UNSUPPORTED line (${totalUnsupported} lines total)`);
    console.log(`${index.filter(r => r.eeReviewSolves).length} of ${index.length} are solved by an EE_Review solver`);
}

module.exports = { emit, modelName };
if (require.main === module) main();
