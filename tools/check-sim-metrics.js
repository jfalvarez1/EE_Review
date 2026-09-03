#!/usr/bin/env node
/**
 * check-sim-metrics - a build table that never says what you should see.
 *
 * Why this exists.
 *
 * 168 lessons tell the reader what to wire up in Circuit Toy and which nodes
 * to watch. Three of them said what a correct build would show. That is the
 * same gap most textbooks leave, and it is worse than leaving the section out
 * entirely: a reader who connects the feedback resistor to the wrong node gets
 * a smooth, plausible, completely wrong trace and no reason on earth to doubt
 * it. The simulation confirms whatever they built.
 *
 * A build section earns its place only if it comes with numbers - node
 * voltages, currents, timings - that a correct build produces, and something
 * that compares the reader's measurements against them. That is what
 * SimCheckWidget does, so this counts the build sections that have one.
 *
 * Advisory, not gating: this measures something that is improving rather than
 * something that is correct, and a permanently red build is a build nobody
 * reads. It fails only on the thing that is genuinely broken - a SimCheck
 * whose host div does not exist, or which promises probes it does not define.
 *
 *   node tools/check-sim-metrics.js            summary
 *   node tools/check-sim-metrics.js --list     every build section still bare
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const LIST = process.argv.includes('--list');

/** A build section is a heading that sends the reader to the simulator. */
const BUILD_HEADING = /<h[2-4][^>]*>[^<]*\b(?:Build it in Circuit Toy|Build this in Circuit Toy|Simulate it|Simulator Lab)/i;
const BUILD_TABLE = /<th[^>]*>\s*Part\s*<\/th>\s*<th[^>]*>\s*What\s*<\/th>/i;

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

const files = walk(LESSONS, []).sort();

let withBuild = 0, withCheck = 0, probes = 0, experiments = 0;
const bare = [];
const broken = [];

files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');

    const isBuild = BUILD_HEADING.test(src) || BUILD_TABLE.test(src);

    // Every SimCheckWidget must have a host div in the same file, or it
    // silently does nothing - the widget returns early on a missing host, so
    // there is no console error to notice.
    const mounts = [...src.matchAll(/new\s+SimCheckWidget\(\s*'([^']+)'/g)].map(m => m[1]);
    mounts.forEach(id => {
        if (!new RegExp('id="' + id + '"').test(src)) {
            broken.push(rel + '  mounts SimCheckWidget on #' + id + ', which no element has');
        }
    });

    // A SimCheck with no probes is a section header, not a check.
    if (mounts.length) {
        // Probes and experiments both carry `expect`; only experiments carry
        // `action`, so the difference is the probe count.
        const nExp = (src.match(/\baction:\s*'/g) || []).length;
        const nProbes = Math.max(0, (src.match(/\bexpect:\s*['"0-9-]/g) || []).length - nExp);
        if (!nProbes && !nExp) {
            broken.push(rel + '  has a SimCheckWidget with neither probes nor experiments');
        }
        probes += nProbes;
        experiments += nExp;
    }

    if (isBuild) {
        withBuild++;
        if (mounts.length) withCheck++;
        else bare.push(rel);
    }
});

console.log('SIMULATION METRICS\n');
console.log('  lessons with a Circuit Toy build section   ' + String(withBuild).padStart(4));
console.log('  ...that say what a correct build shows     ' + String(withCheck).padStart(4) +
            '   ' + (withBuild ? ((withCheck / withBuild) * 100).toFixed(0) : 0) + '%');
console.log('  ...still leaving the reader to guess       ' + String(bare.length).padStart(4));
console.log('');
console.log('  expected values stated                    ' + String(probes).padStart(4));
console.log('  perturbations with a predicted outcome    ' + String(experiments).padStart(4));
console.log('');

if (LIST && bare.length) {
    console.log('BUILD SECTIONS WITH NO METRICS\n');
    bare.forEach(r => console.log('  ' + r));
    console.log('');
}

if (broken.length) {
    console.log('BROKEN\n');
    broken.forEach(b => console.log('  ' + b));
    console.log('');
    console.log('FAIL - ' + broken.length + ' SimCheckWidget' +
                (broken.length === 1 ? '' : 's') + ' cannot render.');
    process.exit(1);
}

console.log('PASS - ' + withCheck + ' of ' + withBuild +
            ' build sections give the reader numbers to check against.');
