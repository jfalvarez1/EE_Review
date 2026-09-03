#!/usr/bin/env node
/**
 * check-empty-containers - a figure the markup promises and no code draws.
 *
 * Why this exists
 * ---------------
 * Module 6 lesson 9 has this in its markup:
 *
 *     <h3>Schematics</h3>
 *     <div class="schematic-container" id="sch-m5l7-simple"></div>
 *     <p>Simple NMOS current mirror: M1 is diode-connected; M2 mirrors ...</p>
 *
 * ...and nothing anywhere in the lesson ever writes into that element. The
 * reader gets a heading, a caption describing a schematic, and a blank gap.
 *
 * Every check we had passes: the id exists, so check-element-ids is happy; the
 * script parses; the markup is balanced; there is no schematic to validate so
 * check-diagram-nets has nothing to say. The failure is the ABSENCE of code,
 * which no check that looks at code can see.
 *
 * What it flags
 * -------------
 * An element that looks like a figure slot - a div with an id, carrying a
 * container class or an id that names a diagram - which no script in the same
 * lesson ever targets by that id.
 *
 * Run: node tools/check-empty-containers.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');

// Classes and id shapes that promise a drawing.
const CONTAINER_CLASS = /(schematic-container|diagram-container|circuit-container|chart-container|plot-container)/;
const CONTAINER_ID = /^(sch|schem|diag|diagram|circuit|fig|plot|chart)[-_]/i;

// Widgets fill their container by id, so a container handed to one of these
// is not empty.
const WIDGET_CALL = /new\s+\w*Widget\s*\(\s*['"`]([^'"`]+)['"`]/g;

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

const files = walk(LESSONS, []).sort();
const findings = [];

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // Split markup from script, so an id mentioned only in the markup is
    // distinguishable from one the code actually uses.
    const scripts = (src.match(/<script[\s\S]*?<\/script>/gi) || []).join('\n');

    // Every empty div that carries an id.
    const re = /<div([^>]*\bid\s*=\s*["']([^"']+)["'][^>]*)>\s*<\/div>/gi;
    let m;
    while ((m = re.exec(src)) !== null) {
        const attrs = m[1];
        const id = m[2];

        const classMatch = /class\s*=\s*["']([^"']*)["']/.exec(attrs);
        const cls = classMatch ? classMatch[1] : '';

        const looksLikeFigure = CONTAINER_CLASS.test(cls) || CONTAINER_ID.test(id);
        if (!looksLikeFigure) continue;

        // Is this id referenced anywhere in the lesson's own script?
        const idRe = new RegExp('[\'"`]' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"`]');
        if (idRe.test(scripts)) continue;

        // Or handed to a widget?
        let widgetHit = false;
        let w;
        WIDGET_CALL.lastIndex = 0;
        while ((w = WIDGET_CALL.exec(src)) !== null) {
            if (w[1] === id) { widgetHit = true; break; }
        }
        if (widgetHit) continue;

        findings.push({ file: rel, id, cls });
    }
});

if (!findings.length) {
    console.log('PASS - every figure container has code that draws into it.');
    process.exit(0);
}

const byFile = {};
findings.forEach(f => { (byFile[f.file] = byFile[f.file] || []).push(f); });

console.log('check-empty-containers: ' + findings.length + ' figure slot(s) in ' +
            Object.keys(byFile).length + ' file(s) that nothing ever draws into.\n');

Object.keys(byFile).sort().forEach(file => {
    console.log(file);
    byFile[file].forEach(f => {
        console.log('    #' + f.id + (f.cls ? '  (.' + f.cls.trim().split(/\s+/).join('.') + ')' : ''));
    });
});

process.exit(1);
