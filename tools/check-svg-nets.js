#!/usr/bin/env node
/**
 * check-svg-nets - floating pins and wires-to-nowhere in SchematicSVG circuits.
 *
 * Why this exists
 * ---------------
 * check-diagram-nets proves every pin is on a net, but only for schematics
 * built with ComponentModels.diagram(), which is a netlist. 37 lessons use it.
 * The other 58 draw with SchematicSVG, placing components and wires at explicit
 * coordinates - and nothing checked those at all.
 *
 * That is where the bad ones hide. A wire that stops 10 px short of a
 * transistor renders as a wire that touches the transistor, near enough, at a
 * glance. It is only wrong if you look closely, which is exactly the failure
 * mode a human reviewer misses and a script does not. The class AB stage in
 * module 26 had three of them: its bias network was connected to neither base.
 *
 * How it works
 * ------------
 * Every drawing call has known terminal geometry, taken from schematic-svg.js:
 *
 *   line(x1,y1,x2,y2)            two endpoints
 *   resistor/capacitor/          two terminals, at the given endpoints
 *     inductor/diode(x1,y1,x2,y2)
 *   ground(x,y)                  one terminal at (x, y-20)  [20 px stem]
 *   vcc(x,y) / vee(x,y)          one terminal at (x, y)
 *   npn(x,y,facing)              base (x-15f, y), collector (x+20f, y-30),
 *                                emitter (x+20f, y+30)
 *   pnp(x,y,facing)              base (x-15f, y), emitter (x+20f, y-30),
 *                                collector (x+20f, y+30)
 *   nmos/pmos(x,y,facing)        gate (x-20f, y), drain (x+15f, y-25),
 *                                source (x+15f, y+25)
 *   opAmp(x,y)                   in- (x-40, y-10), in+ (x-40, y+10),
 *                                out (x+25, y)      [mirrored: reflected]
 *   junction/dot/nodeLabel(x,y)  a connection point
 *
 * A terminal is CONNECTED if another terminal sits within 4 px of it, or if it
 * lands on the interior of some wire segment (a T-junction). Anything else is
 * floating and gets reported with its coordinates.
 *
 * What it deliberately does not do
 * --------------------------------
 * Only calls whose coordinates are numeric literals can be placed. Blocks that
 * compute coordinates in loops or from variables are reported as NOT CHECKABLE
 * rather than passed silently - a check that quietly skips what it cannot read
 * is worse than one that admits it.
 *
 * Run: node tools/check-svg-nets.js [--verbose]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const TOL = 4;              // px - two terminals this close are the same node
const BASELINE_FILE = path.join(ROOT, 'tools', 'svg-nets-baseline.json');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

function schematicBlocks(src) {
    const blocks = [];
    const re = /new\s+SchematicSVG\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const end = src.indexOf('appendChild', m.index);
        blocks.push(src.slice(m.index, end < 0 ? Math.min(m.index + 8000, src.length) : end));
    }
    return blocks;
}

// Pull the argument list of each `svg.<method>(...)` call, one call per match.
function calls(block, method) {
    const out = [];
    const re = new RegExp('\\.\\s*' + method + '\\s*\\(', 'g');
    let m;
    while ((m = re.exec(block)) !== null) {
        // Scan to the matching close paren so nested parens do not truncate.
        let depth = 1, i = m.index + m[0].length;
        while (i < block.length && depth > 0) {
            const c = block[i];
            if (c === '(') depth++;
            else if (c === ')') depth--;
            i++;
        }
        out.push(block.slice(m.index + m[0].length, i - 1));
    }
    return out;
}

// Split on top-level commas only, so an options object stays one argument.
function splitArgs(s) {
    const args = [];
    let depth = 0, cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; cur += c; continue; }
        if (c === '(' || c === '[' || c === '{') depth++;
        if (c === ')' || c === ']' || c === '}') depth--;
        if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
}

const numRe = /^-?\d+(?:\.\d+)?$/;
function lit(a) { return a !== undefined && numRe.test(a.trim()) ? parseFloat(a) : null; }

function facingFlip(arg) {
    if (arg === undefined) return 1;
    const s = arg.replace(/['"`]/g, '').trim();
    return s === 'left' ? -1 : 1;
}

function analyse(block) {
    const terminals = [];   // {x, y, what}
    const segments = [];    // [x1,y1,x2,y2]
    let unreadable = 0;

    const add = (x, y, what) => {
        if (x === null || y === null) { unreadable++; return; }
        terminals.push({ x, y, what });
    };

    // --- wires -----------------------------------------------------------
    // line(x1,y1,x2,y2) is one segment; wire([[x,y],...]) is a polyline whose
    // interior vertices are corners, connected by construction. Only its two
    // ends are terminals that need to meet something. wire() is used slightly
    // more often than line() across the lessons, so missing it made every
    // diagram that uses it look completely disconnected.
    calls(block, 'line').forEach(raw => {
        const a = splitArgs(raw);
        const x1 = lit(a[0]), y1 = lit(a[1]), x2 = lit(a[2]), y2 = lit(a[3]);
        if (x1 === null || y1 === null || x2 === null || y2 === null) { unreadable++; return; }
        segments.push([x1, y1, x2, y2]);
        terminals.push({ x: x1, y: y1, what: 'wire end' });
        terminals.push({ x: x2, y: y2, what: 'wire end' });
    });

    ['wire', 'addWire'].forEach(name => {
        calls(block, name).forEach(raw => {
            const pts = [];
            const re = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
            let m;
            while ((m = re.exec(raw)) !== null) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
            if (pts.length < 2) { unreadable++; return; }
            for (let i = 0; i < pts.length - 1; i++) {
                segments.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
            }
            terminals.push({ x: pts[0][0], y: pts[0][1], what: 'wire end' });
            terminals.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], what: 'wire end' });
        });
    });

    // --- two-terminal passives ------------------------------------------
    // Three call forms, all still in use:
    //   (x1,y1,x2,y2,label)        endpoints
    //   (x,y,{horizontal,halfLength})  centred, default half-length 20
    //   (x,y,'h'|'v',label,value)  legacy; resistor has a 30 px lead and a
    //                              50 px body, capacitor/inductor are centred
    //                              on a 30 px half-length
    const HALF_LEGACY = { resistor: null, capacitor: 30, inductor: 30, diode: 30 };
    ['resistor', 'capacitor', 'inductor', 'diode'].forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            const x = lit(a[0]), y = lit(a[1]);
            if (x === null || y === null) { unreadable++; return; }

            const x2 = lit(a[2]), y2 = lit(a[3]);
            if (x2 !== null && y2 !== null) {          // endpoint form
                add(x, y, name + ' terminal');
                add(x2, y2, name + ' terminal');
                return;
            }

            const third = (a[2] || '').replace(/['"`]/g, '').trim().toLowerCase();
            if (third === 'h' || third === 'horizontal' || third === 'v' || third === 'vertical') {
                const horiz = third[0] === 'h';
                if (name === 'resistor') {
                    // lead from -30, body ends at +50
                    add(horiz ? x - 30 : x, horiz ? y : y - 30, name + ' terminal');
                    add(horiz ? x + 50 : x, horiz ? y : y + 50, name + ' terminal');
                } else {
                    const h = HALF_LEGACY[name];
                    add(horiz ? x - h : x, horiz ? y : y - h, name + ' terminal');
                    add(horiz ? x + h : x, horiz ? y : y + h, name + ' terminal');
                }
                return;
            }

            // centre/options form
            const opts = a[2] || '';
            const horiz = !/horizontal\s*:\s*false/.test(opts);
            const hm = opts.match(/halfLength\s*:\s*(-?\d+(?:\.\d+)?)/);
            const h = hm ? parseFloat(hm[1]) : 20;
            add(horiz ? x - h : x, horiz ? y : y - h, name + ' terminal');
            add(horiz ? x + h : x, horiz ? y : y + h, name + ' terminal');
        });
    });

    // --- rails and ground ------------------------------------------------
    calls(block, 'ground').forEach(raw => {
        const a = splitArgs(raw);
        const x = lit(a[0]), y = lit(a[1]);
        // ground() draws a 20 px stem UP from (x,y); the connection is its top.
        if (x !== null && y !== null) add(x, y - 20, 'ground stem');
        else unreadable++;
    });
    ['vcc', 'vee'].forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            add(lit(a[0]), lit(a[1]), name);
        });
    });

    // --- three-terminal devices ------------------------------------------
    const BJT = { npn: [-30, 30], pnp: [-30, 30] };
    Object.keys(BJT).forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            const x = lit(a[0]), y = lit(a[1]);
            if (x === null || y === null) { unreadable++; return; }
            const f = facingFlip(a[2]);
            add(x - 15 * f, y, name + ' base');
            add(x + 20 * f, y - 30, name + (name === 'npn' ? ' collector' : ' emitter'));
            add(x + 20 * f, y + 30, name + (name === 'npn' ? ' emitter' : ' collector'));
        });
    });
    ['nmos', 'pmos'].forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            const x = lit(a[0]), y = lit(a[1]);
            if (x === null || y === null) { unreadable++; return; }
            const f = facingFlip(a[2]);
            add(x - 20 * f, y, name + ' gate');
            add(x + 15 * f, y - 25, name + ' drain');
            add(x + 15 * f, y + 25, name + ' source');
        });
    });
    ['opAmp', 'opamp'].forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            const x = lit(a[0]), y = lit(a[1]);
            if (x === null || y === null) { unreadable++; return; }
            const mirror = /mirror\s*:\s*true/.test(a[2] || '');
            const d = mirror ? -1 : 1;
            add(x - 40 * d, y - 10, 'opamp in-');
            add(x - 40 * d, y + 10, 'opamp in+');
            add(x + 25 * d, y, 'opamp out');
        });
    });

    // --- explicit connection points --------------------------------------
    ['junction', 'dot', 'nodeLabel'].forEach(name => {
        calls(block, name).forEach(raw => {
            const a = splitArgs(raw);
            add(lit(a[0]), lit(a[1]), name);
        });
    });

    return { terminals, segments, unreadable };
}

function near(a, b) { return Math.abs(a.x - b.x) <= TOL && Math.abs(a.y - b.y) <= TOL; }

// Does the point sit on the interior of this segment? (a T-junction)
function onSegment(p, s) {
    const [x1, y1, x2, y2] = s;
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return false;
    let t = ((p.x - x1) * dx + (p.y - y1) * dy) / len2;
    if (t < 0.02 || t > 0.98) return false;         // the ends are handled by `near`
    const px = x1 + t * dx, py = y1 + t * dy;
    return Math.hypot(p.x - px, p.y - py) <= TOL;
}

const files = walk(LESSONS, []).sort();
const report = [];
let checkedBlocks = 0, skippedBlocks = 0;

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    if (src.indexOf('new SchematicSVG') < 0) return;
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    schematicBlocks(src).forEach((block, bi) => {
        const { terminals, segments, unreadable } = analyse(block);
        if (terminals.length < 4) return;

        // If most of the drawing is computed rather than literal, the geometry
        // we can see is not the whole picture and "floating" would be a guess.
        if (unreadable > terminals.length / 3) { skippedBlocks++; return; }
        checkedBlocks++;

        // A junction, dot or node label is a MARKER. It counts as a connection
        // point for everything else, but a stray one off a wire is decoration,
        // not a broken circuit - and treating it as an error buried the real
        // findings under port labels sitting beside their wires.
        const MARKERS = { junction: 1, dot: 1, nodeLabel: 1 };

        // A supply rail is a line with several things hanging off its middle.
        // Its two ends stick out past the outermost tap on purpose, the way
        // every schematic draws a VDD or ground rail, so they are not floating.
        const railEnds = [];
        segments.forEach(s => {
            const taps = terminals.filter(t => onSegment(t, s)).length;
            if (taps >= 2) {
                railEnds.push({ x: s[0], y: s[1] }, { x: s[2], y: s[3] });
            }
        });

        const floating = [];
        terminals.forEach((t, i) => {
            if (MARKERS[t.what]) return;
            const connected =
                terminals.some((u, j) => j !== i && near(t, u)) ||
                segments.some(s => onSegment(t, s)) ||
                (t.what === 'wire end' && railEnds.some(r => near(t, r)));
            if (!connected) floating.push(t);
        });

        // Collapse duplicates at the same coordinate.
        const seen = {};
        const uniq = floating.filter(f => {
            const k = f.x + ',' + f.y;
            if (seen[k]) return false;
            seen[k] = 1; return true;
        });

        if (uniq.length) {
            report.push({ file: rel, block: bi + 1, floating: uniq, unreadable });
        }
    });
});

let baseline = {};
if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

const verbose = process.argv.indexOf('--verbose') >= 0;
const regressions = [];

report.forEach(r => {
    const key = r.file + '#' + r.block;
    const known = baseline[key] || 0;
    if (r.floating.length > known) regressions.push({ r, known });
});

if (process.argv.indexOf('--write-baseline') >= 0) {
    const out = {};
    report.forEach(r => { out[r.file + '#' + r.block] = r.floating.length; });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
    console.log('baseline written: ' + Object.keys(out).length + ' block(s)');
    process.exit(0);
}

const totalFloating = report.reduce((a, r) => a + r.floating.length, 0);
const knownTotal = Object.keys(baseline).reduce((a, k) => a + baseline[k], 0);

if (verbose || regressions.length) {
    (regressions.length ? regressions.map(x => x.r) : report).forEach(r => {
        console.log(r.file + ' (diagram ' + r.block + '): ' + r.floating.length + ' floating');
        r.floating.slice(0, 12).forEach(f => {
            console.log('    ' + f.what + ' at (' + f.x + ', ' + f.y + ')');
        });
    });
    console.log('');
}

if (regressions.length) {
    console.log('check-svg-nets: FAIL - ' + regressions.length +
                ' diagram(s) gained floating pins since the baseline.');
    process.exit(1);
}

console.log('check-svg-nets: ' + checkedBlocks + ' hand-drawn circuit(s) checked, ' +
            totalFloating + ' floating pin(s) (baseline ' + knownTotal + '), ' +
            skippedBlocks + ' too computed to place.');
process.exit(0);
