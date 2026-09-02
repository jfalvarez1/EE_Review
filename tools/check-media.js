#!/usr/bin/env node
/**
 * AUDIT EVERY VISUAL IN THE COURSE
 *
 * Three questions, none of which anything asked before:
 *
 *   1. Does a lesson that teaches a CIRCUIT actually draw one? Several draw a
 *      row of labelled rectangles instead - a block diagram standing in for a
 *      schematic. A block diagram is the right tool for a signal chain and the
 *      wrong one for "here is the circuit", and the difference is visible in
 *      the markup: a schematic is mostly conductors and symbols, a block
 *      diagram is mostly <rect> with <text> inside.
 *
 *   2. Does every lesson have any visual at all?
 *
 *   3. Is anything interactive, or is the picture static? A canvas with no
 *      control is a diagram that took a canvas to draw; controls with no
 *      readout give the reader nothing back.
 *
 * The block-diagram test is a ratio, not a rule. Some lessons legitimately show
 * a block diagram - a PLL, a converter's control loop, a signal chain - so this
 * reports candidates with their numbers and leaves the judgement to a reader.
 *
 *   node tools/check-media.js              summary and the flagged lessons
 *   node tools/check-media.js --all        every lesson's inventory
 *   node tools/check-media.js --blocks     only the block-diagram candidates
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const ALL = process.argv.includes('--all');
const BLOCKS_ONLY = process.argv.includes('--blocks');

const C = new Function('window', 'document', 'localStorage',
    fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8') +
    '\n;return window.CURRICULUM;')({}, undefined, undefined);

/** Pull each <svg>...</svg> out of a lesson and describe what it is made of. */
function svgs(html) {
    const out = [];
    const re = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const attrs = m[1], body = m[2];
        const count = t => (body.match(new RegExp('<' + t + '\\b', 'gi')) || []).length;
        const rect = count('rect');
        const line = count('line');
        const pathN = count('path');
        const poly = count('polyline') + count('polygon');
        const circle = count('circle');
        const text = count('text');
        out.push({
            isCircuitClass: /class="[^"]*circuit-diagram/.test(attrs),
            rect, line, path: pathN, poly, circle, text,
            conductors: line + pathN + poly,
            symbols: circle + poly
        });
    }
    return out;
}

const rows = [];
C.modules.forEach(m => m.lessons.forEach(l => {
    const rel = 'lessons/module-' + String(m.id).padStart(2, '0') +
                '/lesson-' + String(l.id).padStart(2, '0') + '.html';
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return;
    const s = fs.readFileSync(p, 'utf8');

    const gen = (s.match(/ComponentModels\.diagram\(/g) || []).length;
    const eng = (s.match(/new SchematicSVG\(/g) || []).length;
    const canvases = (s.match(/<canvas\b/gi) || []).length;
    const ranges = (s.match(/<input[^>]*type="range"/gi) || []).length;
    const selects = (s.match(/<select\b/gi) || []).length;
    // "Does the reader get something back" is not a question about one CSS
    // class. Lessons answer a control in several ways - the .v.mono readout
    // boxes the newer ones use, AD.setText, or a direct textContent/innerHTML
    // assignment - and counting only the first reported thirteen working
    // lessons as broken.
    const readouts = (s.match(/class="v mono"/g) || []).length +
                     (s.match(/AD\.setText\(/g) || []).length +
                     (s.match(/\.textContent\s*=/g) || []).length +
                     (s.match(/\.innerHTML\s*=/g) || []).length;
    const checkpoints = (s.match(/class="checkpoint"/g) || []).length;

    const sv = svgs(s);
    // A drawing that is mostly boxes with words in them, and has essentially no
    // conductors, is a block diagram however it is labelled.
    const blocky = sv.filter(v => v.rect >= 3 && v.conductors <= v.rect &&
                                  v.text >= v.rect && v.symbols <= 2);
    const drawn = sv.filter(v => v.conductors > 4);

    rows.push({
        mod: m.id, les: l.id, title: l.title, rel,
        gen, eng, canvases, ranges, selects, readouts, checkpoints,
        svgTotal: sv.length, blocky: blocky.length, drawn: drawn.length,
        hasCircuit: gen > 0 || eng > 0 || drawn.length > 0,
        hasVisual: gen > 0 || eng > 0 || canvases > 0 || sv.length > 0,
        interactive: ranges + selects > 0
    });
}));

const noVisual = rows.filter(r => !r.hasVisual);
const blockOnly = rows.filter(r => r.blocky > 0 && !r.hasCircuit);
const staticCanvas = rows.filter(r => r.canvases > 0 && !r.interactive);
const deadControls = rows.filter(r => r.interactive && r.canvases === 0 && r.readouts === 0);

console.log(rows.length + ' lessons audited\n');
console.log('  with a real circuit drawing   ' + rows.filter(r => r.hasCircuit).length);
console.log('  with any visual               ' + rows.filter(r => r.hasVisual).length);
console.log('  with a control                ' + rows.filter(r => r.interactive).length);
console.log('  with a checkpoint             ' + rows.filter(r => r.checkpoints).length);
console.log('');
console.log('  NO VISUAL AT ALL              ' + noVisual.length);
console.log('  BLOCKS BUT NO CIRCUIT         ' + blockOnly.length);
console.log('  CANVAS BUT NO CONTROL         ' + staticCanvas.length);
console.log('  CONTROLS BUT NOTHING TO SHOW  ' + deadControls.length);

const list = (title, arr, extra) => {
    if (!arr.length) return;
    console.log('\n' + title + '\n');
    arr.forEach(r => console.log('  ' + (r.mod + '-' + r.les).padEnd(7) +
        r.title.slice(0, 44).padEnd(46) + (extra ? extra(r) : '')));
};

if (BLOCKS_ONLY) {
    list('BLOCK DIAGRAM WHERE A CIRCUIT BELONGS — these draw labelled boxes and\n' +
         'no conductors. Some are legitimately block diagrams; read them.',
        blockOnly, r => r.blocky + ' blocky svg, ' + r.svgTotal + ' total');
    process.exit(0);
}

list('NO VISUAL AT ALL', noVisual);
list('BLOCK DIAGRAM WHERE A CIRCUIT BELONGS — labelled boxes, no conductors.\n' +
     'Some are legitimately block diagrams; read them before changing anything.',
    blockOnly, r => r.blocky + ' blocky / ' + r.svgTotal + ' svg');
list('CANVAS BUT NO CONTROL — a picture that cost a canvas to draw',
    staticCanvas, r => r.canvases + ' canvas');
list('CONTROLS BUT NO CANVAS OR READOUT — the reader gets nothing back',
    deadControls, r => r.ranges + ' range, ' + r.selects + ' select');

if (ALL) {
    console.log('\nEVERY LESSON\n');
    console.log('  lesson  gen eng cv rng sel ro cp  svg blocky drawn  title');
    rows.forEach(r => console.log('  ' + (r.mod + '-' + r.les).padEnd(8) +
        String(r.gen).padStart(3) + String(r.eng).padStart(4) +
        String(r.canvases).padStart(3) + String(r.ranges).padStart(4) +
        String(r.selects).padStart(4) + String(r.readouts).padStart(3) +
        String(r.checkpoints).padStart(3) + String(r.svgTotal).padStart(5) +
        String(r.blocky).padStart(7) + String(r.drawn).padStart(6) + '  ' +
        r.title.slice(0, 34)));
}
