#!/usr/bin/env node
/**
 * check-build-values - a component the reader cannot enter.
 *
 * Why this exists
 * ---------------
 * check-build-nets asks whether a build table's components are connected to each
 * other. It says nothing about whether they have values. A row reading
 *
 *     L1  |  Inductor  |          |  between sw and out
 *
 * is perfectly wired and completely unbuildable, and there were 46 of them,
 * found only when solve-dc tried to compute an operating point and had no number
 * to work with.
 *
 * The placeholder forms are the interesting half. "set by VIN" and "{GAIN}" are
 * leftovers from a generator that expected a parameter block the build table
 * never carries, so they LOOK like values and are not.
 *
 * What is allowed
 * ---------------
 * A part whose name is its value: an op-amp is an "Op-Amp", a transistor is a
 * "2N3904", a switch is an "SPDT Switch". Those rows are complete as they stand.
 *
 *   node tools/check-build-values.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

const text = h => h
    .replace(/<(em|small|i)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&thinsp;/g, ' ')
    .replace(/&Omega;/g, 'ohm')
    .replace(/&micro;|&mu;/g, 'u')
    .replace(/&mdash;|&minus;|&ndash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** Empty, a dash, or a placeholder deferring to a variable nothing defines. */
const noValue = v =>
    v === '' || v === '-' ||
    (/^set by\b/i.test(v) && !/\d/.test(v)) ||
    /^\{.*\}$/.test(v);

/**
 * A semiconductor's value has to NAME A DEVICE, not be a number.
 *
 * Four transistors in module 16 lesson 2's push-pull output stage carried the
 * value "0", which sails past the check above because it contains a digit and
 * past every other checker because the row is wired correctly. It is still
 * unbuildable: there is no part called 0, and no way to know whether the
 * complementary half was meant to be an NPN or a PNP.
 */
const SEMI = /diode|transistor|mosfet|nmos|pmos|\bbjt\b|jfet|darlington/i;
const numericOnly = v => /^[\d.\s]+$/.test(v);

/** Parts whose name IS their value. */
const NAMED = /^(op-amp|real op-amp|opamp|nmos|pmos|npn|pnp|n-jfet|2n\d|1n\d|mbr|schottky|diode|led|photodiode|zener|sub-circuit|sr latch|not gate|and gate|or gate|xor gate|nor gate|buffer|analog switch|spdt switch|dpdt switch|spst switch|transmission line|d flip-flop|t flip-flop|counter|shift register|half adder|full adder|open loop|crystal|thermistor|photoresistor|ldr|optocoupler|memristor|varactor|tunnel diode|ujt|test point|magnetic coupling)/i;

const findings = [];
let rowsSeen = 0;

walk(LESSONS, []).sort().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].forEach(rm => {
            const c = [...rm[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x => text(x[1]));
            if (c.length < 4) return;
            rowsSeen++;
            const [part, what, value] = c;
            const bad = (noValue(value) && !NAMED.test(value)) ||
                        (SEMI.test(what) && numericOnly(value));
            if (!bad) return;
            findings.push({ rel, part, what, value });
        });
    }
});

console.log('BUILD TABLE VALUES\n');
console.log('  component rows      ' + String(rowsSeen).padStart(4));
console.log('  with no value       ' + String(findings.length).padStart(4));
console.log('');

if (findings.length) {
    let last = '';
    findings.forEach(f => {
        if (f.rel !== last) { console.log('  ' + f.rel); last = f.rel; }
        console.log('      ' + f.part.padEnd(12) + f.what.padEnd(24) +
                    (f.value ? '"' + f.value + '"' : '(empty)'));
    });
    console.log('');
    console.log('FAIL - ' + findings.length + ' component row(s) a reader cannot enter into a simulator.');
    process.exit(1);
}
console.log('PASS - every component in every build table has a value.');
