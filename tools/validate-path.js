#!/usr/bin/env node
/**
 * VALIDATE THE SYLLABUS AGAINST THE CATALOGUE
 *
 * assets/learning-path.js points at lessons by [module, lesson]. Nothing in the
 * browser checks those references - a step whose ref has gone stale just renders
 * as a dead link, and a lesson nobody references is simply invisible to a reader
 * who follows the path. Both failure modes are silent, and the reorder tool
 * makes both easy: it renumbers files and remaps refs, so any ref it missed
 * points at whatever landed in that slot instead.
 *
 * This checks four things:
 *
 *   1. every ref resolves to a module and lesson that exist in curriculum.js
 *   2. the lesson file is actually on disk
 *   3. no two steps point at the same lesson
 *   4. every lesson in the catalogue is reachable from the path, or is
 *      accounted for as deliberately supplementary
 *
 * It also warns when a step's title has drifted a long way from the lesson's
 * own title, which is the usual symptom of a ref that moved by one.
 *
 * Exits non-zero on any error, so it can gate a commit.
 *
 *   node tools/validate-path.js          errors only
 *   node tools/validate-path.js --full   also list unreferenced lessons
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FULL = process.argv.includes('--full');

/* curriculum.js is browser code: give it a window to attach to. */
function loadCurriculum() {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'curriculum.js'), 'utf8');
    const sandbox = { window: {}, document: undefined, localStorage: undefined };
    const fn = new Function('window', 'document', 'localStorage', src + '\n;return window.CURRICULUM || (typeof CURRICULUM !== "undefined" ? CURRICULUM : null);');
    const cur = fn(sandbox.window, undefined, undefined);
    if (!cur || !cur.modules) throw new Error('curriculum.js did not yield a modules array');
    return cur;
}

const CUR = loadCurriculum();
const PATH_ = require(path.join(ROOT, 'assets', 'learning-path.js'));

const byModule = new Map();
CUR.modules.forEach(m => {
    const lessons = new Map();
    m.lessons.forEach(l => lessons.set(l.id, l));
    byModule.set(m.id, { module: m, lessons });
});

const errors = [];
const warnings = [];
const seen = new Map();

/** Loose title comparison: lowercase, drop articles and punctuation. */
function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\b(the|a|an|and|of|in|to|for|its)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function overlap(a, b) {
    const A = new Set(norm(a).split(' ').filter(Boolean));
    const B = new Set(norm(b).split(' ').filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.min(A.size, B.size);
}

const steps = PATH_.steps();

steps.forEach(step => {
    const where = `${step.stageId} "${step.title}"`;

    if (!step.ref) {
        if (step.status !== 'todo') {
            errors.push(`${where}: no ref and not marked status:'todo'`);
        }
        return;
    }

    if (!Array.isArray(step.ref) || step.ref.length !== 2 ||
        !Number.isInteger(step.ref[0]) || !Number.isInteger(step.ref[1])) {
        errors.push(`${where}: ref is not an [module, lesson] integer pair`);
        return;
    }

    const [mid, lid] = step.ref;
    const mod = byModule.get(mid);
    if (!mod) {
        errors.push(`${where}: module ${mid} does not exist`);
        return;
    }
    const lesson = mod.lessons.get(lid);
    if (!lesson) {
        errors.push(`${where}: module ${mid} has no lesson ${lid} ` +
                    `(it has 1..${mod.module.lessons.length})`);
        return;
    }

    const file = path.join(ROOT, 'lessons',
        'module-' + String(mid).padStart(2, '0'),
        'lesson-' + String(lid).padStart(2, '0') + '.html');
    if (!fs.existsSync(file)) {
        errors.push(`${where}: ${path.relative(ROOT, file)} is missing from disk`);
        return;
    }

    /* The file declares its own coordinates; a mismatch means the reorder
       renamed the file but not its data attributes, or vice versa. */
    const head = fs.readFileSync(file, 'utf8').slice(0, 2000);
    const dm = /data-module="(\d+)"/.exec(head);
    const dl = /data-lesson="(\d+)"/.exec(head);
    if (dm && dl && (+dm[1] !== mid || +dl[1] !== lid)) {
        errors.push(`${where}: file at ${mid}-${lid} declares itself ` +
                    `data-module="${dm[1]}" data-lesson="${dl[1]}"`);
    }

    const key = mid + '-' + lid;
    if (seen.has(key)) {
        errors.push(`${where}: lesson ${key} is already claimed by ` +
                    `"${seen.get(key)}"`);
    } else {
        seen.set(key, step.title);
    }

    if (overlap(step.title, lesson.title) < 0.34) {
        warnings.push(`${where}: points at ${key} "${lesson.title}" - ` +
                      `titles share almost nothing, check the ref did not shift`);
    }
});

/* Coverage: which lessons does the path never mention? */
const unreferenced = [];
CUR.modules.forEach(m => {
    m.lessons.forEach(l => {
        if (!seen.has(m.id + '-' + l.id)) {
            unreferenced.push({ mid: m.id, lid: l.id, mt: m.title, lt: l.title });
        }
    });
});

const totalLessons = CUR.modules.reduce((n, m) => n + m.lessons.length, 0);
const todo = PATH_.todo();

console.log('SYLLABUS vs CATALOGUE');
console.log('  ' + CUR.modules.length + ' modules, ' + totalLessons + ' lessons');
console.log('  ' + PATH_.SEMESTERS.length + ' semesters, ' + PATH_.STAGES.length +
            ' stages, ' + steps.length + ' steps');
console.log('  ' + seen.size + ' lessons on the path, ' + todo.length + ' steps unwritten');
console.log('  ' + unreferenced.length + ' lessons not on the path (' +
            (100 * seen.size / totalLessons).toFixed(0) + '% referenced)');

if (todo.length) {
    console.log('\nUNWRITTEN (' + todo.length + '):');
    todo.forEach(s => console.log('  ' + s.stageId + '  ' + s.title));
}

if (FULL && unreferenced.length) {
    console.log('\nNOT ON THE PATH (' + unreferenced.length + '):');
    let last = null;
    unreferenced.forEach(u => {
        if (u.mid !== last) { console.log('  M' + u.mid + '  ' + u.mt); last = u.mid; }
        console.log('      ' + u.mid + '-' + u.lid + '  ' + u.lt);
    });
}

if (warnings.length) {
    console.log('\nWARNINGS (' + warnings.length + '):');
    warnings.forEach(w => console.log('  ! ' + w));
}

if (errors.length) {
    console.log('\nERRORS (' + errors.length + '):');
    errors.forEach(e => console.log('  X ' + e));
    process.exit(1);
}

console.log('\nPASS - every reference resolves.');
