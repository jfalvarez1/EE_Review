#!/usr/bin/env node
/**
 * RUN EVERY CHECK
 *
 * One command, one exit code. Each checker below exists because something was
 * actually broken and nothing noticed - the reason is recorded next to it, so
 * the list reads as a history of what has gone wrong here rather than as a
 * generic lint suite.
 *
 * Gating checks fail the run. Advisory ones report and never fail: they measure
 * things that are improving rather than things that are correct, and a build
 * that is permanently red is a build nobody reads.
 *
 *   node tools/audit.js           gating checks, summarised
 *   node tools/audit.js --full    also run the advisory surveys
 *   node tools/audit.js --verbose print each checker's own output
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.dirname(__dirname);
const FULL = process.argv.includes('--full');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

const GATING = [
    ['check-structure.js',
     'lessons stay fragments: no standalone documents, stray nav, <h1> or netlists'],
    ['check-titles.js',
     'the sidebar names the lesson the file actually contains'],
    ['check-markup.js',
     'unbalanced tags the browser hides by silently reparenting'],
    ['check-lesson-js.js',
     'a syntax error in one lesson fails at runtime, silently, in that lesson only'],
    ['check-diagram-nets.js',
     'every schematic pin is on a net; pnp drawn emitter-up the conventional way'],
    ['check-svg-nets.js',
     'the same, for the 58 lessons that draw by coordinate - wires that stop short of the pin'],
    ['check-raw-svg.js',
     'the fourth drawing style - hand-written <line> markup - and its wires that go nowhere'],
    ['check-svg-legibility.js',
     'an SVG class no stylesheet defines: black ink on a black panel, invisibly'],
    ['check-hand-drawn.js',
     'a component faked from rectangles and circles when the library has a real symbol'],
    ['check-bias.js',
     'no drawn BJT stage demands more voltage than its supply has'],
    ['check-canvas-circuits.js',
     'no NEW circuit drawn on a canvas, where it cannot be verified'],
    ['check-css.js',
     'the phone layout rules a later stylesheet rule can silently undo'],
    ['check-palette.js',
     'a colour key that does not exist: undefined on strokeStyle is a silent no-op'],
    ['check-element-ids.js',
     'getElementById for an id the markup lacks: the throw kills the rest of the handler'],
    ['check-widget-args.js',
     'a widget given an argument shape it cannot render - the [object Object] class of bug'],
    ['check-empty-containers.js',
     'a figure the markup promises, with a caption, that no code ever draws into'],
    ['check-toy-parts.js',
     'a build table naming a part Circuit Toy does not have, which sends readers to the wrong one'],
    ['check-arithmetic.js',
     'a worked number that does not evaluate as written - the reader trusts it and blames themselves'],
    ['validate-path.js',
     'every syllabus step resolves to a lesson that exists on disk'],
    ['stamp-build.js --check',
     'a stale cache key: readers get the OLD lesson against the new assets']
];

const ADVISORY = [
    ['check-sim-metrics.js', 'build sections that never say what a correct build shows'],
    ['check-media.js',   'what each lesson draws, and whether it is interactive'],
    ['survey-depth.js',  'how deep each lesson is against the course standard'],
    ['check-taxonomy.js', 'lessons that may be filed under the wrong module (heuristic)']
];

function run(script) {
    // An entry may carry arguments, e.g. 'stamp-build.js --check'.
    const parts = String(script).split(/\s+/);
    const file = parts.shift();
    try {
        const out = execFileSync(process.execPath,
            [path.join(ROOT, 'tools', file)].concat(parts),
            { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
        return { ok: true, out };
    } catch (e) {
        return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
    }
}

/** The last non-empty line is each checker's verdict. */
const verdict = out => {
    const lines = String(out).trimEnd().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim()) return lines[i].trim();
    }
    return '';
};

console.log('AUDIT\n');

let failed = 0;
GATING.forEach(([script, why]) => {
    const r = run(script);
    if (!r.ok) failed++;
    console.log('  ' + (r.ok ? 'pass' : 'FAIL') + '  ' + script.replace('.js', '').padEnd(22) +
                verdict(r.out).slice(0, 62));
    console.log('        ' + why);
    if (VERBOSE || !r.ok) {
        console.log('');
        String(r.out).trimEnd().split('\n').forEach(l => console.log('        | ' + l));
    }
    console.log('');
});

if (FULL) {
    console.log('ADVISORY — reported, never fails the run\n');
    ADVISORY.forEach(([script, why]) => {
        const r = run(script);
        console.log('  ' + script.replace('.js', '').padEnd(22) + why);
        String(r.out).trimEnd().split('\n').slice(0, VERBOSE ? 500 : 8)
            .forEach(l => console.log('        | ' + l));
        console.log('');
    });
} else {
    console.log('Advisory surveys not run. Use --full for media, depth and taxonomy.\n');
}

if (failed) {
    console.log(failed + ' of ' + GATING.length + ' gating checks FAILED.');
    process.exit(1);
}
console.log('All ' + GATING.length + ' gating checks pass.');
