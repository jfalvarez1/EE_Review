#!/usr/bin/env node
/**
 * export-templates - the build tables as a manifest another tool can consume.
 *
 * Why this exists
 * ---------------
 * Every lesson that ends "build it in Circuit Toy" is asking the reader to
 * retype a netlist by hand. There are 196 of them and they are now all
 * buildable, all valued, and - for 46 of them - carrying expected values that
 * are checked against the circuit on every commit. Handing that to the
 * simulator as templates removes the retyping and, more importantly, makes the
 * numbers in the text and the numbers on the screen the same numbers.
 *
 * Emits JSON on stdout: one object per build table, with the parts exactly as
 * the lesson states them, what to run, what to watch, and any expected values
 * that have been verified against a solver.
 *
 *   node tools/export-templates.js > templates.json
 *   node tools/export-templates.js --verified    only tables with checked values
 *   node tools/export-templates.js --summary     human-readable counts
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const ONLY_VERIFIED = args.includes('--verified');
const SUMMARY = args.includes('--summary');

const strip = h => N.text(h);

/** The lesson's own title. */
function titleOf(src) {
    let m = /<h2>([^<]+)<\/h2>/.exec(src);
    if (m) return strip(m[1]);
    m = /<h1[^>]*>([^<]+)</.exec(src);
    return m ? strip(m[1]) : '';
}

/** "What to run" and "What to watch", as plain text. */
function runWatch(src, from) {
    const after = src.slice(from, from + 4000);
    const run = /What to run:<\/strong>([\s\S]{0,300}?)<\/p>/.exec(after);
    const watch = /What to watch:<\/strong>([\s\S]{0,400}?)<\/p>/.exec(after);
    return {
        run: run ? strip(run[1]) : null,
        // Split on commas BETWEEN probes, not the one inside "V(a, b)" - a
        // differential probe is one measurement, and splitting it produced
        // entries called "vminus)".
        watch: watch ? (strip(watch[1]).match(/V(?:DB|P)?\([^)]*\)|I\([^)]*\)/g) || []) : []
    };
}

/**
 * Expected values a solver has confirmed.
 *
 * Only probes carrying `dc: true` or an `acNode` are exported, because those
 * are the ones check-sim-values holds to the netlist on every build. A probe
 * without one of those markers is a real measurement the reader takes, but it
 * is not one this repository can promise agrees with the circuit.
 */
function verifiedValues(src) {
    const out = [];
    const block = /new SimCheckWidget\([\s\S]*?\n\s*\}\);/.exec(src);
    if (!block) return out;
    const arr = /probes:\s*\[([\s\S]*?)\n\s*\],/.exec(block[0]);
    if (!arr) return out;
    arr[1].split(/\n\s*(?=\{\s*id:)/).forEach(chunk => {
        const id = /id:\s*'([^']+)'/.exec(chunk);
        const expect = /expect:\s*'([^']*)'/.exec(chunk);
        const unit = /unit:\s*'([^']*)'/.exec(chunk);
        const tol = /\btol:\s*([\d.]+)/.exec(chunk);
        const label = /label:\s*'((?:[^'\\]|\\.)*)'/.exec(chunk);
        if (!id || !expect || !unit || !tol) return;
        const dc = /\bdc:\s*true\b/.test(chunk);
        const node = /node:\s*'([^']+)'/.exec(chunk);
        const acNode = /acNode:\s*'([^']+)'/.exec(chunk);
        const acAt = /acAt:\s*([\d.eE+\-]+)/.exec(chunk);
        const acCorner = /acCorner:\s*(\d+)/.exec(chunk);
        if (!dc && !acNode) return;
        out.push({
            id: id[1],
            label: label ? strip(label[1]) : '',
            kind: dc ? 'dc' : (acAt ? 'gain-at-frequency' : 'corner-frequency'),
            node: dc ? (node ? node[1] : null) : acNode[1],
            atHz: acAt ? parseFloat(acAt[1]) : undefined,
            corner: acCorner ? parseInt(acCorner[1], 10) : undefined,
            expect: expect[1], unit: strip(unit[1]), tolerance: parseFloat(tol[1])
        });
    });
    return out;
}

const out = [];
N.walk(LESSONS, []).sort().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const m = /module-(\d+)[\\/]lesson-(\d+)\.html$/.exec(rel);
    if (!m) return;
    const title = titleOf(src);
    const values = verifiedValues(src);

    let idx = 0;
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        const rows = [];
        [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].forEach(rm => {
            const c = [...rm[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x => strip(x[1]));
            if (c.length >= 4) rows.push({ ref: c[0], part: c[1], value: c[2], connect: c[3] });
        });
        if (rows.length < 2) continue;
        idx++;
        const rw = runWatch(src, tm.index + tm[0].length);
        const rec = {
            id: 'm' + m[1] + 'l' + m[2] + (idx > 1 ? '-' + idx : ''),
            module: parseInt(m[1], 10),
            lesson: parseInt(m[2], 10),
            source: rel,
            title: title,
            components: rows,
            run: rw.run,
            watch: rw.watch,
            // Values checked against solve-dc / solve-ac / solve-op on every
            // build. Only present on the first table of a lesson, because a
            // SimCheck belongs to the lesson rather than to one of its tables.
            verifiedValues: idx === 1 ? values : []
        };
        if (ONLY_VERIFIED && !rec.verifiedValues.length) continue;
        out.push(rec);
    }
});

if (SUMMARY) {
    const withVals = out.filter(r => r.verifiedValues.length);
    console.log('BUILD TABLES AS TEMPLATES\n');
    console.log('  tables                ' + String(out.length).padStart(4));
    console.log('  with verified values  ' + String(withVals.length).padStart(4));
    console.log('  total checked values  ' + String(withVals.reduce((s, r) => s + r.verifiedValues.length, 0)).padStart(4));
    console.log('');
    const byMod = new Map();
    out.forEach(r => byMod.set(r.module, (byMod.get(r.module) || 0) + 1));
    console.log('  by module: ' + [...byMod.entries()].sort((a, b) => a[0] - b[0])
        .map(([k, v]) => k + ':' + v).join('  '));
    console.log('');
    withVals.forEach(r => console.log('  ' + r.id.padEnd(10) + r.verifiedValues.length + ' checked   ' + r.title.slice(0, 56)));
} else {
    console.log(JSON.stringify(out, null, 2));
}
