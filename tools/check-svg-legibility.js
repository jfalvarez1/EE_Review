#!/usr/bin/env node
/**
 * check-svg-legibility - ink that is not there.
 *
 * Why this exists.
 *
 * Sixty-one lessons annotate their diagrams with <text class="label">. No
 * stylesheet in the project ever defined that class. An SVG <text> with no
 * fill attribute and no matching rule falls back to its initial value, which
 * is BLACK, and on this page's #0b0f16 panel that is a contrast ratio of about
 * 1.1:1 - every component designator, every value and every pin name in those
 * 2376 labels was invisible. The diagrams looked like unlabelled line art and
 * nobody could tell whether the label was missing or the file was.
 *
 * schematic-normalize.js could not save them: it brightens the fill ATTRIBUTE,
 * and these elements had none. So the failure was silent in the browser, silent
 * in the console, and silent in the audit.
 *
 * This checks the one thing that would have caught it: every class used on an
 * element inside an SVG must be defined somewhere - the shared stylesheet, or a
 * <style> block in the same lesson, or inside the SVG itself.
 *
 *   node tools/check-svg-legibility.js
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

/** Class names any selector in this CSS mentions. */
function classesIn(css) {
    const out = new Set();
    // Strip declaration blocks so a value like `.5em` is not read as a class.
    const selectors = css.replace(/\{[^}]*\}/g, '{}');
    (selectors.match(/\.[A-Za-z_][\w-]*/g) || []).forEach(c => out.add(c.slice(1)));
    return out;
}

const shared = classesIn(fs.readFileSync(path.join(ROOT, 'assets', 'styles.css'), 'utf8'));

const SVG_EL = '(?:text|tspan|line|polyline|polygon|path|rect|circle|ellipse|g)';

const files = walk(LESSONS, []).sort();
const problems = [];
let checked = 0;

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');

    // Anything the lesson defines for itself, wherever it defines it.
    const local = new Set();
    (src.match(/<style>[\s\S]*?<\/style>/g) || [])
        .forEach(b => classesIn(b).forEach(c => local.add(c)));

    const chunks = [];
    let m;
    const lit = /<svg\b[\s\S]*?<\/svg>/g;
    while ((m = lit.exec(src))) chunks.push(m[0]);
    const tpl = /\.innerHTML\s*=\s*`([\s\S]*?)`\s*;/g;
    while ((m = tpl.exec(src))) chunks.push(m[1]);

    const missing = new Map();
    chunks.forEach(body => {
        checked++;
        const re = new RegExp('<' + SVG_EL + '\\b[^>]*\\bclass="([^"]+)"', 'g');
        let t;
        while ((t = re.exec(body))) {
            t[1].trim().split(/\s+/).forEach(c => {
                if (!c || shared.has(c) || local.has(c)) return;
                missing.set(c, (missing.get(c) || 0) + 1);
            });
        }
    });

    missing.forEach((n, c) => problems.push({ rel, cls: c, n }));
});

console.log('SVG CLASSES WITH NO STYLE RULE\n');

if (!problems.length) {
    console.log('  ' + checked + ' SVG figures checked.\n');
    console.log('PASS - every class used inside an SVG is defined somewhere.');
    process.exit(0);
}

const byClass = new Map();
problems.forEach(p => {
    if (!byClass.has(p.cls)) byClass.set(p.cls, { files: 0, uses: 0 });
    const e = byClass.get(p.cls);
    e.files++; e.uses += p.n;
});

[...byClass.entries()]
    .sort((a, b) => b[1].uses - a[1].uses)
    .forEach(([cls, e]) => {
        console.log('  .' + cls.padEnd(20) + String(e.uses).padStart(6) +
                    ' uses in ' + e.files + ' lesson(s)');
    });

console.log('');
console.log('  An SVG element with an undefined class and no presentation');
console.log('  attribute falls back to black fill and black stroke, which on');
console.log('  this background is invisible. Define the class in');
console.log('  assets/styles.css, or give the elements explicit attributes.');
console.log('');
console.log('FAIL - ' + byClass.size + ' undefined class(es) across ' +
            new Set(problems.map(p => p.rel)).size + ' lesson(s).');
process.exit(1);
