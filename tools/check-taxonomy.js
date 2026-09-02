#!/usr/bin/env node
/**
 * FIND LESSONS FILED UNDER THE WRONG MODULE
 *
 * The catalogue has a recurring defect: a run of lessons glued to the front of
 * whichever module happened to follow the one they belonged to. Two instances
 * were already found and moved by hand - five general exercise sets opening
 * "RF Analog", and four ADC-monotonicity lessons opening "EMI/EMC Design". Both
 * had been there since the project's first commit, and both were found by
 * accident rather than by looking.
 *
 * This looks. Each module gets a keyword profile built from its own title and
 * its lessons; each lesson is then scored against every module's profile and
 * reported if some other module fits it distinctly better.
 *
 * LEAVE-ONE-OUT matters here. A lesson contributes to its own module's profile,
 * so scoring it against that profile would be self-fulfilling - and worse, a
 * RUN of misfiled lessons reinforces each other and looks native. Each lesson
 * is therefore removed from its module's profile before being scored against
 * it.
 *
 * This is a heuristic and it says so. It is for finding candidates to look at,
 * not for moving anything automatically. A lesson can legitimately sit in a
 * module whose vocabulary it does not share.
 *
 *   node tools/check-taxonomy.js            the flagged lessons
 *   node tools/check-taxonomy.js -v         also show each module's top terms
 *   node tools/check-taxonomy.js --all      score every lesson, worst fit first
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const VERBOSE = process.argv.includes('-v');
const ALL = process.argv.includes('--all');

const C = new Function('window', 'document', 'localStorage',
    fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8') +
    '\n;return window.CURRICULUM;')({}, undefined, undefined);

const STOP = new Set(('a an and are as at be by for from in into is it its of on or the to with ' +
    'this that these those you your we our using use used how what when where which why basic ' +
    'basics fundamentals introduction overview guide techniques technique design designs ' +
    'circuit circuits analysis applications application practical real world').split(' '));

function tokens(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9+\- ]+/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP.has(w));
}

/** Every token a lesson contributes: its title carries most of the signal. */
function lessonTokens(l) {
    return tokens(l.title).concat(tokens(l.title))      // title counted twice
        .concat(tokens(l.description))
        .concat((l.topics || []).flatMap(tokens));
}

// ---------------------------------------------------------------- profiles

const profiles = new Map();     // module id -> Map(token -> weight)
const docFreq = new Map();      // token -> how many modules mention it

C.modules.forEach(m => {
    const p = new Map();
    const bump = (t, w) => p.set(t, (p.get(t) || 0) + w);
    tokens(m.title).forEach(t => bump(t, 6));
    tokens(m.description).forEach(t => bump(t, 2));
    m.lessons.forEach(l => lessonTokens(l).forEach(t => bump(t, 1)));
    profiles.set(m.id, p);
});

profiles.forEach(p => {
    p.forEach((_, t) => docFreq.set(t, (docFreq.get(t) || 0) + 1));
});

const N = C.modules.length;
// A term shared by every module says nothing about where a lesson belongs.
const idf = t => Math.log(N / (1 + (docFreq.get(t) || 0)));

/**
 * Score a lesson's tokens against a module profile. `own` removes the lesson's
 * own contribution, so a lesson is never scored against an echo of itself.
 */
function score(toks, moduleId, own) {
    const p = profiles.get(moduleId);
    if (!p) return 0;
    const minus = new Map();
    if (own) own.forEach(t => minus.set(t, (minus.get(t) || 0) + 1));

    let total = 0, norm = 0;
    const uniq = [...new Set(toks)];
    uniq.forEach(t => {
        const w = idf(t);
        norm += w;
        let f = p.get(t) || 0;
        if (minus.has(t)) f -= minus.get(t);
        if (f > 0) total += w * Math.min(f, 4);       // cap so one word cannot dominate
    });
    return norm ? total / norm : 0;
}

// ---------------------------------------------------------------- scoring

const rows = [];
C.modules.forEach(m => {
    m.lessons.forEach(l => {
        const toks = [...new Set(lessonTokens(l))];
        const own = lessonTokens(l);
        const here = score(toks, m.id, own);

        let best = null;
        C.modules.forEach(other => {
            if (other.id === m.id) return;
            const s = score(toks, other.id, null);
            if (!best || s > best.s) best = { id: other.id, title: other.title, s: s };
        });

        rows.push({
            mod: m.id, modTitle: m.title, les: l.id, title: l.title,
            here: here, best: best, margin: best ? best.s - here : 0
        });
    });
});

if (VERBOSE) {
    console.log('MODULE PROFILES (top terms)\n');
    C.modules.forEach(m => {
        const top = [...profiles.get(m.id).entries()]
            .map(([t, f]) => [t, f * idf(t)])
            .sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
        console.log('  M' + String(m.id).padStart(2) + '  ' + m.title.slice(0, 34).padEnd(36) +
                    top.join(', '));
    });
    console.log('');
}

const byLesson = new Map(rows.map(r => [r.mod + '/' + r.les, r]));
const misfit = r => r.best && r.margin > 0.5 && r.best.s > r.here * 1.5;

/**
 * THE STRUCTURAL BUG, which is what this tool is really for.
 *
 * An applications module legitimately shares vocabulary with the fundamentals
 * module it applies, so a loose threshold flags a third of the catalogue and is
 * useless. The defect that actually exists here has a much sharper fingerprint:
 * a CONTIGUOUS RUN starting at lesson 1 whose members all fit some other module
 * better, and mostly the SAME other module. That is what a block of lessons
 * glued to the front of the wrong module looks like, and it is how the exercise
 * sets and the monotonicity lessons were eventually found.
 */
const runs = [];
C.modules.forEach(m => {
    const run = [];
    for (const l of m.lessons) {
        const r = byLesson.get(m.id + '/' + l.id);
        if (!r || !misfit(r)) break;
        run.push(r);
    }
    if (run.length >= 2) {
        const votes = {};
        run.forEach(r => { votes[r.best.id] = (votes[r.best.id] || 0) + 1; });
        const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        runs.push({ mod: m.id, modTitle: m.title, run: run,
                    dest: Number(top[0]), agree: top[1] });
    }
});

rows.sort((a, b) => b.margin - a.margin);
const flagged = rows.filter(misfit);

console.log(rows.length + ' lessons scored across ' + C.modules.length + ' modules\n');

if (runs.length) {
    console.log('LEADING RUNS — a block of lessons at the FRONT of a module that all');
    console.log('belong elsewhere. This is the shape of the known filing bug.\n');
    runs.forEach(r => {
        const d = C.modules.find(m => m.id === r.dest);
        console.log('  M' + r.mod + '  ' + r.modTitle);
        console.log('      opens with ' + r.run.length + ' lesson(s) that fit elsewhere; ' +
                    r.agree + ' of them point at M' + r.dest + ' ' + (d ? d.title : ''));
        r.run.forEach(x => console.log('        ' + (x.mod + '-' + x.les).padEnd(7) +
            x.title.slice(0, 40).padEnd(42) + '-> M' + x.best.id + ' ' +
            x.best.title.slice(0, 24)));
        console.log('');
    });
}

if (ALL) {
    console.log('EVERY LESSON, worst fit first\n');
    console.log('  margin  lesson                                        filed under -> fits');
    rows.slice(0, 400).forEach(r => {
        console.log('  ' + r.margin.toFixed(3).padStart(6) + '  ' +
            (r.mod + '-' + r.les).padEnd(7) +
            r.title.slice(0, 38).padEnd(40) +
            ('M' + r.mod).padEnd(5) + '-> M' + r.best.id + ' ' + r.best.title.slice(0, 26));
    });
} else {
    console.log(flagged.length + ' individual lessons also fit another module better.');
    console.log('Most are an applications module borrowing a fundamentals vocabulary, which');
    console.log('is fine. Run with --all to read them.');
}

console.log('\nHeuristic. Look at each one; do not move anything on this alone.');
process.exit(runs.length ? 1 : 0);
