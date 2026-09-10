#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { render } = require('./test-diagram-geometry');

function change(document, id, value, event = 'input') {
    const el = document.getElementById(id);
    el.value = String(value);
    for (const fn of el._listeners.get(event) || []) fn();
}
function click(document, id) {
    for (const fn of document.getElementById(id)._listeners.get('click') || []) fn();
}

// Run the authored scripts and their event handlers, including the actual readouts.
const lab = render('lessons/module-01/lesson-01.html');
const reading = () => lab.document.getElementById('lab-loading-reading').textContent;
assert.match(reading(), /0\.550 V pk-pk · 50\.0%/);
click(lab.document, 'lab-reference');
assert.match(reading(), /1\.099 V pk-pk · 100\.0%/);
click(lab.document, 'lab-half');
change(lab.document, 'lab-cap', '1e-8', 'change');
assert.match(reading(), /0\.167 V pk-pk · 15\.2%.*-72\.2°/);
click(lab.document, 'lab-reference');
assert.match(reading(), /100\.0%.*0\.0°/);

const slew = render('lessons/module-01/lesson-04.html');
const generator = render('lessons/module-01/lesson-03.html');
let traces;
generator.context.AD.plotMultiWave = (_ctx, _w, _h, waves) => { traces = waves; };
change(generator.document, 'wg-r', '10k');
assert.equal(traces.length, 2, 'Both oscillator outputs must survive the same canvas render');
assert((traces[0].samples[2] - traces[0].samples[1]) * traces[1].samples[1] < 0,
    'The inverting integrator must ramp opposite to its square-wave input');
const text = id => slew.document.getElementById(id).textContent;
assert.equal(text('sr-rate-val'), '1.00 V/µs');
assert.equal(text('sr-required'), '1.57 V/µs');
assert.equal(text('sr-status'), 'SLEW LIMITED');
change(slew.document, 'sr-rate', 1);
assert.equal(text('sr-rate-val'), '10.00 V/µs');
assert.equal(text('sr-status'), 'Linear');
click(slew.document, 'sr-limited');
assert.equal(text('sr-status'), 'SLEW LIMITED');
click(slew.document, 'sr-clean');
assert.equal(text('sr-status'), 'Linear');
change(slew.document, 'sr-wave', 'square', 'change');
assert.equal(text('sr-required'), '∞ (ideal step)');
assert.match(text('sr-margin'), /ramp time.*half-period/);

const stability = render('lessons/module-01/lesson-08.html');
const result = () => stability.document.getElementById('stability-result').innerHTML;
assert.match(result(), /9\.6 MHz/); // GBW = 10M, not 10 milli.
assert.match(result(), /73\.3°/);
stability.document.getElementById('cload-val').value = '10n';
stability.context.calcStability();
assert.match(result(), /1\.8 MHz/);
assert.match(result(), /10\.2°/);
stability.document.getElementById('cload-val').value = '-100p';
stability.context.calcStability();
assert.match(stability.document.getElementById('stability-result').textContent, /positive finite values/);
console.log('PASS - resistive/reactive loading, logarithmic slew controls, square-wave limit, SI parsing and loaded loop crossover.');
