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
 * Every expected value a lesson states, each labelled with how far it can be
 * trusted.
 *
 *   verified: true   check-sim-values holds this to the netlist on every build,
 *                    via solve-dc, solve-ac or solve-op. If it drifts, the
 *                    build fails here.
 *   verified: false  the lesson states it and nothing checks it. Usually
 *                    because it is a swept condition, a device-model-dependent
 *                    bias point, a slope, a duty cycle or a peak-to-peak
 *                    ripple - all real measurements, none of them a default
 *                    operating point this repository can promise.
 *
 * Both are exported, because a consumer that reports a disagreement on an
 * unverified value is doing something useful: it means one of us is wrong, and
 * neither side knew.
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
        const checked = dc || !!acNode;
        out.push({
            id: id[1],
            label: label ? strip(label[1]) : '',
            verified: checked,
            kind: dc ? 'dc' : (acNode ? (acAt ? 'gain-at-frequency' : 'corner-frequency') : 'stated'),
            node: dc ? (node ? node[1] : null) : (acNode ? acNode[1] : (node ? node[1] : null)),
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
            expectedValues: idx === 1 ? values : []
        };
        if (ONLY_VERIFIED && !rec.expectedValues.some(v => v.verified)) continue;
        out.push(rec);
    }
});

if (SUMMARY) {
    const withVals = out.filter(r => r.expectedValues.some(v => v.verified));
    console.log('BUILD TABLES AS TEMPLATES\n');
    console.log('  tables                ' + String(out.length).padStart(4));
    console.log('  with verified values  ' + String(withVals.length).padStart(4));
    console.log('  values, solver-checked' + String(out.reduce((s,r)=>s+r.expectedValues.filter(v=>v.verified).length,0)).padStart(4));
    console.log('  values, stated only   ' + String(out.reduce((s,r)=>s+r.expectedValues.filter(v=>!v.verified).length,0)).padStart(4));
    console.log('');
    const byMod = new Map();
    out.forEach(r => byMod.set(r.module, (byMod.get(r.module) || 0) + 1));
    console.log('  by module: ' + [...byMod.entries()].sort((a, b) => a[0] - b[0])
        .map(([k, v]) => k + ':' + v).join('  '));
    console.log('');
    out.filter(r=>r.expectedValues.length).forEach(r => console.log('  ' + r.id.padEnd(10) + String(r.expectedValues.filter(v=>v.verified).length).padStart(2) + ' checked, ' + String(r.expectedValues.filter(v=>!v.verified).length).padStart(2) + ' stated   ' + r.title.slice(0, 46)));
} else {
    console.log(JSON.stringify(out, null, 2));
}
