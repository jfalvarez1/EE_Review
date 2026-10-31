#!/usr/bin/env node
'use strict';
// Independent public-data checks; no solver installation is needed for CI.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/data/placement-study');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
for (const [name, record] of Object.entries(manifest.files)) {
    assert(/^(docs\/data|assets\/figures)\/placement-study\//.test(name) && !name.split('/').includes('..'));
    const bytes = fs.readFileSync(path.join(root, name));
    assert.strictEqual(bytes.length, record.bytes, name);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256, name);
}
const csv = name => fs.readFileSync(path.join(dir, name), 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(',').map(Number));
const close = (a, b, limit, label) => assert(Math.abs(a - b) <= limit, `${label}: ${a} vs ${b}`);
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const inv = a => { const q = a[0] ** 2 + a[1] ** 2; return [a[0] / q, -a[1] / q]; };
for (const [name, record] of Object.entries(manifest.cases)) {
    const fit = record.fit;
    assert(fit.rdc > 0 && fit.linf > 0 && fit.branches.every(b => b.r > 0 && b.l > 0));
    const ac = csv(name + '-ac.csv');
    assert.strictEqual(ac.length, 1001);
    for (const [f, real, imaginary, magnitude] of ac) {
        const w = 2 * Math.PI * f;
        let copper = [fit.rdc, w * fit.linf];
        for (const b of fit.branches) {
            const x = w * b.l;
            copper = add(copper, [b.r * x * x / (b.r * b.r + x * x), b.r * b.r * x / (b.r * b.r + x * x)]);
        }
        const cap = add(copper, [.01, w * .3e-9 - 1 / (w * 10e-6)]);
        const expected = inv(add(inv(cap), inv([.02, w * 20e-9])));
        close(real, expected[0], 1e-7 * Math.hypot(...expected), name + ' AC real');
        close(imaginary, expected[1], 1e-7 * Math.hypot(...expected), name + ' AC imaginary');
        close(magnitude, Math.hypot(real, imaginary), 1e-10, name + ' magnitude');
    }
    const transient = csv(name + '-transient.csv');
    let last = -1;
    const edge = (t, start) => t <= start ? 0 : t >= start + 1e-7 ? 1 : (1 - Math.cos(Math.PI * (t - start) / 1e-7)) / 2;
    for (const [t, voltage, current] of transient) {
        assert([t, voltage, current].every(Number.isFinite) && t > last, name + ' transient order');
        last = t;
        close(current, 2 * (edge(t, 2e-6) - edge(t, 7e-6)), 1e-8, name + ' load stimulus');
    }
    close(Math.min(...transient.map(r => r[1])), record.minimum_V, 1e-10, name + ' minimum');
    close(Math.max(...transient.map(r => r[1])), record.maximum_V, 1e-10, name + ' maximum');
    close(transient[0][1], 1, 1e-9, name + ' initial voltage');
    close(transient.at(-1)[0], 12e-6, 1e-15, name + ' end time');
    assert(record.mesh_max_complex_relative_change < .03);
    assert(record.fit.max_complex_relative_error < .01);
    assert(record.port_max_complex_relative_error < .015);
    assert(record.timestep_max_difference_V < .001);
    assert(record.independent_transient_max_difference_V < .001);
    const copper = csv(name + '-copper.csv');
    assert.strictEqual(copper.length, 41);
    for (const row of copper) {
        assert(row.every(Number.isFinite) && row[1] > 0);
        close(row[1], row[3] + row[9] - row[5] - row[7], 2e-11, name + ' loop resistance');
        close(row[2], row[4] + row[10] - row[6] - row[8], 2e-11, name + ' loop reactance');
    }
}
console.log('PASS - five placement datasets: hashes, field matrices, passive fits, AC circuit and load-pulse metrics');
