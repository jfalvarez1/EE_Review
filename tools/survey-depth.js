#!/usr/bin/env node
/**
 * SURVEY HOW DEEP EACH LESSON ACTUALLY IS
 *
 * The course sets a standard for itself in the lessons written most recently:
 * a derivation in LaTeX, at least one interactive, a problem set with worked
 * solutions, and where it applies a lab. Most lessons predate that standard.
 * This scores every lesson against it so the thin ones can be found rather
 * than stumbled upon.
 *
 * The score is a blunt instrument on purpose. It counts features, not quality,
 * and a lesson that is genuinely short because its topic is small will score
 * low and be fine. Use it to pick candidates, not to grade.
 *
 *   node tools/survey-depth.js              the 25 thinnest, with a summary
 *   node tools/survey-depth.js --all        every lesson, worst first
 *   node tools/survey-depth.js --module 7   just that module
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const ALL = process.argv.includes('--all');
const modArg = (() => {
    const i = process.argv.indexOf('--module');
    return i !== -1 ? Number(process.argv[i + 1]) : null;
})();

function load() {
    const src = fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8');
    const fn = new Function('window', 'document', 'localStorage',
                            src + '\n;return window.CURRICULUM;');
    return fn({}, undefined, undefined);
}
const C = load();

const rows = [];
C.modules.forEach(m => {
    m.lessons.forEach(l => {
        const rel = 'lessons/module-' + String(m.id).padStart(2, '0') +
                    '/lesson-' + String(l.id).padStart(2, '0') + '.html';
        const p = path.join(ROOT, rel);
        if (!fs.existsSync(p)) return;
        const s = fs.readFileSync(p, 'utf8');

        const words = (s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                        .replace(/<[^>]*>/g, ' ')
                        .match(/[A-Za-z][A-Za-z'-]+/g) || []).length;

        const f = {
            words: words,
            canvases: (s.match(/<canvas\b/gi) || []).length,
            controls: (s.match(/<input[^>]*type="range"/gi) || []).length,
            schematics: (s.match(/ComponentModels\.diagram\(/g) || []).length,
            svgs: (s.match(/<svg\b/gi) || []).length,
            mathDisplay: (s.match(/\\\[/g) || []).length,
            mathInline: (s.match(/\\\(/g) || []).length,
            derivations: (s.match(/class="derivation"/g) || []).length,
            problems: (s.match(/class="problem"/g) || []).length,
            labs: (s.match(/class="lab"/g) || []).length,
            buildTable: (s.match(/Build it in Circuit Toy/g) || []).length,
            tables: (s.match(/<table\b/gi) || []).length
        };

        // One point per feature present, weighted by how much it signals depth.
        let score = 0;
        if (f.words >= 600) score += 1;
        if (f.words >= 1500) score += 1;
        if (f.words >= 3000) score += 1;
        if (f.canvases) score += 2;
        if (f.controls >= 2) score += 1;
        if (f.schematics || f.svgs >= 2) score += 1;
        if (f.mathDisplay >= 5) score += 2;
        if (f.derivations) score += 2;
        if (f.problems >= 4) score += 2;
        if (f.labs) score += 2;
        if (f.tables >= 2) score += 1;

        rows.push({ mod: m.id, les: l.id, title: l.title, rel: rel, score: score, f: f });
    });
});

const pool = modArg ? rows.filter(r => r.mod === modArg) : rows;
pool.sort((a, b) => a.score - b.score || a.f.words - b.f.words);

const MAX = 16;
console.log(pool.length + ' lessons scored out of ' + MAX + '\n');

const buckets = { '0-3 skeletal': 0, '4-6 thin': 0, '7-9 solid': 0, '10-12 deep': 0, '13+ full': 0 };
pool.forEach(r => {
    if (r.score <= 3) buckets['0-3 skeletal']++;
    else if (r.score <= 6) buckets['4-6 thin']++;
    else if (r.score <= 9) buckets['7-9 solid']++;
    else if (r.score <= 12) buckets['10-12 deep']++;
    else buckets['13+ full']++;
});
Object.entries(buckets).forEach(([k, v]) => {
    const bar = '#'.repeat(Math.round(v / Math.max(1, pool.length) * 40));
    console.log('  ' + k.padEnd(14) + String(v).padStart(4) + '  ' + bar);
});

const show = ALL ? pool : pool.slice(0, 25);
console.log('\n' + (ALL ? 'ALL LESSONS' : 'THINNEST ' + show.length) + ', worst first\n');
console.log('  sc  words  cv ct sch math der prb lab   lesson');
show.forEach(r => {
    const f = r.f;
    console.log(
        '  ' + String(r.score).padStart(2) +
        String(f.words).padStart(7) +
        String(f.canvases).padStart(4) +
        String(f.controls).padStart(3) +
        String(f.schematics + f.svgs).padStart(4) +
        String(f.mathDisplay).padStart(5) +
        String(f.derivations).padStart(4) +
        String(f.problems).padStart(4) +
        String(f.labs).padStart(4) +
        '   ' + r.mod + '-' + r.les + '  ' + r.title.slice(0, 44));
});

const totals = pool.reduce((a, r) => {
    a.canvases += r.f.canvases; a.problems += r.f.problems;
    a.labs += r.f.labs; a.derivations += r.f.derivations;
    a.schematics += r.f.schematics; a.words += r.f.words;
    return a;
}, { canvases: 0, problems: 0, labs: 0, derivations: 0, schematics: 0, words: 0 });

console.log('\nTOTALS across ' + pool.length + ' lessons');
console.log('  ' + totals.words.toLocaleString() + ' words');
console.log('  ' + totals.canvases + ' interactive canvases');
console.log('  ' + totals.schematics + ' generated schematics');
console.log('  ' + totals.derivations + ' derivation blocks');
console.log('  ' + totals.problems + ' problems with worked solutions');
console.log('  ' + totals.labs + ' labs');
