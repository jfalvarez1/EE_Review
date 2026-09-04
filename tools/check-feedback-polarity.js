#!/usr/bin/env node
/**
 * check-feedback-polarity - an op-amp whose feedback returns to the wrong input.
 *
 * Why this exists
 * ---------------
 * A DC solve cannot see this mistake. The course's ideal op-amp is a nullor,
 * which forces its two inputs equal whichever way round they are wired, so an
 * amplifier built with positive feedback solves to exactly the same operating
 * point as the correct one. The circuit_toy session tried it as a negative
 * control with a finite-gain macromodel: swapping +in and -in moved the answer
 * by 2/A, which at A = 1e5 is closer to the ideal value, not further. A
 * passing solve is therefore no evidence at all about feedback polarity, and
 * M05 L11's three-stage amplifier had exactly this fault at transistor level -
 * it latched at a rail in one solver and could not converge in the other, and
 * nothing said why.
 *
 * On the bench the wrongly wired amplifier is a latch: the output goes to a
 * rail and stays. The reader who built the table as written would blame
 * themselves.
 *
 * The same session then showed where the blindness actually lives: its own
 * template solver, whose op-amp clips at its rails, catches the swap at once,
 * because positive feedback drives a railed output nowhere near the expected
 * value. The nullor and a bare VCVS have no rails, so the swap is invisible to
 * them. It is a property of a RAIL-LESS model, not of DC solving or of
 * op-amps - which is why this check reads the authored connection text and
 * asks no solver anything.
 *
 * What it checks
 * --------------
 * For every op-amp in a build table, which of its inputs the output reaches
 * through passive parts alone - resistors, capacitors, inductors, and node
 * names shared with the output. Reaching the inverting input is negative
 * feedback (or mixed, which a Schmitt trigger wants). Reaching ONLY the
 * non-inverting input is positive feedback, and is flagged unless the table
 * or the lesson says that is the point: a Schmitt trigger, a comparator with
 * hysteresis, a relaxation oscillator, a negative-impedance converter.
 * Reaching neither is open loop, which parse() already refuses unless the
 * table names it a comparator.
 *
 * Paths through a controlled source are not followed: a VCVS in the loop is
 * a model of something and its sense is that model's business.
 *
 * Run: node tools/check-feedback-polarity.js [--list] [--file <path>]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const ONLY = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : null; })();

// Titles or rows that make positive feedback the intent.
const INTENDED = /schmitt|hysteresis|relaxation|oscillator|astable|multivibrator|negative[- ]impedance|\bnic\b|latch|bistable|regenerative|positive feedback|window comparator|comparator/i;

const files = ONLY ? [path.resolve(ROOT, ONLY)] : N.walk(LESSONS, []).sort();
let tables = 0, opamps = 0;
const bad = [];

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    // The text just above each build table (its bold label, usually), in the
    // same order tablesIn() returns them: a Schmitt trigger says so there.
    const headings = [];
    for (const m of src.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
        const body = m[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body) || !/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        headings.push(src.slice(Math.max(0, m.index - 400), m.index).replace(/<[^>]+>/g, ' '));
    }
    N.tablesIn(src).forEach((rows, ti) => {
        tables++;
        // Passive connectivity: union nodes joined by R, C, L rows.
        const parent = new Map();
        const find = n => { while (parent.has(n) && parent.get(n) !== n) n = parent.get(n); return n; };
        const union = (a, b) => { const ra = find(a), rb = find(b); if (!parent.has(ra)) parent.set(ra, ra); if (!parent.has(rb)) parent.set(rb, rb); if (ra !== rb) parent.set(ra, rb); };
        const oas = [];
        const passiveRows = [];
        for (const [part, what, value, connect] of rows) {
            const t = N.terminals(connect);
            if (!t.kind) continue;
            if (/op-?amp/i.test(what) && t.kind === 'opamp') { oas.push({ part, value, n: t.nodes }); continue; }
            if (/resistor|capacitor|inductor|potentiometer/i.test(what) && t.kind === 'two') {
                passiveRows.push(t.nodes);
                if (!N.isGround(t.nodes[0]) && !N.isGround(t.nodes[1])) union(t.nodes[0], t.nodes[1]);
            }
        }
        if (!oas.length) return;
        const tableText = rows.map(r => r.join(' ')).join(' ');
        const heading = headings[ti] || '';
        for (const oa of oas) {
            opamps++;
            const [plus, minus, out] = oa.n;
            const reach = n => !N.isGround(n) && !N.isGround(out) && find(n) === find(out) && parent.has(find(out));
            const toMinus = reach(minus), toPlus = reach(plus);
            if (toMinus) continue;                         // negative or mixed: fine
            if (!toPlus) continue;                         // open loop: parse() polices it
            if (INTENDED.test(oa.value) || INTENDED.test(tableText) || INTENDED.test(heading)) continue;
            bad.push({ rel, table: ti + 1, part: oa.part, plus, minus, out });
        }
    });
});

if (LIST || bad.length) {
    for (const b of bad) {
        console.log('  FAIL  ' + b.rel + (b.table > 1 ? ' [table ' + b.table + ']' : '') + '   ' + b.part +
                    ': output ' + b.out + ' returns only to the + input (' + b.plus + '); the - input (' + b.minus + ') has no feedback path');
    }
}
console.log('');
console.log('  build tables checked   ' + String(tables).padStart(4));
console.log('  op-amps checked        ' + String(opamps).padStart(4));
console.log('  positive feedback, unintended ' + String(bad.length).padStart(4));
console.log('');
if (bad.length) {
    console.log('FAIL - an op-amp wired with positive feedback where the lesson does not intend it.');
    console.log('       A DC solve cannot see this (the ideal op-amp solves identically either way); on the bench it latches to a rail.');
    process.exit(1);
}
console.log('PASS - every op-amp with feedback returns it to the inverting input, or the lesson means the hysteresis.');
