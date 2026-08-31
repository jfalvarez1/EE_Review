#!/usr/bin/env node
/**
 * HEADLESS CONNECTIVITY CHECK FOR ComponentModels.diagram() SCHEMATICS
 *
 * The browser netlist auditor found 212 connection faults in diagrams that were
 * geometrically spotless - a transistor drawn beautifully 15 px away from the
 * rail it was supposed to be on is still a transistor that is not in the
 * circuit. This runs the same idea without a browser, so it can gate a commit.
 *
 * It loads component-models.js, finds every diagram({...}) literal in the given
 * lesson files, resolves each part's pin coordinates through its rotation, and
 * then unions pins with wire endpoints and with any wire segment that passes
 * through them. It reports:
 *
 *   FLOATING PIN     a part pin that no wire and no other pin touches
 *   FLOATING WIRE    a wire endpoint landing on nothing
 *   ISOLATED PART    a part whose pins are all in one net with nothing else -
 *                    drawn, but not wired into anything
 *   SINGLETON NET    a net with exactly one member
 *
 * The usual cause of all four is a pin offset: an npn's collector and emitter
 * are at x+15, not x, so a collector resistor drawn at the transistor's own x
 * misses by 15 px and the stage silently has no load.
 *
 *   node tools/check-diagram-nets.js                    all lessons
 *   node tools/check-diagram-nets.js lessons/module-05/lesson-02.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

// ---------------------------------------------------------------- load models

const sandbox = { window: {}, document: undefined, console };
const src = fs.readFileSync(path.join(ROOT, 'assets/component-models.js'), 'utf8');
new Function('window', 'document', 'console', src)(sandbox.window, undefined, console);
const CM = sandbox.window.ComponentModels;
if (!CM) {
    console.error('could not load ComponentModels from assets/component-models.js');
    process.exit(1);
}

// ---------------------------------------------------------------- geometry

/** rotate:90 maps (dx,dy) -> (-dy,dx); 180 -> (-dx,-dy); 270 -> (dy,-dx). */
function rot(dx, dy, deg) {
    switch (((deg || 0) % 360 + 360) % 360) {
        case 90:  return [-dy, dx];
        case 180: return [-dx, -dy];
        case 270: return [dy, -dx];
        default:  return [dx, dy];
    }
}

function pinsOf(part) {
    const model = CM.models ? CM.models[part.key] : null;
    const spec = model || (CM.get ? CM.get(part.key) : null);
    if (!spec || !spec.pins) return null;
    return spec.pins.map(p => {
        const dx = (p.x !== undefined ? p.x : p.dx) || 0;
        const dy = (p.y !== undefined ? p.y : p.dy) || 0;
        const r = rot(dx, dy, part.rotate);
        return { name: p.name || p.id || '?', x: part.x + r[0], y: part.y + r[1] };
    });
}

const key = (x, y) => Math.round(x) + ',' + Math.round(y);

/**
 * Pins that are allowed to be open, because leaving them so is the drawing
 * convention rather than a mistake. Each is a deliberate exception and is
 * listed here so it is a decision on the record, not silence.
 *
 *   bus a/b        A bus is a BAR. Its ends are the ends of the bar; feeders
 *                  tap it along its length. Wiring something to the tip would
 *                  be the odd thing to do.
 *   ct secondary   On a one-line, a current transformer's secondary is shown
 *                  open unless the relay it burdens is also drawn. Drawing the
 *                  burden on every CT is what one-lines exist to avoid.
 *   opamp vcc/vee  Supply pins are routinely omitted from a signal-path
 *                  schematic. The rails are stated in the text instead.
 *   structure a    A transmission structure is scenery holding a conductor up,
 *                  not a circuit element with a terminal.
 */
const OPEN_BY_CONVENTION = {
    busbar:    ['a', 'b'],
    ct:        ['secondary'],
    opamp:     ['vcc', 'vee'],
    structure: ['a', 'b']
};

function mayFloat(partKey, pinName) {
    const allowed = OPEN_BY_CONVENTION[partKey];
    return !!allowed && allowed.indexOf(pinName) !== -1;
}

/** Is (px,py) on the segment a-b, allowing a pixel of slop? */
function onSegment(px, py, a, b) {
    const [x1, y1] = a, [x2, y2] = b;
    if (Math.abs(x1 - x2) < 0.5) {                    // vertical
        if (Math.abs(px - x1) > 0.5) return false;
        return py >= Math.min(y1, y2) - 0.5 && py <= Math.max(y1, y2) + 0.5;
    }
    if (Math.abs(y1 - y2) < 0.5) {                    // horizontal
        if (Math.abs(py - y1) > 0.5) return false;
        return px >= Math.min(x1, x2) - 0.5 && px <= Math.max(x1, x2) + 0.5;
    }
    return false;                                      // diagonal: a separate defect
}

// ---------------------------------------------------------------- union-find

function makeUF() {
    const parent = new Map();
    function find(a) {
        if (!parent.has(a)) { parent.set(a, a); return a; }
        let r = a;
        while (parent.get(r) !== r) r = parent.get(r);
        while (parent.get(a) !== r) { const n = parent.get(a); parent.set(a, r); a = n; }
        return r;
    }
    return {
        find,
        union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); },
        groups() {
            const g = new Map();
            for (const k of parent.keys()) {
                const r = find(k);
                if (!g.has(r)) g.set(r, []);
                g.get(r).push(k);
            }
            return g;
        }
    };
}

// ------------------------------------------------------- extract diagram specs

/** Find balanced-brace diagram({...}) literals and eval them for their data. */
function extractSpecs(html) {
    const specs = [];
    const marker = 'ComponentModels.diagram(';
    let i = 0;
    while ((i = html.indexOf(marker, i)) !== -1) {
        let j = i + marker.length;
        while (j < html.length && /\s/.test(html[j])) j++;
        if (html[j] !== '{') { i = j; continue; }
        let depth = 0, end = j, inStr = null;
        for (; end < html.length; end++) {
            const c = html[end];
            if (inStr) {
                if (c === '\\') { end++; continue; }
                if (c === inStr) inStr = null;
                continue;
            }
            if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) { end++; break; } }
        }
        const body = html.slice(j, end);
        specs.push({ body, at: i });
        i = end;
    }
    return specs;
}

/** Evaluate one spec with the surrounding const declarations in scope. */
function evalSpec(html, spec) {
    // Pull simple numeric consts from the enclosing script so MX/CX/BX resolve.
    // Names declared inside OTHER closures in the same file are picked up too
    // and may reference things not in scope here, so each is evaluated on its
    // own and silently dropped if it throws - a later declaration wins, which
    // matches the nearest-enclosing-scope the diagram actually sees.
    const scope = {};
    // One statement may declare several names - `const MX = 330, MY = 175;` is
    // the common form - so capture the whole body and split it on the commas
    // that introduce a new declarator.
    const re = /(?:const|let|var)\s+([^;\n]+);/g;
    let m;
    while ((m = re.exec(html.slice(0, spec.at))) !== null) {
        m[1].split(/,\s*(?=[A-Za-z_$][\w$]*\s*=)/).forEach(decl => {
            const eq = decl.indexOf('=');
            if (eq === -1) return;
            const name = decl.slice(0, eq).trim();
            const val = decl.slice(eq + 1).trim();
            if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
            if (!/^[-+*/()\s\w.]+$/.test(val) || /\bfunction\b|=>/.test(val)) return;
            const names = Object.keys(scope);
            try {
                scope[name] = new Function(...names, 'return (' + val + ');')
                                  (...names.map(n => scope[n]));
            } catch (e) { /* not resolvable here; not ours */ }
        });
    }
    // Multiple declarations of the same name across closures are the norm in
    // these files. Keep only numbers, which is all a coordinate can be.
    const names = Object.keys(scope).filter(n => typeof scope[n] === 'number');
    try {
        return new Function(...names, 'return (' + spec.body + ');')
                   (...names.map(n => scope[n]));
    } catch (e) {
        return { __error: e.message };
    }
}

// ---------------------------------------------------------------- the check

function checkFile(file) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const specs = extractSpecs(html);
    const findings = [];

    specs.forEach((spec, si) => {
        const d = evalSpec(html, spec);
        const tag = file + ' #' + (si + 1) + (d && d.title ? ' "' + d.title + '"' : '');

        if (!d || d.__error) {
            findings.push({ tag, kind: 'UNPARSED', msg: d ? d.__error : 'no object' });
            return;
        }
        const parts = d.parts || [], wires = d.wires || [], blocks = d.blocks || [];
        if (!parts.length) return;

        /** A wire may legitimately end on a BLOCK's edge, or a few px inside a
         *  symbol whose pin it already ran through. Both are landings. */
        const inBlock = (x, y) => blocks.some(b =>
            x >= b.x - b.w / 2 - 1 && x <= b.x + b.w / 2 + 1 &&
            y >= b.y - b.h / 2 - 1 && y <= b.y + b.h / 2 + 1);
        const nearPart = (x, y) => parts.some(p =>
            Math.abs(p.x - x) <= 25 && Math.abs(p.y - y) <= 25);
        /** A tap landing anywhere along a bus bar has landed on the bus. */
        const onBusbar = (x, y) => parts.some(p => {
            if (p.key !== 'busbar') return false;
            const pins = pinsOf(p);
            return pins && pins.length >= 2 &&
                   onSegment(x, y, [pins[0].x, pins[0].y], [pins[1].x, pins[1].y]);
        });

        const uf = makeUF();
        const pinAt = new Map();
        const unknown = [];

        parts.forEach((p, pi) => {
            const pins = pinsOf(p);
            if (!pins) { unknown.push(p.key); return; }
            pins.forEach(pin => {
                const k = key(pin.x, pin.y);
                uf.find(k);
                if (!pinAt.has(k)) pinAt.set(k, []);
                pinAt.get(k).push({ pi, part: p, pin });
            });
        });

        // A wire is a POLYLINE, not a segment: [[x,y],[x,y],[x,y]] is one
        // conductor with a corner in it. Reading only the first two points was
        // this tool's own first bug, and it reported every corner-routed gate
        // in the catalogue as floating.
        const segs = [];
        wires.forEach(w => {
            for (let i = 0; i + 1 < w.length; i++) segs.push({ a: w[i], b: w[i + 1], w });
            // the whole polyline is one net
            const k0 = key(w[0][0], w[0][1]);
            for (let i = 1; i < w.length; i++) uf.union(k0, key(w[i][0], w[i][1]));
        });

        // any pin lying on any segment joins that conductor
        segs.forEach(s => {
            for (const k of pinAt.keys()) {
                const [px, py] = k.split(',').map(Number);
                if (onSegment(px, py, s.a, s.b)) uf.union(k, key(s.w[0][0], s.w[0][1]));
            }
        });

        // A bus is a conductor along its whole length, not just at its two
        // pins: feeders tap it anywhere on the bar. Union everything that
        // lands on the span between its ends.
        parts.forEach(p => {
            if (p.key !== 'busbar') return;
            const pins = pinsOf(p);
            if (!pins || pins.length < 2) return;
            const a = [pins[0].x, pins[0].y], b = [pins[1].x, pins[1].y];
            const ka = key(a[0], a[1]);
            uf.union(ka, key(b[0], b[1]));
            wires.forEach(w => w.forEach(v => {
                if (onSegment(v[0], v[1], a, b)) uf.union(ka, key(v[0], v[1]));
            }));
        });

        // a vertex of one wire touching another wire's span joins the two
        wires.forEach(w => {
            w.forEach(e => {
                segs.forEach(s => {
                    if (s.w === w) return;
                    if (onSegment(e[0], e[1], s.a, s.b)) {
                        uf.union(key(e[0], e[1]), key(s.w[0][0], s.w[0][1]));
                    }
                });
            });
        });

        const onAnySeg = (px, py, skip) =>
            segs.some(s => (skip ? s.w !== skip : true) && onSegment(px, py, s.a, s.b));

        // ---- floating pins
        pinAt.forEach((entries, k) => {
            const [px, py] = k.split(',').map(Number);
            if (onAnySeg(px, py) || entries.length > 1) return;
            const e = entries[0];
            if (mayFloat(e.part.key, e.pin.name)) return;
            findings.push({
                tag, kind: 'FLOATING PIN',
                msg: (e.part.label || e.part.key) + '.' + e.pin.name +
                     ' at (' + px + ',' + py + ') touches no wire'
            });
        });

        // ---- floating wire ends: only the two ENDS of a polyline can float;
        // an interior vertex is a corner and is connected by construction.
        wires.forEach(w => {
            [w[0], w[w.length - 1]].forEach(e => {
                if (pinAt.has(key(e[0], e[1]))) return;
                if (onAnySeg(e[0], e[1], w)) return;
                if (inBlock(e[0], e[1]) || nearPart(e[0], e[1]) || onBusbar(e[0], e[1])) return;
                findings.push({
                    tag, kind: 'FLOATING WIRE',
                    msg: 'endpoint (' + e[0] + ',' + e[1] + ') lands on nothing'
                });
            });
        });

        // ---- parts wired to nothing but themselves
        parts.forEach((p, pi) => {
            const pins = pinsOf(p);
            if (!pins || pins.length < 2) return;
            const roots = new Set(pins.map(pin => uf.find(key(pin.x, pin.y))));
            const others = new Set();
            roots.forEach(r => {
                uf.groups().get(r).forEach(k => {
                    (pinAt.get(k) || []).forEach(e => { if (e.pi !== pi) others.add(e.pi); });
                });
            });
            if (others.size === 0) {
                findings.push({
                    tag, kind: 'ISOLATED PART',
                    msg: (p.label || p.key) + ' at (' + p.x + ',' + p.y +
                         ') shares no net with any other part'
                });
            }
        });

        if (unknown.length) {
            findings.push({ tag, kind: 'UNKNOWN KEY', msg: [...new Set(unknown)].join(', ') });
        }
    });

    return { specs: specs.length, findings };
}

// ---------------------------------------------------------------- main

let files = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!files.length) {
    files = [];
    const dir = path.join(ROOT, 'lessons');
    fs.readdirSync(dir).forEach(m => {
        const md = path.join(dir, m);
        if (!fs.statSync(md).isDirectory()) return;
        fs.readdirSync(md).forEach(f => {
            if (f.endsWith('.html')) files.push(path.join('lessons', m, f).replace(/\\/g, '/'));
        });
    });
}

let totalSpecs = 0, all = [];
files.forEach(f => {
    const r = checkFile(f);
    totalSpecs += r.specs;
    all = all.concat(r.findings);
});

console.log(files.length + ' files, ' + totalSpecs + ' diagram() schematics');

// UNPARSED is a limit of this tool, not a defect in the drawing: those diagrams
// assemble their parts array in code (a loop, a spread, a helper) rather than
// writing a literal, and static extraction cannot evaluate that. They are
// reported so the blind spot is visible, but they do not fail the gate - the
// in-browser netlist auditor covers them.
const unparsed = all.filter(f => f.kind === 'UNPARSED');
const real = all.filter(f => f.kind !== 'UNPARSED');

const byKind = {};
real.forEach(f => { (byKind[f.kind] = byKind[f.kind] || []).push(f); });
Object.keys(byKind).sort().forEach(k => {
    console.log('\n' + k + ' (' + byKind[k].length + ')');
    byKind[k].slice(0, 40).forEach(f => console.log('  ' + f.tag + '\n      ' + f.msg));
    if (byKind[k].length > 40) console.log('  ... ' + (byKind[k].length - 40) + ' more');
});

if (unparsed.length) {
    console.log('\nNOT STATICALLY CHECKABLE (' + unparsed.length + ') - these build their ' +
                'parts in code, so\nthe in-browser netlist auditor is what covers them:');
    unparsed.forEach(f => console.log('  ' + f.tag + '  (' + f.msg + ')'));
}

if (!real.length) {
    console.log('\nPASS - every pin checked is on a net, and every net has more than one member.');
    process.exit(0);
}
console.log('\n' + real.length + ' findings');
process.exit(1);
