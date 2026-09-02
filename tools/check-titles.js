#!/usr/bin/env node
/**
 * DOES EACH LESSON FILE CONTAIN THE LESSON THE CATALOGUE PROMISES?
 *
 * The sidebar, the search box and the learning path all take a lesson's title
 * from assets/curriculum.js. The reader takes it from the <h2> at the top of
 * the file. Nothing checked that those were the same lesson, and for 55 of them
 * they were not: clicking "Active Filters (Sallen-Key)" opened a transimpedance
 * amplifier.
 *
 * That is worse than a cosmetic mismatch. The learning path references lessons
 * by POSITION, so a mispaired file silently rewires the syllabus - the step
 * that says "transimpedance amplifier, your first current-input amplifier"
 * hands the reader an instrumentation amplifier instead.
 *
 * validate-path.js could never have caught it. That tool compares the path's
 * step titles against the CATALOGUE, and here the catalogue and the path agreed
 * with each other while both disagreed with the file on disk. Two sources
 * agreeing is not corroboration when they were copied from one another.
 *
 * The file is treated as the truth: it holds the actual teaching. A title in
 * curriculum.js is a label, and a label is the cheap thing to fix.
 *
 *   node tools/check-titles.js          the mismatches
 *   node tools/check-titles.js --all    every lesson and its verdict
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const ALL = process.argv.includes('--all');

const C = new Function('window', 'document', 'localStorage',
    fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8') +
    '\n;return window.CURRICULUM;')({}, undefined, undefined);

const norm = s => String(s || '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Overlap of the smaller title's words with the larger's. */
function agreement(a, b) {
    const A = new Set(norm(a).split(' ').filter(Boolean));
    const B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
}

// A heading that names no topic tells the reader nothing and cannot be
// compared. Worth reporting separately rather than as a mismatch.
const GENERIC = /^(introduction|overview|contents|summary|about)$/;

const rows = [];
C.modules.forEach(m => {
    m.lessons.forEach(l => {
        const rel = 'lessons/module-' + String(m.id).padStart(2, '0') +
                    '/lesson-' + String(l.id).padStart(2, '0') + '.html';
        const p = path.join(ROOT, rel);
        if (!fs.existsSync(p)) {
            rows.push({ m: m.id, l: l.id, cat: l.title, file: null, kind: 'MISSING FILE' });
            return;
        }
        const s = fs.readFileSync(p, 'utf8');
        const h = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(s);
        const heading = h ? h[1].replace(/<[^>]*>/g, '').trim() : null;

        if (!heading) {
            rows.push({ m: m.id, l: l.id, cat: l.title, file: null, kind: 'NO HEADING' });
            return;
        }
        if (GENERIC.test(norm(heading))) {
            rows.push({ m: m.id, l: l.id, cat: l.title, file: heading, kind: 'GENERIC HEADING' });
            return;
        }
        const ov = agreement(l.title, heading);
        rows.push({
            m: m.id, l: l.id, cat: l.title, file: heading, ov: ov,
            kind: ov >= 0.5 ? 'ok' : 'MISMATCH'
        });
    });
});

const bad = rows.filter(r => r.kind === 'MISMATCH');
const generic = rows.filter(r => r.kind === 'GENERIC HEADING');
const broken = rows.filter(r => r.kind === 'MISSING FILE' || r.kind === 'NO HEADING');

console.log(rows.length + ' lessons checked');
console.log('  ' + rows.filter(r => r.kind === 'ok').length + ' titles agree with their file');
console.log('  ' + bad.length + ' MISMATCH');
console.log('  ' + generic.length + ' generic heading (cannot be compared)');
console.log('  ' + broken.length + ' missing or headingless');

if (ALL) {
    console.log('\nALL LESSONS\n');
    rows.forEach(r => console.log('  ' + r.kind.padEnd(16) +
        (r.m + '-' + r.l).padEnd(7) + String(r.cat).slice(0, 36).padEnd(38) +
        (r.file || '')));
}

if (bad.length) {
    console.log('\nMISMATCHED — the sidebar promises one lesson and the file is another\n');
    let last = null;
    bad.forEach(r => {
        if (r.m !== last) { console.log('  M' + r.m); last = r.m; }
        console.log('      ' + (r.m + '-' + r.l).padEnd(7) +
            'catalogue: ' + r.cat.slice(0, 34).padEnd(36) +
            'file: ' + r.file.slice(0, 40));
    });
}

if (generic.length) {
    console.log('\nGENERIC HEADINGS — the file opens with a word that names no topic,');
    console.log('so a reader landing on it cannot tell what they are reading.\n');
    generic.forEach(r => console.log('      ' + (r.m + '-' + r.l).padEnd(7) +
        r.cat.slice(0, 40).padEnd(42) + '<h2>' + r.file + '</h2>'));
}

if (broken.length) {
    console.log('\nBROKEN\n');
    broken.forEach(r => console.log('      ' + (r.m + '-' + r.l).padEnd(7) + r.kind + '  ' + r.cat));
}

if (!bad.length && !broken.length) {
    console.log('\nPASS - every lesson file matches the title the catalogue gives it.');
    process.exit(0);
}
process.exit(1);
