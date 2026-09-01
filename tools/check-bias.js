#!/usr/bin/env node
/**
 * CHECK THAT EVERY DRAWN BJT STAGE CAN ACTUALLY BE BIASED
 *
 * A "Build it in Circuit Toy" table is an instruction. If the values in it put
 * the transistor into saturation, the reader builds a circuit that does not
 * amplify, and nothing in the lesson says so - an AC sweep linearises about
 * whatever operating point it finds and will happily report a frequency
 * response for a stage jammed against its rail.
 *
 * This finds the classic four-resistor stage in every build table:
 *
 *      VCC ---+---[R1]---+---[RC]--- collector
 *             |          |
 *          [R2]       (base)
 *             |          |
 *            gnd      emitter ---[RE]--- gnd
 *
 * and checks the operating point it implies. The failure it exists to catch is
 * the one found in module-05/lesson-06: R1/R2 asking for 2.34 mA, which through
 * a 6 kohm collector resistor wants 14 V of drop from a 12 V supply.
 *
 * It only understands that one topology, which is deliberate - it is the most
 * common one in the course and the one whose arithmetic is easy to get wrong.
 * Stages it cannot identify are counted, not guessed at.
 *
 *   node tools/check-bias.js
 *   node tools/check-bias.js -v      list the stages it checked and passed
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const VERBOSE = process.argv.includes('-v');
const VBE = 0.7;
const VCESAT = 0.3;

/** "6&nbsp;k&Omega;" -> 6000 ; "5.6&nbsp;kO" -> 5600 ; "600&nbsp;O" -> 600 */
function ohms(cell) {
    const t = cell.replace(/&nbsp;/g, ' ').replace(/&[a-zA-Z]+;/g, '').trim();
    const m = /^([-\d.]+)\s*([kKmMG])?/.exec(t);
    if (!m) return null;
    const mult = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, m: 1e-3 }[m[2]] || 1;
    return parseFloat(m[1]) * mult;
}
function volts(cell) {
    const t = cell.replace(/&nbsp;/g, ' ').replace(/&[a-zA-Z]+;/g, '').trim();
    const m = /^([-\d.]+)\s*([mk])?\s*V/i.exec(t);
    if (!m) return null;
    const mult = { m: 1e-3, k: 1e3 }[m[2]] || 1;
    return parseFloat(m[1]) * mult;
}

/** Pull every build table out of a lesson as an array of row objects. */
function tables(html) {
    const out = [];
    const re = /<table>([\s\S]*?)<\/table>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const body = m[1];
        if (!/<th>Part<\/th>/.test(body)) continue;
        const rows = [];
        const rre = /<tr>([\s\S]*?)<\/tr>/gi;
        let r;
        while ((r = rre.exec(body)) !== null) {
            const cells = [];
            const cre = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            let c;
            while ((c = cre.exec(r[1])) !== null) {
                cells.push(c[1].replace(/<[^>]*>/g, '').trim());
            }
            if (cells.length === 4) {
                rows.push({ name: cells[0], what: cells[1], value: cells[2], conn: cells[3] });
            }
        }
        if (rows.length) out.push(rows);
    }
    return out;
}

const between = c => {
    const m = /between\s+(\S+)\s+and\s+(\S+)/.exec(c.replace(/\s+/g, ' '));
    return m ? [m[1], m[2]] : null;
};
const fromTo = c => {
    const m = /from\s+(\S+)\s+to\s+(\S+)/.exec(c.replace(/\s+/g, ' '));
    return m ? [m[1], m[2]] : null;
};

function analyse(rows) {
    const q = rows.find(r => /Transistor \(BJT\)/.test(r.what));
    if (!q) return null;
    const cm = /collector\s+(\S+),\s*base\s+(\S+),\s*emitter\s+(\S+)/.exec(q.conn.replace(/\s+/g, ' '));
    if (!cm) return null;
    const [, col, base, emit] = cm;
    if (emit === 'ground') return null;              // no RE: a different topology

    // the supply: a DC voltage source from some node to ground
    let vccNode = null, vcc = null;
    rows.forEach(r => {
        if (!/Voltage source/.test(r.what)) return;
        const v = volts(r.value);
        if (v === null || !/DC/.test(r.value)) return;
        const ft = fromTo(r.conn);
        if (ft && ft[1] === 'ground' && v > 0 && (vcc === null || v > vcc)) {
            vcc = v; vccNode = ft[0];
        }
    });
    if (vcc === null) return null;

    const res = rows.filter(r => r.what === 'Resistor');
    const find = (a, b) => res.find(r => {
        const bt = between(r.conn);
        return bt && ((bt[0] === a && bt[1] === b) || (bt[0] === b && bt[1] === a));
    });

    const R1 = find(vccNode, base), R2 = find(base, 'ground');
    const RC = find(vccNode, col), RE = find(emit, 'ground');
    if (!R1 || !R2 || !RC || !RE) return null;

    const r1 = ohms(R1.value), r2 = ohms(R2.value);
    const rc = ohms(RC.value), re = ohms(RE.value);
    if ([r1, r2, rc, re].some(x => x === null || !isFinite(x) || x <= 0)) return null;

    const vb = vcc * r2 / (r1 + r2);
    const ve = vb - VBE;
    if (ve <= 0) {
        return { vcc, r1, r2, rc, re, vb, ve, ic: 0, vc: vcc,
                 verdict: 'CUT OFF - base sits at ' + vb.toFixed(2) + ' V, below one VBE' };
    }
    const ic = ve / re;
    const vc = vcc - ic * rc;
    const headroom = vc - ve;
    let verdict = null;
    if (headroom < VCESAT) {
        verdict = 'SATURATED - wants ' + (ic * rc).toFixed(2) + ' V across RC from a ' +
                  vcc + ' V supply';
    } else if (headroom < 1.0) {
        verdict = 'barely active - only ' + headroom.toFixed(2) + ' V of VCE, no room to swing';
    }
    return { vcc, r1, r2, rc, re, vb, ve, ic, vc, headroom, verdict };
}

const files = [];
const dir = path.join(ROOT, 'lessons');
fs.readdirSync(dir).forEach(m => {
    const md = path.join(dir, m);
    if (!fs.statSync(md).isDirectory()) return;
    fs.readdirSync(md).forEach(f => {
        if (f.endsWith('.html')) files.push(path.join('lessons', m, f).replace(/\\/g, '/'));
    });
});

let checked = 0, skipped = 0;
const bad = [], good = [];
files.forEach(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    tables(html).forEach((rows, i) => {
        const hasQ = rows.some(r => /Transistor \(BJT\)/.test(r.what));
        if (!hasQ) return;
        const a = analyse(rows);
        if (!a) { skipped++; return; }
        checked++;
        const rec = { file: f, table: i + 1, a: a };
        if (a.verdict) bad.push(rec); else good.push(rec);
    });
});

console.log('Four-resistor BJT stages: ' + checked + ' checked, ' + skipped +
            ' had a BJT but not this topology');

if (VERBOSE) {
    console.log('\nPASSING');
    good.forEach(g => console.log('  ' + g.file + ' #' + g.table +
        '  IC=' + (g.a.ic * 1000).toFixed(2) + 'mA  VC=' + g.a.vc.toFixed(2) +
        'V  VCE=' + g.a.headroom.toFixed(2) + 'V'));
}

if (!bad.length) {
    console.log('PASS - every one of them has a usable operating point.');
    process.exit(0);
}
console.log('\nUNUSABLE OPERATING POINT (' + bad.length + ')');
bad.forEach(b => {
    const a = b.a;
    console.log('  ' + b.file + '  table ' + b.table);
    console.log('      R1=' + a.r1 + ' R2=' + a.r2 + ' RC=' + a.rc + ' RE=' + a.re +
                '  from ' + a.vcc + ' V');
    console.log('      VB=' + a.vb.toFixed(2) + ' VE=' + a.ve.toFixed(2) +
                ' IC=' + (a.ic * 1000).toFixed(2) + 'mA VC=' + a.vc.toFixed(2));
    console.log('      ' + a.verdict);
});
process.exit(1);
