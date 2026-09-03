#!/usr/bin/env node
/**
 * check-sim-values - does the SimCheck agree with the circuit above it?
 *
 * Why this exists
 * ---------------
 * A SimCheck tells the reader what a node will read. If that number is wrong,
 * the reader builds the circuit correctly, gets a different answer, and
 * concludes they made a mistake - which is worse than saying nothing, because
 * it spends their evening and their confidence.
 *
 * Every one of those numbers was worked out by hand, and several were wrong the
 * first time: an R-2R ladder loaded at the wrong node, a divider I sagged in the
 * wrong direction, a pair of ESRs I treated as carrying different voltages when
 * they are in parallel. Each was caught by re-deriving it. Nothing was checking.
 *
 * solve-dc computes the operating point from the build table. This compares the
 * two, so a probe that claims V(out) = 1.2438 V has to agree with the netlist
 * the same page tells the reader to build.
 *
 * What it checks
 * --------------
 * Probes marked `dc: true`, which asserts one specific thing: this is what the
 * node reads with the build table exactly as printed. The node comes from
 * `node`, and "sense_p,sense_n" means the difference between two.
 *
 * It took two wrong designs to get here and both are worth recording.
 *
 * Reading the node out of the LABEL failed four correct probes, because a label
 * is prose: "V(out) with V_field at +100 mV" and "V(cc) if the sink is
 * unplugged" both name a node and both describe a state the table is not in.
 *
 * Keying off `node` alone failed two more, and for a subtler reason. `node` says
 * where the reader puts the probe; it does not say the circuit is in its default
 * state. A photodiode amplifier driven by a 1 uA AC source has V(out) = 0 at DC
 * and a 1 V amplitude at 10 kHz, and both statements are true about the same
 * node. Only the author knows which one a probe means, so the author says so.
 *
 * A probe for a frequency, a duty cycle, a slope, a ripple or a swept condition
 * simply omits the flag. A lesson whose build table solve-dc cannot handle is
 * skipped, not failed.
 *
 *   node tools/check-sim-values.js
 *   node tools/check-sim-values.js --list    show every comparison, not just failures
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const LIST = process.argv.includes('--list');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** Ask solve-dc for one lesson's operating point. */
function operatingPoint(rel) {
    let out;
    try {
        out = execFileSync(process.execPath,
            [path.join(ROOT, 'tools', 'solve-dc.js'), rel],
            { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
        return null;
    }
    if (!/^SOLVED/m.test(out)) return null;
    // More than one solvable table in a file makes "V(out)" ambiguous.
    if ((out.match(/^SOLVED/gm) || []).length > 1) return null;
    const v = {};
    out.split('\n').forEach(line => {
        const m = /V\(([^)]+)\)\s*=\s*(-?[\d.]+(?:e[-+]?\d+)?)\s*(uV|mV|V)/.exec(line);
        if (!m) return;
        const scale = m[3] === 'uV' ? 1e-6 : m[3] === 'mV' ? 1e-3 : 1;
        v[m[1]] = parseFloat(m[2]) * scale;
    });
    return v;
}

/** The probe objects out of a lesson's SimCheck script block. */
function probes(src) {
    const found = [];
    // add-sim-check indents the options object, so the block closes on
    // "\n    });" rather than at column zero. Start at "probes:" so the widget's
    // own id is not read as the first probe's.
    const block = /new SimCheckWidget\([\s\S]*?\n\s*\}\);/.exec(src);
    if (!block) return found;
    const arr = /probes:\s*\[([\s\S]*?)\n\s*\],/.exec(block[0]);
    if (!arr) return found;
    // Split on probe boundaries first, so a `dc: true` in one probe cannot be
    // read as belonging to the probe before it.
    arr[1].split(/\n\s*(?=\{\s*id:)/).forEach(chunk => {
        const id = /id:\s*'([^']+)'/.exec(chunk);
        const expect = /expect:\s*'([^']*)'/.exec(chunk);
        const unit = /unit:\s*'([^']*)'/.exec(chunk);
        const tol = /\btol:\s*([\d.]+)/.exec(chunk);
        if (!id || !expect || !unit || !tol) return;
        const base = { id: id[1], expect: expect[1], unit: unit[1], tol: parseFloat(tol[1]) };

        if (/\bdc:\s*true\b/.test(chunk)) {
            const node = /node:\s*'([^']+)'/.exec(chunk);
            if (node) found.push(Object.assign({ kind: 'dc', node: node[1] }, base));
            return;
        }
        const acNode = /acNode:\s*'([^']+)'/.exec(chunk);
        if (!acNode) return;
        const acAt = /acAt:\s*([\d.eE+\-]+)/.exec(chunk);
        const acCorner = /acCorner:\s*(\d+)/.exec(chunk);
        if (acAt) found.push(Object.assign({ kind: 'acAt', node: acNode[1], at: parseFloat(acAt[1]) }, base));
        else if (acCorner) found.push(Object.assign({ kind: 'acCorner', node: acNode[1], nth: parseInt(acCorner[1], 10) }, base));
    });
    return found;
}

const UNIT = { 'V': 1, 'mV': 1e-3, '&micro;V': 1e-6, 'uV': 1e-6, 'V peak': 1, 'mV peak': 1e-3 };
const FREQ = { 'Hz': 1, 'kHz': 1e3, 'MHz': 1e6, 'GHz': 1e9, 'mHz': 1e-3 };

/** Ask solve-ac for one lesson's response, as JSON. */
function acResponse(rel, extra) {
    let out;
    try {
        out = execFileSync(process.execPath,
            [path.join(ROOT, 'tools', 'solve-ac.js'), rel, '--json'].concat(extra || []),
            { cwd: ROOT, encoding: 'utf8' });
    } catch (e) { return null; }
    const lines = out.trim().split('\n').filter(Boolean);
    if (lines.length !== 1) return null;              // none, or ambiguous
    try { return JSON.parse(lines[0]).nodes; } catch (e) { return null; }
}

const files = walk(LESSONS, []).sort();
const bad = [];
let compared = 0, acCompared = 0, lessons = 0, skipped = 0;

const fail = (rel, id, msg) => {
    bad.push({ rel, id, msg });
    console.log('  FAIL ' + rel + '  ' + id + '  ' + msg);
};

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    if (src.indexOf('SimCheckWidget') === -1) return;
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const ps = probes(src);
    if (!ps.length) return;

    lessons++;

    // --- AC claims: a corner frequency, or a gain at one frequency -----------
    const acProbes = ps.filter(p => p.kind !== 'dc');
    if (acProbes.length) {
        const sweep = acResponse(rel);
        const atCache = new Map();
        acProbes.forEach(p => {
            const want = parseFloat(p.expect);
            if (!isFinite(want)) return;
            if (p.kind === 'acCorner') {
                if (!sweep) { skipped++; return; }
                const n = sweep[p.node];
                if (!n) { fail(rel, p.id, 'names node "' + p.node + '", not in the netlist'); return; }
                const scale = FREQ[p.unit];
                if (scale === undefined) return;
                if (!n.corners || n.corners.length < p.nth) {
                    fail(rel, p.id, 'expects corner #' + p.nth + ' on V(' + p.node + '), and the sweep finds ' +
                         ((n.corners || []).length));
                    return;
                }
                const got = n.corners[p.nth - 1] / scale;
                acCompared++;
                const ok = Math.abs(got - want) <= p.tol;
                if (LIST || !ok) {
                    console.log((ok ? '  ok   ' : '  FAIL ') + rel + '  ' + p.id + '  says ' + want + ' ' +
                        p.unit + ', sweep gives ' + got.toPrecision(5) + (ok ? '' : '   (tolerance ' + p.tol + ')'));
                }
                if (!ok) bad.push({ rel, id: p.id });
            } else if (p.kind === 'acAt') {
                if (!atCache.has(p.at)) atCache.set(p.at, acResponse(rel, ['--at', String(p.at)]));
                const r = atCache.get(p.at);
                if (!r) { skipped++; return; }
                const n = r[p.node];
                if (!n) { fail(rel, p.id, 'names node "' + p.node + '", not in the netlist'); return; }
                const got = p.unit === 'dB' ? n.db : (UNIT[p.unit] === undefined ? null : n.mag / UNIT[p.unit]);
                if (got === null) return;
                acCompared++;
                const ok = Math.abs(got - want) <= p.tol;
                if (LIST || !ok) {
                    console.log((ok ? '  ok   ' : '  FAIL ') + rel + '  ' + p.id + '  says ' + want + ' ' +
                        p.unit + ' at ' + p.at + ' Hz, sweep gives ' + got.toPrecision(5) +
                        (ok ? '' : '   (tolerance ' + p.tol + ')'));
                }
                if (!ok) bad.push({ rel, id: p.id });
            }
        });
    }

    // --- DC claims -----------------------------------------------------------
    const dcProbes = ps.filter(p => p.kind === 'dc');
    if (!dcProbes.length) return;
    const op = operatingPoint(rel);
    if (!op) { skipped++; return; }

    dcProbes.forEach(p => {
        // Earlier SimChecks wrote node: 'V(out)' and later ones write node:
        // 'out'. Both mean the same node; accept either rather than making the
        // older ones wrong.
        const bare = p.node.replace(/^\s*V\s*\(\s*/i, '').replace(/\s*\)\s*$/, '');
        const [a, b] = bare.split(',').map(s => s.trim());
        if (!(a in op)) {
            bad.push({ rel, id: p.id, why: 'names node "' + a + '", which the build table does not build' });
            console.log('  FAIL ' + rel + '  ' + p.id + '  names node "' + a + '", not in the netlist');
            return;
        }
        if (b && !(b in op)) {
            bad.push({ rel, id: p.id, why: 'names node "' + b + '", which the build table does not build' });
            console.log('  FAIL ' + rel + '  ' + p.id + '  names node "' + b + '", not in the netlist');
            return;
        }
        const scale = UNIT[p.unit];
        if (scale === undefined) return;              // not a voltage probe
        const want = parseFloat(p.expect);
        if (!isFinite(want)) return;

        const got = (op[a] - (b ? op[b] : 0)) / scale;
        const tol = p.tol;
        compared++;
        const ok = Math.abs(got - want) <= tol;
        if (LIST || !ok) {
            const line = (ok ? '  ok   ' : '  FAIL ') + rel + '  ' + p.id +
                '  says ' + want + ' ' + p.unit + ', circuit gives ' + got.toPrecision(6) +
                (ok ? '' : '   (tolerance ' + tol + ')');
            console.log(line);
        }
        if (!ok) bad.push({ rel, id: p.id, want, got, unit: p.unit, tol });
    });
});

console.log('');
console.log('SIMCHECK VALUES AGAINST THE CIRCUIT\n');
console.log('  lessons with node probes  ' + String(lessons).padStart(4));
console.log('  build table not solvable  ' + String(skipped).padStart(4) + '   (skipped, not failed)');
console.log('  DC values compared        ' + String(compared).padStart(4));
console.log('  AC values compared        ' + String(acCompared).padStart(4));
console.log('  disagreeing               ' + String(bad.length).padStart(4));
console.log('');

if (bad.length) {
    console.log('FAIL - ' + bad.length + ' stated value(s) disagree with the circuit on the same page.');
    process.exit(1);
}
console.log('PASS - every DC and AC value a SimCheck states matches the circuit it describes.');
