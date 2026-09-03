#!/usr/bin/env node
/**
 * survey-numeric-coverage - which lessons are full of numbers nothing checks?
 *
 * check-arithmetic verifies 298 expressions, check-tables 32 cells and
 * check-constants 24 values. That is a lot more than the 42 it started with,
 * and it is still a fraction of the numbers in the course - because a number
 * only becomes checkable when the lesson writes down the sum that produced it.
 *
 * The rest are assertions: "the corner is at 1.6 kHz", "expect 40 mA", "typical
 * 2.5 ppm". Those cannot be verified mechanically, and pretending otherwise is
 * how a checker starts producing noise. What CAN be done is point at them, so a
 * hand audit goes where the numbers actually are rather than where it is
 * convenient to start.
 *
 * This ranks every lesson by unverified numeric density: how many quantities it
 * asserts, against how many of them appear in something a checker can evaluate.
 *
 * Advisory. It measures how much is left, not whether anything is wrong.
 *
 * Run: node tools/survey-numeric-coverage.js [--top N]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const TOP = (() => {
    const i = process.argv.indexOf('--top');
    return i > 0 ? parseInt(process.argv[i + 1], 10) : 25;
})();

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** A quantity: a number carrying a unit, which is what a claim looks like. */
const QUANTITY =
    /-?\d[\d,]*(?:\.\d+)?\s*(?:&nbsp;|&thinsp;|\s)?\s*(?:[pnuµμmkKMGT]|&micro;|&mu;)?\s*(?:V|A|W|Hz|F\b|H\b|s\b|J\b|&Omega;|Ω|ohms?|dB[a-zΩ]*|%|°C|ppm|bits?)\b/g;

/** Something a checker could have evaluated: an expression with an equals. */
const CHECKABLE = /=\s*-?\d/g;

const files = walk(LESSONS, []).sort();
const rows = [];

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const body = src.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

    const quantities = (body.match(QUANTITY) || []).length;
    const checkable = (body.match(CHECKABLE) || []).length;
    if (quantities < 8) return;

    const m = /module-(\d+)[\\/]lesson-(\d+)/.exec(rel);
    const t = /<h2>([^<]{1,80})<\/h2>/.exec(src);
    rows.push({
        rel,
        mod: m ? +m[1] : 0,
        les: m ? +m[2] : 0,
        title: t ? t[1].replace(/&[a-z]+;/g, ' ').trim() : '',
        quantities, checkable,
        ratio: checkable / quantities
    });
});

rows.sort((a, b) => (b.quantities - b.checkable) - (a.quantities - a.checkable));

const totalQ = rows.reduce((s, r) => s + r.quantities, 0);
const totalC = rows.reduce((s, r) => s + r.checkable, 0);

console.log('NUMERIC COVERAGE\n');
console.log('  lessons carrying eight or more quantities   ' + String(rows.length).padStart(5));
console.log('  quantities asserted                         ' + String(totalQ).padStart(5));
console.log('  of those, inside a written-out sum          ' + String(totalC).padStart(5) +
            '   ' + ((totalC / totalQ) * 100).toFixed(0) + '%');
console.log('');
console.log('MOST NUMBERS, LEAST WORKING SHOWN\n');
console.log('  quantities  shown  lesson');
rows.slice(0, TOP).forEach(r => {
    console.log('  ' + String(r.quantities).padStart(9) + '  ' +
                String(r.checkable).padStart(5) + '  M' + r.mod + '-' + r.les +
                '  ' + r.title.slice(0, 46));
});
console.log('');
console.log('A high count here is not a defect. It is where a hand audit pays,');
console.log('and where adding one worked line would let a checker reach.');
