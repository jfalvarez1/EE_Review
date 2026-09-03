#!/usr/bin/env node
/**
 * survey-design-practice - does the course make a designer, or a reader?
 *
 * The claim this course wants to make is not "by the end you will have the
 * tools to learn circuit design". It is "by the end you will HAVE DESIGNED
 * things, debugged them, and know what it feels like when they do not work."
 *
 * That is a different property from coverage, and nothing measured it. A
 * lesson can be complete, accurate, well drawn and interactive while still
 * leaving the reader having done nothing.
 *
 * So this scores the four things that separate instruction from exposition:
 *
 *   BRIEF      Is the reader given a specification to hit - a target with
 *              numbers - rather than a worked example to admire?
 *   CHECK      Is there an acceptance criterion, so they can tell whether
 *              their answer is right without being told the answer?
 *   ABUSE      Are they shown what breaks it, with a physical consequence,
 *              rather than only what works?
 *   DIAGNOSE   Are they asked to find a fault from a symptom, rather than
 *              being handed the cause?
 *
 * Run: node tools/survey-design-practice.js [--gaps] [--module N]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');

const SIGNALS = {
    // A specification the reader must hit, not an example they watch.
    brief: [
        // A DesignBriefWidget IS a specification with numbers and an
        // acceptance test - the strongest possible signal, not a heuristic.
        /new\s+DesignBriefWidget/,
        /\bdesign (?:a|an|the)\b/i,
        /\bspecif(?:y|ication)s?\b[^.]{0,60}\b(?:must|shall|target)/i,
        /\byour (?:design|circuit|board|amplifier|supply)\b/i,
        /\brequirements?:/i,
        /\bthe brief\b/i,
        /\bdesign task\b/i
    ],
    // A way to know whether the answer is right.
    check: [
        // The two widgets that judge a reader's own numbers against what a
        // correct build produces. These are the mechanism the rest of this
        // list was only ever a proxy for.
        /new\s+SimCheckWidget/,
        /new\s+DesignBriefWidget/,
        /class="acceptance"/,
        /\bac-pass\b/,
        /\bpass criterion\b/i,
        /\bacceptance (?:test|criteri)/i,
        /\bverif(?:y|ication) (?:that|the)\b/i
    ],
    // What it does when it is wrong, physically.
    abuse: [
        /\bac-abuse\b/,
        /\bwhat physically happens\b/i,
        /\bfailure mode\b/i,
        /\bwhat goes wrong\b/i,
        /\bdestroy|burn|vaporis|melt|thermal runaway|blows|explodes\b/i
    ],
    // Find the fault from the symptom.
    diagnose: [
        // Symptom, test points, commit to a cause - the reader pays for
        // information with an action, which is what a bench actually costs.
        /new\s+FaultFindWidget/,
        /\bdiagnos/i,
        /\btroubleshoot/i,
        /\bsymptom\b/i,
        /\bwhat would you (?:check|measure|probe)\b/i,
        /\bfind the fault\b/i,
        /\bdebug/i
    ]
};

// A design brief that the reader can actually attempt is one where numbers
// are given. Prose that says "design an amplifier" with no target is not one.
const HAS_TARGETS = /\b\d+(?:\.\d+)?\s*(?:V|mV|A|mA|W|mW|Hz|kHz|MHz|GHz|Ω|ohm|dB|%|nF|uF|µF|pF|nH|uH|µH|mH)\b/i;

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

function score(src) {
    const s = {};
    Object.keys(SIGNALS).forEach(k => {
        s[k] = SIGNALS[k].some(re => re.test(src));
    });
    s.targets = HAS_TARGETS.test(src);
    // A brief only counts if it comes with numbers to hit.
    s.brief = s.brief && s.targets;
    s.total = ['brief', 'check', 'abuse', 'diagnose'].filter(k => s[k]).length;
    return s;
}

const files = walk(LESSONS, []).sort();
const rows = [];

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const m = /module-(\d+)[\\/]lesson-(\d+)/.exec(rel);
    const s = score(src);
    let title = '';
    const t = /<h2>([^<]{1,90})<\/h2>/.exec(src);
    if (t) title = t[1].replace(/&[a-z]+;/g, ' ').trim();
    rows.push({
        rel, mod: m ? +m[1] : 0, les: m ? +m[2] : 0, title,
        ...s
    });
});

const only = (() => {
    const i = process.argv.indexOf('--module');
    return i > 0 ? parseInt(process.argv[i + 1], 10) : null;
})();
const view = only ? rows.filter(r => r.mod === only) : rows;

const n = view.length;
const pct = k => ((view.filter(r => r[k]).length / n) * 100).toFixed(0);

console.log(n + ' lessons scored on design practice\n');
console.log('  gives a BRIEF with numbers to hit    ' +
            String(view.filter(r => r.brief).length).padStart(4) + '   ' + pct('brief') + '%');
console.log('  gives an acceptance CHECK           ' +
            String(view.filter(r => r.check).length).padStart(4) + '   ' + pct('check') + '%');
console.log('  shows ABUSE / what breaks it        ' +
            String(view.filter(r => r.abuse).length).padStart(4) + '   ' + pct('abuse') + '%');
console.log('  asks the reader to DIAGNOSE         ' +
            String(view.filter(r => r.diagnose).length).padStart(4) + '   ' + pct('diagnose') + '%');
console.log('');

const dist = [0, 1, 2, 3, 4].map(k => view.filter(r => r.total === k).length);
const bar = v => '#'.repeat(Math.round(v / Math.max(1, n) * 40));
console.log('  all four        ' + String(dist[4]).padStart(4) + '  ' + bar(dist[4]));
console.log('  three of four   ' + String(dist[3]).padStart(4) + '  ' + bar(dist[3]));
console.log('  two             ' + String(dist[2]).padStart(4) + '  ' + bar(dist[2]));
console.log('  one             ' + String(dist[1]).padStart(4) + '  ' + bar(dist[1]));
console.log('  none of them    ' + String(dist[0]).padStart(4) + '  ' + bar(dist[0]));
console.log('');

// Per-module, so the gaps are addressable rather than a global number.
if (!only) {
    const byMod = {};
    rows.forEach(r => {
        if (!byMod[r.mod]) byMod[r.mod] = { n: 0, brief: 0, check: 0, abuse: 0, diagnose: 0 };
        const b = byMod[r.mod];
        b.n++;
        ['brief', 'check', 'abuse', 'diagnose'].forEach(k => { if (r[k]) b[k]++; });
    });
    console.log('BY MODULE   (lessons / brief / check / abuse / diagnose)\n');
    Object.keys(byMod).map(Number).sort((a, b) => a - b).forEach(m => {
        const b = byMod[m];
        const weak = (b.brief + b.check + b.abuse + b.diagnose) / (4 * b.n);
        console.log('  M' + String(m).padStart(2) + '  ' +
                    String(b.n).padStart(3) + ' | ' +
                    String(b.brief).padStart(3) + ' ' +
                    String(b.check).padStart(3) + ' ' +
                    String(b.abuse).padStart(3) + ' ' +
                    String(b.diagnose).padStart(3) +
                    '   ' + (weak * 100).toFixed(0).padStart(3) + '%' +
                    (weak < 0.15 ? '   <- little design practice' : ''));
    });
    console.log('');
}

if (process.argv.includes('--gaps')) {
    const none = view.filter(r => r.total === 0);
    console.log('LESSONS WITH NO DESIGN PRACTICE AT ALL (' + none.length + ')\n');
    none.slice(0, 60).forEach(r => {
        console.log('  M' + r.mod + '-' + r.les + '  ' + r.title.slice(0, 58));
    });
    if (none.length > 60) console.log('  ... and ' + (none.length - 60) + ' more');
}
