#!/usr/bin/env node
/**
 * WORK OUT HOW TO RE-PAIR LESSON FILES WITH THEIR CATALOGUE SLOTS
 *
 * check-titles.js reports that 48 lesson files sit in a slot whose catalogue
 * title describes a different lesson. Within a module the files usually hold
 * the right SET of topics, just in the wrong order - module 2's first three
 * files are TIA, instrumentation, active filters against catalogue slots
 * active filters, TIA, instrumentation. A rotation.
 *
 * There are two ways to make that consistent and only one of them is right.
 *
 *   Relabel the catalogue to match each file.  Cheap, and wrong: the LEARNING
 *   PATH references lessons by position and its step titles were written
 *   against the catalogue. Renaming slot 2 to "instrumentation amplifier"
 *   would silently move the syllabus step that promises a transimpedance
 *   amplifier onto a different lesson.
 *
 *   Move each FILE to the slot whose title it matches.  Fixes the sidebar, the
 *   search box and the syllabus in one action, because all three read the same
 *   catalogue and the catalogue then describes what is really there.
 *
 * So this solves an assignment problem per module - which file belongs in which
 * slot - and prints a LESSON_ORDER that tools/reorder-curriculum.js can apply.
 *
 * Where no file matches a slot, or no slot matches a file, it says so instead
 * of guessing. Those are cases where the catalogue promises a lesson nobody
 * wrote, and the answer is a judgement call, not a permutation.
 *
 *   node tools/plan-title-fix.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

const C = new Function('window', 'document', 'localStorage',
    fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8') +
    '\n;return window.CURRICULUM;')({}, undefined, undefined);

const norm = s => String(s || '').toLowerCase()
    .replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

const STOP = new Set('and the of for a an with to in on its'.split(' '));
const words = s => new Set(norm(s).split(' ').filter(w => w && !STOP.has(w)));

function agreement(a, b) {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
}

function headingOf(m, l) {
    const p = path.join(ROOT, 'lessons', 'module-' + String(m).padStart(2, '0'),
                        'lesson-' + String(l).padStart(2, '0') + '.html');
    if (!fs.existsSync(p)) return null;
    const h = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(fs.readFileSync(p, 'utf8'));
    return h ? h[1].replace(/<[^>]*>/g, '').trim() : null;
}

const plans = [];
const unresolved = [];

C.modules.forEach(m => {
    const slots = m.lessons.map(l => ({ id: l.id, title: l.title }));
    const files = m.lessons.map(l => ({ id: l.id, heading: headingOf(m.id, l.id) }));

    // Nothing to do unless something in this module is actually mispaired.
    const anyBad = slots.some((s, i) =>
        files[i].heading && agreement(s.title, files[i].heading) < 0.5);
    if (!anyBad) return;

    // Greedy assignment on the strongest agreement first. The matrix is at most
    // 36x36 and the scores are well separated, so a full Hungarian solve buys
    // nothing here - and a greedy pass that REFUSES weak pairs is easier to
    // check by eye, which matters more than optimality for a one-off migration.
    const pairs = [];
    slots.forEach((s, si) => files.forEach((f, fi) => {
        if (!f.heading) return;
        const a = agreement(s.title, f.heading);
        if (a >= 0.5) pairs.push({ si, fi, a });
    }));
    pairs.sort((x, y) => y.a - x.a);

    const slotTaken = new Set(), fileTaken = new Set();
    const assign = new Map();               // slot index -> file index
    pairs.forEach(p => {
        if (slotTaken.has(p.si) || fileTaken.has(p.fi)) return;
        slotTaken.add(p.si); fileTaken.add(p.fi);
        assign.set(p.si, p.fi);
    });

    const freeSlots = slots.map((_, i) => i).filter(i => !slotTaken.has(i));
    const freeFiles = files.map((_, i) => i).filter(i => !fileTaken.has(i));

    // Anything left unmatched keeps its current position: without a title
    // match there is no evidence for moving it, and guessing would be worse
    // than leaving a known problem visible.
    freeSlots.forEach((si, k) => { if (freeFiles[k] !== undefined) assign.set(si, freeFiles[k]); });

    const order = slots.map((_, si) => files[assign.get(si)].id);
    const moved = order.some((id, i) => id !== slots[i].id);
    if (!moved) return;

    plans.push({ mod: m.id, title: m.title, order: order, slots: slots, files: files, assign: assign });

    freeSlots.forEach((si, k) => {
        if (freeFiles[k] === undefined) return;
        const s = slots[si], f = files[freeFiles[k]];
        if (agreement(s.title, f.heading) < 0.5) {
            unresolved.push({ mod: m.id, slot: s.title, file: f.heading });
        }
    });
});

console.log(plans.length + ' modules need their files re-paired with their slots\n');

plans.forEach(p => {
    console.log('  M' + p.mod + '  ' + p.title);
    p.slots.forEach((s, si) => {
        const fi = p.assign.get(si);
        const f = p.files[fi];
        const from = f.id;
        const mark = from === s.id ? '   ' : ' * ';
        console.log(mark + '   slot ' + String(si + 1).padStart(2) + '  ' +
            s.title.slice(0, 36).padEnd(38) + '<- lesson ' + String(from).padStart(2) +
            '  ' + String(f.heading || '?').slice(0, 34));
    });
    console.log('');
});

console.log('LESSON_ORDER for tools/reorder-curriculum.js:\n');
console.log('const LESSON_ORDER = {');
plans.forEach(p => {
    const line = '    ' + p.mod + ': [' + p.order.join(', ') + '],';
    console.log(line.length <= 96 ? line
        : '    ' + p.mod + ': [\n        ' + p.order.join(', ') + '\n    ],');
});
console.log('};');

if (unresolved.length) {
    console.log('\nNO CONFIDENT MATCH — a slot and a file were paired only because both');
    console.log('were left over. Decide these by reading them, not by title:\n');
    unresolved.forEach(u => console.log('    M' + u.mod + '  slot "' + u.slot +
        '"  vs file "' + u.file + '"'));
}
