#!/usr/bin/env node
/**
 * check-lesson-key - a lesson storing its progress under another lesson's name.
 *
 * Why this exists
 * ---------------
 * The design-checklist widget saves each tick under `${lessonKey}-${itemKey}`
 * in localStorage. If lessonKey does not identify the lesson it is in, the
 * ticks go somewhere else: two lessons sharing a key see each other's progress,
 * and neither owner can tell.
 *
 * Every one of the 131 lessons with a checklist had a key from an OLDER module
 * numbering - module 5's lessons were keyed m1lN, module 6's m5lN - left over
 * from a renumbering that never touched them. They happened not to collide with
 * each other, which is the only reason nobody noticed; the first new lesson to
 * use the correct scheme would have collided with one of them.
 *
 * The rule is simple and this enforces it: lessonKey must be m<module>l<lesson>
 * as derived from the file's own path, with no zero padding.
 *
 *   node tools/check-lesson-key.js
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

const bad = [];
const seen = new Map();
let withKey = 0;

walk(LESSONS, []).sort().forEach(file => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const m = /module-(\d+)\/lesson-(\d+)\.html$/.exec(rel);
    if (!m) return;
    const want = 'm' + parseInt(m[1], 10) + 'l' + parseInt(m[2], 10);
    const src = fs.readFileSync(file, 'utf8');
    const keys = [...src.matchAll(/lessonKey:\s*'([^']+)'/g)].map(x => x[1]);
    if (!keys.length) return;
    withKey++;
    keys.forEach(k => {
        if (!seen.has(k)) seen.set(k, []);
        seen.get(k).push(rel);
        if (k !== want) bad.push('  ' + rel.padEnd(34) + 'has ' + k.padEnd(8) + 'should be ' + want);
    });
});

const dups = [...seen.entries()].filter(([, v]) => v.length > 1);

console.log('LESSON KEYS\n');
console.log('  lessons with a checklist  ' + String(withKey).padStart(4));
console.log('  keyed to the wrong lesson ' + String(bad.length).padStart(4));
console.log('  keys shared by two lessons' + String(dups.length).padStart(4));
console.log('');

if (bad.length || dups.length) {
    bad.forEach(l => console.log(l));
    dups.forEach(([k, v]) => console.log('  ' + k + ' is used by ' + v.join(' and ')));
    console.log('');
    console.log('FAIL - a checklist would store its ticks under another lesson\'s name.');
    process.exit(1);
}
console.log('PASS - every lessonKey names the lesson it is in.');
