#!/usr/bin/env node
/**
 * INVARIANTS THAT WERE TRUE ONCE AND MUST STAY TRUE
 *
 * Every rule here corresponds to a defect that was actually found and fixed in
 * this course, not to a style preference. Each was at zero when this file was
 * written; the job of this tool is to keep them there, because none of them
 * announces itself when it comes back.
 *
 *   STANDALONE DOCUMENT
 *     36 lessons were complete HTML pages. innerHTML silently drops the
 *     doctype, <html> and <head>, so they appeared to work - but not <header>
 *     or <footer>, so those lessons rendered a second, stale navigation bar
 *     naming the wrong module, and a copyright notice halfway down the course.
 *
 *   STRAY HEADER / FOOTER / NAV LINK
 *     The visible half of the above. A lesson is a fragment; the application
 *     supplies the chrome.
 *
 *   <h1> IN A LESSON
 *     Lesson titles are <h2>. Nine files used <h1>, which is why check-titles
 *     could not find a heading in six of them and a numbered section got
 *     promoted to a lesson title.
 *
 *   NETLIST SYNTAX
 *     193 SPICE netlists were translated into build tables. The course teaches
 *     circuits, not a file format, and a netlist creeping back would undo a
 *     deliberate decision rather than a stylistic one.
 *
 *   GENERIC HEADING
 *     Seven lessons opened with the bare word "Introduction". A reader arriving
 *     from search or a deep link cannot tell what they are reading, and no
 *     checker can verify the file holds the lesson it claims to.
 *
 * Every finding names the file and says what to do about it.
 *
 *   node tools/check-structure.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

const lessons = [];
const dir = path.join(ROOT, 'lessons');
fs.readdirSync(dir).forEach(d => {
    const md = path.join(dir, d);
    if (!fs.statSync(md).isDirectory()) return;
    fs.readdirSync(md).forEach(f => {
        if (f.endsWith('.html')) lessons.push(path.join('lessons', d, f).replace(/\\/g, '/'));
    });
});

const RULES = [
    {
        id: 'STANDALONE DOCUMENT',
        test: s => /<!DOCTYPE\s+html/i.test(s) || /<html\b/i.test(s) || /<\/body>/i.test(s),
        fix: 'A lesson is a fragment injected into #lesson-content. ' +
             'Run: node tools/defragment.js'
    },
    {
        id: 'STRAY <header>',
        test: s => /<header\b/i.test(s),
        fix: 'The application supplies the navigation. A lesson carrying its own ' +
             'renders a second, stale one.'
    },
    {
        id: 'STRAY <footer>',
        test: s => /<footer\b/i.test(s),
        fix: 'The application supplies the page chrome.'
    },
    {
        id: 'STANDALONE NAV LINK',
        test: s => /class="(?:prev-link|next-link|module-link|home-link)"/.test(s),
        fix: 'Links to sibling lesson FILES break the moment anything is ' +
             'reordered. Navigate by #module-N/lesson-N instead.'
    },
    {
        id: '<h1> HEADING',
        test: s => /<h1\b/i.test(s),
        fix: 'Lesson titles are <h2>; the application owns <h1>.'
    },
    {
        id: 'SPICE NETLIST',
        test: s => /SpiceNetlistWidget/.test(s) ||
                   /^\s*\.(?:TRAN|SUBCKT|ENDS|PROBE|MODEL|AC|DC|OP|PARAM)\b/im.test(s),
        fix: 'Netlists were deliberately replaced with "Build it in Circuit Toy" ' +
             'tables. Run: node tools/despice.js'
    },
    {
        id: 'GENERIC HEADING',
        test: s => {
            const h = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(s);
            if (!h) return false;
            const t = h[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
            return /^(introduction|overview|contents|summary|about)$/.test(t);
        },
        fix: 'The first <h2> is the lesson title. Name the topic.'
    },
    {
        id: 'NO LESSON ROOT',
        test: s => !/class="lesson-content"/.test(s),
        fix: 'Wrap the lesson in ' +
             '<div class="lesson-content" data-module="M" data-lesson="L">.'
    }
];

const findings = [];
lessons.forEach(rel => {
    const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    RULES.forEach(r => { if (r.test(s)) findings.push({ rel, rule: r }); });
});

console.log(lessons.length + ' lessons checked against ' + RULES.length + ' structural rules');

if (!findings.length) {
    console.log('PASS - every lesson is a well-formed fragment.');
    process.exit(0);
}

const byRule = new Map();
findings.forEach(f => {
    if (!byRule.has(f.rule.id)) byRule.set(f.rule.id, { rule: f.rule, files: [] });
    byRule.get(f.rule.id).files.push(f.rel);
});

console.log('\n' + findings.length + ' FINDINGS\n');
byRule.forEach(g => {
    console.log('  ' + g.rule.id + ' (' + g.files.length + ')');
    console.log('      ' + g.rule.fix);
    g.files.slice(0, 12).forEach(f => console.log('        ' + f.replace('lessons/', '')));
    if (g.files.length > 12) console.log('        ... ' + (g.files.length - 12) + ' more');
    console.log('');
});
process.exit(1);
