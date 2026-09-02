#!/usr/bin/env node
/**
 * MAKE THE CATALOGUE DESCRIBE THE LESSON THAT IS ACTUALLY THERE
 *
 * check-titles.js found 48 lessons whose curriculum.js title named a different
 * lesson than the file contained. This rewrites those titles from the file's
 * own <h2>, because the file holds the teaching and the catalogue entry is only
 * a label.
 *
 * WHY NOT MOVE THE FILES INSTEAD. That was tried first and is wrong here.
 * reorder-curriculum.js carries a lesson's catalogue entry along with its file,
 * so permuting a module preserves the mispairing and merely reshuffles it. It
 * would also be the wrong outcome even if it worked: in module 2 the files are
 * already in the order the syllabus wants - transimpedance, instrumentation,
 * active filters - and it is only the labels that had rotated. Moving the files
 * would have broken a correct order to fix an incorrect label.
 *
 * WHAT THIS DOES NOT FIX. Each lesson also carries a `description` and a
 * `topics` list, and where the title was wrong those are usually wrong too.
 * They cannot be recovered from an <h2>. Every one it touches is reported so
 * the descriptions can be written by someone who has read the lesson, and
 * `--flag-descriptions` lists them without changing anything.
 *
 * Learning-path refs are NOT touched either: a step pointing at the wrong
 * lesson is a separate decision about what the syllabus meant to teach.
 * check-titles.js and validate-path.js will both still complain until those are
 * settled by hand, which is the point.
 *
 *   node tools/fix-titles.js --dry     show what would change
 *   node tools/fix-titles.js           rewrite the titles
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');
const CURRICULUM = path.join(ROOT, 'assets/curriculum.js');

const C = new Function('window', 'document', 'localStorage',
    fs.readFileSync(CURRICULUM, 'utf8') + '\n;return window.CURRICULUM;')({}, undefined, undefined);

const norm = s => String(s || '').toLowerCase()
    .replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function agreement(a, b) {
    const A = new Set(norm(a).split(' ').filter(Boolean));
    const B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
}

const GENERIC = /^(introduction|overview|contents|summary|about)$/;

/**
 * Some lessons have no lesson-level <h2> at all - their first one is already a
 * numbered section, "1. Flyback Operating Principle". Taking that as the
 * lesson's title replaces a good name with a fragment of the lesson's own
 * outline, which is how six perfectly well-named M25 lessons briefly became
 * "1. EMI Fundamentals" and friends.
 *
 * A heading that opens with a section number is never a lesson title.
 */
const SECTION = /^\s*(?:\d+|[ivx]+)\s*[.)]\s+/i;

/** Decode the handful of entities that appear in these headings. */
function decode(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
            .replace(/&nbsp;/g, ' ').replace(/&micro;/g, 'µ')
            .replace(/&deg;/g, '°').replace(/&Omega;/g, 'Ω')
            .replace(/\s+/g, ' ').trim();
}

const changes = [];
C.modules.forEach(m => {
    m.lessons.forEach(l => {
        const rel = 'lessons/module-' + String(m.id).padStart(2, '0') +
                    '/lesson-' + String(l.id).padStart(2, '0') + '.html';
        const p = path.join(ROOT, rel);
        if (!fs.existsSync(p)) return;
        const h = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(fs.readFileSync(p, 'utf8'));
        if (!h) return;
        const heading = decode(h[1].replace(/<[^>]*>/g, ''));
        if (!heading || GENERIC.test(norm(heading)) || SECTION.test(heading)) return;
        if (agreement(l.title, heading) >= 0.5) return;
        changes.push({ mod: m.id, les: l.id, from: l.title, to: heading, desc: l.description });
    });
});

console.log(changes.length + ' catalogue titles name a different lesson than their file\n');
if (!changes.length) {
    console.log('Nothing to do.');
    process.exit(0);
}

let last = null;
changes.forEach(c => {
    if (c.mod !== last) { console.log('  M' + c.mod); last = c.mod; }
    console.log('      ' + (c.mod + '-' + c.les).padEnd(7) +
        '"' + c.from.slice(0, 34) + '"');
    console.log('              -> "' + c.to.slice(0, 60) + '"');
});

if (process.argv.includes('--flag-descriptions')) {
    console.log('\nDESCRIPTIONS THAT ALSO NEED REWRITING BY HAND\n');
    changes.forEach(c => console.log('  ' + (c.mod + '-' + c.les).padEnd(7) +
        String(c.desc || '').slice(0, 86)));
}

if (DRY) {
    console.log('\nNothing written (--dry).');
    process.exit(0);
}

// ---------------------------------------------------------------- rewrite
//
// Exact-match, assert-once, all-or-nothing - the project's editing rule. A
// title is located by the `id: N,` immediately preceding it inside the right
// module block, never by a bare search for the title text, which would also
// match a `topics:` entry or another module's identically named lesson.

let src = fs.readFileSync(CURRICULUM, 'utf8');
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const failures = [];
changes.forEach(c => {
    const moduleRe = new RegExp(
        '(// =+ MODULE ' + c.mod + ':[\\s\\S]*?)(?=// =+ MODULE \\d+:|\\n    \\],)', 'm');
    const mm = moduleRe.exec(src);
    if (!mm) { failures.push(c.mod + '-' + c.les + ': module block not found'); return; }

    const block = mm[0];
    const titleRe = new RegExp(
        '(id:\\s*' + c.les + ',\\s*\\n\\s*title:\\s*\')' + rxEsc(c.from) + '(\')');
    const hits = block.match(new RegExp(titleRe.source, 'g'));
    if (!hits || hits.length !== 1) {
        failures.push(c.mod + '-' + c.les + ': matched ' + (hits ? hits.length : 0) +
                      ' times inside its module, expected 1');
        return;
    }
    const updated = block.replace(titleRe, (whole, a, b) => a + esc(c.to) + b);
    src = src.replace(block, () => updated);
});

if (failures.length) {
    console.error('\nABORTED - nothing written. Could not safely locate:\n');
    failures.forEach(f => console.error('  ' + f));
    process.exit(1);
}

fs.writeFileSync(CURRICULUM, src);
console.log('\n' + changes.length + ' titles rewritten in assets/curriculum.js');
console.log('Descriptions and topics for those lessons are still stale - run with');
console.log('--flag-descriptions to list them.');
