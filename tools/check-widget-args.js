#!/usr/bin/env node
/**
 * check-widget-args - widget options whose shape the widget does not render.
 *
 * Why this exists
 * ---------------
 * A reader reported "[object Object]" on a module 29 lesson. The cause:
 *
 *     ChecklistWidget renders  `<span>${item}</span>`
 *
 * so its `items` must be plain STRINGS. Lessons that pass
 * `{id, text, category}` objects - which reads perfectly well as source, and
 * which several lessons do - get the string "[object Object]" rendered for
 * every line of the checklist.
 *
 * Nothing threw, nothing logged, and check-lesson-js passed because the code
 * is valid JavaScript. It is only wrong at the moment of interpolation, which
 * is exactly the class of defect that survives every check we had.
 *
 * The same applies to ExerciseWidget, which reads specific field names off
 * each exercise. A lesson that supplies `hint` where the widget reads `hints`
 * silently shows no hints at all.
 *
 * What it checks
 * --------------
 *   1. ChecklistWidget items are strings, not object literals.
 *   2. ExerciseWidget exercises carry the fields the widget actually reads.
 *
 * Run: node tools/check-widget-args.js [--fix-report]
 */

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

// Read the widget source to discover which fields it actually interpolates,
// so this check cannot drift away from the implementation.
const widgetSrc = fs.readFileSync(path.join(ROOT, 'assets', 'widgets.js'), 'utf8');

// The widget now accepts BOTH a plain string and {id, text, category}, so the
// check flips: it fails if the widget ever regresses to interpolating the item
// itself without handling the object shape. Keeping the check means the fix
// cannot be undone silently.
function checklistTakesStrings() {
    const at = widgetSrc.indexOf('class ChecklistWidget');
    if (at < 0) return null;
    let end = widgetSrc.indexOf('\nclass ', at + 10);
    if (end < 0) end = at + 4000;
    const body = widgetSrc.slice(at, end);
    const handlesObjects = /item\.text/.test(body) && /typeof item === 'object'/.test(body);
    // Only object-shaped items are a problem, and only while the widget cannot
    // read them.
    return !handlesObjects;
}

const STRINGS_EXPECTED = checklistTakesStrings();

// Pull the arguments of a given constructor call.
function callArgs(src, name) {
    const out = [];
    const re = new RegExp('new\\s+' + name + '\\s*\\(', 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
        let depth = 1, i = m.index + m[0].length;
        while (i < src.length && depth > 0) {
            const c = src[i];
            if (c === '(') depth++;
            else if (c === ')') depth--;
            i++;
        }
        out.push({ text: src.slice(m.index, i), index: m.index });
    }
    return out;
}

// Extract the bracketed body of `items: [ ... ]` from a call.
function arrayBody(call, key) {
    const at = call.indexOf(key + ':');
    if (at < 0) return null;
    const open = call.indexOf('[', at);
    if (open < 0) return null;
    let depth = 0, i = open;
    for (; i < call.length; i++) {
        if (call[i] === '[') depth++;
        else if (call[i] === ']') { depth--; if (depth === 0) break; }
    }
    return call.slice(open + 1, i);
}

// ExerciseWidget reads specific field names off each exercise, and the course
// writes them two ways:
//
//   {question, expected, unit, hint, solution}   a numeric drill
//   {title, problem, hints: [...], answer}       a worked problem
//
// ...and 75 lessons hand it a LIST under `exercises:` rather than a single
// exercise. For a long time it read only the first shape and had no concept of
// the list, so those 75 rendered ONE exercise with a blank question and hint
// and answer buttons hidden behind a `solved` flag that could never be set.
// These assertions fail if any of that support is removed again.
function exerciseSupport() {
    const at = widgetSrc.indexOf('class ExerciseWidget');
    if (at < 0) return { list: false, alt: false, worked: false };
    let end = widgetSrc.indexOf('\nclass ', at + 10);
    if (end < 0) end = widgetSrc.length;
    const body = widgetSrc.slice(at, end);
    return {
        list:   /Array\.isArray\(\s*options\.exercises\s*\)/.test(body),
        alt:    /options\.problem/.test(body) && /options\.answer/.test(body)
                && /options\.hints/.test(body),
        worked: /'worked'/.test(body)
    };
}

const EX = exerciseSupport();

const files = walk(LESSONS, []).sort();
const findings = [];

if (!EX.list) {
    findings.push({
        file: 'assets/widgets.js', widget: 'ExerciseWidget', count: 0,
        problem: 'no longer handles `exercises: [...]`; the 75 lessons that pass a list ' +
                 'will each render one blank exercise'
    });
}
if (!EX.alt) {
    findings.push({
        file: 'assets/widgets.js', widget: 'ExerciseWidget', count: 0,
        problem: 'no longer reads problem/hints/answer; those lessons render an empty question'
    });
}
if (!EX.worked) {
    findings.push({
        file: 'assets/widgets.js', widget: 'ExerciseWidget', count: 0,
        problem: 'no longer supports the worked type; exercises with no numeric answer ' +
                 'get an input box and unreachable hints'
    });
}

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    if (STRINGS_EXPECTED) {
        callArgs(src, 'ChecklistWidget').forEach(call => {
            const body = arrayBody(call.text, 'items');
            if (body === null) return;
            const trimmed = body.trim();
            if (!trimmed) return;
            // An object literal as the first element means the whole array is
            // objects - the widget will render [object Object] for each.
            if (/^\s*\{/.test(trimmed)) {
                const n = (body.match(/\{\s*(id|text)\s*:/g) || []).length;
                findings.push({
                    file: rel,
                    widget: 'ChecklistWidget',
                    problem: 'items are objects; the widget interpolates the item itself, ' +
                             'so every line renders as "[object Object]"',
                    count: n
                });
            }
        });
    }
});

if (!findings.length) {
    console.log('PASS - every widget is given the argument shape it renders.');
    process.exit(0);
}

const total = findings.reduce((a, f) => a + f.count, 0);
console.log('check-widget-args: ' + findings.length + ' widget call(s) in ' +
            new Set(findings.map(f => f.file)).size + ' file(s) render as [object Object] (' +
            total + ' checklist lines).\n');

findings.slice(0, 40).forEach(f => {
    console.log(f.file + '  ' + f.widget + ': ' + f.count + ' items — ' + f.problem);
});
if (findings.length > 40) console.log('  ... and ' + (findings.length - 40) + ' more');

process.exit(1);
