#!/usr/bin/env node
/**
 * check-build-nets - a build table you cannot actually build.
 *
 * Why this exists
 * ---------------
 * The build tables are the reader's primary do-it-yourself artifact: 173
 * lessons end by telling somebody to wire this up in a simulator. Nothing
 * checked them. check-toy-parts verifies that the PARTS exist; no checker had
 * ever looked at the wiring.
 *
 * The defects found by hand so far, each of which wastes a reader's evening:
 *
 *   - a node touched by exactly one component. Module 5 lesson 9 ran the coil
 *     resistance from node 3 to node 3a, and nothing else was on 3a, so the
 *     100 ohms dangled and the inductor sat straight across the transistor.
 *     Every time constant on the page depended on that resistor.
 *   - a node the table watches but never drives. Module 8 lesson 1 asks the
 *     reader to watch V(vco) in a table that contains no VCO.
 *   - a source and a component fighting over the same node, so the passive is
 *     electrically absent. Module 2 lesson 4's Schmitt trigger had ideal
 *     sources on both comparator inputs and therefore no hysteresis at all.
 *
 * All three are invisible on the page and obvious to a parser.
 *
 * What counts as a net
 * --------------------
 * The Connect column is written in a small set of phrasings - "between A and
 * B", "from A to ground", "collector A, base B, emitter C" - and this reads
 * them all. Anything it cannot parse is reported separately rather than
 * silently passed, because an unparsed row is a row nobody checked.
 *
 *   node tools/check-build-nets.js            summary and failures
 *   node tools/check-build-nets.js --list     every table, including clean ones
 *   node tools/check-build-nets.js --unparsed show rows the parser gave up on
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const BASELINE = path.join(ROOT, 'tools', 'build-nets-baseline.json');
const LIST = process.argv.includes('--list');
const UNPARSED = process.argv.includes('--unparsed');
const BLESS = process.argv.includes('--bless');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

const text = html => html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&thinsp;/g, ' ')
    .replace(/&minus;|&#8722;/g, '-')
    .replace(/&Omega;/g, 'ohm')
    .replace(/&micro;|&mu;/g, 'u')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** GROUND by any of its names. */
const isGround = n => /^(?:ground|gnd|agnd|dgnd|0)$/i.test(n);

/**
 * A supply rail, which is allowed to touch only one listed component.
 *
 * These tables follow the usual schematic convention of not listing an
 * op-amp's power pins - "U1 | Op-amp | Op-Amp | + input inp, - input inv,
 * output out" - so vcc appears once, on the source that defines it, and that
 * is correct rather than dangling. Treating rails like ground removed
 * two-thirds of this checker's first run.
 */
const isRail = n => /^(?:v?cc|vdd|vee|vss|vbb|vbat|vbus|avdd|dvdd|avss|dvss|v\+|v-)$/i.test(n);

/**
 * Node names out of one Connect cell.
 *
 * Returns null when nothing matched, so an unparsed row is visible rather than
 * counted as a row with no connections.
 */
function nodesOf(cell) {
    const s = cell.replace(/\bthe\b/gi, ' ').trim();
    const out = [];
    let matched = false;

    const add = n => {
        if (typeof n !== 'string') return;                  // an absent capture
        const clean = n.trim().replace(/^["'`]|["'`.,;]$/g, '');
        if (!clean) return;
        // Only the connector words themselves. Do NOT add short English words
        // here: "in", "a" and "on" are all real node names in these tables, and
        // filtering them made twenty lessons look like they watched a node they
        // never built.
        if (/^(?:and|to|from|between|node|pin|pins|the)$/i.test(clean)) return;
        if (/^[+\-]$/.test(clean)) return;             // a stray polarity marker
        // A quantity is not a node. The MCU lessons describe pseudo-code in the
        // Connect column and their identifiers were being read as nets.
        if (/^\d/.test(clean)) return;
        if (/^(?:mA|mAh|mV|uA|uF|nF|pF|kohm|ohm|Hz|kHz|MHz)$/i.test(clean)) return;
        if (!/^[A-Za-z_][A-Za-z0-9_+\-]{0,19}$/.test(clean)) return;
        out.push(clean);
    };

    // between A and B
    let m = /\bbetween\s+([^\s,]+)\s+and\s+([^\s,.]+)/i.exec(s);
    if (m) { matched = true; add(m[1]); add(m[2]); }

    // from A to B
    m = /\bfrom\s+([^\s,]+)\s+to\s+([^\s,.]+)/i.exec(s);
    if (m) { matched = true; add(m[1]); add(m[2]); }

    // terminal-named forms: collector X, base Y, emitter Z / anode / cathode /
    // drain / gate / source / + input / - input / output / control
    const term = /\b(?:collector|base|emitter|drain|gate|source|anode|cathode|output|input|control|clock|clk|reset|out|in)\b\s*:?\s*([A-Za-z0-9_+\-]{1,20})/gi;
    let t;
    while ((t = term.exec(s))) {
        // "+ input vp" and "- input vm" both land here; so does "output vout".
        matched = true;
        add(t[1]);
    }

    // Controlled sources: "output A to B, sensing C to D". The terminal rule
    // below picks up "output A" and stops, which loses three nodes out of four
    // and made every VCVS in the course look like a dangling lead.
    m = /\boutput\s+([^\s,]+)\s+to\s+([^\s,.]+)/i.exec(s);
    if (m) { matched = true; add(m[1]); add(m[2]); }
    m = /\bsensing\s+([^\s,]+)\s+to\s+([^\s,.]+)/i.exec(s);
    if (m) { matched = true; add(m[1]); add(m[2]); }

    // Gates: "inputs A and B, output C".
    m = /\binputs\s+([^\s,]+)\s+and\s+([^\s,.]+)/i.exec(s);
    if (m) { matched = true; add(m[1]); add(m[2]); }

    // pins a, b, c, ground
    m = /\bpins?\s+(.+)$/i.exec(s);
    if (m) {
        matched = true;
        m[1].split(/\s*,\s*/).forEach(add);
    }

    return matched ? out : null;
}

/** Is this row a source that hard-drives its node? */
const isSource = whatCell => /voltage source|current source|battery|clock|pulse source|square wave|sine|triangle|sawtooth|arb source|3-phase/i.test(whatCell);

const files = walk(LESSONS, []).sort();
const findings = [];
const unparsedRows = [];
let tables = 0, rowsSeen = 0;

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // A build table is the four-column Part/What/Value/Connect shape.
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        tables++;

        const rows = [];
        const rRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
        let rm;
        while ((rm = rRe.exec(body))) {
            const cells = [];
            const cRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
            let cm;
            while ((cm = cRe.exec(rm[1]))) cells.push(text(cm[1]));
            if (cells.length >= 4) rows.push(cells);
        }
        if (rows.length < 2) continue;

        const degree = new Map();
        const driven = new Set();
        const parts = [];

        rows.forEach(cells => {
            rowsSeen++;
            const [part, what, , connect] = cells;
            const nodes = nodesOf(connect);
            if (nodes === null) {
                unparsedRows.push(rel + '  ' + part + ': ' + connect.slice(0, 70));
                return;
            }
            parts.push({ part, what, nodes });
            const uniq = [...new Set(nodes)];
            uniq.forEach(n => {
                if (isGround(n) || isRail(n)) return;
                degree.set(n, (degree.get(n) || 0) + 1);
                if (isSource(what)) driven.add(n);
            });
        });

        // What the lesson tells the reader to probe. A node with one connection
        // that is ALSO watched is an output port, which is normal - an op-amp
        // output with nothing hung on it is a perfectly good thing to measure.
        // A node with one connection that nobody looks at is a lead going
        // nowhere.
        const after = src.slice(tm.index + tm[0].length, tm.index + tm[0].length + 900);
        const watched = new Set([...after.matchAll(/\bV\(([A-Za-z0-9_+\-]{1,20})\)/g)]
            .map(w => w[1])
            .filter(n => !isGround(n)));

        const dangling = [...degree.entries()]
            .filter(([n, d]) => d < 2 && !watched.has(n))
            .map(([n]) => n);

        const unknown = [...watched].filter(n => !degree.has(n));

        if (dangling.length || unknown.length) {
            findings.push({ rel, dangling, unknown, rows: rows.length });
        } else if (LIST) {
            findings.push({ rel, dangling: [], unknown: [], rows: rows.length, ok: true });
        }
    }
});

console.log('BUILD TABLES\n');
console.log('  tables found       ' + String(tables).padStart(4));
console.log('  component rows     ' + String(rowsSeen).padStart(4));
console.log('  rows not parsed    ' + String(unparsedRows.length).padStart(4) +
            (UNPARSED ? '' : '   (--unparsed to list)'));
console.log('');

if (UNPARSED) {
    unparsedRows.slice(0, 40).forEach(r => console.log('  ' + r));
    if (unparsedRows.length > 40) console.log('  ... and ' + (unparsedRows.length - 40) + ' more');
    console.log('');
}

const bad = findings.filter(f => !f.ok);

const base = fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')).tables || {}
    : {};

if (BLESS) {
    const rec = {};
    bad.forEach(f => { rec[f.rel] = f.dangling.length + f.unknown.length; });
    fs.writeFileSync(BASELINE, JSON.stringify({
        note: 'Build tables with a node that connects to only one component, or ' +
              'a watched node the table never builds. Recorded so new ones fail ' +
              'the build while the backlog is worked through. Never raise a ' +
              'number here to make a check pass - fix the table.',
        tables: rec
    }, null, 2) + '\n');
    console.log('Baseline written: ' + Object.keys(rec).length + ' table(s).');
    process.exit(0);
}

findings.forEach(f => {
    const n = f.dangling.length + f.unknown.length;
    const allowed = base[f.rel] || 0;
    const isNew = n > allowed;
    console.log('  ' + (n ? (isNew ? 'FAIL' : 'debt') : 'ok  ') + '  ' + f.rel +
                (allowed && !isNew ? '   [known: ' + allowed + ']' : ''));
    if (f.dangling.length) {
        console.log('          connects to only one component: ' + f.dangling.join(', '));
    }
    if (f.unknown.length) {
        console.log('          watched but never built: ' +
                    f.unknown.map(u => 'V(' + u + ')').join(', '));
    }
});

const regressions = bad.filter(f => (f.dangling.length + f.unknown.length) > (base[f.rel] || 0));

console.log('');
console.log('  tables with a wiring problem  ' + String(bad.length).padStart(4) +
            '   (baseline ' + Object.keys(base).length + ')');
console.log('');

if (regressions.length) {
    console.log('FAIL - ' + regressions.length + ' build table(s) newly unbuildable:');
    regressions.forEach(f => console.log('    ' + f.rel));
    process.exit(1);
}
console.log('PASS - no new unbuildable tables. ' + bad.length + ' known.');
