#!/usr/bin/env node
/**
 * refile-module-15 - move four debug lessons out of Battery Management.
 *
 * Module 15 is called "Battery Management" and its first four lessons were
 * "Oscilloscope Techniques for Analog Debug", "Power Supply Debugging",
 * "Signal Integrity Debugging" and "Systematic Debug Methodology". Between
 * them they mention a battery, a cell or a charge once, in 1963 lines.
 *
 * They are not duplicates - measured against their closest counterparts in
 * modules 10 and 24 they share 0%, 21%, 23% and 0% of their text, so they are
 * different treatments of the same topics and nothing should be deleted. They
 * are simply filed under the wrong subject, which is why a reader looking for
 * battery material meets four debug lessons first.
 *
 * So they move to module 24, Troubleshooting & Debug, where they belong. Two
 * of them would collide with an existing title there, so those are retitled to
 * say what makes them different rather than left to look like duplicates.
 *
 * Module 15's real battery lessons then renumber 5..10 -> 1..6, which is safe:
 * nothing in the syllabus or in any lesson's prose references module 15 by
 * number. Verified before writing this.
 *
 * Run: node tools/refile-module-15.js [--dry]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');
const L = (m, l) => path.join(ROOT, 'lessons', 'module-' + String(m).padStart(2, '0'),
                              'lesson-' + String(l).padStart(2, '0') + '.html');

// The moves. New titles only where the old one would collide in module 24.
const MOVES = [
    { from: 1, to: 11, title: 'Oscilloscope Techniques for Analog Debug', retitle: null },
    { from: 2, to: 12, title: 'Power Supply Debugging',
      retitle: 'Power Supply Debugging: Measurement and Common Faults' },
    { from: 3, to: 13, title: 'Signal Integrity Debugging',
      retitle: 'Signal Integrity Debugging: Measurement and Fixes' },
    { from: 4, to: 14, title: 'Systematic Debug Methodology',
      retitle: 'Debug Decision Trees and Test-Point Strategy' }
];

// Module 15's battery lessons, in their new order.
const KEEP = [
    { old: 5,  now: 1, title: 'Fuel Gauge Algorithms' },
    { old: 6,  now: 2, title: 'Cell Balancing Circuits' },
    { old: 7,  now: 3, title: 'Protection Circuits' },
    { old: 8,  now: 4, title: 'Charging Profiles' },
    { old: 9,  now: 5, title: 'Battery Chemistry Selection' },
    { old: 10, now: 6, title: 'BMS Integration' }
];

function retag(src, mod, les, title) {
    let out = src;
    // The root element's stamp is what the runtime audit and the router key off.
    out = out.replace(/(<div class="lesson-content"[^>]*?)data-module="\d+"/,
                      '$1data-module="' + mod + '"');
    out = out.replace(/(<div class="lesson-content"[^>]*?)data-lesson="\d+"/,
                      '$1data-lesson="' + les + '"');
    // The leading comment, so the file says where it lives.
    out = out.replace(/^<!--[^>]*?-->/,
                      '<!-- Module ' + mod + ', Lesson ' + les + ': ' + title + ' -->');
    return out;
}

// ---- 1. move the four debug lessons ------------------------------------
const staged = [];
MOVES.forEach(mv => {
    const srcPath = L(15, mv.from);
    if (!fs.existsSync(srcPath)) throw new Error('missing ' + srcPath);
    const title = mv.retitle || mv.title;
    let body = retag(fs.readFileSync(srcPath, 'utf8'), 24, mv.to, title);
    if (mv.retitle) {
        // Change the visible <h2> as well, so the page and the catalogue agree.
        const before = body;
        body = body.replace(new RegExp('<h2>' + mv.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</h2>'),
                            '<h2>' + mv.retitle + '</h2>');
        if (body === before) console.log('  note: no <h2> matched for M15-' + mv.from);
    }
    staged.push({ dest: L(24, mv.to), body, from: srcPath });
});

// ---- 2. renumber the battery lessons ------------------------------------
const renumbered = [];
KEEP.forEach(k => {
    const srcPath = L(15, k.old);
    if (!fs.existsSync(srcPath)) throw new Error('missing ' + srcPath);
    renumbered.push({
        dest: L(15, k.now),
        body: retag(fs.readFileSync(srcPath, 'utf8'), 15, k.now, k.title),
        from: srcPath
    });
});

if (DRY) {
    console.log('would move to module 24:');
    staged.forEach(s => console.log('  ' + path.basename(s.from) + ' -> ' +
                                    path.relative(ROOT, s.dest).replace(/\\/g, '/')));
    console.log('would renumber inside module 15:');
    renumbered.forEach(r => console.log('  ' + path.basename(r.from) + ' -> ' +
                                        path.basename(r.dest)));
    process.exit(0);
}

// Write the new files first, then remove the vacated slots - so a failure
// half way leaves everything still present rather than a hole.
staged.forEach(s => fs.writeFileSync(s.dest, s.body));
renumbered.forEach(r => fs.writeFileSync(r.dest, r.body));
[7, 8, 9, 10].forEach(n => { const p = L(15, n); if (fs.existsSync(p)) fs.unlinkSync(p); });

console.log('moved ' + staged.length + ' debug lessons to module 24');
console.log('renumbered ' + renumbered.length + ' battery lessons to 1..6');
console.log('module 15 now has ' +
            fs.readdirSync(path.join(ROOT, 'lessons', 'module-15')).length + ' files');
