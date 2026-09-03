#!/usr/bin/env node
/**
 * check-hand-drawn - find components faked out of raw SVG primitives.
 *
 * Why this exists
 * ---------------
 * check-diagram-nets validates schematics built with ComponentModels.diagram(),
 * which is a netlist: it knows what a component is and where its pins are, so
 * it can prove every pin is on a net. 37 lessons use it.
 *
 * The other 58 draw with raw SchematicSVG primitives. Those are invisible to
 * every check we have, and some of them do not call the component methods at
 * all - they draw an inductor as a row of circles, a capacitor as two loose
 * lines, a resistor as a bare rectangle. The result renders, so nothing fails,
 * but it looks like nothing an engineer recognises. That is what a reader
 * means by "the old schematic".
 *
 * SchematicSVG has had real primitives the whole time:
 *
 *     svg.resistor(...)  svg.capacitor(...)  svg.inductor(...)  svg.diode(...)
 *     svg.nmos/pmos/npn/pnp(...)  svg.opAmp(...)  svg.ground(...)
 *     svg.currentSource(...)  svg.vcc/vee(...)
 *
 * So a hand-drawn component is never necessary; it is always a lesson that
 * predates the primitive or ignored it.
 *
 * What it flags
 * -------------
 *   1. A loop of svg.circle() or svg.path() arcs on one axis - a fake inductor.
 *   2. Two or three parallel svg.line() calls sharing an axis, with a nearby
 *      text label of "C" or a capacitance - a fake capacitor.
 *   3. svg.rect() with a nearby "R" or an ohms label - a fake resistor.
 *   4. A file that draws with primitives and never calls any component method.
 *
 * (4) is the strongest signal and the one to fix first: a schematic block with
 * zero component calls contains no recognisable components at all.
 *
 * Run: node tools/check-hand-drawn.js [--list] [--file <path>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');

// Every component-drawing method SchematicSVG exposes. Calling one of these
// means the lesson is using the library as intended.
const COMPONENT_METHODS = [
    'resistor', 'addResistor',
    'capacitor', 'addCapacitor',
    'inductor', 'addInductor',
    'diode', 'addDiode',
    'nmos', 'pmos', 'npn', 'pnp',
    'opAmp', 'opamp', 'addOpAmp',
    'ground', 'addGround',
    'currentSource', 'voltageSource', 'addSource',
    'vcc', 'vee',
    'transformer', 'switch', 'crystal'
];

// Primitives. Drawing with only these is drawing by hand.
const PRIMITIVES = ['line', 'rect', 'circle', 'path', 'wire', 'addWire', 'addRect'];

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

// Pull the body of each function that builds a schematic, so counts are
// per-diagram rather than per-file. A file can hold several.
function schematicBlocks(src) {
    const blocks = [];
    const re = /new\s+SchematicSVG\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        // From the constructor to the appendChild that mounts it, which is how
        // every one of these blocks ends.
        const end = src.indexOf('appendChild', m.index);
        blocks.push(src.slice(m.index, end < 0 ? Math.min(m.index + 6000, src.length) : end));
    }
    return blocks;
}

function countCalls(block, names) {
    const counts = {};
    names.forEach(n => {
        const re = new RegExp('\\.\\s*' + n + '\\s*\\(', 'g');
        const found = block.match(re);
        if (found) counts[n] = found.length;
    });
    return counts;
}

function total(counts) {
    return Object.keys(counts).reduce((a, k) => a + counts[k], 0);
}

// A loop that emits circles or arcs is almost always a hand-rolled inductor -
// but only if the circles are big enough to BE coil humps. A loop that drops a
// 2 px dot at each cell tap is drawing junctions, which is correct and has no
// primitive of its own beyond svg.dot(). Require radius >= 5.
function fakeInductor(block) {
    const loops = block.match(/for\s*\([^)]*\)\s*\{[\s\S]{0,600}?\}/g) || [];
    return loops.some(loop => {
        const circles = loop.match(/\.\s*circle\s*\([^)]*\)/g) || [];
        if (circles.some(c => {
            const args = c.split(',');
            const r = parseFloat(args[2]);
            return isFinite(r) && r >= 5;
        })) return true;
        // ctx-style arcs stepping along an axis
        return /\.\s*arc\s*\([^)]*Math\.PI/.test(loop);
    });
}

// Two or three svg.line() calls in a row whose x-ranges match and whose y
// values differ by 8-14px are capacitor plates.
function fakeCapacitor(block) {
    const lines = [];
    const re = /\.\s*line\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        lines.push([+m[1], +m[2], +m[3], +m[4]]);
    }
    for (let i = 0; i < lines.length - 1; i++) {
        const a = lines[i], b = lines[i + 1];
        // both horizontal, same span, close together vertically
        if (a[1] === a[3] && b[1] === b[3] &&
            Math.abs(a[0] - b[0]) < 3 && Math.abs(a[2] - b[2]) < 3 &&
            Math.abs(a[1] - b[1]) >= 5 && Math.abs(a[1] - b[1]) <= 16) return true;
        // both vertical, same span, close together horizontally
        if (a[0] === a[2] && b[0] === b[2] &&
            Math.abs(a[1] - b[1]) < 3 && Math.abs(a[3] - b[3]) < 3 &&
            Math.abs(a[0] - b[0]) >= 5 && Math.abs(a[0] - b[0]) <= 16) return true;
    }
    return false;
}

// A bare rect standing in for a resistor. The shape is the discriminator: a
// resistor body is a thin oblong, roughly 2:1 to 5:1 with its short side under
// 20 px. An IC block is big in both directions, and flagging those made the
// data-acquisition lesson - which draws its resistors correctly - look broken.
function fakeResistor(block) {
    if (/\.\s*(resistor|addResistor)\s*\(/.test(block)) return false;
    if (!/['"]R\d+['"]|Ω|&Omega;|ohm/i.test(block)) return false;
    const rects = block.match(/\.\s*rect\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g) || [];
    return rects.some(r => {
        const n = r.match(/(-?[\d.]+)/g).map(Number);
        const w = n[2], h = n[3];
        if (!isFinite(w) || !isFinite(h)) return false;
        const short = Math.min(w, h), long = Math.max(w, h);
        const ratio = long / short;
        return short <= 20 && ratio >= 1.8 && ratio <= 6;
    });
}

// Not every SchematicSVG block is a circuit. Lessons also use it for enclosure
// drawings, flowcharts, timing diagrams and system block diagrams, and those
// legitimately contain no resistors. Flagging them would train everyone to
// ignore this check, which is worse than not having it.
//
// A block is treated as a CIRCUIT schematic only if it shows one of the two
// things every circuit drawing has and no block diagram does: a ground symbol,
// or component reference designators in its text.
const REFDES = /['"`](?:R|C|L|D|Q|U|M|J|T|X|Y|K|F|SW)\d+['"`]/;

// Note what is NOT a signal here: svg.ground(). An enclosure drawing marks its
// chassis bonding points with the same symbol, so ground alone flagged the
// shielding lesson's mechanical view as a broken schematic. Reference
// designators and component values are the tells that survive that test - a
// block diagram has neither.
function isCircuit(block, comp) {
    if (REFDES.test(block)) return true;
    // Component values: "10kΩ", "4.7uF", "100nH".
    if (/['"`][\d.]+\s*[munpkMG]?(?:Ω|ohm|F\b|H\b)/i.test(block)) return true;
    return false;
}

const files = walk(LESSONS, []).sort();
const findings = [];
const skipped = [];

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    if (src.indexOf('new SchematicSVG') < 0) return;
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    schematicBlocks(src).forEach((block, i) => {
        const comp = countCalls(block, COMPONENT_METHODS);
        const prim = countCalls(block, PRIMITIVES);
        const nComp = total(comp), nPrim = total(prim);
        if (nPrim === 0) return;   // nothing drawn here

        if (!isCircuit(block, comp)) {
            skipped.push(rel + ' #' + (i + 1));
            return;                // a block diagram, flowchart or mechanical view
        }

        const reasons = [];
        // ground() alone does not make a schematic - it is furniture, not a
        // component. Discount it when deciding whether anything real was drawn.
        const realComp = nComp - (comp.ground || 0) - (comp.addGround || 0)
                               - (comp.vcc || 0) - (comp.vee || 0);

        if (realComp === 0) {
            reasons.push('no component primitive at all (' + nPrim +
                         ' raw draw calls, only furniture)');
        }
        if (fakeInductor(block) && !comp.inductor && !comp.addInductor) {
            reasons.push('loop of circles/arcs where svg.inductor() exists');
        }
        if (fakeCapacitor(block) && !comp.capacitor && !comp.addCapacitor) {
            reasons.push('parallel plate lines where svg.capacitor() exists');
        }
        if (fakeResistor(block)) {
            reasons.push('bare rect labelled as a resistor where svg.resistor() exists');
        }

        if (reasons.length) {
            findings.push({ file: rel, block: i + 1, realComp, nPrim, reasons });
        }
    });
});

const argList = process.argv.indexOf('--list') >= 0;

if (!findings.length) {
    console.log('PASS - every SchematicSVG circuit uses the library\'s component primitives. (' +
                skipped.length + ' non-circuit diagram(s) skipped.)');
    process.exit(0);
}

const byFile = {};
findings.forEach(f => { (byFile[f.file] = byFile[f.file] || []).push(f); });

console.log('check-hand-drawn: ' + findings.length + ' hand-drawn diagram(s) in ' +
            Object.keys(byFile).length + ' file(s).\n');

Object.keys(byFile).sort().forEach(file => {
    console.log(file);
    byFile[file].forEach(f => {
        console.log('  diagram ' + f.block + ': ' + f.reasons.join('; '));
    });
});

if (argList) {
    console.log('\nfiles:');
    Object.keys(byFile).sort().forEach(f => console.log(f));
}

process.exit(1);
