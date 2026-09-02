#!/usr/bin/env node
/**
 * FIND CIRCUITS DRAWN ON A CANVAS
 *
 * A canvas is the right tool for a waveform, a Bode plot or a sweep, and the
 * wrong one for a schematic. Drawn on a canvas a resistor becomes a strokeRect
 * with a letter beside it, an op-amp becomes three lineTo calls, and the result
 * is the "boxes instead of a circuit" that keeps getting reported. It is also
 * invisible to every other checker here: check-diagram-nets only sees generated
 * schematics, so a canvas circuit's connectivity is never verified at all.
 *
 * THE FIRST VERSION OF THIS MISSED THE LESSON IT WAS WRITTEN FOR.
 *
 * It scanned each FILE's script as one blob and discarded any file containing
 * plotting calls, on the theory that a plotting file is drawing graphs. Module
 * 1 lesson 2 has two canvases - a virtual-ground schematic and a transfer-curve
 * plot - so the plot vetoed the schematic and the exact lesson that prompted
 * the search came back clean.
 *
 * It now scopes to each canvas separately: the code for a canvas is taken from
 * its getElementById to the next one. A file may hold both kinds and both are
 * judged on their own.
 *
 *   node tools/check-canvas-circuits.js         the canvases drawing circuits
 *   node tools/check-canvas-circuits.js --all   every canvas and its verdict
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const ALL = process.argv.includes('--all');

// Component reference designators drawn as text, and the bare +/- of an op-amp.
const REFDES = /fillText\(\s*['"`](?:R[0-9A-Za-z]{0,3}|C[0-9]{1,2}|L[0-9]{1,2}|Q[0-9]{1,2}|M[0-9]{1,2}|D[0-9]{1,2}|U[0-9]{1,2}|Vin|Vout|Vcc|Vee|VDD|VSS|GND|Vs|Vo|Vi|−|\+)\s*['"`]/g;
// Things only a schematic draws.
const PART_SHAPE = /strokeRect\(|\.arc\(/g;
const WIRES = /lineTo\(/g;
// Things only a graph draws.
const PLOTTING = /drawGrid\(|drawAxes\(|plotData\(|plotWave|plotBode|plotSpectrum|plotMultiWave|autoScale\(|drawLegend/;

function canvasBlocks(js) {
    // Each canvas's drawing code runs from where the element is fetched to
    // where the next one is. Crude, but these lessons are written one
    // canvas per IIFE and it holds.
    const re = /getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    const marks = [];
    let m;
    while ((m = re.exec(js)) !== null) marks.push({ id: m[1], at: m.index });
    return marks.map((mk, i) => ({
        id: mk.id,
        code: js.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : js.length)
    }));
}

const rows = [];
const dir = path.join(ROOT, 'lessons');
fs.readdirSync(dir).forEach(d => {
    const md = path.join(dir, d);
    if (!fs.statSync(md).isDirectory()) return;
    fs.readdirSync(md).forEach(f => {
        if (!f.endsWith('.html')) return;
        const rel = path.join('lessons', d, f).replace(/\\/g, '/');
        const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');

        // Only ids that are actually canvases in this lesson.
        const canvasIds = new Set();
        const cre = /<canvas[^>]*id="([^"]+)"/gi;
        let c;
        while ((c = cre.exec(s)) !== null) canvasIds.add(c[1]);
        if (!canvasIds.size) return;

        const js = (s.match(/<script[\s\S]*?<\/script>/gi) || []).join('\n');
        if (!js) return;
        const title = (/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(s) || [, '?'])[1]
            .replace(/<[^>]*>/g, '').trim();

        canvasBlocks(js).forEach(b => {
            if (!canvasIds.has(b.id)) return;
            const refdes = (b.code.match(REFDES) || []).length;
            const parts = (b.code.match(PART_SHAPE) || []).length;
            const wires = (b.code.match(WIRES) || []).length;
            const plots = PLOTTING.test(b.code);
            // A schematic names parts, draws part shapes, and wires them up.
            const isCircuit = !plots && refdes >= 2 && parts >= 1 && wires >= 4;
            rows.push({ rel, title, id: b.id, refdes, parts, wires, plots, isCircuit });
        });
    });
});

const circuits = rows.filter(r => r.isCircuit);
const byFile = new Map();
circuits.forEach(r => {
    if (!byFile.has(r.rel)) byFile.set(r.rel, []);
    byFile.get(r.rel).push(r);
});

console.log(rows.length + ' canvases inspected across the course');
console.log(circuits.length + ' of them draw a CIRCUIT, in ' + byFile.size + ' lessons\n');

if (ALL) {
    console.log('EVERY CANVAS\n');
    console.log('  verdict   file                        canvas            ref part wire plot');
    rows.forEach(r => console.log('  ' + (r.isCircuit ? 'CIRCUIT ' : 'graph   ') + '  ' +
        r.rel.replace('lessons/', '').padEnd(28) + r.id.padEnd(18) +
        String(r.refdes).padStart(3) + String(r.parts).padStart(5) +
        String(r.wires).padStart(5) + '  ' + (r.plots ? 'yes' : '-')));
    process.exit(0);
}

console.log('  file                        canvas            ref part wire  lesson');
byFile.forEach((list, rel) => {
    list.forEach(r => console.log('  ' + rel.replace('lessons/', '').padEnd(28) +
        r.id.padEnd(18) + String(r.refdes).padStart(3) + String(r.parts).padStart(5) +
        String(r.wires).padStart(5) + '  ' + r.title.slice(0, 34)));
});

console.log('\nThese should be SVG schematics: ComponentModels.diagram() where the parts');
console.log('exist in the catalogue, or SchematicSVG otherwise. Drawn as SVG they get');
console.log('real symbols, and check-diagram-nets can verify what connects to what.');
