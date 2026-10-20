#!/usr/bin/env node
'use strict';

// A changed-input answer must be tested against the changed circuit, and a
// missing override must fail rather than silently fall back to the original.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const N = require('./netlist');
const DC = require('./sim-dc-case');
const SPICE = require('./export-spice');
const root = path.dirname(__dirname);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-sim-case-'));
const file = path.join(dir, 'fixture.html');
const circuit = `<table><tr><th>Part</th><th>What</th><th>Value</th><th>Connect</th></tr>
<tr><td>V1</td><td>Voltage source</td><td>12 V DC</td><td>from supply to ground</td></tr>
<tr><td>R1</td><td>Resistor</td><td>1 ohm</td><td>between supply and out</td></tr>
<tr><td>R2</td><td>Resistor</td><td>11999 ohm</td><td>between out and ground</td></tr></table>`;
function fixture(expect = '0.5', overrides = "{ V1: '6 V DC' }") {
    return circuit + `\n<script>new SimCheckWidget('fixture', {
    probes: [
        { id: 'tiny-drop', node: 'supply,out', dc: true, expect: '1', unit: 'mV', tol: 0.0001 },
        { id: 'changed', node: 'supply,out', dc: true, dcValues: ${overrides},
          expect: '${expect}', unit: 'mV', tol: 0.0001 }
    ],
    });</script>`;
}
function check(src) {
    fs.writeFileSync(file, src);
    return spawnSync(process.execPath, [path.join(root, 'tools/check-sim-values.js'), file],
        { cwd: root, encoding: 'utf8' });
}
try {
    assert.equal(check(fixture()).status, 0, 'millivolt differences and changed voltage must pass');
    assert.equal(check(fixture('1')).status, 1, 'a default-build answer for a changed source must fail');
    const missing = check(fixture('0.5', "{ Typo: '6 V DC' }"));
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /missing or ambiguous part Typo/);
    assert.equal(check(fixture('0.5', "{ V1: 'pulse 0 6 V at 1 kHz' }")).status, 1,
        'an unsolved changed circuit must fail, not skip');
    assert.throws(() => DC.overrides("dcValues: { V1: 6 }"), /string Value/);
    assert.throws(() => DC.solveCase(circuit + circuit, { V1: '6 V DC' }), /exactly one/);
    assert.equal(N.modelFor('Zener Diode, 8.2 V', 'Diode').m.BV, 8.2);
    assert.equal(N.modelFor('Zener Diode, 5.1 V', 'Diode').m.BV, 5.1);
    assert.equal(N.MODELS.ZENER.BV, 5.1, 'per-part parameters must not mutate the global default');
    const tvs = N.modelFor(N.text('Zener Diode, 16.7 V, rz = 0.31&nbsp;&Omega;'), 'Diode').m;
    assert.equal(tvs.BV, 16.7);
    assert.equal(tvs.RZ, 0.31, 'a stated dynamic resistance replaces the generic 7 ohm');
    assert.equal(N.modelFor(N.text('Zener Diode, 26.7 V, rz = 70&nbsp;m&Omega;'), 'Diode').m.RZ, 0.07);
    assert.equal(N.modelFor('Zener Diode, 8.2 V', 'Diode').m.RZ, N.MODELS.ZENER.RZ);
    assert.equal(N.MODELS.ZENER.RZ, 7, 'per-part rz must not mutate the global default');
    const tvsExport = SPICE.emit({ ref: 'D2', what: 'Diode', value: 'Zener Diode, 5.1 V, rz = 0.5 ohm', kind: 'diode', nodes: ['ground', 'out'] });
    assert.equal(tvsExport.unsupported.length, 1, 'a default-BV zener with a stated rz is still not the default part');
    const clamp = { ref: 'D1', what: 'Diode', value: 'Zener Diode, 8.2 V', kind: 'diode', nodes: ['ground', 'out'] };
    const export82 = SPICE.emit(clamp);
    assert.equal(export82.unsupported.length, 1);
    assert.ok(export82.lines.every(line => line.startsWith('*')), 'do not export a silently wrong default clamp');
    assert.equal(SPICE.modelName('Zener Diode, 8.2 V', 'Diode'), 'ZENER');
    console.log('PASS - changed circuits, tiny voltage differences, missing/unsolved overrides and explicit zener models.');
} finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir); // Only the empty directory this test created; never recursive.
}
